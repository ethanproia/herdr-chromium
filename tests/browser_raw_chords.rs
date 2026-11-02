//! Raw chords (a remote-desktop block): with the block's raw_chords on, Cmd+A and Cmd+Z reach the
//! page as keydown events (metaKey) instead of edit commands; with it off they are edits (select
//! all, undo); copy and paste stay edit commands either way and still reach the page. Real CEF.
include!("common/browser_harness.rs");

use harness::{Host, Page};
use std::time::Duration;

fn log(p: &mut Page) -> Vec<String> {
    p.eval("log").unwrap().as_array().unwrap().iter().map(|v| v.as_str().unwrap_or("").to_owned()).collect()
}

fn set_raw(p: &mut Page, on: bool) {
    let v = p.view.clone();
    p.cx.update(|cx| v.update(cx, |v, cx| {
        let mut b = v.block().clone();
        b.raw_chords = on;
        v.set_block(b, cx);
    }));
}

fn round(p: &mut Page, raw: bool) {
    set_raw(p, raw);
    let r = p.eval("rect('t')").unwrap();
    p.click(r["x"].as_f64().unwrap() as f32, r["y"].as_f64().unwrap() as f32);
    p.eval("(()=>{const t=document.getElementById('t'); t.value='hello world'; t.focus(); t.setSelectionRange(11,11); log.length=0; return true})()").unwrap();
    p.key("cmd-a");
    p.run_for(Duration::from_millis(300));
    let sel = p.eval("sel()").unwrap();
    // An edit to undo: typed text (the page's own undo stack).
    p.text("!");
    p.run_for(Duration::from_millis(200));
    p.key("cmd-z");
    p.key("cmd-c");
    p.key("cmd-v");
    p.run_for(Duration::from_millis(600));
    let l = log(p);
    let saw = |s: &str| l.iter().any(|e| e == s);
    println!("raw_chords {raw}: log {l:?}, selection after Cmd+A {sel}");
    if raw {
        assert!(saw("keydown:a:true"), "Cmd+A reaches the page as a key: {l:?}");
        assert!(saw("keydown:z:true"), "Cmd+Z reaches the page as a key: {l:?}");
        assert!(!saw("input:historyUndo"), "no undo edit was run: {l:?}");
        assert_eq!(sel[0].as_i64(), Some(11), "no select-all edit was run: {sel}");
    } else {
        assert!(!saw("keydown:a:true") && !saw("keydown:z:true"), "Cmd+A/Z are edits, not keys: {l:?}");
        assert_eq!((sel[0].as_i64(), sel[1].as_i64()), (Some(0), Some(11)), "Cmd+A selected all: {sel}");
        assert!(saw("input:historyUndo"), "Cmd+Z ran undo: {l:?}");
    }
    // Either way copy and paste are edit commands that reach the page (cancelled there).
    assert!(saw("copy") && saw("paste"), "copy and paste reach the page: {l:?}");
    assert!(!saw("keydown:c:true") && !saw("keydown:v:true"), "copy and paste are not raw keys: {l:?}");
}

/// What the app sends (stub host echoes it): raw Key events for Cmd+A/Z with raw chords on, Edit commands off.
fn stub(server: &fixtures::Server) {
    let Some(mut p) = Page::open(Host::Stub, &server.url("keys.html")) else { return };
    p.focus();
    for raw in [true, false] {
        set_raw(&mut p, raw);
        let n = p.console().len();
        p.key("cmd-a");
        p.key("cmd-c");
        p.run_for(Duration::from_millis(300));
        let l: Vec<String> = p.console()[n..].to_vec();
        let key_a = l.iter().any(|e| e.contains(r#""type":"key""#) && e.contains(r#""key":"a""#) && e.contains(r#""platform":true"#));
        let edit_all = l.iter().any(|e| e.contains("edit select_all"));
        let edit_copy = l.iter().any(|e| e.contains("edit copy"));
        println!("stub raw_chords {raw}: key a {key_a}, edit select_all {edit_all}, edit copy {edit_copy}");
        assert_eq!((key_a, edit_all, edit_copy), (raw, !raw, true));
    }
}

fn main() {
    let server = fixtures::Server::start();
    stub(server);
    let Some(mut p) = Page::open(Host::Cef, &server.url("keys.html")) else { return };
    p.focus();
    round(&mut p, true);
    round(&mut p, false);
    println!("raw chords passed (CEF): Cmd+A/Z raw with raw_chords on, edits with it off; copy and paste edits both ways");
}
