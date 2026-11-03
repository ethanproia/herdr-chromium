//! Visible macOS check: the see-through title bar survives fullscreen, both
//! toggled from a window and from a window opened fullscreen (a restored one).
//! It shows a real window and takes over a Space for a few seconds, so it runs
//! only with HERDR_VISIBLE_TEST=1 (the Chromium slot, never CI).
#[cfg(target_os = "macos")]
#[path = "../src/window/native_titlebar.rs"]
mod native_titlebar;

#[cfg(target_os = "macos")]
fn main() {
    use gpui::*;
    use std::time::Duration;

    struct Blank;
    impl Render for Blank {
        fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
            div().size_full().bg(rgb(0x202020))
        }
    }

    if std::env::var_os("HERDR_VISIBLE_TEST").is_none() {
        println!("titlebar fullscreen test skipped (HERDR_VISIBLE_TEST=1 runs it)");
        return;
    }
    gpui_platform::application().run(|cx| {
        let open = |cx: &mut App, bounds: WindowBounds| {
            cx.open_window(
                WindowOptions {
                    window_bounds: Some(bounds),
                    titlebar: Some(TitlebarOptions { title: Some("titlebar test".into()), appears_transparent: true, traffic_light_position: Some(point(px(12.), px(7.))) }),
                    ..Default::default()
                },
                |_, cx| cx.new(|_| Blank),
            )
            .unwrap()
        };
        let bounds = Bounds::new(point(px(100.), px(100.)), size(px(640.), px(400.)));
        let toggled = open(cx, WindowBounds::Windowed(bounds));
        let restored = open(cx, WindowBounds::Fullscreen(bounds));
        cx.spawn(async move |cx| {
            let executor = cx.background_executor().clone();
            let wait = |s: u64| executor.timer(Duration::from_secs(s));
            let flags = |cx: &mut AsyncApp, w: WindowHandle<Blank>| cx.update_window(w.into(), |_, window, _| native_titlebar::titlebar_flags(window).unwrap()).unwrap();
            let fullscreen = |cx: &mut AsyncApp, w: WindowHandle<Blank>| cx.update_window(w.into(), |_, window, _| window.toggle_fullscreen()).unwrap();
            let windowed = native_titlebar::TitlebarFlags { transparent: true, full_size_content: true, title_hidden: true, fullscreen: false };

            wait(2).await;
            assert_eq!(flags(cx, toggled), windowed, "toggled window before fullscreen");
            fullscreen(cx, toggled);
            wait(3).await;
            assert!(flags(cx, toggled).fullscreen, "toggled window entered fullscreen");
            fullscreen(cx, toggled);
            wait(3).await;
            assert_eq!(flags(cx, toggled), windowed, "toggled window after leaving fullscreen");

            assert!(flags(cx, restored).fullscreen, "window opened fullscreen");
            fullscreen(cx, restored);
            wait(3).await;
            assert_eq!(flags(cx, restored), windowed, "window opened fullscreen, after leaving it");
            println!("titlebar fullscreen test passed");
            cx.update(|cx| cx.quit());
        })
        .detach();
    });
}

#[cfg(not(target_os = "macos"))]
fn main() {}
