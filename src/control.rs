//! `herdr-app do <command> [--arg value ... | json]`, `herdr-app ls`, `herdr-app commands`
//! and `herdr-app status`: drive a running window from a shell (agents, tests)
//! over `$HERDR_APP_HOME/herdr-app.sock`, one JSON line each way.

use crate::mods::{self, Request};
use serde_json::{Value, json};
use std::io::{BufRead, BufReader, Write};
#[cfg(unix)]
use std::os::unix::net::{UnixListener, UnixStream};
#[cfg(windows)]
use uds_windows::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::time::Duration;

fn socket() -> PathBuf {
    mods::app_dir().join("herdr-app.sock")
}

/// Serves the socket for this window. A live socket means another window owns this home.
pub fn listen(tx: async_channel::Sender<Request>) {
    let path = socket();
    if UnixStream::connect(&path).is_ok() {
        tracing::warn!("another Herdr is serving {}; `herdr-app do` goes there", path.display());
        return;
    }
    let _ = std::fs::remove_file(&path);
    let listener = match UnixListener::bind(&path) {
        Ok(l) => l,
        Err(e) => return tracing::warn!("cannot serve {}: {e}", path.display()),
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    let _ = std::thread::Builder::new().name("herdr-app-control".into()).spawn(move || {
        for stream in listener.incoming().flatten() {
            #[cfg(unix)]
            if !same_user(&stream) {
                tracing::warn!("control socket: refused a connection from another user");
                continue;
            }
            let tx = tx.clone();
            std::thread::spawn(move || serve(stream, tx));
        }
    });
}

/// HERDR: the socket drives the whole window (terminals, browsers): only this user may connect.
#[cfg(unix)]
fn same_user(stream: &UnixStream) -> bool {
    peer_uid(stream).is_some_and(|uid| uid == unsafe { libc::geteuid() })
}

#[cfg(target_os = "macos")]
fn peer_uid(stream: &UnixStream) -> Option<u32> {
    use std::os::fd::AsRawFd;
    let (mut uid, mut gid) = (0, 0);
    // SAFETY: a connected socket fd and two out-params.
    (unsafe { libc::getpeereid(stream.as_raw_fd(), &mut uid, &mut gid) } == 0).then_some(uid)
}

#[cfg(target_os = "linux")]
fn peer_uid(stream: &UnixStream) -> Option<u32> {
    use std::os::fd::AsRawFd;
    let mut cred = libc::ucred { pid: 0, uid: 0, gid: 0 };
    let mut len = std::mem::size_of::<libc::ucred>() as libc::socklen_t;
    // SAFETY: SO_PEERCRED fills a ucred of the given length on a connected unix socket.
    let ok = unsafe { libc::getsockopt(stream.as_raw_fd(), libc::SOL_SOCKET, libc::SO_PEERCRED, (&mut cred as *mut libc::ucred).cast(), &mut len) } == 0;
    ok.then_some(cred.uid)
}

#[cfg(all(unix, not(any(target_os = "macos", target_os = "linux"))))]
fn peer_uid(_: &UnixStream) -> Option<u32> {
    None
}

fn serve(stream: UnixStream, tx: async_channel::Sender<Request>) {
    let mut line = String::new();
    if BufReader::new(&stream).read_line(&mut line).is_err() {
        return;
    }
    let reply = match serde_json::from_str::<Value>(&line) {
        Ok(cmd) => {
            // HERDR: browser block. Commands the browser host answers wait on it: a page
            // screenshot or script gets the 30 s a window shot gets; a new page's first load 15 s.
            let browser = cmd.get("do").and_then(Value::as_str).filter(|n| n.starts_with("browser."));
            let waits_for_person = browser == Some("browser.pick")
                || (browser == Some("browser.annotations") && cmd.pointer("/args/wait").and_then(Value::as_bool) == Some(true));
            let timeout = Duration::from_secs(match browser {
                // The person picks or sends when they're ready; the agent side drops the waiter at the same bound.
                _ if waits_for_person => crate::browser::agent::PERSON_WAIT.as_secs(),
                Some("browser.screenshot" | "browser.eval") => 30,
                Some("browser.find" | "browser.open") => 15,
                _ if cmd.get("shot").is_some() => 30,
                _ => 5,
            });
            let (reply_tx, reply_rx) = std::sync::mpsc::channel();
            let _ = tx.send_blocking(Request::Control { cmd, reply: reply_tx });
            reply_rx.recv_timeout(timeout).unwrap_or_else(|_| json!({ "error": "the window did not answer" }))
        }
        Err(e) => json!({ "error": format!("bad request: {e}") }),
    };
    let _ = (&stream).write_all(format!("{reply}\n").as_bytes());
}

// HERDR: out-of-sight mode for forks and tests: no shown window, no focus, no activation.
pub fn headless() -> bool {
    std::env::var("HERDR_APP_HEADLESS").is_ok_and(|v| v == "1")
}

// HERDR: a window serves this home, without raising it.
pub fn running() -> bool {
    UnixStream::connect(socket()).is_ok()
}

/// One Herdr per home: a second launch brings the running window to the
/// front and quits. True when one is running (even one too busy to answer:
/// a second window would ring every alert twice).
pub fn raise_running() -> bool {
    raise_running_at(&socket())
}

fn raise_running_at(path: &std::path::Path) -> bool {
    let Ok(mut stream) = UnixStream::connect(path) else { return false };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    if stream.write_all(format!("{}\n", json!({ "raise": true })).as_bytes()).is_ok() {
        let _ = BufReader::new(&stream).read_line(&mut String::new());
    }
    true
}

/// The client side; returns the process exit code.
pub fn client(args: &[String]) -> i32 {
    if args == ["commands"] {
        println!("{}", serde_json::to_string_pretty(&crate::commands::listing()).unwrap());
        return 0;
    }
    // HERDR: `render --layout <file.json> --out <file.png>`: set the layout, then shoot.
    if let [verb, a, layout, b, out] = args
        && verb == "render" && a == "--layout" && b == "--out"
    {
        return render(layout, out);
    }
    let cmd = match args {
        [verb, rest @ ..] if verb == "shot" && rest.len() <= 1 => {
            let path = PathBuf::from(rest.first().map(String::as_str).unwrap_or("herdr-shot.png"));
            let path = match std::path::absolute(path) {
                Ok(path) => path,
                Err(e) => return fail(&format!("cannot resolve screenshot path: {e}")),
            };
            if path.extension().is_none_or(|ext| !ext.eq_ignore_ascii_case("png")) {
                return fail("screenshot path must end in .png");
            }
            json!({ "shot": path })
        },
        [verb] if verb == "status" => json!({ "status": true }),
        [verb] if verb == "ls" => json!({ "ls": true }),
        [verb, message] if verb == "feedback" => json!({ "do": "app.feedback", "args": { "message": message, "from": "agent" } }),
        [verb, command, rest @ ..] if verb == "do" => match parse_args(rest) {
            Ok(a) => json!({ "do": command, "args": a }),
            Err(e) => return fail(&e),
        },
        _ => return fail("usage: herdr-app ls | herdr-app commands | herdr-app status | herdr-app shot [file.png] | herdr-app render --layout <file.json> --out <file.png> | herdr-app do <command> [--arg value ... | json]"),
    };
    let mut stream = match UnixStream::connect(socket()) {
        Ok(s) => s,
        Err(_) if args.first().is_some_and(|v| v == "feedback") => {
            let body = crate::feedback::draft(&args[1], "", 0, "agent", "other");
            println!("{}", serde_json::to_string_pretty(&body).unwrap_or_default());
            eprintln!("Herdr must be open to review and send this feedback. Nothing was sent; core version and layout will reflect the open window.");
            return 1;
        }
        Err(e) => return fail(&format!("no Herdr window at {}: {e}", socket().display())),
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(35)));
    let mut line = String::new();
    if stream.write_all(format!("{cmd}\n").as_bytes()).is_err() || BufReader::new(&stream).read_line(&mut line).is_err() {
        return fail("the window hung up");
    }
    let reply: Value = serde_json::from_str(&line).unwrap_or(Value::Null);
    if args.first().is_some_and(|v| v == "shot") {
        if let Some(error) = reply.get("error") {
            return fail(error.as_str().unwrap_or("screenshot failed"));
        }
        let Some(path) = reply.get("path").and_then(Value::as_str) else {
            return fail("the window returned no screenshot path");
        };
        println!("{path}");
    } else {
        println!("{}", serde_json::to_string_pretty(&reply).unwrap_or_default());
    }
    if reply.get("error").is_some() { 1 } else { 0 }
}

// HERDR: the render verb, against the (headless) window on this home.
fn render(layout: &str, out: &str) -> i32 {
    let tree: Value = match std::fs::read_to_string(layout).map_err(|e| e.to_string()).and_then(|t| serde_json::from_str(&t).map_err(|e| e.to_string())) {
        Ok(v) => v,
        Err(e) => return fail(&format!("cannot read layout {layout}: {e}")),
    };
    // A personal layout in this home, so its whole tree applies (layout.set keeps shipped structure).
    let dir = mods::app_dir().join("layouts");
    if let Err(e) = std::fs::create_dir_all(&dir).and_then(|()| std::fs::write(dir.join("render.json"), tree.to_string())) {
        return fail(&format!("cannot write {}: {e}", dir.display()));
    }
    let shown = client(&["do".into(), "layout.switch".into(), "--name".into(), "render".into()]);
    if shown != 0 {
        return shown;
    }
    // Let the new layout paint before the shot.
    std::thread::sleep(Duration::from_millis(500));
    client(&["shot".into(), out.into()])
}

/// `--name api --argv '["pi"]'` (values that parse as JSON are JSON), or one JSON object.
fn parse_args(rest: &[String]) -> Result<Value, String> {
    match rest {
        [] => Ok(Value::Null),
        [raw] if raw.trim_start().starts_with('{') => serde_json::from_str(raw).map_err(|e| format!("args are not JSON: {e}")),
        _ => {
            let mut out = serde_json::Map::new();
            let mut it = rest.iter();
            while let Some(flag) = it.next() {
                let key = flag.strip_prefix("--").ok_or_else(|| format!("expected --<arg>, got {flag:?}"))?;
                let value = it.next().ok_or_else(|| format!("--{key} needs a value"))?;
                let v = serde_json::from_str::<Value>(value).ok().filter(|v| !v.is_string()).unwrap_or_else(|| Value::String(value.clone()));
                out.insert(key.to_owned(), v);
            }
            Ok(Value::Object(out))
        }
    }
}

/// Draws the window with sensitive browser pages covered, saves it, then draws it normally again.
pub fn masked_shot(window: &mut gpui::Window, cx: &mut gpui::App, path: &std::path::Path) -> anyhow::Result<()> {
    use std::sync::atomic::Ordering::SeqCst;
    crate::browser::view::SHOT_MASK.store(true, SeqCst);
    window.refresh();
    window.draw(cx).clear(cx);
    let r = save_shot(window, path);
    crate::browser::view::SHOT_MASK.store(false, SeqCst);
    window.refresh();
    r
}

/// Encode before opening the destination: GPU errors must not truncate a good shot. The file is
/// new and private (0600, created exclusively): an existing file is never replaced.
pub fn save_shot(window: &gpui::Window, path: &std::path::Path) -> anyhow::Result<()> {
    let image = window.render_to_image()?;
    let mut bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut bytes, image.width(), image.height());
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.set_source_srgb(png::SrgbRenderingIntent::Perceptual);
        encoder.write_header()?.write_image_data(image.as_raw())?;
    }
    write_new_private(path, &bytes)
}

/// Writes `bytes` to a file that must not exist yet (O_EXCL, 0600); a failed write removes it.
pub fn write_new_private(path: &std::path::Path, bytes: &[u8]) -> anyhow::Result<()> {
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    let mut file = options.open(path).map_err(|e| anyhow::anyhow!("{}: {e} (shots never replace a file)", path.display()))?;
    let result = (|| -> anyhow::Result<()> {
        file.write_all(bytes)?;
        file.sync_all()?;
        Ok(())
    })();
    if result.is_err() {
        drop(file);
        let _ = std::fs::remove_file(path);
    }
    result
}

fn fail(message: &str) -> i32 {
    eprintln!("herdr-app: {message}");
    2
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn a_shot_never_replaces_a_file_and_is_private() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("herdr-app-shot-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let fresh = dir.join("new.png");
        write_new_private(&fresh, b"png").unwrap();
        assert_eq!(std::fs::metadata(&fresh).unwrap().permissions().mode() & 0o777, 0o600);
        let precious = dir.join("notes.txt");
        std::fs::write(&precious, "keep me").unwrap();
        assert!(write_new_private(&precious, b"png").is_err());
        assert_eq!(std::fs::read_to_string(&precious).unwrap(), "keep me", "an existing file is untouched");
        // A symlink at the destination is not followed.
        let link = dir.join("link.png");
        std::os::unix::fs::symlink(&precious, &link).unwrap();
        assert!(write_new_private(&link, b"png").is_err());
        assert_eq!(std::fs::read_to_string(&precious).unwrap(), "keep me");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_second_launch_raises_the_running_window() {
        let dir = std::env::temp_dir().join(format!("herdr-app-raise-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("herdr-app.sock");
        // Nothing running: this launch opens its own window.
        assert!(!raise_running_at(&path));
        // One running: it gets asked to come to the front.
        let listener = UnixListener::bind(&path).unwrap();
        let asked = std::thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut line = String::new();
            BufReader::new(&stream).read_line(&mut line).unwrap();
            (&stream).write_all(b"{\"ok\":true}\n").unwrap();
            serde_json::from_str::<Value>(&line).unwrap()
        });
        assert!(raise_running_at(&path));
        assert_eq!(asked.join().unwrap(), json!({ "raise": true }));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
