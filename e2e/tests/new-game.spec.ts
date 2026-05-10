import { test, expect } from "@playwright/test";

test.describe("New Game Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock before any page load
    await page.addInitScript({ path: "e2e/mocks/tauri.js" });
    await page.goto("/");
  });

  test("should display the main menu with create manager form", async ({ page }) => {
    await expect(page.locator("text=Nueva Partida")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#create-manager-field-firstName")).toBeVisible();
    await expect(page.locator("#create-manager-field-lastName")).toBeVisible();
  });

  test("should create a new game and navigate to team selection", async ({ page }) => {
    // Fill manager form
    await page.locator("#create-manager-field-firstName input").fill("John");
    await page.locator("#create-manager-field-lastName input").fill("Doe");
    await page.locator("#create-manager-field-nickname input").fill("JD");

    // Fill date of birth
    const dobInput = page.locator('input[type="date"]');
    await dobInput.fill("2000-01-15");

    // Select nationality from the searchable dropdown
    const nationalitySearch = page.locator(
      'input[placeholder*="nationality" i], input[placeholder*="pa\u00eds" i]',
    );
    await nationalitySearch.fill("ES");
    await page.locator("text=Spain").first().click();

    // Click "Iniciar carrera" / "Start Career"
    await page.locator('button:has-text("Comenzar")').click();

    // Should navigate to /select-team
    await page.waitForURL("**/select-team", { timeout: 30000 });

    // Verify team selection shows teams
    await expect(page.locator("text=Fnatic").first()).toBeVisible({ timeout: 15000 });

    // Select Fnatic
    await page.locator('button:has-text("Fnatic")').first().click();

    // Verify confirm button is enabled
    const confirmBtn = page.locator('button:has-text("Confirmar")');
    await expect(confirmBtn).toBeEnabled();

    // Confirm selection
    await confirmBtn.click();

    // Should navigate to dashboard after a brief loading
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    await expect(page.locator("text=Dashboard").first()).toBeVisible({ timeout: 15000 });
  });
});
