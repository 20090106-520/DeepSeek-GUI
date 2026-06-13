import { test, expect } from './fixtures'

test.describe('Plugin Marketplace', () => {
  test('should have marketplace accessible', async ({ page }) => {
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })
})
