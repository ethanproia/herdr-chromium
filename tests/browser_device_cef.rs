//! Responsive mode on the real CEF host: a named device gives the page that real viewport, scale,
//! a coarse pointer, the device's mobile UA and touch events from a click; rotate swaps the size;
//! off restores the desktop page exactly (no override left behind).
include!("common/browser_harness.rs");

use harness::{Host, Page};
use std::time::Duration;

fn report(p: &mut Page) -> serde_json::Value {
    let v = p.eval("window.__report()").unwrap();
    serde_json::from_str(v.as_str().unwrap_or("{}")).unwrap()
}

fn set(p: &mut Page, mode: Option<crate::browser::devices::Mode>) {
    let v = p.view.clone();
    p.cx.update(|cx| v.update(cx, |v, cx| v.set_device(mode, cx)));
    p.pump();
}

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Cef, &server.url("device.html")) else { return };
    let desktop = report(&mut p);
    assert_eq!(desktop["coarse"], false);
    assert_eq!(desktop["mobile"], false);
    let desktop_ua = p.eval("navigator.userAgent").unwrap();

    set(&mut p, crate::browser::devices::Mode::preset("iPhone 15"));
    let r = p.eval_until("window.__report()", Duration::from_secs(20), |v| v.as_str().is_some_and(|s| s.contains("\"w\":390")));
    let r: serde_json::Value = serde_json::from_str(r.as_str().unwrap()).unwrap();
    assert_eq!((r["w"].clone(), r["dpr"].clone(), r["coarse"].clone(), r["mobile"].clone()), (serde_json::json!(390), serde_json::json!(3), serde_json::json!(true), serde_json::json!(true)), "{r}");
    // A click on the letterboxed page arrives as a touch.
    p.run_for(Duration::from_millis(300));
    p.click(p.size.0 / 2.0, 200.0);
    let t = p.eval_until("window.__touched", Duration::from_secs(10), |v| *v == serde_json::json!(true));
    assert_eq!(t, serde_json::json!(true), "the click became a touch");

    let rotated = p.cx.update(|cx| p.view.read(cx).device().map(|d| d.rotated()));
    set(&mut p, rotated);
    p.eval_until("window.__report()", Duration::from_secs(20), |v| v.as_str().is_some_and(|s| s.contains("\"w\":844")));

    set(&mut p, None);
    let want_w = format!("\"w\":{}", desktop["w"]);
    let back = p.eval_until("window.__report()", Duration::from_secs(20), |v| v.as_str().is_some_and(|s| s.contains("\"coarse\":false") && s.contains(&want_w)));
    let back: serde_json::Value = serde_json::from_str(back.as_str().unwrap()).unwrap();
    assert_eq!((back["w"].clone(), back["dpr"].clone(), back["mobile"].clone()), (desktop["w"].clone(), desktop["dpr"].clone(), serde_json::json!(false)), "off restores the desktop page: {back}");
    assert_eq!(p.eval("navigator.userAgent").unwrap(), desktop_ua, "and its own user agent");
    println!("device mode (cef): ok");
}
