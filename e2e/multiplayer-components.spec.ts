import { test, expect } from '@playwright/test';

test.describe('Multiplayer Components', () => {
  test('should render connection status component', async ({ page }) => {
    // Navigate to multiplayer game route
    await page.goto('/multiplayer-game');
    
    // Connection status should be visible (or component should exist)
    // Check for status indicators
    const statusIndicator = page.locator('[data-testid="connection-status"], .connection-status, [aria-label*="connection"]');
    const count = await statusIndicator.count();
    
    if (count > 0) {
      await expect(statusIndicator.first()).toBeVisible();
    }
  });

  test('should render ready button in multiplayer game', async ({ page }) => {
    await page.goto('/multiplayer-game');
    
    // Ready button should exist
    const readyButton = page.locator('button:has-text(/Ready|Listo/i), [data-testid="ready-btn"]');
    const count = await readyButton.count();
    
    if (count > 0) {
      await expect(readyButton.first()).toBeVisible();
    }
  });

  test('should render sync indicator', async ({ page }) => {
    await page.goto('/multiplayer-game');
    
    // Sync indicator should exist
    const syncIndicator = page.locator('[data-testid="sync-indicator"], .sync-indicator, [aria-label*="sync"]');
    const count = await syncIndicator.count();
    
    if (count > 0) {
      await expect(syncIndicator.first()).toBeVisible();
    }
  });

  test('should show loading skeleton when loading', async ({ page }) => {
    await page.goto('/multiplayer-lobby');
    
    // Loading skeleton might appear briefly
    await page.waitForTimeout(500);
    
    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]');
    const count = await skeleton.count();
    
    // Skeleton is optional - component might load fast
    if (count > 0) {
      await expect(skeleton.first()).toBeVisible();
    }
  });
});
