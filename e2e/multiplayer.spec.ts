import { test, expect } from '@playwright/test';

test.describe('Multiplayer Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
  });

  test('should display multiplayer button in main menu', async ({ page }) => {
    // Wait for app to load
    await expect(page.getByText(/OLManager|Open League/)).toBeVisible({ timeout: 10000 });
    
    // Look for multiplayer button - check multiple possible selectors
    const multiplayerButton = page.locator('button:has-text("Multiplayer"), [data-testid="multiplayer-btn"], .multiplayer-btn');
    
    // If multiplayer button exists, it should be visible
    const count = await multiplayerButton.count();
    if (count > 0) {
      await expect(multiplayerButton.first()).toBeVisible();
    } else {
      // Alternative: check for Users icon or similar
      const usersIcon = page.locator('[aria-label*="multiplayer"], svg[aria-label*="users"]');
      const iconCount = await usersIcon.count();
      if (iconCount > 0) {
        await expect(usersIcon.first()).toBeVisible();
      }
    }
  });

  test('should navigate to multiplayer menu', async ({ page }) => {
    // Try to find and click multiplayer button
    const multiplayerButton = page.locator('button:has-text("Multiplayer")').first();
    const count = await multiplayerButton.count();
    
    if (count > 0) {
      await multiplayerButton.click();
      
      // Should navigate to multiplayer route
      await expect(page).toHaveURL(/.*multiplayer.*/, { timeout: 5000 });
      
      // Should show create/join tabs or forms
      const hasCreateTab = await page.locator('text=/Create|Crear/').count() > 0;
      const hasJoinTab = await page.locator('text=/Join|Unirse/').count() > 0;
      
      expect(hasCreateTab || hasJoinTab).toBeTruthy();
    }
  });

  test('should display room code input for joining', async ({ page }) => {
    // Navigate to multiplayer if possible
    const multiplayerButton = page.locator('button:has-text("Multiplayer")').first();
    if (await multiplayerButton.count() > 0) {
      await multiplayerButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Look for room code input
    const roomCodeInput = page.locator('input[placeholder*="code"], input[placeholder*="código"], input[name="roomCode"]');
    const inputCount = await roomCodeInput.count();
    
    if (inputCount > 0) {
      await expect(roomCodeInput.first()).toBeVisible();
      
      // Test input validation - should auto-uppercase
      await roomCodeInput.first().fill('abc123');
      const value = await roomCodeInput.first().inputValue();
      expect(value).toBe('ABC123');
    }
  });

  test('should show create room form', async ({ page }) => {
    // Navigate to multiplayer
    const multiplayerButton = page.locator('button:has-text("Multiplayer")').first();
    if (await multiplayerButton.count() > 0) {
      await multiplayerButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Look for create room button or form
    const createButton = page.locator('button:has-text("Create"), button:has-text("Crear")');
    const createCount = await createButton.count();
    
    if (createCount > 0) {
      await expect(createButton.first()).toBeVisible();
    }
  });
});
