//! Data models shared across commands and services.
pub mod completion;
pub mod git;
pub mod session;
pub use completion::{OmpCommand, OmpPathSuggestion};
pub use git::{GitChangesSnapshot, GitFileChange};
pub use session::OmpSession;
