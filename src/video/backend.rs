//! HERDR: what plays a clip (shared with tests/video_play.rs).

/// What plays a clip: AVFoundation on macOS; tests use a fake.
pub trait Backend {
    type Player;
    /// A decoded picture the screen can show.
    type Picture: Clone;
    /// The frame at `at` seconds, as a still.
    fn still(&self, path: &std::path::Path, at: f64) -> Result<Self::Picture, String>;
    /// A playing player, from `at` seconds.
    fn play(&self, path: &std::path::Path, at: f64, muted: bool) -> Result<Self::Player, String>;
    /// Its newest frame, when a new one is due.
    fn frame(&self, p: &mut Self::Player) -> Option<Self::Picture>;
    /// Position and length in seconds (length None until known), whether it reached the end, and a load error.
    fn state(&self, p: &Self::Player) -> PlayerState;
    fn seek(&self, p: &mut Self::Player, to: f64);
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PlayerState {
    pub time: f64,
    pub duration: Option<f64>,
    pub ended: bool,
    pub error: Option<String>,
}
