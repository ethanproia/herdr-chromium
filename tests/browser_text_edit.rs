//! S13 inline text edit on the real CEF host: double-click a picked paragraph, type, Return saves
//! a text-edit pin and the page keeps the text; Esc puts the text back exactly; an element with
//! element children is refused with a hint. Offscreen; nothing opens a window.
include!("common/browser_harness.rs");

use browser::input::Owner;
use harness::{Host, Page};
use std::time::Duration;

fn rect(p: &mut Page, id: &str) -> (f32, f32) {
    let r: Vec<f32> = p.eval(&format!("(()=>{{const r=document.getElementById('{id}').getBoundingClientRect();return [r.x,r.y,r.width,r.height]}})()")).unwrap().as_array().unwrap().iter().map(|n| n.as_f64().unwrap() as f32).collect();
    (r[0] + r[2] / 2.0, r[1] + r[3] / 2.0)
}

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Cef, &server.url("select.html")) else { return };
    p.focus();
    let v = p.view.clone();
    let owner = |p: &mut Page| p.cx.update(|cx| p.view.read(cx).owner(cx));
    let text = |p: &mut Page, id: &str| p.eval(&format!("document.getElementById('{id}').textContent")).unwrap();

    // Save: double-click #drop, type, Return.
    p.cx.update(|cx| v.update(cx, |v, cx| v.toggle_mode(Owner::Pick, cx)));
    let (x, y) = rect(&mut p, "drop");
    p.double_click(x, y);
    assert!(p.wait(Duration::from_secs(10), |p| owner(p) == Owner::TextEdit), "editing: {:?}", owner(&mut p));
    assert_eq!(p.cx.update(|cx| v.read(cx).text_edit_hint()), Some("Return to save · Esc to cancel"));
    // Return right after typing: the host's commit must not read the text before the keys land.
    p.text("drop files here");
    p.key("enter");
    let pinned = p.wait(Duration::from_secs(10), |p| p.cx.update(|cx| p.view.read(cx).annotations().count()) == 1);
    let dom = text(&mut p, "drop");
    let editable = p.eval("document.getElementById('drop').getAttribute('contenteditable')").unwrap();
    assert!(pinned, "a text-edit pin; page text {dom:?}, contenteditable {editable:?}, owner {:?}, hint {:?}", owner(&mut p), p.cx.update(|cx| v.read(cx).text_edit_hint()));
    let pin = p.cx.update(|cx| v.read(cx).annotations().pending().next().cloned()).unwrap();
    let change = pin.text_edit.expect("the pin holds the change");
    assert_eq!((change.before.as_str(), change.after.as_str()), ("drop here", "drop files here"));
    assert_eq!(text(&mut p, "drop"), "drop files here", "the page keeps it until reload");
    assert_eq!(owner(&mut p), Owner::Pick, "back to picking");

    // Cancel: double-click #p, type, Esc puts it back exactly.
    let before = text(&mut p, "p");
    let (x, y) = rect(&mut p, "p");
    p.double_click(x, y);
    assert!(p.wait(Duration::from_secs(10), |p| owner(p) == Owner::TextEdit));
    p.text("gone");
    // The edit really changed the page before Esc (so the restore below proves something).
    assert!(p.wait(Duration::from_secs(5), |p| text(p, "p") != before), "typing changed the page first");
    p.key("escape");
    assert!(p.wait(Duration::from_secs(10), |p| text(p, "p") == before), "restored exactly");
    assert_eq!(owner(&mut p), Owner::Pick, "one Esc ends the edit, not design mode");
    assert_eq!(p.cx.update(|cx| v.read(cx).annotations().count()), 1, "no pin for a cancelled edit");

    // Refused: the body (element children) is not plain text.
    let (bx, by) = (rect(&mut p, "drop").0 + 300.0, rect(&mut p, "drop").1);
    p.double_click(bx, by);
    assert!(p.wait(Duration::from_secs(10), |p| p.cx.update(|cx| p.view.read(cx).text_edit_hint()) == Some("Only plain text can be edited here")), "refused with a hint");
    assert_ne!(owner(&mut p), Owner::TextEdit);
    println!("PASS browser_text_edit");
}
