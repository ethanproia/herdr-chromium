//! S29: on a browser the person opened, agent commands need the Control grant from the block's
//! shield. The harness opens with Control on (the person's stand-in); turned off, eval and
//! navigate are refused; on again, they run. Real CEF.
include!("common/browser_harness.rs");

use browser::agent::Grant;
use harness::{Host, Page};

fn main() {
    let server = fixtures::Server::start();
    let Some(mut p) = Page::open(Host::Cef, &server.url("scroll.html")) else { return };
    assert_eq!(p.eval("document.title").unwrap(), "scroll", "Control on: eval runs");
    p.grant(Grant::Control, false);
    let e = p.eval("document.title").unwrap_err();
    assert!(e.contains("hasn't allowed"), "Control off: eval refused, got {e}");
    let e = p.navigate(&server.url("form.html")).unwrap_err();
    assert!(e.contains("hasn't allowed"), "Control off: navigate refused, got {e}");
    p.grant(Grant::Control, true);
    assert_eq!(p.eval("document.title").unwrap(), "scroll", "Control on again: eval runs");
    println!("browser_grants: ok");
}
