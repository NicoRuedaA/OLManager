use serde::Serialize;

/// Unified application error with structured code, message, and optional details.
/// Frontend should map `code` to an i18n message and display `details` for debugging.
#[derive(Debug, thiserror::Error, Serialize)]
pub enum AppError {
    #[error("Save not found: {0}")]
    SaveNotFound(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Session error: {0}")]
    Session(String),

    #[error("Lock error: {0}")]
    Lock(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("{0}")]
    Generic(String),
}

impl AppError {
    /// Human-readable error code for frontend i18n mapping.
    pub fn code(&self) -> &'static str {
        match self {
            AppError::SaveNotFound(_) => "SAVE_NOT_FOUND",
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::Session(_) => "SESSION_ERROR",
            AppError::Lock(_) => "LOCK_ERROR",
            AppError::Io(_) => "IO_ERROR",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Conflict(_) => "CONFLICT",
            AppError::Generic(_) => "GENERIC_ERROR",
        }
    }

    /// Human-readable message (English default, for development).
    pub fn message(&self) -> String {
        self.to_string()
    }
}

// Allow converting from common error types.
// Each new `From` impl makes it easier to use `?` with AppError.

impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Generic(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Generic(s.to_string())
    }
}
