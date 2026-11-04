//! Pick in responsive mode on the real CEF host: a click on the letterboxed page (drawn at `fit`)
//! picks the element under it in the page's own coordinates, and its target box is drawn at
//! `fit` inside the device's box.
include!("common/browser_harness.rs");

use crate::browser::input::Owner;
use harness::{Host, Page};
use std::time::Duration;

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Cef, &server.url("pick.html")) else { return };
    assert!(p.wait_loaded(Duration::from_secs(20)), "page loads");
    p.focus();
    let v = p.view.clone();
    p.cx.update(|cx| v.update(cx, |v, cx| v.set_device(crate::browser::devices::Mode::preset("iPhone 15"), cx)));
    p.eval_until("innerWidth", Duration::from_secs(20), |w| *w == serde_json::json!(390));
    p.cx.update(|cx| v.update(cx, |v, cx| v.set_comment_on_pick(true, cx)));
    p.cx.update(|cx| v.update(cx, |v, cx| v.toggle_mode(Owner::Pick, cx)));
    p.run_for(Duration::from_millis(300));
    let fit = p.cx.update(|cx| v.read(cx).fit());
    assert!(fit < 1.0, "scaled ({fit})");
    let input = p.cx.update(|cx| v.read(cx).input().clone());
    let o = p.cx.update(|cx| input.read(cx).origin());
    // #go's centre in page DIPs (249, 141), drawn at fit inside the box.
    let top = p.page_top();
    p.click(f32::from(o.x) + 249.0 * fit, f32::from(o.y) + 141.0 * fit - top);
    let got = p.wait(Duration::from_secs(10), |p| p.cx.update(|cx| p.view.read(cx).comment_target().is_some()));
    assert!(got, "the click on the scaled page picked something");
    let t = p.cx.update(|cx| v.read(cx).comment_target().cloned()).unwrap();
    assert_eq!((t.selector.as_str(), t.rect), ("#go", (200.0, 120.0, 98.0, 43.0)), "{t:?}");
    println!("device pick (cef): ok at fit {fit:.3}: {} {:?}", t.selector, t.rect);
}
