import { test as base, type Page, type Browser, chromium } from '@playwright/test'
import { spawn, type ChildProcess } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

type ElectronTestFixtures = {
  electronProcess: ChildProcess
  browser: Browser
  page: Page
}

const CDP_PORT = 9223

let _electronProc: ChildProcess | null = null

async function launchElectron(): Promise<ChildProcess> {
  if (_electronProc && !_electronProc.killed) return _electronProc

  const electronExe = join(__dirname, '../node_modules/electron/dist/electron.exe')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  const proc = spawn(electronExe, [`--remote-debugging-port=${CDP_PORT}`, '.'], {
    cwd: join(__dirname, '..'),
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  proc.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg && !msg.includes('DevTools listening')) {
      console.error('[electron:stderr]', msg)
    }
  })

  await new Promise(resolve => setTimeout(resolve, 8000))
  _electronProc = proc
  return proc
}

export const test = base.extend<ElectronTestFixtures>({
  electronProcess: [async ({}, use) => {
    const proc = await launchElectron()
    await use(proc)
  }, { scope: 'worker' }],

  browser: [async ({ electronProcess }, use) => {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`)
    await use(browser)
    await browser.close()
  }, { scope: 'worker' }],

  page: async ({ browser }, use) => {
    const contexts = browser.contexts()
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext()
    const pages = context.pages()
    const page = pages.length > 0 ? pages[0] : await context.newPage()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  }
})

export { expect } from '@playwright/test'
