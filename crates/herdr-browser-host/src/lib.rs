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
