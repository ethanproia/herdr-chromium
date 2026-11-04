//! HERDR: the macOS player, AVFoundation through plain Objective-C messages (no new crates).
//! Stills come from `AVAssetImageGenerator` drawn into an IOSurface-backed CVPixelBuffer; playing
//! frames from `AVPlayerItemVideoOutput`. Both are shown with GPUI's `surface()`. The OS codecs
//! play .mp4/.mov (H.264, HEVC, ProRes; AAC audio through the system output).

use super::{Backend, PlayerState};
use core_foundation::base::TCFType;
use core_video::pixel_buffer::{CVPixelBuffer, CVPixelBufferRef};
use std::ffi::{CStr, c_char, c_void};

type Id = *mut c_void;
type Sel = *mut c_void;

#[repr(C)]
#[derive(Clone, Copy)]
struct CMTime {
    value: i64,
    timescale: i32,
    flags: u32,
    epoch: i64,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct CGSize {
    w: f64,
    h: f64,
}

#[repr(C)]
struct CGRect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

const CMTIME_VALID: u32 = 1;
const CMTIME_INDEFINITE: u32 = 1 << 4;
const BGRA: u32 = u32::from_be_bytes(*b"BGRA");
/// The longest side of a still: enough for a board tile, about the cost of an image.
const STILL_MAX: f64 = 1600.0;

#[link(name = "objc")]
unsafe extern "C" {
    fn objc_getClass(name: *const c_char) -> Id;
    fn sel_registerName(name: *const c_char) -> Sel;
    fn objc_msgSend();
    fn objc_retain(obj: Id) -> Id;
    fn objc_release(obj: Id);
}

#[link(name = "AVFoundation", kind = "framework")]
unsafe extern "C" {}
#[link(name = "Foundation", kind = "framework")]
unsafe extern "C" {}

#[link(name = "CoreMedia", kind = "framework")]
unsafe extern "C" {
    fn CMTimeMakeWithSeconds(seconds: f64, timescale: i32) -> CMTime;
    fn CMTimeGetSeconds(time: CMTime) -> f64;
    static kCMTimeZero: CMTime;
}

#[link(name = "QuartzCore", kind = "framework")]
unsafe extern "C" {
    fn CACurrentMediaTime() -> f64;
}

#[link(name = "CoreVideo", kind = "framework")]
unsafe extern "C" {
    static kCVPixelBufferPixelFormatTypeKey: Id;
    static kCVPixelBufferIOSurfacePropertiesKey: Id;
    fn CVPixelBufferCreate(alloc: *const c_void, w: usize, h: usize, format: u32, attrs: Id, out: *mut CVPixelBufferRef) -> i32;
    fn CVPixelBufferLockBaseAddress(buf: CVPixelBufferRef, flags: u64) -> i32;
    fn CVPixelBufferUnlockBaseAddress(buf: CVPixelBufferRef, flags: u64) -> i32;
    fn CVPixelBufferGetBaseAddress(buf: CVPixelBufferRef) -> *mut c_void;
    fn CVPixelBufferGetBytesPerRow(buf: CVPixelBufferRef) -> usize;
}

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGImageGetWidth(image: *const c_void) -> usize;
    fn CGImageGetHeight(image: *const c_void) -> usize;
    fn CGImageRelease(image: *const c_void);
    fn CGColorSpaceCreateDeviceRGB() -> *const c_void;
    fn CGColorSpaceRelease(space: *const c_void);
    fn CGBitmapContextCreate(data: *mut c_void, w: usize, h: usize, bits: usize, row: usize, space: *const c_void, info: u32) -> *const c_void;
    fn CGContextDrawImage(ctx: *const c_void, rect: CGRect, image: *const c_void);
    fn CGContextRelease(ctx: *const c_void);
}

fn sel(name: &CStr) -> Sel {
    unsafe { sel_registerName(name.as_ptr()) }
}

fn class(name: &CStr) -> Id {
    unsafe { objc_getClass(name.as_ptr()) }
}

/// One Objective-C message with the signature spelled out (`objc_msgSend` cast to it).
macro_rules! send {
    ($obj:expr, $sel:literal $(, $arg:expr => $ty:ty)* ; $ret:ty) => {{
        let f: unsafe extern "C" fn(Id, Sel $(, $ty)*) -> $ret = std::mem::transmute(objc_msgSend as unsafe extern "C" fn());
        f($obj, sel($sel) $(, $arg)*)
    }};
}

fn ns_string(s: &str) -> Result<Id, String> {
    let c = std::ffi::CString::new(s).map_err(|_| "a path with a NUL byte".to_string())?;
    Ok(unsafe { send!(class(c"NSString"), c"stringWithUTF8String:", c.as_ptr() => *const c_char; Id) })
}

fn error_text(error: Id) -> String {
    if error.is_null() {
        return "unknown error".into();
    }
    unsafe {
        let d: Id = send!(error, c"localizedDescription"; Id);
        let s: *const c_char = send!(d, c"UTF8String"; *const c_char);
        if s.is_null() { "unknown error".into() } else { CStr::from_ptr(s).to_string_lossy().into_owned() }
    }
}

fn asset(path: &std::path::Path) -> Result<Id, String> {
    let p = ns_string(&path.to_string_lossy())?;
    unsafe {
        let url: Id = send!(class(c"NSURL"), c"fileURLWithPath:", p => Id; Id);
        let asset: Id = send!(class(c"AVURLAsset"), c"URLAssetWithURL:options:", url => Id, std::ptr::null_mut() => Id; Id);
        if asset.is_null() { Err(format!("cannot open {}", path.display())) } else { Ok(asset) }
    }
}

/// BGRA, IOSurface-backed: what GPUI's `surface()` shows without a copy.
fn pixel_attrs() -> Id {
    unsafe {
        let format: Id = send!(class(c"NSNumber"), c"numberWithUnsignedInt:", BGRA => u32; Id);
        let surface: Id = send!(class(c"NSDictionary"), c"dictionary"; Id);
        let keys = [kCVPixelBufferPixelFormatTypeKey, kCVPixelBufferIOSurfacePropertiesKey];
        let values = [format, surface];
        send!(class(c"NSDictionary"), c"dictionaryWithObjects:forKeys:count:", values.as_ptr() => *const Id, keys.as_ptr() => *const Id, 2usize => usize; Id)
    }
}

#[derive(Default)]
pub struct AvFoundation;

/// A live AVPlayer and its frame output (released on drop: that is "releasing the player").
pub struct Player {
    player: Id,
    item: Id,
    output: Id,
}

impl Drop for Player {
    fn drop(&mut self) {
        unsafe {
            let _: () = send!(self.player, c"pause"; ());
            objc_release(self.output);
            objc_release(self.item);
            objc_release(self.player);
        }
    }
}

fn seconds(t: CMTime) -> Option<f64> {
    (t.flags & CMTIME_VALID != 0 && t.flags & CMTIME_INDEFINITE == 0).then(|| unsafe { CMTimeGetSeconds(t) })
}

impl Backend for AvFoundation {
    type Player = Player;
    type Picture = CVPixelBuffer;

    fn still(&self, path: &std::path::Path, at: f64) -> Result<CVPixelBuffer, String> {
        let asset = asset(path)?;
        unsafe {
            let generator: Id = send!(class(c"AVAssetImageGenerator"), c"assetImageGeneratorWithAsset:", asset => Id; Id);
            let _: () = send!(generator, c"setAppliesPreferredTrackTransform:", true => bool; ());
            let _: () = send!(generator, c"setMaximumSize:", CGSize { w: STILL_MAX, h: STILL_MAX } => CGSize; ());
            // The exact frame asked for (a paused seek shows that moment), not the nearest keyframe.
            let _: () = send!(generator, c"setRequestedTimeToleranceBefore:", kCMTimeZero => CMTime; ());
            let _: () = send!(generator, c"setRequestedTimeToleranceAfter:", kCMTimeZero => CMTime; ());
            let mut error: Id = std::ptr::null_mut();
            let image: *const c_void = send!(generator, c"copyCGImageAtTime:actualTime:error:", CMTimeMakeWithSeconds(at, 600) => CMTime, std::ptr::null_mut() => *mut CMTime, &mut error => *mut Id; *const c_void);
            if image.is_null() {
                return Err(format!("no picture in {}: {}", path.display(), error_text(error)));
            }
            let (w, h) = (CGImageGetWidth(image), CGImageGetHeight(image));
            let mut buf: CVPixelBufferRef = std::ptr::null_mut();
            let made = CVPixelBufferCreate(std::ptr::null(), w, h, BGRA, pixel_attrs(), &mut buf);
            if made != 0 || buf.is_null() {
                CGImageRelease(image);
                return Err(format!("CVPixelBufferCreate failed: {made}"));
            }
            CVPixelBufferLockBaseAddress(buf, 0);
            let space = CGColorSpaceCreateDeviceRGB();
            // Premultiplied first, 32-bit little endian: BGRA in memory.
            let ctx = CGBitmapContextCreate(CVPixelBufferGetBaseAddress(buf), w, h, 8, CVPixelBufferGetBytesPerRow(buf), space, 2 | (2 << 12));
            if !ctx.is_null() {
                CGContextDrawImage(ctx, CGRect { x: 0.0, y: 0.0, w: w as f64, h: h as f64 }, image);
                CGContextRelease(ctx);
            }
            CGColorSpaceRelease(space);
            CVPixelBufferUnlockBaseAddress(buf, 0);
            CGImageRelease(image);
            Ok(CVPixelBuffer::wrap_under_create_rule(buf))
        }
    }

    fn play(&self, path: &std::path::Path, at: f64, muted: bool) -> Result<Player, String> {
        let asset = asset(path)?;
        unsafe {
            let item: Id = objc_retain(send!(class(c"AVPlayerItem"), c"playerItemWithAsset:", asset => Id; Id));
            let output: Id = send!(class(c"AVPlayerItemVideoOutput"), c"alloc"; Id);
            let output: Id = send!(output, c"initWithPixelBufferAttributes:", pixel_attrs() => Id; Id);
            let _: () = send!(item, c"addOutput:", output => Id; ());
            let player: Id = objc_retain(send!(class(c"AVPlayer"), c"playerWithPlayerItem:", item => Id; Id));
            if player.is_null() || output.is_null() {
                return Err(format!("cannot play {}", path.display()));
            }
            let _: () = send!(player, c"setMuted:", muted => bool; ());
            let mut p = Player { player, item, output };
            if at > 0.0 {
                self.seek(&mut p, at);
            }
            self.start(p)
        }
    }

    fn frame(&self, p: &mut Player) -> Option<CVPixelBuffer> {
        unsafe {
            let t: CMTime = send!(p.output, c"itemTimeForHostTime:", CACurrentMediaTime() => f64; CMTime);
            let fresh: bool = send!(p.output, c"hasNewPixelBufferForItemTime:", t => CMTime; bool);
            if !fresh {
                return None;
            }
            let buf: CVPixelBufferRef = send!(p.output, c"copyPixelBufferForItemTime:itemTimeForDisplay:", t => CMTime, std::ptr::null_mut() => *mut CMTime; CVPixelBufferRef);
            (!buf.is_null()).then(|| CVPixelBuffer::wrap_under_create_rule(buf))
        }
    }

    fn state(&self, p: &Player) -> PlayerState {
        unsafe {
            let status: isize = send!(p.item, c"status"; isize);
            if status == 2 {
                let e: Id = send!(p.item, c"error"; Id);
                return PlayerState { error: Some(error_text(e)), ..PlayerState::default() };
            }
            let time = seconds(send!(p.player, c"currentTime"; CMTime)).unwrap_or(0.0);
            let duration = seconds(send!(p.item, c"duration"; CMTime));
            let rate: f32 = send!(p.player, c"rate"; f32);
            let ended = status == 1 && rate == 0.0 && duration.is_some_and(|d| time >= d - 0.05);
            PlayerState { time, duration, ended, error: None }
        }
    }

    fn seek(&self, p: &mut Player, to: f64) {
        unsafe {
            let _: () = send!(p.player, c"seekToTime:toleranceBefore:toleranceAfter:", CMTimeMakeWithSeconds(to, 600) => CMTime, kCMTimeZero => CMTime, kCMTimeZero => CMTime; ());
            // A seek at the end restarts a stopped player (looping).
            let _: () = send!(p.player, c"play"; ());
        }
    }
}

impl AvFoundation {
    fn start(&self, p: Player) -> Result<Player, String> {
        unsafe {
            let _: () = send!(p.player, c"play"; ());
        }
        Ok(p)
    }
}

/// The BGRA pixel at the middle of a picture (tests read what was decoded).
#[allow(dead_code)]
pub fn middle_bgra(buf: &CVPixelBuffer) -> [u8; 4] {
    unsafe extern "C" {
        fn CVPixelBufferGetWidth(buf: CVPixelBufferRef) -> usize;
        fn CVPixelBufferGetHeight(buf: CVPixelBufferRef) -> usize;
    }
    unsafe {
        let r = buf.as_concrete_TypeRef();
        CVPixelBufferLockBaseAddress(r, 1);
        let (w, h, row) = (CVPixelBufferGetWidth(r), CVPixelBufferGetHeight(r), CVPixelBufferGetBytesPerRow(r));
        let p = (CVPixelBufferGetBaseAddress(r) as *const u8).add((h / 2) * row + (w / 2) * 4);
        let px = [*p, *p.add(1), *p.add(2), *p.add(3)];
        CVPixelBufferUnlockBaseAddress(r, 1);
        px
    }
}
