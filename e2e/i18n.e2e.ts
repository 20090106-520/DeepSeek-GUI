import { test, expect } from './fixtures'

test.describe('i18n', () => {
  test('should render UI text content (not raw i18n keys)', async ({ page }) => {
    await page.waitForTimeout(3000)
    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()

    const hasRawKey = bodyText!.includes('{{') || bodyText!.includes('common.')
    expect(hasRawKey).toBe(false)
  })

  test('should display content in Chinese or English', async ({ page }) => {
    await page.waitForTimeout(3000)
    const bodyText = await page.textContent('body')
    const hasChinese = /[\u4e00-\u9fff]/.test(bodyText!)
    const hasEnglish = /[a-zA-Z]{3,}/.test(bodyText!)
    expect(hasChinese || hasEnglish).toBe(true)
  })
})
