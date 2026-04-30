# Multiplayer E2E Tests

These tests verify the online multiplayer mode end-to-end.

## Setup

```bash
# Install Playwright browsers
npx playwright install

# Run tests
npx playwright test

# Run tests with UI
npx playwright test --ui

# Run specific test file
npx playwright test e2e/multiplayer.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug
```

## Test Coverage

- ✅ Multiplayer menu navigation
- ✅ Room creation flow
- ✅ Room join flow
- ✅ Player selection
- ✅ Ready button functionality
- ✅ Connection status display
- ✅ Disconnect recovery

## Notes

- Tests run against local dev server (`npm run dev`)
- Requires Tauri backend to be running for full functionality
- Some tests use mocked data for reliability
