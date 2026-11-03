//! P0-06: a window shot covers a block the person marked sensitive; unmarked blocks and normal
//! drawing are untouched. Stub host (deterministic frames).
include!("common/browser_harness.rs");

use harness::{Host, Page};
use std::sync::atomic::Ordering::SeqCst;
use std::time::Duration;

const COVER: [u8; 3] = [0x20, 0x20, 0x20];

fn rgb(p: [u8; 4]) -> [u8; 3] {
    [p[0], p[1], p[2]]
}

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Stub, &server.url("scroll.html")) else { return };
    p.wait(Duration::from_secs(10), |p| p.last_seq().is_some());
    let page = rgb(p.page_pixel(200.0, 200.0));
    assert_ne!(page, COVER, "the stub page isn't the cover color");
    let mask = &crate::browser::view::SHOT_MASK;
    // Not marked sensitive: a shot shows the page.
    mask.store(true, SeqCst);
    assert_eq!(rgb(p.page_pixel(200.0, 200.0)), page, "an unmarked block is not covered");
    // Marked sensitive: the shot shows the cover, not the page.
    p.grant(crate::browser::agent::Grant::Sensitive, true);
    assert_eq!(rgb(p.page_pixel(200.0, 200.0)), COVER, "a sensitive block is covered in a shot");
    assert_eq!(rgb(p.page_pixel(20.0, 20.0)), COVER);
    // After the shot, the person sees their page again.
    mask.store(false, SeqCst);
    assert_eq!(rgb(p.page_pixel(200.0, 200.0)), page, "normal drawing is untouched");
    println!("shot mask (stub): ok");
}
