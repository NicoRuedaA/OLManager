# Integration Tests - Frontend + Backend

These tests verify the integration between React frontend and Rust backend.

## Setup

```bash
# Run integration tests
cargo test --test multiplayer_integration_tests

# Run with output
cargo test --test multiplayer_integration_tests -- --nocapture
```

## Coverage

- ✅ Room creation and management
- ✅ Player context validation
- ✅ Day advancement logic
- ✅ State synchronization
- ✅ Backup and recovery
- ✅ Hotseat mode

## Running in CI

Integration tests run automatically in CI/CD pipeline.
