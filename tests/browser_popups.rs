//! Real popups (window.open with features, after a click) show as a card over their opener, keep
//! the opener's profile, show their CURRENT origin, and close themselves; a popup without a click
//! is refused with a chip; ids the app didn't get from the host for this opener are ignored.
//! Stub first (scripted popups); real CEF with a local fake OAuth flow in PR 3.
include!("common/browser_harness.rs");

use harness::{Host, Page};
use crate::browser::HostLink as _;
use herdr_browser_protocol::{AppToHost, HostToApp};
use std::time::Duration;

fn popups(p: &mut Page) -> Vec<gpui::Entity<crate::browser::view::BrowserView>> {
    let v = p.view.clone();
    p.cx.update(|cx| v.read(cx).popup_views())
}

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Stub, &server.url("scroll.html")) else { return };
    let auth = server.url("oauth-auth.html");
    p.navigate(&server.url(&format!("scroll.html?popup={auth}"))).unwrap();
    assert!(p.wait(Duration::from_secs(10), |p| popups(p).len() == 1), "the popup shows as a card");
    let pop = popups(&mut p)[0].clone();
    let (url, opener, profile) = p.cx.update(|cx| {
        let v = pop.read(cx);
        (v.block().url.clone(), v.opener().map(str::to_owned), v.block().profile.clone())
    });
    assert_eq!(opener.as_deref(), Some("page"));
    assert_eq!(profile, "default", "the popup keeps its opener's profile");
    assert_eq!(url, auth);
    let pop_id = p.cx.update(|cx| p.view.read(cx).popup_ids(cx))[0].clone();
    assert!(pop_id.starts_with("page-pop"), "{pop_id}");
    assert_eq!(p.cx.update(|cx| pop.read(cx).state.opener.clone()), Some("page".to_string()));

    // The bar shows where the popup is NOW: navigate it to another origin.
    let other = format!("http://localhost:{}/form.html", server.port);
    p.link.send(AppToHost::Navigate { id: pop_id.clone(), url: other });
    let want = format!("http://localhost:{}", server.port);
    assert!(p.wait(Duration::from_secs(10), |p| p.cx.update(|cx| crate::browser::view::popup_origin(&pop.read(cx).state.url)) == want), "the bar follows the popup's current origin");

    // window.close: the card goes.
    p.link.send(AppToHost::Navigate { id: pop_id.clone(), url: format!("{auth}?close=1") });
    assert!(p.wait(Duration::from_secs(10), |p| popups(p).is_empty()), "a popup that closes itself leaves");

    // Without a click: refused, a chip instead.
    p.navigate(&server.url(&format!("scroll.html?popup_blocked={auth}"))).unwrap();
    let v = p.view.clone();
    assert!(p.wait(Duration::from_secs(10), |p| p.cx.update(|cx| v.read(cx).blocked_popup().is_some())), "the blocked chip shows");
    assert!(popups(&mut p).is_empty());

    // Ids the app didn't get from the host for this opener: an id in use, another opener's.
    let inject = |p: &mut Page, m: HostToApp| {
        let v = p.view.clone();
        p.cx.update(|cx| v.update(cx, |v, cx| v.on_host(m, cx)));
        p.pump();
    };
    inject(&mut p, HostToApp::PopupOpened { opener: "page".into(), id: "page".into(), url: auth.clone(), w: None, h: None });
    inject(&mut p, HostToApp::PopupOpened { opener: "someone-else".into(), id: "x-pop1".into(), url: auth.clone(), w: None, h: None });
    p.run_for(Duration::from_millis(200));
    assert!(popups(&mut p).is_empty(), "neither makes a popup");
    assert!(p.state().url.contains("scroll.html"), "the opener is untouched");

    // Closing the opener takes its popup with it.
    p.navigate(&server.url(&format!("scroll.html?popup={auth}&again"))).unwrap();
    assert!(p.wait(Duration::from_secs(10), |p| popups(p).len() == 1));
    p.link.send(AppToHost::Close { id: "page".into() });
    assert!(p.wait(Duration::from_secs(10), |p| popups(p).is_empty()), "the opener's popup closed with it");
    println!("popups (stub): ok");
}

