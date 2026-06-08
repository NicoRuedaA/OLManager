//! Supabase JWT auth.
//!
//! Supabase signs user access tokens with ES256 (asymmetric). We verify them
//! against the project's public JWKS endpoint — no shared secret needed. The
//! JWKS is fetched once and cached; if an unknown `kid` shows up we refetch.

use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use tokio::sync::RwLock;

/// Claims we care about from a Supabase access token.
#[derive(Debug, Deserialize)]
struct Claims {
    /// Subject = the auth user's UUID.
    sub: String,
}

#[derive(Debug, Deserialize, Clone)]
struct Jwk {
    kid: String,
    x: String,
    y: String,
}

#[derive(Debug, Deserialize)]
struct Jwks {
    keys: Vec<Jwk>,
}

/// Caches the project's JWKS (kid → decoding key).
#[derive(Clone)]
pub struct JwtVerifier {
    jwks_url: String,
    keys: Arc<RwLock<HashMap<String, DecodingKey>>>,
}

impl JwtVerifier {
    pub fn new(jwks_url: String) -> Self {
        Self {
            jwks_url,
            keys: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn refresh(&self) -> Result<(), String> {
        let jwks: Jwks = reqwest::get(&self.jwks_url)
            .await
            .map_err(|e| format!("fetch jwks: {e}"))?
            .json()
            .await
            .map_err(|e| format!("parse jwks: {e}"))?;

        let mut map = HashMap::new();
        for jwk in jwks.keys {
            match DecodingKey::from_ec_components(&jwk.x, &jwk.y) {
                Ok(key) => {
                    map.insert(jwk.kid, key);
                }
                Err(e) => tracing::warn!("bad jwk {}: {e}", jwk.kid),
            }
        }
        *self.keys.write().await = map;
        Ok(())
    }

    async fn key_for(&self, kid: &str) -> Option<DecodingKey> {
        if let Some(k) = self.keys.read().await.get(kid).cloned() {
            return Some(k);
        }
        // Unknown kid — refresh once (keys rotate).
        if self.refresh().await.is_ok() {
            return self.keys.read().await.get(kid).cloned();
        }
        None
    }

    /// Verify a bearer token and return the user id (`sub`).
    pub async fn verify(&self, token: &str) -> Result<String, String> {
        let header = decode_header(token).map_err(|e| format!("bad token header: {e}"))?;
        let kid = header.kid.ok_or("token missing kid")?;
        let key = self
            .key_for(&kid)
            .await
            .ok_or_else(|| format!("no key for kid {kid}"))?;

        let mut validation = Validation::new(Algorithm::ES256);
        // Supabase access tokens carry aud = "authenticated".
        validation.set_audience(&["authenticated"]);

        let data = decode::<Claims>(token, &key, &validation)
            .map_err(|e| format!("token verify failed: {e}"))?;
        Ok(data.claims.sub)
    }
}

/// Axum extractor: yields the authenticated user's id, or 401.
///
/// Requires `AppState` (or any state) to expose a `JwtVerifier` via the
/// `HasVerifier` trait below.
pub struct AuthUser {
    pub user_id: String,
}

pub trait HasVerifier {
    fn verifier(&self) -> &JwtVerifier;
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: HasVerifier + Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "missing Authorization".into()))?;

        let token = auth
            .strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "expected Bearer token".into()))?;

        let user_id = state
            .verifier()
            .verify(token)
            .await
            .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;

        Ok(AuthUser { user_id })
    }
}
