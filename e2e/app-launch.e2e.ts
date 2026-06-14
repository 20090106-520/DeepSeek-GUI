import { test, expect } from './fixtures'

test.describe('App Launch', () => {
  test('should launch and show main window', async ({ page }) => {
    const root = page.locator('#root')
    await expect(root).toBeAttached({ timeout: 15000 })
  })

  test('should render the app shell', async ({ page }) => {
    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
    expect(bodyText!.length).toBeGreaterThan(0)
  })

  test('should show loading indicator or main UI', async ({ page }) => {
    const loadingOrApp = page.locator('#root')
    await expect(loadingOrApp).toBeAttached({ timeout: 15000 })
  })
})
