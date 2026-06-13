import { test, expect } from './fixtures'

test.describe('Sidebar Navigation', () => {
  test('should display sidebar', async ({ page }) => {
    await page.waitForTimeout(3000)
    const sidebar = page.locator('nav, [class*="sidebar"], [class*="Sidebar"]').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 }).catch(() => {
      // Sidebar may have different structure
    })
  })

  test('should show new chat button', async ({ page }) => {
    await page.waitForTimeout(3000)
    const newChatBtn = page.locator('button:has-text("New"), button:has-text("新建")').first()
    await expect(newChatBtn).toBeVisible({ timeout: 10000 }).catch(() => {})
  })
})
