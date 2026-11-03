//! S27 addressed Send on the real CEF host: a comment pin, Send, the recipient list, a pick:
//! the batch lands in that agent's inbox (note.md fenced, batch.json, picture), the agent's
//! read is recorded for the chip. Nothing is typed into any pane.
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
    p.cx.update(|cx| v.update(cx, |v, cx| v.show_recipients(vec![agent("t7"), agent("t8")], cx)));
    p.cx.update(|cx| v.update(cx, |v, cx| v.choose_recipient("t7", cx)));
    assert!(p.wait(Duration::from_secs(20), |p| p.events().iter().any(|e| matches!(e, BrowserEvent::Annotations(_)))), "batch sent");
    let batch = p.events().into_iter().find_map(|e| match e { BrowserEvent::Annotations(b) => Some(b), _ => None }).unwrap();

    let root = browser::inbox::root(&p.dir);
    let folder = root.join("t7").join(batch.id.to_string());
    let note = std::fs::read_to_string(folder.join("note.md")).expect("note.md in t7's inbox");
    assert!(note.contains("drop zone too small"), "{note}");
    assert!(note.contains("<<page-data-") && !note.to_lowercase().contains("authoriz"), "{note}");
    let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(folder.join("batch.json")).unwrap()).unwrap();
    assert_eq!(json["to"]["terminal"], "t7");
    assert!(folder.join("picture.png").exists(), "the picture is in the batch folder");
    assert!(!root.join("t8").exists(), "only the chosen agent gets it");
    println!("METRIC inbox_files {:?}", std::fs::read_dir(&folder).unwrap().flatten().map(|e| e.file_name()).collect::<Vec<_>>());

    assert_eq!(browser::inbox::unread(&root, "t7").unwrap(), [batch.id]);
    browser::inbox::mark_read(&root, "t7", batch.id, 1).unwrap();
    assert_eq!(browser::inbox::read_at(&root, "t7", batch.id), Some(1));
    println!("PASS browser_send_to");
}
