import { app, dialog, ipcMain, shell, type BrowserWindow, type WebContents } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import {
  type AppSettingsPatch,
  type AppSettingsV1,
  type ClawRunResult,
  type ClawTaskFromTextResult,
  type ClawRuntimeStatus,
  type ScheduleRunResult,
  type ScheduleRuntimeStatus,
  type ScheduleTaskFromTextResult
} from '../../shared/app-settings'
import type {
  ClawImInstallPollResult,
  ClawImInstallQrResult,
  DesktopCommand,
  RuntimeRequestResult,
  SystemNotificationResult,
  TurnCompleteNotificationPayload,
  UpstreamModelsResult,
  WorkspacePickResult
} from '../../shared/ds-gui-api'
import type { GuiUpdateDownloadResult, GuiUpdateInfo, GuiUpdateInstallResult, GuiUpdateState } from '../../shared/gui-update'
import {
  clawMirrorPayloadSchema,
  clawImInstallPollPayloadSchema,
  clawTaskFromTextPayloadSchema,
  deepseekConfigContentSchema,
  desktopCommandSchema,
  defaultPathSchema,
  gitBranchPayloadSchema,
  guiUpdateChannelSchema,
  logErrorPayloadSchema,
  notificationPayloadSchema,
  openEditorPathPayloadSchema,
  rootPathSchema,
  runtimeRequestPayloadSchema,
  scheduleTaskFromTextPayloadSchema,
  shellOpenExternalUrlSchema,
  skillListPayloadSchema,
  skillSaveFilePayloadSchema,
  settingsPatchSchema,
  streamIdSchema,
  workspaceDirectoryCreatePayloadSchema,
  workspaceClipboardImageSavePayloadSchema,
  workspaceDirectoryTargetPayloadSchema,
  workspaceEntryDeletePayloadSchema,
  workspaceEntryRenamePayloadSchema,
  workspaceFileCreatePayloadSchema,
  workspaceFileTargetPayloadSchema,
  workspaceFileWatchPayloadSchema,
  workspaceFileWritePayloadSchema,
  workspaceFileUploadPayloadSchema,
  workspaceFileDownloadPayloadSchema,
  writeExportPayloadSchema,
  writeRichClipboardPayloadSchema,
  writeInlineCompletionPayloadSchema,
  chatExportPayloadSchema,
  workspaceRootSchema
} from './app-ipc-schemas'
import type { JsonSettingsStore } from '../settings-store'
import type { ClawRuntime } from '../claw-runtime'
import type { ScheduleRuntime } from '../schedule-runtime'
import { createAndSwitchGitBranch, getGitBranches, switchGitBranch } from '../services/git-service'
import {
  createWorkspaceDirectory,
  createWorkspaceFile,
  deleteWorkspaceEntry,
  downloadWorkspaceFile,
  expandHomePath,
  listEditorsResult,
  listWorkspaceDirectory,
  normalizeSkillFolderName,
  openEditorPath,
  openPathWithShell,
  readClipboardImage,
  readWorkspaceImage,
  readWorkspaceFile,
  renameWorkspaceEntry,
  resolveWorkspaceFile,
  saveWorkspaceClipboardImage,
  uploadWorkspaceFiles,
  writeWorkspaceFile
} from '../services/workspace-service'
import {
  clearWriteInlineCompletionDebugEntries,
  listWriteInlineCompletionDebugEntries,
  requestWriteInlineCompletion
} from '../services/write-inline-completion-service'
import { copyWriteDocumentAsRichText, exportWriteDocument } from '../services/write-export-service'
import { exportChatMessages } from '../services/chat-export-service'
import { installPlugin, listPlugins, togglePlugin, uninstallPlugin } from '../services/plugin-manager-service'
import { listGuiSkills } from '../services/skill-service'

type GuiUpdaterModule = typeof import('../gui-updater')

type WorkspaceFileWatchRecord = {
  watcher: FSWatcher
  sender: WebContents
  path: string
  workspaceRoot: string
  timer: ReturnType<typeof setTimeout> | null
}

type RegisterAppIpcHandlersOptions = {
  store: JsonSettingsStore
  getMainWindow: () => BrowserWindow | null
  applySettingsPatch: (partial: AppSettingsPatch) => Promise<AppSettingsV1>
  runtimeRequest: (
    path: string,
    method?: string,
    body?: string
  ) => Promise<RuntimeRequestResult>
  fetchUpstreamModels: () => Promise<UpstreamModelsResult>
  getClawRuntime: () => ClawRuntime | null
  getScheduleRuntime: () => ScheduleRuntime | null
  startFeishuInstallQrcode: (isLark: boolean) => Promise<ClawImInstallQrResult>
  pollFeishuInstall: (deviceCode: string) => Promise<ClawImInstallPollResult>
  startWeixinInstallQrcode: (weixinBridgeUrl?: string) => Promise<ClawImInstallQrResult>
  pollWeixinInstall: (deviceCode: string, weixinBridgeUrl?: string) => Promise<ClawImInstallPollResult>
  resolveKunConfigPath: () => string
  onKunMcpConfigWritten?: (path: string, content: string) => Promise<void> | void
  showTurnCompleteNotification: (
    payload: TurnCompleteNotificationPayload
  ) => Promise<SystemNotificationResult>
  getAppVersion: () => string
  readGuiUpdateState: () => Promise<GuiUpdateState>
  loadGuiUpdaterModule: () => Promise<GuiUpdaterModule>
  resolveLogDirectory: () => string
  logError: (category: string, message: string, detail?: unknown) => void
}

const MAX_BODY_BYTES = 100_000

function parseIpcPayload<T>(channel: string, schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload)
  if (parsed.success) return parsed.data
  const issue = parsed.error.issues[0]
  throw new Error(`Invalid payload for ${channel}: ${issue?.message ?? 'Bad request.'}`)
}

function validateMcpConfigContent(content: string): void {
  const trimmed = content.trim()
  if (!trimmed) return
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`MCP config must be JSON: ${message}`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MCP config must be a JSON object.')
  }
}

function runDesktopCommand(
  command: DesktopCommand,
  sender: WebContents,
  getMainWindow: () => BrowserWindow | null
): void {
  const mainWindow = getMainWindow()
  const contents = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : sender

  switch (command) {
    case 'undo':
      contents.undo()
      return
    case 'redo':
      contents.redo()
      return
    case 'cut':
      contents.cut()
      return
    case 'copy':
      contents.copy()
      return
    case 'paste':
      contents.paste()
      return
    case 'selectAll':
      contents.selectAll()
      return
    case 'reload':
      contents.reload()
      return
    case 'zoomIn':
      contents.setZoomLevel(contents.getZoomLevel() + 1)
      return
    case 'zoomOut':
      contents.setZoomLevel(contents.getZoomLevel() - 1)
      return
    case 'resetZoom':
      contents.setZoomLevel(0)
      return
    case 'toggleDevTools':
      contents.toggleDevTools()
      return
    case 'minimize':
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize()
      return
    case 'toggleMaximize':
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
      return
    case 'close':
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
      return
    case 'quit':
      app.quit()
      return
  }
}

export function registerAppIpcHandlers(options: RegisterAppIpcHandlersOptions): void {
  const {
    store,
    getMainWindow,
    applySettingsPatch,
    runtimeRequest,
    fetchUpstreamModels,
    getClawRuntime,
    getScheduleRuntime,
    startFeishuInstallQrcode,
    pollFeishuInstall,
    startWeixinInstallQrcode,
    pollWeixinInstall,
    resolveKunConfigPath,
    onKunMcpConfigWritten,
    showTurnCompleteNotification,
    getAppVersion,
    readGuiUpdateState,
    loadGuiUpdaterModule,
    resolveLogDirectory,
    logError
  } = options
  const workspaceFileWatchers = new Map<string, WorkspaceFileWatchRecord>()

  const disposeWorkspaceFileWatch = (watchId: string): boolean => {
    const record = workspaceFileWatchers.get(watchId)
    if (!record) return false
    if (record.timer) clearTimeout(record.timer)
    try {
      record.watcher.close()
    } catch (error) {
      logError('workspace-watch', 'Failed to close workspace file watcher', {
        watchId,
        message: error instanceof Error ? error.message : String(error)
      })
    }
    workspaceFileWatchers.delete(watchId)
    return true
  }

  const disposeWorkspaceFileWatchesForSender = (sender: WebContents): void => {
    for (const [watchId, record] of workspaceFileWatchers) {
      if (record.sender.id === sender.id) {
        disposeWorkspaceFileWatch(watchId)
      }
    }
  }

  const emitWorkspaceFileChange = async (watchId: string): Promise<void> => {
    const record = workspaceFileWatchers.get(watchId)
    if (!record) return
    const changedAt = new Date().toISOString()
    try {
      const result = await readWorkspaceFile({
        path: record.path,
        workspaceRoot: record.workspaceRoot
      })
      const latest = workspaceFileWatchers.get(watchId)
      if (!latest || latest.sender.isDestroyed()) return
      if (result.ok) {
        latest.sender.send('file:workspace-changed', {
          ok: true,
          watchId,
          workspaceRoot: latest.workspaceRoot,
          path: result.path,
          content: result.content,
          size: result.size,
          truncated: result.truncated,
          changedAt
        })
        return
      }
      latest.sender.send('file:workspace-changed', {
        ok: false,
        watchId,
        workspaceRoot: latest.workspaceRoot,
        path: latest.path,
        message: result.message,
        changedAt
      })
    } catch (error) {
      const latest = workspaceFileWatchers.get(watchId)
      if (!latest || latest.sender.isDestroyed()) return
      latest.sender.send('file:workspace-changed', {
        ok: false,
        watchId,
        workspaceRoot: latest.workspaceRoot,
        path: latest.path,
        message: error instanceof Error ? error.message : String(error),
        changedAt
      })
    }
  }

  const scheduleWorkspaceFileChange = (watchId: string): void => {
    const record = workspaceFileWatchers.get(watchId)
    if (!record) return
    if (record.timer) clearTimeout(record.timer)
    record.timer = setTimeout(() => {
      const latest = workspaceFileWatchers.get(watchId)
      if (!latest) return
      latest.timer = null
      void emitWorkspaceFileChange(watchId)
    }, 90)
  }

  ipcMain.handle('settings:get', async () => store.load())
  ipcMain.handle('settings:set', async (_, partial: unknown) =>
    applySettingsPatch(
      parseIpcPayload('settings:set', settingsPatchSchema, partial) as AppSettingsPatch
    )
  )

  ipcMain.handle('runtime:request', async (_, payload: unknown) => {
    const request = parseIpcPayload('runtime:request', runtimeRequestPayloadSchema, payload)
    return runtimeRequest(request.path, request.method, request.body)
  })

  ipcMain.handle('upstream:models', async () => fetchUpstreamModels())

  ipcMain.handle('claw:status', async (): Promise<ClawRuntimeStatus> =>
    getClawRuntime()?.status() ?? {
      imServerRunning: false,
      imUrl: '',
      runningTaskIds: []
    }
  )

  ipcMain.handle('claw:task:run', async (_, taskId: unknown): Promise<ClawRunResult> => {
    const normalizedTaskId = parseIpcPayload('claw:task:run', streamIdSchema, taskId)
    const scheduleRuntime = getScheduleRuntime()
    if (!scheduleRuntime) return { ok: false, message: 'Schedule runtime is not initialized.' }
    return scheduleRuntime.runTask(normalizedTaskId)
  })

  ipcMain.handle('schedule:status', async (): Promise<ScheduleRuntimeStatus> =>
    getScheduleRuntime()?.status() ?? {
      internalServerRunning: false,
      internalUrl: '',
      runningTaskIds: [],
      powerSaveBlockerActive: false
    }
  )

  ipcMain.handle('schedule:task:run', async (_, taskId: unknown): Promise<ScheduleRunResult> => {
    const normalizedTaskId = parseIpcPayload('schedule:task:run', streamIdSchema, taskId)
    const scheduleRuntime = getScheduleRuntime()
    if (!scheduleRuntime) return { ok: false, message: 'Schedule runtime is not initialized.' }
    return scheduleRuntime.runTask(normalizedTaskId)
  })

  ipcMain.handle(
    'claw:channel:mirror',
    async (_, payload: unknown) => {
      const request = parseIpcPayload('claw:channel:mirror', clawMirrorPayloadSchema, payload)
      const clawRuntime = getClawRuntime()
      if (!clawRuntime) return { ok: false as const, message: 'Claw runtime is not initialized.' }
      return clawRuntime.mirrorThreadMessageToIm(
        request.threadId,
        request.text,
        request.direction
      )
    }
  )

  ipcMain.handle(
    'claw:channel:mirror-to-feishu',
    async (_, payload: unknown) => {
      const request = parseIpcPayload('claw:channel:mirror-to-feishu', clawMirrorPayloadSchema, payload)
      const clawRuntime = getClawRuntime()
      if (!clawRuntime) return { ok: false as const, message: 'Claw runtime is not initialized.' }
      return clawRuntime.mirrorThreadMessageToIm(
        request.threadId,
        request.text,
        request.direction
      )
    }
  )

  ipcMain.handle(
    'claw:task:create-from-text',
    async (_, payload: unknown): Promise<ClawTaskFromTextResult> => {
      const request = parseIpcPayload(
        'claw:task:create-from-text',
        clawTaskFromTextPayloadSchema,
        payload
      )
      const scheduleRuntime = getScheduleRuntime()
      if (!scheduleRuntime) return { kind: 'error', message: 'Schedule runtime is not initialized.' }
      const settings = await store.load()
      const channel = request.channelId
        ? settings.claw.channels.find((item) => item.id === request.channelId)
        : undefined
      return scheduleRuntime.createScheduledTaskFromText(request.text, {
        workspaceRoot: channel?.workspaceRoot || settings.schedule.defaultWorkspaceRoot || settings.workspaceRoot,
        modelHint: request.modelHint,
        mode: request.mode
      })
    }
  )

  ipcMain.handle(
    'schedule:task:create-from-text',
    async (_, payload: unknown): Promise<ScheduleTaskFromTextResult> => {
      const request = parseIpcPayload(
        'schedule:task:create-from-text',
        scheduleTaskFromTextPayloadSchema,
        payload
      )
      const scheduleRuntime = getScheduleRuntime()
      if (!scheduleRuntime) return { kind: 'error', message: 'Schedule runtime is not initialized.' }
      return scheduleRuntime.createScheduledTaskFromText(request.text, {
        workspaceRoot: request.workspaceRoot,
        modelHint: request.modelHint,
        mode: request.mode
      })
    }
  )

  ipcMain.handle(
    'claw:im-install:qrcode',
    async (_, payload: unknown) => {
      const request = parseIpcPayload(
        'claw:im-install:qrcode',
        z.object({ provider: z.enum(['feishu', 'weixin']), isLark: z.boolean().optional() }).strict(),
        payload
      )
      if (request.provider === 'weixin') {
        return startWeixinInstallQrcode()
      }
      return startFeishuInstallQrcode(request.isLark === true)
    }
  )

  ipcMain.handle(
    'claw:im-install:poll',
    async (_, payload: unknown) => {
      const request = parseIpcPayload('claw:im-install:poll', clawImInstallPollPayloadSchema, payload)
      if (request.provider === 'weixin') {
        return pollWeixinInstall(request.deviceCode)
      }
      return pollFeishuInstall(request.deviceCode)
    }
  )

  ipcMain.handle('workspace:pick-directory', async (_, defaultPath: unknown): Promise<WorkspacePickResult> => {
    const normalizedDefaultPath = parseIpcPayload(
      'workspace:pick-directory',
      z.object({ defaultPath: defaultPathSchema }).strict(),
      { defaultPath }
    ).defaultPath
    const options: Electron.OpenDialogOptions = {
      title: 'Select working directory',
      defaultPath: normalizedDefaultPath,
      properties: ['openDirectory', 'createDirectory', 'dontAddToRecent']
    }
    const mainWindow = getMainWindow()
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    return {
      canceled: result.canceled,
      path: result.canceled ? null : (result.filePaths[0] ?? null)
    }
  })

  ipcMain.handle(
    'skill:save-file',
    async (_, payload: unknown) => {
      const request = parseIpcPayload('skill:save-file', skillSaveFilePayloadSchema, payload)
      try {
        const rootPath = expandHomePath(request.rootPath)
        if (!rootPath) {
          return { ok: false as const, message: 'Skill directory is required.' }
        }
        const skillName = normalizeSkillFolderName(request.skillName)
        const skillDir = join(rootPath, skillName)
        const filePath = join(skillDir, 'SKILL.md')
        await mkdir(skillDir, { recursive: true })
        await writeFile(filePath, request.content, 'utf8')
        return { ok: true as const, path: filePath }
      } catch (error) {
        return {
          ok: false as const,
          message: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  ipcMain.handle('skill:list', async (_, payload: unknown) => {
    const request = parseIpcPayload('skill:list', skillListPayloadSchema, payload)
    const settings = await store.load()
    return listGuiSkills(settings, request.workspaceRoot)
  })

  ipcMain.handle('skill:open-root', async (_, rootPath: unknown) => {
    const normalizedRootPath = parseIpcPayload('skill:open-root', rootPathSchema, rootPath)
    try {
      const target = expandHomePath(normalizedRootPath)
      if (!target) {
        return { ok: false as const, message: 'Skill directory is required.' }
      }
      await mkdir(target, { recursive: true })
      return openPathWithShell(target)
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })

  ipcMain.handle('deepseek:config:read', async () => {
    const path = resolveKunConfigPath()
    try {
      const content = await readFile(path, 'utf8')
      return { path, content, exists: true as const }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { path, content: '', exists: false as const }
      }
      throw error
    }
  })

  ipcMain.handle('deepseek:config:write', async (_, content: unknown) => {
    const validatedContent = parseIpcPayload(
      'deepseek:config:write',
      deepseekConfigContentSchema,
      content
    )
    const path = resolveKunConfigPath()
    validateMcpConfigContent(validatedContent)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, validatedContent, 'utf8')
    try {
      await onKunMcpConfigWritten?.(path, validatedContent)
    } catch (error: unknown) {
      logError('mcp-config', 'Failed to apply MCP config change after write', {
        path,
        message: error instanceof Error ? error.message : String(error)
      })
    }
    return { ok: true as const, path }
  })

  ipcMain.handle('deepseek:config:open-dir', async () => {
    try {
      const path = resolveKunConfigPath()
      const dirPath = dirname(path)
      await mkdir(dirPath, { recursive: true })
      return openPathWithShell(dirPath)
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })

  ipcMain.handle('git:branches', async (_, workspaceRoot: unknown) =>
    getGitBranches(parseIpcPayload('git:branches', workspaceRootSchema, workspaceRoot))
  )
  ipcMain.handle(
    'git:switch-branch',
    async (_, payload: unknown) => {
      const request = parseIpcPayload('git:switch-branch', gitBranchPayloadSchema, payload)
      return switchGitBranch(request.workspaceRoot, request.branch)
    }
  )
  ipcMain.handle(
    'git:create-and-switch-branch',
    async (_, payload: unknown) => {
      const request = parseIpcPayload(
        'git:create-and-switch-branch',
        gitBranchPayloadSchema,
        payload
      )
      return createAndSwitchGitBranch(request.workspaceRoot, request.branch)
    }
  )

  ipcMain.handle('editor:list', async () => listEditorsResult())
  ipcMain.handle('editor:open-path', async (_, payload: unknown) =>
    openEditorPath(parseIpcPayload('editor:open-path', openEditorPathPayloadSchema, payload))
  )

  ipcMain.handle('file:resolve-workspace', async (_, payload: unknown) =>
    resolveWorkspaceFile(
      parseIpcPayload('file:resolve-workspace', workspaceFileTargetPayloadSchema, payload)
    )
  )
  ipcMain.handle('file:list-workspace-directory', async (_, payload: unknown) =>
    listWorkspaceDirectory(
      parseIpcPayload('file:list-workspace-directory', workspaceDirectoryTargetPayloadSchema, payload)
    )
  )
  ipcMain.handle('file:read-workspace', async (_, payload: unknown) =>
    readWorkspaceFile(
      parseIpcPayload('file:read-workspace', workspaceFileTargetPayloadSchema, payload)
    )
  )
  ipcMain.handle('file:read-workspace-image', async (_, payload: unknown) =>
    readWorkspaceImage(
      parseIpcPayload('file:read-workspace-image', workspaceFileTargetPayloadSchema, payload)
    )
  )
  ipcMain.handle('file:write-workspace', async (_, payload: unknown) =>
    writeWorkspaceFile(
      parseIpcPayload('file:write-workspace', workspaceFileWritePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:create-workspace', async (_, payload: unknown) =>
    createWorkspaceFile(
      parseIpcPayload('file:create-workspace', workspaceFileCreatePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:create-workspace-directory', async (_, payload: unknown) =>
    createWorkspaceDirectory(
      parseIpcPayload('file:create-workspace-directory', workspaceDirectoryCreatePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:save-workspace-clipboard-image', async (_, payload: unknown) =>
    saveWorkspaceClipboardImage(
      parseIpcPayload(
        'file:save-workspace-clipboard-image',
        workspaceClipboardImageSavePayloadSchema,
        payload
      )
    )
  )
  ipcMain.handle('clipboard:read-image', async () => readClipboardImage())
  ipcMain.handle('file:rename-workspace-entry', async (_, payload: unknown) =>
    renameWorkspaceEntry(
      parseIpcPayload('file:rename-workspace-entry', workspaceEntryRenamePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:delete-workspace-entry', async (_, payload: unknown) =>
    deleteWorkspaceEntry(
      parseIpcPayload('file:delete-workspace-entry', workspaceEntryDeletePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:watch-workspace', async (event, payload: unknown) => {
    const request = parseIpcPayload('file:watch-workspace', workspaceFileWatchPayloadSchema, payload)
    const initial = await readWorkspaceFile(request)
    let watchedPath: string
    let initialContent: string
    let initialSize: number
    let initialTruncated: boolean
    if (initial.ok) {
      watchedPath = initial.path
      initialContent = initial.content
      initialSize = initial.size
      initialTruncated = initial.truncated
    } else {
      const initialImage = await readWorkspaceImage(request)
      if (!initialImage.ok) return initial
      watchedPath = initialImage.path
      initialContent = ''
      initialSize = initialImage.size
      initialTruncated = false
    }

    const watchId = randomUUID()
    try {
      const watcher = watch(watchedPath, { persistent: false }, () => {
        scheduleWorkspaceFileChange(watchId)
      })
      workspaceFileWatchers.set(watchId, {
        watcher,
        sender: event.sender,
        path: watchedPath,
        workspaceRoot: request.workspaceRoot,
        timer: null
      })
      event.sender.once('destroyed', () => disposeWorkspaceFileWatchesForSender(event.sender))
      return {
        ok: true as const,
        watchId,
        path: watchedPath,
        content: initialContent,
        size: initialSize,
        truncated: initialTruncated,
        startedAt: new Date().toISOString()
      }
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })
  ipcMain.handle('file:unwatch-workspace', async (_, watchId: unknown) =>
    disposeWorkspaceFileWatch(parseIpcPayload('file:unwatch-workspace', streamIdSchema, watchId))
  )
  ipcMain.handle('file:upload-workspace', async (_, payload: unknown) =>
    uploadWorkspaceFiles(
      parseIpcPayload('file:upload-workspace', workspaceFileUploadPayloadSchema, payload)
    )
  )
  ipcMain.handle('file:download-workspace', async (_, payload: unknown) =>
    downloadWorkspaceFile(
      parseIpcPayload('file:download-workspace', workspaceFileDownloadPayloadSchema, payload)
    )
  )
  ipcMain.handle('write:export', async (_, payload: unknown) =>
    exportWriteDocument(
      parseIpcPayload('write:export', writeExportPayloadSchema, payload),
      { parentWindow: getMainWindow() }
    )
  )
  ipcMain.handle('write:copy-rich-text', async (_, payload: unknown) =>
    copyWriteDocumentAsRichText(
      parseIpcPayload('write:copy-rich-text', writeRichClipboardPayloadSchema, payload)
    )
  )
  ipcMain.handle('write:inline-completion', async (_, payload: unknown) =>
    requestWriteInlineCompletion(
      await store.load(),
      parseIpcPayload('write:inline-completion', writeInlineCompletionPayloadSchema, payload)
    )
  )
  ipcMain.handle('write:inline-completion-debug:list', async () => listWriteInlineCompletionDebugEntries())
  ipcMain.handle('write:inline-completion-debug:clear', async () => {
    clearWriteInlineCompletionDebugEntries()
    return true
  })
  ipcMain.handle('chat:export', async (_, payload: unknown) =>
    exportChatMessages(
      parseIpcPayload('chat:export', chatExportPayloadSchema, payload),
      { parentWindow: getMainWindow() }
    )
  )
  ipcMain.handle('plugin:list', async () =>
    listPlugins(await store.load())
  )
  ipcMain.handle('plugin:install', async (_, payload: unknown) =>
    installPlugin(payload as { id: string; kind: 'mcp' | 'skill'; source?: string; version?: string })
  )
  ipcMain.handle('plugin:uninstall', async (_, payload: unknown) =>
    uninstallPlugin(payload as { id: string; kind: 'mcp' | 'skill' })
  )
  ipcMain.handle('plugin:toggle', async (_, payload: unknown) =>
    togglePlugin(payload as { id: string; kind: 'mcp' | 'skill'; enabled: boolean })
  )
  ipcMain.handle('desktop:command', async (event, command: unknown) => {
    runDesktopCommand(
      parseIpcPayload('desktop:command', desktopCommandSchema, command),
      event.sender,
      getMainWindow
    )
  })
  ipcMain.handle('shell:open-external', async (_, url: unknown) => {
    const validatedUrl = parseIpcPayload('shell:open-external', shellOpenExternalUrlSchema, url)
    await shell.openExternal(validatedUrl)
  })
  ipcMain.handle('notification:turn-complete', async (_, payload: unknown) =>
    showTurnCompleteNotification(
      parseIpcPayload('notification:turn-complete', notificationPayloadSchema, payload)
    )
  )
  ipcMain.handle('app:version', async () => getAppVersion())
  ipcMain.handle('gui:update-state', async () => readGuiUpdateState())
  ipcMain.handle('gui:update-check', async (_, channel: unknown): Promise<GuiUpdateInfo> => {
    const module = await loadGuiUpdaterModule()
    return module.checkGuiUpdate(
      parseIpcPayload(
        'gui:update-check',
        z.object({ channel: guiUpdateChannelSchema }).strict(),
        { channel }
      ).channel
    )
  })
  ipcMain.handle('gui:update-download', async (_, channel: unknown): Promise<GuiUpdateDownloadResult> => {
    const module = await loadGuiUpdaterModule()
    return module.downloadGuiUpdate(
      parseIpcPayload(
        'gui:update-download',
        z.object({ channel: guiUpdateChannelSchema }).strict(),
        { channel }
      ).channel
    )
  })
  ipcMain.handle('gui:update-install', async (): Promise<GuiUpdateInstallResult> => {
    const module = await loadGuiUpdaterModule()
    return module.installGuiUpdate()
  })

  ipcMain.handle('log:error', async (_, payload: unknown) => {
    const request = parseIpcPayload('log:error', logErrorPayloadSchema, payload)
    logError(request.category, request.message, request.detail)
  })
  ipcMain.handle('log:get-path', async () => resolveLogDirectory())
  ipcMain.handle('log:open-dir', async () => {
    const dir = resolveLogDirectory()
    try {
      await mkdir(dir, { recursive: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message }
    }
    const error = await shell.openPath(dir)
    if (error) return { ok: false, message: error }
    return { ok: true }
  })

  type AgnesFallbackConfig = {
    fallbackEnabled: boolean
    fallbackBaseUrl: string
    fallbackApiKey: string
    fallbackImageModel: string
    fallbackVideoModel: string
  }

  function isRateLimited(status: number): boolean {
    return status === 429 || status === 503
  }

  function resolveFallbackEndpoint(agnes: AgnesFallbackConfig, type: 'image' | 'video'): { baseUrl: string; apiKey: string; model: string } | null {
    if (!agnes.fallbackEnabled || !agnes.fallbackApiKey.trim() || !agnes.fallbackBaseUrl.trim()) return null
    const model = type === 'image' ? agnes.fallbackImageModel : agnes.fallbackVideoModel
    if (!model.trim()) return null
    return {
      baseUrl: agnes.fallbackBaseUrl.replace(/\/+$/, ''),
      apiKey: agnes.fallbackApiKey.trim(),
      model
    }
  }

  ipcMain.handle('agnes:generate-image', async (_, payload: unknown) => {
    const request = parseIpcPayload('agnes:generate-image', z.object({
      prompt: z.string().min(1).max(MAX_BODY_BYTES),
      model: z.string().max(256).optional(),
      size: z.string().max(32).optional(),
      image: z.array(z.string()).optional(),
      returnBase64: z.boolean().optional()
    }).strict(), payload)
    const settings = await store.load()
    const agnes = settings.agnesGeneration
    if (!agnes.enabled || !agnes.apiKey.trim()) {
      return { ok: false, message: 'Agnes image generation is not configured. Please set API key in Settings.' }
    }
    try {
      const baseUrl = agnes.baseUrl.replace(/\/+$/, '')
      const model = request.model || agnes.imageModel
      const size = request.size || '1024x1024'
      const isImg2Img = request.image && request.image.length > 0
      const extraBody: Record<string, unknown> = {}
      if (isImg2Img) {
        extraBody.image = request.image
      }
      if (isImg2Img || request.returnBase64) {
        extraBody.response_format = request.returnBase64 ? 'b64_json' : 'url'
      } else {
        extraBody.response_format = 'url'
      }
      const body: Record<string, unknown> = {
        model,
        prompt: request.prompt,
        size,
        extra_body: extraBody
      }
      if (!isImg2Img && request.returnBase64) {
        body.return_base64 = true
      }
      const res = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agnes.apiKey.trim()}`
        },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        const text = await res.text()
        if (isRateLimited(res.status)) {
          const fallback = resolveFallbackEndpoint(agnes, 'image')
          if (fallback) {
            const fallbackBody = { ...body, model: fallback.model }
            const fallbackRes = await fetch(`${fallback.baseUrl}/v1/images/generations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${fallback.apiKey}`
              },
              body: JSON.stringify(fallbackBody)
            })
            if (!fallbackRes.ok) {
              const fallbackText = await fallbackRes.text()
              return { ok: false, message: `Primary API rate limited, fallback also failed (${fallbackRes.status}): ${fallbackText.slice(0, 500)}` }
            }
            const fallbackData = await fallbackRes.json() as { data?: Array<{ url?: string; b64_json?: string }> }
            const fallbackItem = fallbackData.data?.[0]
            if (!fallbackItem) return { ok: false, message: 'No image data in fallback response' }
            return { ok: true, imageUrl: fallbackItem.url ?? '', imageBase64: fallbackItem.b64_json }
          }
        }
        return { ok: false, message: `API error ${res.status}: ${text.slice(0, 500)}` }
      }
      const data = await res.json() as { data?: Array<{ url?: string; b64_json?: string }> }
      const item = data.data?.[0]
      if (!item) return { ok: false, message: 'No image data in response' }
      return { ok: true, imageUrl: item.url ?? '', imageBase64: item.b64_json }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('agnes:generate-video', async (_, payload: unknown) => {
    const request = parseIpcPayload('agnes:generate-video', z.object({
      prompt: z.string().min(1).max(MAX_BODY_BYTES),
      model: z.string().max(256).optional(),
      image: z.union([z.string(), z.array(z.string())]).optional(),
      width: z.number().int().min(256).max(4096).optional(),
      height: z.number().int().min(256).max(4096).optional(),
      numFrames: z.number().int().min(9).max(441).optional(),
      frameRate: z.number().min(1).max(60).optional(),
      negativePrompt: z.string().max(MAX_BODY_BYTES).optional(),
      seed: z.number().int().optional(),
      extraBodyImage: z.array(z.string()).optional(),
      extraBodyMode: z.string().max(64).optional()
    }).strict(), payload)
    const settings = await store.load()
    const agnes = settings.agnesGeneration
    if (!agnes.enabled || !agnes.apiKey.trim()) {
      return { ok: false, message: 'Agnes video generation is not configured. Please set API key in Settings.' }
    }
    try {
      const baseUrl = agnes.baseUrl.replace(/\/+$/, '')
      const model = request.model || agnes.videoModel
      const body: Record<string, unknown> = {
        model,
        prompt: request.prompt
      }
      if (request.image) body.image = request.image
      if (request.width) body.width = request.width
      if (request.height) body.height = request.height
      if (request.numFrames) body.num_frames = request.numFrames
      if (request.frameRate) body.frame_rate = request.frameRate
      if (request.negativePrompt) body.negative_prompt = request.negativePrompt
      if (request.seed !== undefined) body.seed = request.seed
      const extraBody: Record<string, unknown> = {}
      if (request.extraBodyImage) extraBody.image = request.extraBodyImage
      if (request.extraBodyMode) extraBody.mode = request.extraBodyMode
      if (Object.keys(extraBody).length > 0) body.extra_body = extraBody

      const createRes = await fetch(`${baseUrl}/v1/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agnes.apiKey.trim()}`
        },
        body: JSON.stringify(body)
      })
      if (!createRes.ok) {
        const text = await createRes.text()
        if (isRateLimited(createRes.status)) {
          const fallback = resolveFallbackEndpoint(agnes, 'video')
          if (fallback) {
            const fallbackBody = { ...body, model: fallback.model }
            const fallbackRes = await fetch(`${fallback.baseUrl}/v1/videos`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${fallback.apiKey}`
              },
              body: JSON.stringify(fallbackBody)
            })
            if (!fallbackRes.ok) {
              const fallbackText = await fallbackRes.text()
              return { ok: false, message: `Primary API rate limited, fallback also failed (${fallbackRes.status}): ${fallbackText.slice(0, 500)}` }
            }
            const fallbackData = await fallbackRes.json() as { video_id?: string; task_id?: string; status?: string }
            const fallbackVideoId = fallbackData.video_id
            if (!fallbackVideoId) {
              return { ok: false, message: 'No video_id in fallback create response' }
            }
            const pollInterval = 5000
            const maxPolls = 72
            for (let i = 0; i < maxPolls; i++) {
              await new Promise((r) => setTimeout(r, pollInterval))
              const pollRes = await fetch(
                `${fallback.baseUrl}/agnesapi?video_id=${encodeURIComponent(fallbackVideoId)}`,
                { headers: { 'Authorization': `Bearer ${fallback.apiKey}` } }
              )
              if (!pollRes.ok) continue
              const pollData = await pollRes.json() as {
                status?: string
                progress?: number
                remixed_from_video_id?: string
                error?: string | { message?: string }
              }
              if (pollData.status === 'completed' && pollData.remixed_from_video_id) {
                return { ok: true, videoUrl: pollData.remixed_from_video_id, thumbnailUrl: '' }
              }
              if (pollData.status === 'failed') {
                const errMsg = typeof pollData.error === 'object' ? pollData.error?.message : pollData.error
                return { ok: false, message: `Fallback video generation failed: ${errMsg ?? 'unknown error'}` }
              }
            }
            return { ok: false, message: 'Fallback video generation timed out (6 minutes)' }
          }
        }
        return { ok: false, message: `API error ${createRes.status}: ${text.slice(0, 500)}` }
      }
      const createData = await createRes.json() as {
        video_id?: string
        task_id?: string
        status?: string
      }
      const videoId = createData.video_id
      if (!videoId) {
        return { ok: false, message: 'No video_id in create response' }
      }

      const pollInterval = 5000
      const maxPolls = 72
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, pollInterval))
        const pollRes = await fetch(
          `${baseUrl}/agnesapi?video_id=${encodeURIComponent(videoId)}`,
          {
            headers: { 'Authorization': `Bearer ${agnes.apiKey.trim()}` }
          }
        )
        if (!pollRes.ok) continue
        const pollData = await pollRes.json() as {
          status?: string
          progress?: number
          remixed_from_video_id?: string
          error?: string | { message?: string }
        }
        if (pollData.status === 'completed' && pollData.remixed_from_video_id) {
          return { ok: true, videoUrl: pollData.remixed_from_video_id, thumbnailUrl: '' }
        }
        if (pollData.status === 'failed') {
          const errMsg = typeof pollData.error === 'object' ? pollData.error?.message : pollData.error
          return { ok: false, message: `Video generation failed: ${errMsg ?? 'unknown error'}` }
        }
      }
      return { ok: false, message: 'Video generation timed out (6 minutes)' }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('novelforge:start', async () => {
    const { getNovelForgeManager } = await import('../runtime/novelforge-process.js')
    const manager = getNovelForgeManager()
    return manager.start()
  })

  ipcMain.handle('novelforge:status', async () => {
    const { getNovelForgeManager } = await import('../runtime/novelforge-process.js')
    const manager = getNovelForgeManager()
    return { state: manager.getState(), port: manager.getPort() }
  })

  ipcMain.handle('novelforge:stop', async () => {
    const { getNovelForgeManager } = await import('../runtime/novelforge-process.js')
    const manager = getNovelForgeManager()
    manager.stop()
    return { success: true }
  })
}
