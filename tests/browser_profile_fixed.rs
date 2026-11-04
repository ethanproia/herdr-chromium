//! A live block's profile never changes in place: a layout update that names another profile
//! (a hand edit, an agent-written layout) is ignored; the url still follows.
include!("common/browser_harness.rs");

use harness::{Host, Page};
use std::time::Duration;

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Stub, &server.url("scroll.html")) else { return };
    let v = p.view.clone();
    assert_eq!(p.cx.update(|cx| v.read(cx).profile().to_string()), "default");
    for other in ["agent", " default", "work", ""] {
        let block = crate::layout::BrowserBlock { url: server.url("form.html"), profile: other.into(), ..Default::default() };
        p.cx.update(|cx| v.update(cx, |v, cx| v.set_block(block, cx)));
        p.run_for(Duration::from_millis(100));
        assert_eq!(p.cx.update(|cx| v.read(cx).profile().to_string()), "default", "profile {other:?} ignored");
        assert_eq!(p.state().profile, "default", "the broker's record is unchanged");
    }
    assert!(p.wait(Duration::from_secs(10), |p| p.state().url.ends_with("form.html")), "the url change still applies");
    println!("profile fixed (stub): ok");
}
