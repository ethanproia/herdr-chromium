//! S27 addressed Send on the real CEF host: two pins sent to two agents while both screenshots
//! are in flight; each batch lands in its own agent's inbox only (note.md fenced, batch.json,
//! picture), nothing reaches the global pull path, and the agent's read is recorded for the chip. Nothing is typed into any pane.
include!("common/browser_harness.rs");

use browser::handoff::Recipient;
use browser::input::Owner;
use browser::send_to::Candidate;
use browser::view::BrowserEvent;
use harness::{Host, Page};
use std::time::Duration;

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Cef, &server.url("select.html")) else { return };
    p.focus();
    let v = p.view.clone();
    let rr: Vec<f32> = p.eval("(()=>{const r=document.getElementById('drop').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()").unwrap().as_array().unwrap().iter().map(|n| n.as_f64().unwrap() as f32).collect();
    p.cx.update(|cx| v.update(cx, |v, cx| v.set_comment_on_pick(true, cx)));
    p.cx.update(|cx| v.update(cx, |v, cx| v.toggle_mode(Owner::Pick, cx)));
    p.click(rr[0] + rr[2] / 2.0, rr[1] + rr[3] / 2.0);
    assert!(p.wait(Duration::from_secs(10), |p| p.cx.update(|cx| p.view.read(cx).comment_target().is_some())));
    p.text("drop zone too small");
    p.key("enter");

    let agent = |t: &str| Candidate { to: Recipient { terminal: t.into(), name: "Claude Code".into() }, word: Some("idle".into()) };
    let send = |p: &mut Page, t: &str| {
        let v = p.view.clone();
        p.cx.update(|cx| v.update(cx, |v, cx| v.show_recipients(vec![agent("t7"), agent("t8")], cx)));
        p.cx.update(|cx| v.update(cx, |v, cx| v.choose_recipient(t, cx)));
    };
    // Two sends in flight at once: each keeps its own recipient and its own pins.
    send(&mut p, "t7");
    // A second pin on #resize; Pick may have ended with the first Send.
    if p.cx.update(|cx| v.read(cx).owner(cx)) != Owner::Pick {
        p.cx.update(|cx| v.update(cx, |v, cx| v.toggle_mode(Owner::Pick, cx)));
    }
    let r2: Vec<f32> = p.eval("(()=>{const r=document.getElementById('resize').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()").unwrap().as_array().unwrap().iter().map(|n| n.as_f64().unwrap() as f32).collect();
    p.click(r2[0] + r2[2] / 2.0, r2[1] + r2[3] / 2.0);
    assert!(p.wait(Duration::from_secs(10), |p| p.cx.update(|cx| p.view.read(cx).comment_target().is_some())));
    p.text("second note for t8");
    p.key("enter");
    send(&mut p, "t8");
    let root = browser::inbox::root(&p.dir);
    let landed = |t: &str| browser::inbox::unread(&root, t).unwrap_or_default();
    assert!(p.wait(Duration::from_secs(30), |_| landed("t7").len() == 1 && landed("t8").len() == 1), "both sends land: t7 {:?} t8 {:?}", landed("t7"), landed("t8"));
    let read = |t: &str| {
        let id = landed(t)[0];
        (id, std::fs::read_to_string(root.join(t).join(id.to_string()).join("note.md")).unwrap())
    };
    let ((id7, note7), (_, note8)) = (read("t7"), read("t8"));
    assert!(note7.contains("drop zone too small") && !note7.contains("second note"), "t7 got only its own pin:\n{note7}");
    assert!(note8.contains("second note for t8") && !note8.contains("drop zone too small"), "t8 got only its own pin:\n{note8}");
    assert!(note7.contains("<<page-data-") && !note7.to_lowercase().contains("authoriz"), "{note7}");
    let folder = root.join("t7").join(id7.to_string());
    let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(folder.join("batch.json")).unwrap()).unwrap();
    assert_eq!(json["to"]["terminal"], "t7");
    assert!(folder.join("picture.png").exists(), "the picture is in the batch folder");
    println!("METRIC inbox_files {:?}", std::fs::read_dir(&folder).unwrap().flatten().map(|e| e.file_name()).collect::<Vec<_>>());

    // Exclusive: an addressed send never reaches the global pull path (window.rs feeds
    // browser.annotations only from BrowserEvent::Annotations), so no other agent can read it.
    p.run_for(Duration::from_millis(300));
    assert!(!p.events().iter().any(|e| matches!(e, BrowserEvent::Annotations(_))), "no global batch for an addressed send");
    assert_eq!(p.command("browser.annotations", serde_json::json!({})).unwrap()["batch"], serde_json::Value::Null, "legacy pull sees nothing");
    assert_eq!(p.cx.update(|cx| p.view.read(cx).annotations().count()), 0, "pins clear once delivered");

    browser::inbox::mark_read(&root, "t7", id7, 1).unwrap();
    assert_eq!(browser::inbox::read_at(&root, "t7", id7), Some(1));
    println!("PASS browser_send_to");
}
