//! Overlays in responsive mode: the page is drawn at `fit` inside the device's box, and markup
//! (like every overlay) goes through `to_drawn`: a rect drawn on the box lands at the right page
//! DIPs, its red stroke shows at the drawn place, and turning the device off draws it unscaled.
//! Stub host (deterministic frames).
include!("common/browser_harness.rs");

use harness::{Host, Page};
use std::time::Duration;

const RED: [u8; 3] = [0xff, 0x3b, 0x30];

fn rgb3(p: [u8; 4]) -> [u8; 3] {
    [p[0], p[1], p[2]]
}

/// A window pixel (window DIPs), via the harness's page coordinates.
fn window_pixel(p: &mut Page, x: f32, y: f32) -> [u8; 3] {
    let top = p.page_top();
    rgb3(p.page_pixel(x, y - top))
}

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Stub, &server.url("scroll.html")) else { return };
    p.wait(Duration::from_secs(10), |p| p.last_seq().is_some());
    let v = p.view.clone();
    p.cx.update(|cx| v.update(cx, |v, cx| v.set_device(crate::browser::devices::Mode::preset("iPhone 15"), cx)));
    p.run_for(Duration::from_millis(300));
    // Markup mode first: its strip moves the page down and changes the fit.
    p.cx.update(|cx| v.update(cx, |v, cx| v.toggle_mode(crate::browser::input::Owner::Markup, cx)));
    p.run_for(Duration::from_millis(300));
    // The device's box: where the input layer sits (window DIPs), and the fit it draws at.
    let input = p.cx.update(|cx| v.read(cx).input().clone());
    let origin = p.cx.update(|cx| input.read(cx).origin());
    let (ox, oy) = (f32::from(origin.x), f32::from(origin.y));
    let fit = p.cx.update(|cx| v.read(cx).fit());
    assert!(fit < 1.0, "the iPhone is scaled down to fit ({fit})");

    // Draw a rect on the box from drawn (40, 60) to (140, 160).
    let top = p.page_top();
    let (a, b) = ((ox + 40.0, oy + 60.0 - top), (ox + 140.0, oy + 160.0 - top));
    p.drag(a, b, 6);
    let shapes = p.cx.update(|cx| v.read(cx).markup().read(cx).shapes().to_vec());
    let Some(crate::browser::markup::Shape::Rect(s, e)) = shapes.first().cloned() else { panic!("no rect: {shapes:?}") };
    let near = |q: (f32, f32), want: (f32, f32)| (q.0 - want.0).abs() < 1.5 && (q.1 - want.1).abs() < 1.5;
    assert!(near(s, (40.0 / fit, 60.0 / fit)) && near(e, (140.0 / fit, 160.0 / fit)), "the rect is kept in page DIPs: {s:?} {e:?} at fit {fit}");
    // Its stroke shows where it was drawn (the box's left edge of the rect, halfway down).
    assert_eq!(window_pixel(&mut p, ox + 40.0, oy + 110.0), RED, "drawn at the box position");

    // Device off: the same shape draws at its page position, unscaled.
    p.cx.update(|cx| v.update(cx, |v, cx| v.set_device(None, cx)));
    p.run_for(Duration::from_millis(300));
    let top = p.page_top();
    let _ = top;
    assert_eq!(rgb3(p.page_pixel(40.0 / fit, 110.0 / fit)), RED, "unscaled after device off");
    println!("device overlays (stub): ok");
}
