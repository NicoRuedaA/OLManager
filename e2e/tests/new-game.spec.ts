import { test, expect } from "@playwright/test";

test.describe("New Game Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before any page load
    await page.addInitScript({ path: "e2e/mocks/tauri.js" });
    await page.goto("/");
  });

  test("should display the main menu with new game button", async ({ page }) => {
    // Main menu should show the "Nueva Partida" button (menuState === "main")
    const newGameBtn = page.locator('button:has-text("Nueva Partida")');
    await expect(newGameBtn).toBeVisible({ timeout: 15000 });

    // Click to open the create manager form
    await newGameBtn.click();

    // Form fields should now be visible
    await expect(page.locator("#create-manager-field-firstName")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#create-manager-field-lastName")).toBeVisible();
  });

  test("should create a new game and navigate to team selection", async ({ page }) => {
    // Click "Nueva Partida" to open the create manager form
    await page.locator('button:has-text("Nueva Partida")').click({ timeout: 15000 });

    // Wait for form to appear
    await expect(page.locator("#create-manager-field-firstName")).toBeVisible({ timeout: 5000 });

    // Fill manager form
    await page.locator("#create-manager-field-firstName input").fill("John");
    await page.locator("#create-manager-field-lastName input").fill("Doe");
    await page.locator("#create-manager-field-nickname input").fill("JD");

    // Fill date of birth (custom DatePicker)
    // Day input: numeric input inside the DatePicker, first one
    await page.locator("input[inputmode='numeric']").nth(0).fill("15");
    // Year input: numeric input inside the DatePicker, second one
    await page.locator("input[inputmode='numeric']").nth(1).fill("2000");
    // Month: click the toggle button inside the DatePicker
    await page.locator("#create-manager-field-dob button").first().click();
    // Select first month from the dropdown list
    await page.locator(".max-h-48 button").first().click();

    // Select nationality from the searchable dropdown
    // Click the toggle button to open dropdown
    await page.locator("#create-manager-field-nationality button[type='button']").first().click();
    // Type country code (ES = Spain, works regardless of locale)
    await page.locator("#create-manager-field-nationality input[type='text']").fill("ES");
    // Wait for filter and click the first option
    await page.locator("#create-manager-field-nationality [class*='max-h'] button").first().waitFor({ timeout: 5000 });
    await page.locator("#create-manager-field-nationality [class*='max-h'] button").first().click({ force: true });

    // Click submit button (locale-independent, button type="submit")
    await page.locator('button[type="submit"]').click();

    // Should navigate to /select-team
    await page.waitForURL("**/select-team", { timeout: 30000 });

    // Verify team selection shows teams
    await expect(page.locator("text=Fnatic").first()).toBeVisible({ timeout: 15000 });

    // Select Fnatic
    await page.locator('button:has-text("Fnatic")').first().click();

    // The manage button says "Dirigir FNC" (Spanish) — unique text on page
    const confirmBtn = page.locator('button:has-text("Dirigir")');
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 });

    // Confirm selection
    await confirmBtn.click();

    // Should navigate to dashboard — verify by URL and team name presence
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    await expect(page.locator("text=Fnatic").first()).toBeVisible({ timeout: 15000 });
  });
});
