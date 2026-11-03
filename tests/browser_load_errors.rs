//! U9: a failed main-frame load shows the app's error card and sets BrowserState.load_error (kind,
//! code only); the next load clears it. Real CEF (refused port, unresolvable host), then the stub.
include!("common/browser_harness.rs");

use harness::{Host, Page};
use std::time::Duration;

fn error(p: &mut Page) -> Option<(String, i32)> {
    p.state().load_error
}

fn wait_error(p: &mut Page, kind: &str) -> (String, i32) {
    let ok = p.wait(Duration::from_secs(20), |p| error(p).is_some_and(|(k, _)| k == kind));
    assert!(ok, "no {kind} load error, got {:?}", error(p));
    error(p).unwrap()
}

fn main() {
    let server = fixtures::Server::start();
    if let Some(mut p) = Page::open(Host::Cef, &server.url("scroll.html")) {
        assert_eq!(error(&mut p), None, "a good page has no error");
        // A port just freed has no listener: refused (Chromium blocks low ports like 9 as unsafe, -312).
        let port = std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        p.navigate(&format!("http://127.0.0.1:{port}/")).unwrap();
        let (_, code) = wait_error(&mut p, "refused");
        assert_eq!(code, -102);
        p.navigate("http://nothing-here.invalid/").unwrap();
        wait_error(&mut p, "dns");
        p.navigate(&server.url("scroll.html")).unwrap();
        assert!(p.wait(Duration::from_secs(20), |p| error(p).is_none()), "the next load clears it");
        println!("load errors (cef): ok");
    }
    if let Some(mut p) = Page::open(Host::Stub, &server.url("scroll.html")) {
        p.navigate("http://nothing-here.invalid/").unwrap();
        assert_eq!(wait_error(&mut p, "dns").1, -105);
        println!("load errors (stub): ok");
    }
}
