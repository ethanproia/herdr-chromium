//! S29's shield in a browser block's bar is drawn (a filled path, no font or emoji), so it always
//! shows: the bar's right end holds the shield's own colour, gray with nothing granted and white
//! on the blue tile with a grant on, at wide and narrow widths. Stub host. (The + menu's browser
//! tab is checked on a headless app by scripts/test-shield-tab.sh.)
include!("common/browser_harness.rs");

use crate::browser::agent::Grant;
use crate::browser::view::{SHIELD_OFF, SHIELD_ON};
use harness::{Host, Page};
use std::time::Duration;

/// Pixels within `tol` of `color` in the box (window DIPs).
fn of_color(p: &mut Page, color: u32, x: f32, y: f32, w: f32, h: f32) -> usize {
    let img = p.shot();
    let s = img.width() as f32 / p.size.0;
    let want = [(color >> 16) as i32 & 0xff, (color >> 8) as i32 & 0xff, color as i32 & 0xff];
    let mut n = 0;
    for yy in (y * s) as u32..((y + h) * s) as u32 {
        for xx in (x * s) as u32..((x + w) * s).min(img.width() as f32) as u32 {
            let q = img.get_pixel(xx, yy).0;
            if (0..3).all(|i| (q[i] as i32 - want[i]).abs() <= 6) {
                n += 1;
            }
        }
    }
    n
}

fn main() {
    let server = fixtures::Server::start();
    for w in [1024.0, 480.0, 380.0] {
        let Some(mut p) = Page::open_sized(Host::Stub, &server.url("scroll.html"), w, 600.0) else { return };
        p.wait(Duration::from_secs(10), |p| p.last_seq().is_some());
        let bar = p.page_top();
        // As the person first sees it: no grant (the harness turns Control on for its tests).
        p.grant(Grant::Control, false);
        p.run_for(Duration::from_millis(200));
        let off = of_color(&mut p, SHIELD_OFF, w - 40.0, 0.0, 38.0, bar);
        assert!(off > 30, "width {w}: no gray shield at the bar's right end ({off} pixels)");
        p.grant(Grant::Control, true);
        p.run_for(Duration::from_millis(200));
        let on = of_color(&mut p, SHIELD_ON, w - 40.0, 0.0, 38.0, bar);
        assert!(on > 30, "width {w}: no white shield on the blue tile ({on} pixels)");
        println!("width {w}: shield drawn ({off} gray off, {on} white on)");
    }
    let Some(mut p) = Page::open(Host::Stub, &server.url("scroll.html")) else { return };
    let v = p.view.clone();
    p.cx.update(|cx| v.update(cx, |v, cx| v.toggle_shield(cx)));
    p.pump();
    assert!(p.cx.update(|cx| v.read(cx).shield_open()), "the shield opens its panel");
    println!("shield visible (stub): ok");
}
