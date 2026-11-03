//! Browser host: serves the browser protocol on a Unix socket. See docs/browser-block-contract.md.
//! OWNER: part 2 (host).
//!
//! Two backends serve the same protocol: `--stub` (no CEF; deterministic frames whose pixels encode
//! the browser id, size and seq, see `stub_pixel`; input echoed back as `Console` messages) and,
//! with the `cef` feature, the real CEF off-screen host in `cef`, which must run from its .app
//! bundle (scripts/fork-host-bundle.sh).

use herdr_browser_protocol::{PixelSize, SurfaceRef};
use std::io;
use std::os::unix::net::UnixListener;
use std::path::Path;

pub mod downloads;
mod stub;
#[cfg(all(feature = "cef", target_os = "macos"))]
pub mod cef;

pub use stub::{id_byte, stub_pixel};

/// The kind a failed load's net error is (`HostToApp::LoadError`); None for an abort (-3, a
/// navigation replaced by another), which is no error to show.
pub fn load_error_kind(code: i32) -> Option<&'static str> {
    Some(match code {
        -3 => return None,
        -105 | -137 => "dns",
        -106 => "offline",
        -102 | -109 | -104 => "refused",
        -7 | -118 => "timeout",
        -299..=-200 => "certificate",
        _ => "other",
    })
}

/// v1 prompts only for these; anything else is denied by the host without asking.
pub const PROMPTED_KINDS: [&str; 4] = ["camera", "microphone", "geolocation", "clipboard-read"];

/// The words for a media request's bits (CEF `cef_media_access_permission_types_t`).
pub fn media_kinds(mask: u32) -> Vec<&'static str> {
    let mut out = Vec::new();
    if mask & 2 != 0 { out.push("camera"); }
    if mask & 1 != 0 { out.push("microphone"); }
    if mask & (4 | 8) != 0 { out.push("screen"); }
    out
}

/// The words for a permission prompt's bits (CEF `cef_permission_request_types_t`).
pub fn prompt_kinds(mask: u32) -> Vec<&'static str> {
    let named: [(u32, &str); 6] = [(4, "camera"), (4096, "microphone"), (256, "geolocation"), (16, "clipboard-read"), (32768, "notifications"), (8192, "midi")];
    let mut out: Vec<&str> = named.iter().filter(|(bit, _)| mask & bit != 0).map(|(_, k)| *k).collect();
    if mask & !named.iter().fold(0, |m, (bit, _)| m | bit) != 0 { out.push("other"); }
    out
}

/// Whether a request is asked at all: only when every kind is one v1 prompts for.
pub fn asks(kinds: &[&str]) -> bool {
    !kinds.is_empty() && kinds.iter().all(|k| PROMPTED_KINDS.contains(k))
}

#[cfg(test)]
mod permission_tests {
    use super::*;

    #[test]
    fn only_camera_mic_location_and_clipboard_are_asked() {
        assert_eq!(media_kinds(3), vec!["camera", "microphone"]);
        assert_eq!(media_kinds(8), vec!["screen"]);
        assert_eq!(prompt_kinds(256 | 16), vec!["geolocation", "clipboard-read"]);
        assert_eq!(prompt_kinds(32768 | 1), vec!["notifications", "other"]);
        assert!(asks(&media_kinds(3)) && asks(&prompt_kinds(256)));
        assert!(!asks(&media_kinds(2 | 8)), "screen capture has no picker yet");
        assert!(!asks(&prompt_kinds(32768)) && !asks(&prompt_kinds(8192)) && !asks(&prompt_kinds(1)) && !asks(&[]));
    }
}

#[cfg(test)]
mod load_error_tests {
    #[test]
    fn net_errors_map_to_kinds_and_aborts_are_none() {
        use super::load_error_kind as k;
        assert_eq!(k(-3), None);
        assert_eq!(k(-105), Some("dns"));
        assert_eq!(k(-106), Some("offline"));
        assert_eq!(k(-102), Some("refused"));
        assert_eq!(k(-118), Some("timeout"));
        assert_eq!(k(-202), Some("certificate"));
        assert_eq!(k(-501), Some("other"));
    }
}

/// Where frames are drawn. The stub writes pixels; the CEF backend will blit into the same surfaces.
pub trait SurfaceAlloc {
    type Surface: HostSurface;
    fn create(&mut self, px: PixelSize) -> io::Result<Self::Surface>;
}

/// One shared frame buffer the host owns until the app acks it.
pub trait HostSurface {
    fn write_bgra(&self, pixels: &[u8]) -> io::Result<()>;
    fn export(&mut self) -> io::Result<SurfaceRef>;
}

/// Real IOSurfaces from `herdr-browser-surface`, exported by global id (contract D3 default).
pub struct IoSurfaces;

impl SurfaceAlloc for IoSurfaces {
    type Surface = herdr_browser_surface::Surface;
    fn create(&mut self, px: PixelSize) -> io::Result<Self::Surface> {
        herdr_browser_surface::create_pixels(px).map_err(io::Error::other)
    }
}

impl HostSurface for herdr_browser_surface::Surface {
    fn write_bgra(&self, pixels: &[u8]) -> io::Result<()> {
        herdr_browser_surface::Surface::write_bgra(self, pixels).map_err(io::Error::other)
    }
    fn export(&mut self) -> io::Result<SurfaceRef> {
        herdr_browser_surface::Surface::export(self, herdr_browser_surface::Transport::GlobalId).map_err(io::Error::other)
    }
}

/// Bind `socket` (replacing a stale file) and serve one app connection at a time until `Shutdown`.
pub fn serve<A: SurfaceAlloc>(socket: &Path, alloc: A) -> io::Result<()> {
    let _ = std::fs::remove_file(socket);
    let listener = UnixListener::bind(socket)?;
    let mut host = stub::StubHost::new(alloc);
    for conn in listener.incoming() {
        if host.serve_conn(conn?)? {
            break;
        }
    }
    let _ = std::fs::remove_file(socket);
    Ok(())
}
