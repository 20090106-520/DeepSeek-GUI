import { test, expect } from './fixtures'

test.describe('Composer', () => {
  test('should display the floating composer input', async ({ page }) => {
    await page.waitForTimeout(3000)
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 10000 })
  })

  test('should accept text input in composer', async ({ page }) => {
    await page.waitForTimeout(3000)
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 10000 })
    await textarea.fill('Hello, this is an E2E test')
    const value = await textarea.inputValue()
    expect(value).toContain('Hello, this is an E2E test')
  })
})
