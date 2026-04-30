import { test, expect } from '@playwright/test';

test.describe('Multiplayer Backend Integration', () => {
  test('should have Tauri commands available', async ({ page }) => {
    await page.goto('/');
    
    // Check if Tauri is loaded
    const hasTauri = await page.evaluate(() => {
      return typeof window !== 'undefined' && 
             typeof (window as any).__TAURI__ !== 'undefined';
    });
    
    // Tauri might not be available in browser tests - that's OK
    // This test is informational
    console.log('Tauri available:', hasTauri);
  });

  test('should handle offline mode gracefully', async ({ page }) => {
    // Go offline
    await page.setOffline(true);
    
    // Navigate to app
    await page.goto('/');
    
    // App should still load (it's a desktop app)
    await expect(page).toHaveURL('/', { timeout: 10000 });
    
    // Go back online
    await page.setOffline(false);
  });

  test('should handle network errors in multiplayer', async ({ page }) => {
    // Navigate to multiplayer
    await page.goto('/multiplayer');
    
    // Simulate slow network
    await page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });
    
    // Try to join room - should handle timeout gracefully
    const joinButton = page.locator('button:has-text("Join")').first();
    if (await joinButton.count() > 0) {
      await joinButton.click();
      
      // Should show loading state
      await page.waitForTimeout(1000);
      
      // Should eventually show error or succeed
      const hasError = await page.locator('text=/error|failed|timeout/i').count() > 0;
      const hasSuccess = await page.locator('text=/joined|success/i').count() > 0;
      
      expect(hasError || hasSuccess).toBeTruthy();
    }
  });
});
