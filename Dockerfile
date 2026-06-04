# ─── Build stage ────────────────────────────────────────────────
# Builds only the `olmanager-server` binary from the Rust workspace.
# Tauri itself is never compiled (the server crate doesn't depend on it).
FROM rust:1-bookworm AS builder

WORKDIR /app

# Copy the whole Rust workspace (all crates + Cargo.lock).
COPY src-tauri ./src-tauri

# ofm_core include_str!'s these narrative JSON files (and data/) at compile time.
COPY src/content ./src/content
COPY data ./data

# Build just the web server in release mode.
RUN cargo build --release \
    --manifest-path src-tauri/Cargo.toml \
    -p olmanager-server

# ─── Runtime stage ──────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

# ca-certificates: outbound HTTPS (Supabase JWKS, Postgres TLS). wget: healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Game data the engine reads at runtime (competitions/teams/players JSON).
COPY data ./data

# The compiled server binary.
COPY --from=builder /app/src-tauri/target/release/olmanager-server /usr/local/bin/olmanager-server

# Where the engine reads world data from.
ENV OLM_DATA_DIR=/app/data
# Fly sets PORT; the server falls back to 3001 if unset.
ENV PORT=8080
EXPOSE 8080

CMD ["olmanager-server"]
