//! The device menu sits over the page: a click on it is the menu's, never the page's.
include!("common/browser_harness.rs");

use harness::{Host, Page};
use std::time::Duration;

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Stub, &server.url("scroll.html")) else { return };
    p.wait(Duration::from_secs(10), |p| p.last_seq().is_some());
    let v = p.view.clone();
    p.cx.update(|cx| v.update(cx, |v, cx| v.toggle_device_menu(cx)));
    p.pump();
    let before = p.console().len();
    // Its first row ("Responsive off"), top right of the page area.
    p.click(p.size.0 - 50.0, 14.0);
    p.run_for(Duration::from_millis(300));
    let leaked: Vec<String> = p.console()[before..].iter().filter(|l| l.contains("mouse")).cloned().collect();
    assert!(leaked.is_empty(), "the page got the menu's click: {leaked:?}");
    let open = p.cx.update(|cx| v.read(cx).device_menu_open());
    assert!(!open, "choosing closed the menu");
    // Control: the same click with the menu closed reaches the page.
    p.click(p.size.0 - 50.0, 14.0);
    let ok = p.wait(Duration::from_secs(5), |p| p.console()[before..].iter().any(|l| l.contains("mouse")));
    assert!(ok, "a page click reaches the stub: {:?}", &p.console()[before..]);
    println!("device menu (stub): ok");
}
