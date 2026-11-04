//! A local fake OAuth flow on the real CEF host: "Sign in" opens a real popup (window.open with
//! features, after a click) shown over the opener; "Allow" in it posts the token to
//! window.opener and closes itself. Also: the popup bar follows the popup's current origin, a
//! popup without a click is refused, and an agent's popup stays in the agent's profile. (Closing
//! the opener closes its popups: tests/browser_popups.rs, on the stub.)
include!("common/browser_harness.rs");

use harness::{Host, Page};
use std::time::Duration;

type View = gpui::Entity<crate::browser::view::BrowserView>;

fn popups(p: &mut Page) -> Vec<View> {
    let v = p.view.clone();
    p.cx.update(|cx| v.read(cx).popup_views())
}

/// A click at (x, y) inside the popup's page, given the card's place (centred over the window).
fn click_in_popup(p: &mut Page, x: f32, y: f32, w: f32, h: f32) {
    let (win_w, win_h) = p.size;
    let (left, top) = ((win_w - w) / 2.0, (win_h - (h + 28.0)) / 2.0 + 28.0);
    let page_top = p.page_top();
    p.click(left + x, top + y - page_top);
}

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Cef, &server.url("oauth-opener.html")) else { return };
    // 1. Sign in (a real click: a user gesture) opens a 480x560 popup over the opener.
    p.click(120.0, 50.0);
    assert!(p.wait(Duration::from_secs(20), |p| popups(p).len() == 1), "the popup shows: {:?}", p.console());
    let pop = popups(&mut p)[0].clone();
    assert!(p.wait(Duration::from_secs(20), |p| p.cx.update(|cx| pop.read(cx).frame_seq().is_some())), "the popup paints");
    assert!(p.cx.update(|cx| pop.read(cx).state.url.ends_with("/oauth-auth.html")));
    assert_eq!(p.cx.update(|cx| crate::browser::view::popup_origin(&pop.read(cx).state.url)), format!("http://127.0.0.1:{}", server.port));
    // 2. Allow: the opener gets the token through window.opener.postMessage; the popup closes itself.
    click_in_popup(&mut p, 120.0, 50.0, 480.0, 560.0);
    assert!(p.wait(Duration::from_secs(20), |p| p.state().title == "signed in: abc123"), "postMessage reached the opener: {:?}", p.state().title);
    assert!(p.wait(Duration::from_secs(20), |p| popups(p).is_empty()), "window.close took the card away");

    // 3. The bar shows where the popup is NOW: a popup that redirects itself to another origin.
    let other_server = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let other_port = other_server.local_addr().unwrap().port();
    std::thread::spawn(move || {
        for mut c in other_server.incoming().flatten() {
            use std::io::{Read, Write};
            let mut buf = [0u8; 2048];
            let _ = c.read(&mut buf);
            let _ = c.write_all(b"HTTP/1.1 200 OK\r\ncontent-type: text/html\r\ncontent-length: 25\r\nconnection: close\r\n\r\n<title>elsewhere</title>x");
        }
    });
    let other = format!("http://127.0.0.1:{other_port}/");
    p.navigate(&format!("{}?next={}", server.url("oauth-opener.html"), other)).unwrap();
    assert!(p.wait(Duration::from_secs(20), |p| p.state().url.contains("next=")));
    p.run_for(Duration::from_millis(300));
    p.click(120.0, 50.0);
    assert!(p.wait(Duration::from_secs(20), |p| popups(p).len() == 1));
    let pop = popups(&mut p)[0].clone();
    let want = format!("http://127.0.0.1:{other_port}");
    assert!(p.wait(Duration::from_secs(20), |p| p.cx.update(|cx| crate::browser::view::popup_origin(&pop.read(cx).state.url)) == want), "the bar follows the popup to another origin: now {:?}", p.cx.update(|cx| pop.read(cx).state.url.clone()));

    // 4. Without a click: refused, a chip, no popup.
    // A page that opens one as it loads (no click: an eval would count as one).
    let first = popups(&mut p)[0].clone();
    p.navigate(&server.url("oauth-noclick.html")).unwrap();
    let v = p.view.clone();
    // Chromium's own blocker refuses it before asking the host (so no chip here; the chip is
    // tested on the stub): no popup, no tab.
    let _ = &v;
    let before = p.events().len();
    p.run_for(Duration::from_secs(2));
    assert!(popups(&mut p).iter().all(|q| *q == first), "no new popup");
    assert!(!p.events()[before..].iter().any(|e| matches!(e, crate::browser::view::BrowserEvent::NewWindow(_))), "and no tab");
    println!("popups (cef): ok");
    drop(p);

    // 5. An agent's page: its popup is in the agent's profile and listed only because the opener is the agent's.
    let Some(mut a) = Page::open_as(Host::Cef, &server.url("oauth-opener.html"), 1024.0, 768.0, "agent") else { return };
    a.click(120.0, 50.0);
    assert!(a.wait(Duration::from_secs(20), |a| popups(a).len() == 1), "the agent page's popup shows");
    let ap = popups(&mut a)[0].clone();
    assert_eq!(a.cx.update(|cx| ap.read(cx).block().profile.clone()), "agent", "an agent's popup stays in the agent profile");
    assert_eq!(a.cx.update(|cx| ap.read(cx).state.opener.clone()).as_deref(), Some("page"));
    println!("popups (cef, agent opener): ok");
}
