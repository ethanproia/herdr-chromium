//! macOS: the title bar as AppKit sees it (`window.native`), for checking
//! that the see-through title bar survives fullscreen. Shared with the
//! visible test `tests/titlebar_fullscreen.rs`.
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use std::ffi::{c_char, c_void};

#[link(name = "objc")]
unsafe extern "C" {
    fn sel_registerName(name: *const c_char) -> *mut c_void;
    fn objc_msgSend();
}

const FULL_SCREEN: usize = 1 << 14;
const FULL_SIZE_CONTENT_VIEW: usize = 1 << 15;
const TITLE_HIDDEN: isize = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TitlebarFlags {
    pub transparent: bool,
    pub full_size_content: bool,
    pub title_hidden: bool,
    pub fullscreen: bool,
}

/// None off macOS or without a native window.
pub fn titlebar_flags(window: &impl HasWindowHandle) -> Option<TitlebarFlags> {
    let RawWindowHandle::AppKit(h) = window.window_handle().ok()?.as_raw() else { return None };
    // SAFETY: each cast matches the selector's AppKit signature; the view is GPUI's live NSView.
    unsafe {
        let id: extern "C" fn(*mut c_void, *mut c_void) -> *mut c_void = std::mem::transmute(objc_msgSend as unsafe extern "C" fn());
        let flag: extern "C" fn(*mut c_void, *mut c_void) -> i8 = std::mem::transmute(objc_msgSend as unsafe extern "C" fn());
        let int: extern "C" fn(*mut c_void, *mut c_void) -> isize = std::mem::transmute(objc_msgSend as unsafe extern "C" fn());
        let ns_window = id(h.ns_view.as_ptr(), sel_registerName(c"window".as_ptr()));
        if ns_window.is_null() {
            return None;
        }
        let mask = int(ns_window, sel_registerName(c"styleMask".as_ptr())) as usize;
        Some(TitlebarFlags {
            transparent: flag(ns_window, sel_registerName(c"titlebarAppearsTransparent".as_ptr())) != 0,
            full_size_content: mask & FULL_SIZE_CONTENT_VIEW != 0,
            title_hidden: int(ns_window, sel_registerName(c"titleVisibility".as_ptr())) == TITLE_HIDDEN,
            fullscreen: mask & FULL_SCREEN != 0,
        })
    }
}
