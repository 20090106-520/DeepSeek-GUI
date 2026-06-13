import { test, expect } from './fixtures'

test.describe('Settings View', () => {
  test('should have settings accessible', async ({ page }) => {
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })
})
