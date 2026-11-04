//! Part 5: the CDP broker, the one door agents have to the browser (docs/browser-cdp-pipe.md).
//!
//! The host serves CDP only on a pipe the app holds (`cdp::CdpPipe`, no TCP port). This serves it to
//! agents on `$HERDR_APP_HOME/browser/agent.sock` (0600, in a 0700 dir) to callers that show the token in
//! `browser/broker.token` (0600). Clients name browser blocks, never targets or sessions: the broker
//! attaches one flatten session per block and refuses browser-level and profile methods outright.
//! The person's per-block grants are enforced here, in the app, on every call and every event
//! (`needs`, `Authorize`): Control to drive a block the person opened, Cdp for network events, Capture
//! for screenshots of a page marked sensitive. Methods outside `ALLOWED` are refused (default deny).
//! The agent tools (scripts/herdr-browser) add redaction on top but are not a trust source.
//!
//! Wire: newline JSON. First line `{"token": "..."}` (anything else closes the connection). Then
//! `{"id": n, "block": "<block id>", "method": "...", "params": {...}}`, answered
//! `{"id": n, "result": ...}` or `{"id": n, "error": "..."}`; events of every block the connection has
//! used arrive as `{"block": "...", "method": "...", "params": {...}}`.

use super::cdp::CdpPipe;
use herdr_browser_protocol::BrowserId;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Read, Write};
// HERDR: the agent socket is Unix-only; elsewhere the broker reports itself unsupported.
#[cfg(unix)]
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// The host's pipe now (a new one after a restart), if there is one.
pub type PipeNow = Arc<dyn Fn() -> Option<Arc<CdpPipe>> + Send + Sync>;
/// The CDP target that shows a block (from `HostToApp::CdpTarget`).
pub type TargetOf = Arc<dyn Fn(&str) -> Option<String> + Send + Sync>;
/// The app's grant check for (block, method): Err is the refusal the agent sees. Asked before every
/// call and before forwarding every event, so revoking a grant or closing the block stops both.
pub type Authorize = Arc<dyn Fn(&str, &str) -> Result<(), String> + Send + Sync>;

/// The methods agents may call at all (what the agent tools use); anything else is refused.
const ALLOWED: &[&str] = &[
    "Runtime.evaluate", "Runtime.callFunctionOn", "Runtime.getProperties", "Runtime.releaseObject", "Runtime.enable",
    "Page.captureScreenshot", "Page.getLayoutMetrics", "Page.getFrameTree", "Page.reload", "Page.navigate", "Page.enable",
    "Emulation.setDeviceMetricsOverride", "Emulation.clearDeviceMetricsOverride", "Emulation.setEmulatedMedia",
    "Target.getTargetInfo", "Input.dispatchMouseEvent", "Input.dispatchKeyEvent", "Input.dispatchTouchEvent", "Input.insertText",
    "Network.enable", "Network.disable",
];
/// Whole read-only inspection domains the agent tools use.
const ALLOWED_DOMAINS: &[&str] = &["DOM.", "CSS.", "Accessibility.", "Overlay.", "DOMSnapshot.", "Animation.", "Performance.", "Log.", "Debugger."];
/// Never, even inside an allowed domain: handing the page local files.
const NEVER: &[&str] = &["DOM.setFileInputFiles", "Page.setInterceptFileChooserDialog"];

/// What the person must have granted for the call `method` on a block they opened (agent-opened
/// blocks skip Control): Err when no grant allows it. Events are checked by `event_gate`.
pub fn needs(method: &str, sensitive: bool) -> Result<Vec<super::agent::Grant>, String> {
    use super::agent::Grant;
    if refused(method) || NEVER.contains(&method) {
        return Err(format!("{method} is not available to agents"));
    }
    if !(ALLOWED.contains(&method) || ALLOWED_DOMAINS.iter().any(|d| method.starts_with(d))) {
        return Err(format!("{method} is not available to agents"));
    }
    if method.starts_with("Network.") {
        // Network events carry request headers (cookies, tokens): raw CDP.
        return Ok(vec![Grant::Control, Grant::Cdp]);
    }
    if method == "Page.captureScreenshot" && sensitive {
        return Ok(vec![Grant::Control, Grant::Capture]);
    }
    Ok(vec![Grant::Control])
}

/// The call whose grants an event needs: network events as `Network.enable` (Cdp), the rest as
/// driving the page (Control).
pub fn event_gate(event: &str) -> &'static str {
    if event.starts_with("Network.") { "Network.enable" } else { "Runtime.evaluate" }
}

const CALL_TIMEOUT: Duration = Duration::from_secs(30);

/// Methods no agent gets through the broker, whatever its grants: other tabs and the browser itself
/// (`Target.*` but `getTargetInfo`, `Browser.*`), the profile (cookies, storage), the machine.
pub fn refused(method: &str) -> bool {
    const DOMAINS: &[&str] = &["Browser.", "Storage.", "SystemInfo.", "IO.", "Tethering.", "Memory.", "Cast.", "BackgroundService."];
    const METHODS: &[&str] = &[
        "Network.getAllCookies", "Network.getCookies", "Network.setCookie", "Network.setCookies", "Network.deleteCookies",
        "Network.clearBrowserCookies", "Network.clearBrowserCache", "Page.setDownloadBehavior",
    ];
    (method.starts_with("Target.") && method != "Target.getTargetInfo") || DOMAINS.iter().any(|d| method.starts_with(d)) || METHODS.contains(&method)
}

pub struct Broker {
    dir: PathBuf,
    token: String,
    pipe: PipeNow,
    target_of: TargetOf,
    authorize: Authorize,
    /// block -> (target, session, the pipe it was attached on)
    sessions: Mutex<HashMap<BrowserId, (String, String, usize)>>,
}

impl Broker {
    pub fn socket(dir: &Path) -> PathBuf {
        dir.join("agent.sock")
    }

    pub fn token_file(dir: &Path) -> PathBuf {
        dir.join("broker.token")
    }

    /// No agent socket off Unix (HERDR: keeps non-mac builds compiling).
    #[cfg(not(unix))]
    pub fn start(_dir: PathBuf, _pipe: PipeNow, _target_of: TargetOf, _authorize: Authorize) -> std::io::Result<Arc<Broker>> {
        Err(std::io::Error::new(std::io::ErrorKind::Unsupported, "the browser broker needs a Unix socket"))
    }

    /// Writes a fresh token, binds the socket (owner-only) and serves it on a thread.
    #[cfg(unix)]
    pub fn start(dir: PathBuf, pipe: PipeNow, target_of: TargetOf, authorize: Authorize) -> std::io::Result<Arc<Broker>> {
        use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt, PermissionsExt};
        std::fs::DirBuilder::new().recursive(true).mode(0o700).create(&dir)?;
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700))?;
        let mut raw = [0u8; 32];
        std::fs::File::open("/dev/urandom")?.read_exact(&mut raw)?;
        let token: String = raw.iter().map(|b| format!("{b:02x}")).collect();
        let token_file = Self::token_file(&dir);
        let _ = std::fs::remove_file(&token_file);
        std::fs::OpenOptions::new().write(true).create_new(true).mode(0o600).open(&token_file)?.write_all(token.as_bytes())?;
        let sock = Self::socket(&dir);
        let _ = std::fs::remove_file(&sock);
        let listener = UnixListener::bind(&sock)?;
        std::fs::set_permissions(&sock, std::fs::Permissions::from_mode(0o600))?;
        let broker = Arc::new(Broker { dir, token, pipe, target_of, authorize, sessions: Mutex::new(HashMap::new()) });
        let b = broker.clone();
        std::thread::Builder::new().name("herdr-browser-broker".into()).spawn(move || {
            for stream in listener.incoming().flatten() {
                let b = b.clone();
                std::thread::spawn(move || b.serve(stream));
            }
        })?;
        Ok(broker)
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    #[cfg(unix)]
    fn serve(self: Arc<Self>, stream: UnixStream) {
        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let mut lines = BufReader::new(match stream.try_clone() {
            Ok(s) => s,
            Err(_) => return,
        });
        let mut first = String::new();
        if lines.read_line(&mut first).is_err() || !self.authorized(&first) {
            return; // dropped: no reply, nothing learned
        }
        let _ = stream.set_read_timeout(None);
        let out = Arc::new(Mutex::new(stream));
        let watched: Arc<Mutex<HashSet<String>>> = Default::default();
        for line in lines.lines() {
            let Ok(line) = line else { break };
            let Ok(req) = serde_json::from_str::<Value>(&line) else { break };
            let (b, out, watched) = (self.clone(), out.clone(), watched.clone());
            std::thread::spawn(move || {
                let answer = b.call(&req, &out, &watched);
                send(&out, &match answer {
                    Ok(result) => json!({ "id": req["id"], "result": result }),
                    Err(error) => json!({ "id": req["id"], "error": error }),
                });
            });
        }
    }

    fn authorized(&self, line: &str) -> bool {
        let got = serde_json::from_str::<Value>(line).ok().and_then(|v| v["token"].as_str().map(str::to_owned)).unwrap_or_default();
        // Constant time over the token's length.
        got.len() == self.token.len() && got.bytes().zip(self.token.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
    }

    #[cfg(unix)]
    fn call(&self, req: &Value, out: &Arc<Mutex<UnixStream>>, watched: &Arc<Mutex<HashSet<String>>>) -> Result<Value, String> {
        let method = req["method"].as_str().ok_or("no method")?;
        if refused(method) {
            return Err(format!("{method} is not available to agents"));
        }
        let block = req["block"].as_str().ok_or("no block")?;
        // The person's grants, checked in the app before anything reaches the page.
        (self.authorize)(block, method)?;
        let pipe = (self.pipe)().filter(|p| !p.is_dead()).ok_or("no browser host is running")?;
        let session = self.session(block, &pipe)?;
        // The first use of a block on this connection: its events follow.
        if watched.lock().unwrap().insert(block.to_owned()) {
            let (rx, out, block) = (pipe.subscribe(Some(&session)), out.clone(), block.to_owned());
            let (authorize, watched) = (self.authorize.clone(), watched.clone());
            std::thread::spawn(move || {
                for ev in rx {
                    let method = ev["method"].as_str().unwrap_or("");
                    match authorize(&block, event_gate(method)) {
                        Ok(()) => {}
                        // This event's class isn't granted (network without Cdp): skip it.
                        Err(_) if authorize(&block, "Runtime.evaluate").is_ok() => continue,
                        // Control revoked or the block closed: this connection stops hearing it.
                        Err(_) => break,
                    }
                    if !send(&out, &json!({ "block": block, "method": ev["method"], "params": ev["params"] })) {
                        break;
                    }
                }
                watched.lock().unwrap().remove(&block);
            });
        }
        pipe.call(Some(&session), method, req["params"].clone(), CALL_TIMEOUT)
    }

    /// The block's flatten session on this pipe, attaching once (again after a restart or a new target).
    fn session(&self, block: &str, pipe: &Arc<CdpPipe>) -> Result<String, String> {
        let target = (self.target_of)(block).ok_or_else(|| format!("no browser block {block:?}"))?;
        let key = Arc::as_ptr(pipe) as usize;
        if let Some((t, s, p)) = self.sessions.lock().unwrap().get(block)
            && *t == target
            && *p == key
        {
            return Ok(s.clone());
        }
        let r = pipe.call(None, "Target.attachToTarget", json!({ "targetId": target, "flatten": true }), CALL_TIMEOUT)?;
        let session = r["sessionId"].as_str().ok_or("attach gave no session")?.to_owned();
        self.sessions.lock().unwrap().insert(block.to_owned(), (target, session.clone(), key));
        Ok(session)
    }
}

#[cfg(unix)]
fn send(out: &Arc<Mutex<UnixStream>>, msg: &Value) -> bool {
    let mut line = msg.to_string();
    line.push('\n');
    out.lock().unwrap().write_all(line.as_bytes()).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn browser_level_and_profile_methods_are_refused() {
        for m in ["Target.createTarget", "Target.attachToTarget", "Browser.close", "Storage.getCookies", "Network.getAllCookies", "Network.setCookie", "SystemInfo.getInfo", "IO.read"] {
            assert!(refused(m), "{m}");
        }
        for m in ["Runtime.evaluate", "Page.navigate", "Page.captureScreenshot", "DOM.getDocument", "Input.dispatchMouseEvent", "Target.getTargetInfo", "Network.enable"] {
            assert!(!refused(m), "{m}");
        }
    }

    #[test]
    fn the_method_table_defaults_to_deny() {
        use crate::browser::agent::Grant::*;
        assert_eq!(needs("Runtime.evaluate", false), Ok(vec![Control]));
        assert_eq!(needs("Input.dispatchKeyEvent", false), Ok(vec![Control]));
        assert_eq!(needs("Page.captureScreenshot", false), Ok(vec![Control]));
        assert_eq!(needs("Page.captureScreenshot", true), Ok(vec![Control, Capture]));
        assert_eq!(needs("Network.enable", false), Ok(vec![Control, Cdp]));
        assert_eq!(needs(event_gate("Network.requestWillBeSent"), false), Ok(vec![Control, Cdp]), "network events need Cdp");
        assert_eq!(needs(event_gate("Page.loadEventFired"), false), Ok(vec![Control]));
        for m in ["DOM.setFileInputFiles", "Page.setInterceptFileChooserDialog", "Fetch.enable", "Page.printToPDF", "Runtime.compileScript", "Network.getResponseBody", "Security.setIgnoreCertificateErrors", "Storage.getCookies", "Target.createTarget"] {
            assert!(needs(m, false).is_err(), "{m} must be refused");
        }
    }

    /// The real app gate over agent.sock with a real token: a block the person opened, every shield
    /// toggle off, refuses eval, input, screenshots and network subscription; the same block with
    /// Control on gets through to the (absent) host; an agent-opened block needs no Control.
    #[cfg(unix)]
    #[test]
    fn a_persons_block_with_grants_off_refuses_everything_through_the_socket() {
        use crate::browser::agent::{Agent, Grant};
        use crate::browser::BrowserState;
        let dir = PathBuf::from(format!("/tmp/hbg-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let agent = Arc::new(Mutex::new(Agent::new(dir.clone())));
        let states: Arc<Mutex<HashMap<BrowserId, BrowserState>>> = Default::default();
        states.lock().unwrap().insert("mine".into(), BrowserState { profile: "default".into(), ..Default::default() });
        states.lock().unwrap().insert("theirs".into(), BrowserState { profile: "agent".into(), ..Default::default() });
        let auth = crate::browser::view::broker_authorizer(agent.clone(), states.clone());
        let b = Broker::start(dir.clone(), Arc::new(|| None), Arc::new(|_| Some("T".into())), auth).unwrap();
        let token = std::fs::read_to_string(Broker::token_file(&dir)).unwrap();
        let mut s = UnixStream::connect(Broker::socket(&dir)).unwrap();
        line(&mut s, json!({ "token": token }));
        let ask = |s: &mut UnixStream, id: u64, block: &str, method: &str| {
            line(s, json!({ "id": id, "block": block, "method": method, "params": {} }));
            read(s).unwrap()["error"].as_str().unwrap_or("").to_string()
        };
        for (i, m) in ["Runtime.evaluate", "Input.dispatchMouseEvent", "Input.insertText", "Page.captureScreenshot", "Network.enable", "Page.enable", "DOM.getDocument"].iter().enumerate() {
            let e = ask(&mut s, i as u64, "mine", m);
            assert!(e.contains("hasn't allowed agents to drive"), "{m}: {e}");
        }
        // An unknown block (closed, or never there) is refused, not passed through.
        assert!(ask(&mut s, 20, "gone", "Runtime.evaluate").contains("no browser block"));
        // Control on: drive passes the gate (and only then meets the absent host); network still needs Cdp.
        agent.lock().unwrap().grants.set(&"mine".into(), Grant::Control, true);
        assert_eq!(ask(&mut s, 21, "mine", "Runtime.evaluate"), "no browser host is running");
        assert!(ask(&mut s, 22, "mine", "Network.enable").contains("raw CDP"));
        // Sensitive: a screenshot needs Capture too.
        agent.lock().unwrap().grants.set(&"mine".into(), Grant::Sensitive, true);
        assert!(ask(&mut s, 23, "mine", "Page.captureScreenshot").contains("sensitive"));
        // Revoked: refused again at once.
        agent.lock().unwrap().grants.set(&"mine".into(), Grant::Control, false);
        assert!(ask(&mut s, 24, "mine", "Runtime.evaluate").contains("hasn't allowed"));
        // The agent's own block needs no Control, but file upload is never allowed.
        assert_eq!(ask(&mut s, 25, "theirs", "Runtime.evaluate"), "no browser host is running");
        assert!(ask(&mut s, 26, "theirs", "DOM.setFileInputFiles").contains("not available"));
        // A popup answers to its opener: the person's popup needs the person's grants on the
        // opener (it has none of its own), an agent popup is the agent's.
        states.lock().unwrap().insert("mine-pop1".into(), BrowserState { profile: "default".into(), opener: Some("mine".into()), ..Default::default() });
        states.lock().unwrap().insert("theirs-pop1".into(), BrowserState { profile: "default".into(), opener: Some("theirs".into()), ..Default::default() });
        assert!(ask(&mut s, 40, "mine-pop1", "Runtime.evaluate").contains("hasn't allowed"), "the person's popup with Control off");
        agent.lock().unwrap().grants.set(&"mine-pop1".into(), Grant::Control, true);
        assert!(ask(&mut s, 41, "mine-pop1", "Runtime.evaluate").contains("hasn't allowed"), "a grant on the popup id itself doesn't count");
        assert_eq!(ask(&mut s, 42, "theirs-pop1", "Runtime.evaluate"), "no browser host is running", "an agent's popup is the agent's");
        assert!(ask(&mut s, 43, "theirs-pop1", "DOM.setFileInputFiles").contains("not available"));
        // The agent's own block holds only its own traffic: network needs no Cdp there.
        assert_eq!(ask(&mut s, 27, "theirs", "Network.enable"), "no browser host is running");
        // Only the exact "agent" profile: padded, other-case or the person's still need Control and Cdp.
        for (i, p) in [" agent", "AGENT", "default", "agent "].iter().enumerate() {
            let id = format!("odd{i}");
            states.lock().unwrap().insert(id.clone(), BrowserState { profile: p.to_string(), ..Default::default() });
            agent.lock().unwrap().grants.set(&id, Grant::Control, true);
            let e = ask(&mut s, 30 + i as u64, &id, "Network.enable");
            assert!(e.contains("raw CDP"), "profile {p:?}: {e}");
        }
        drop(b);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    fn line(s: &mut UnixStream, v: Value) {
        s.write_all(format!("{v}\n").as_bytes()).unwrap();
    }

    #[cfg(unix)]
    fn read(s: &UnixStream) -> Option<Value> {
        let mut l = String::new();
        BufReader::new(s.try_clone().unwrap()).read_line(&mut l).ok()?;
        serde_json::from_str(&l).ok()
    }

    #[cfg(unix)]
    #[test]
    fn the_socket_needs_the_token_and_is_private() {
        use std::os::unix::fs::PermissionsExt;
        // Short: macOS caps socket paths at 103 bytes.
        let dir = PathBuf::from(format!("/tmp/hbb-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let b = Broker::start(dir.clone(), Arc::new(|| None), Arc::new(|_| Some("T".into())), Arc::new(|_, _| Ok(()))).unwrap();
        let mode = |p: &Path| std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
        assert_eq!((mode(&dir), mode(&Broker::socket(&dir)), mode(&Broker::token_file(&dir))), (0o700, 0o600, 0o600));
        let token = std::fs::read_to_string(Broker::token_file(&dir)).unwrap();
        assert_eq!(token.len(), 64);
        // No token, a wrong one, or a websocket upgrade: the connection closes without a reply.
        for first in ["{}".to_string(), json!({ "token": "0".repeat(64) }).to_string(), "GET / HTTP/1.1".to_string()] {
            let mut s = UnixStream::connect(Broker::socket(&dir)).unwrap();
            s.write_all(format!("{first}\nUpgrade: websocket\n\n{}\n", json!({ "id": 1, "block": "b1", "method": "Runtime.evaluate" })).as_bytes()).unwrap();
            assert_eq!(read(&s), None, "refused: {first}");
        }
        // With the token: answered (no host yet), and refused methods never reach a host.
        let mut s = UnixStream::connect(Broker::socket(&dir)).unwrap();
        line(&mut s, json!({ "token": token }));
        line(&mut s, json!({ "id": 7, "block": "b1", "method": "Runtime.evaluate", "params": {} }));
        assert_eq!(read(&s), Some(json!({ "id": 7, "error": "no browser host is running" })));
        line(&mut s, json!({ "id": 8, "block": "b1", "method": "Storage.getCookies", "params": {} }));
        assert_eq!(read(&s), Some(json!({ "id": 8, "error": "Storage.getCookies is not available to agents" })));
        drop(b);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
