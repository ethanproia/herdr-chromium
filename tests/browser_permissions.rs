//! Site permission prompts: a request shows the block's bar, the person allows or denies, a
//! remembered answer skips the bar for that origin and kind only, and queued prompts wait their
//! turn. Stub (scripted `?permission=` requests), then real CEF (a geolocation request denied).
include!("common/browser_harness.rs");

use harness::{Host, Page};
use std::time::Duration;

fn prompts(p: &mut Page) -> Vec<(String, Vec<String>)> {
    let v = p.view.clone();
    p.cx.update(|cx| v.read(cx).prompts())
}

fn answer(p: &mut Page, allow: bool, remember: bool) {
    let v = p.view.clone();
    p.cx.update(|cx| v.update(cx, |v, cx| {
        v.set_prompt_remember(remember, cx);
        v.answer_permission(allow, cx);
    }));
}

/// The stub echoes what the app sent it, so the answer can be read back.
fn answered(p: &mut Page, allow: bool) -> bool {
    let want = format!("\"allow\":{allow}");
    p.wait(Duration::from_secs(10), |p| p.console().iter().any(|l| l.contains("permission_result") && l.contains(&want)))
}

fn main() {
    let server = fixtures::Server::start();
    if let Some(mut p) = Page::open(Host::Stub, &server.url("scroll.html")) {
        let origin = server.url("").trim_end_matches('/').to_string();
        p.navigate(&server.url("scroll.html?permission=camera,microphone")).unwrap();
        assert!(p.wait(Duration::from_secs(10), |p| !prompts(p).is_empty()), "the bar shows");
        assert_eq!(prompts(&mut p), vec![(origin.clone(), vec!["camera".to_string(), "microphone".to_string()])]);
        answer(&mut p, false, false);
        assert!(answered(&mut p, false) && prompts(&mut p).is_empty(), "deny answers once and clears the bar");

        // Allow and remember: the next identical request is answered without a bar.
        p.navigate(&server.url("scroll.html?permission=camera")).unwrap();
        assert!(p.wait(Duration::from_secs(10), |p| !prompts(p).is_empty()));
        answer(&mut p, true, true);
        assert!(answered(&mut p, true));
        let stored = std::fs::read_to_string(p.dir.join("permissions.json")).unwrap();
        assert!(stored.contains("\"camera\": true"), "{stored}");
        p.navigate(&server.url("scroll.html?permission=camera&again")).unwrap();
        p.run_for(Duration::from_millis(500));
        assert!(prompts(&mut p).is_empty(), "a remembered camera answer skips the bar");

        // A new kind at the same origin still asks.
        p.navigate(&server.url("scroll.html?permission=geolocation")).unwrap();
        assert!(p.wait(Duration::from_secs(10), |p| !prompts(p).is_empty()), "another kind asks");
        // Leaving the page drops the waiting prompt.
        p.navigate(&server.url("scroll.html")).unwrap();
        assert!(p.wait(Duration::from_secs(10), |p| prompts(p).is_empty()), "navigating away clears it");
        println!("permissions (stub): ok");
    }
    if let Some(mut p) = Page::open(Host::Cef, &server.url("scroll.html")) {
        let origin = server.url("").trim_end_matches('/').to_string();
        p.eval("window.__geo = 'waiting'; navigator.geolocation.getCurrentPosition(() => window.__geo = 'allowed', e => window.__geo = 'denied ' + e.code); 1").unwrap();
        assert!(p.wait(Duration::from_secs(20), |p| !prompts(p).is_empty()), "a real geolocation request shows the bar");
        let (o, kinds) = prompts(&mut p)[0].clone();
        assert_eq!((o.trim_end_matches('/'), kinds), (origin.as_str(), vec!["geolocation".to_string()]), "CEF's requesting origin");
        answer(&mut p, false, false);
        let v = p.eval_until("window.__geo", Duration::from_secs(20), |v| v != "waiting");
        assert_eq!(v, "denied 1", "the page sees PERMISSION_DENIED");
        assert!(!p.dir.join("permissions.json").exists(), "nothing remembered without the box");
        println!("permissions (cef): ok");
    }
}
