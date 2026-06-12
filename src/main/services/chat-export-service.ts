import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { ChatExportPayload, ChatExportResult } from '../../shared/ds-gui-api'

const CHAT_EXPORT_CSS = `
  :root {
    color-scheme: light;
  }

  body {
    margin: 0;
    padding: 24px;
    background: #ffffff;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    font-size: 15px;
    line-height: 1.7;
  }

  .chat-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .chat-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .chat-messages {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .message {
    display: flex;
    gap: 12px;
  }

  .message-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 500;
    color: white;
  }

  .message-avatar.user {
    background: #3b82f6;
  }

  .message-avatar.assistant {
    background: #10b981;
  }

  .message-avatar.system {
    background: #6b7280;
  }

  .message-avatar.tool {
    background: #8b5cf6;
  }

  .message-content {
    flex: 1;
    background: #f3f4f6;
    border-radius: 8px;
    padding: 12px 16px;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .message-role {
    font-weight: 500;
    font-size: 14px;
  }

  .message-role.user {
    color: #3b82f6;
  }

  .message-role.assistant {
    color: #10b981;
  }

  .message-role.system {
    color: #6b7280;
  }

  .message-role.tool {
    color: #8b5cf6;
  }

  .message-timestamp {
    font-size: 12px;
    color: #9ca3af;
  }

  .message-tool-name {
    font-size: 12px;
    color: #8b5cf6;
    font-style: italic;
  }

  .message-body {
    white-space: pre-wrap;
    word-break: break-word;
  }

  code {
    font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
    font-size: 0.9em;
    background: #e5e7eb;
    padding: 2px 6px;
    border-radius: 4px;
  }

  pre {
    background: #1f2937;
    color: #e5e7eb;
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
  }

  pre code {
    background: transparent;
    padding: 0;
    color: inherit;
  }
`

function exportExtension(format: string): string {
  switch (format) {
    case 'json': return '.json'
    case 'md': return '.md'
    case 'html': return '.html'
    case 'txt': return '.txt'
    default: return '.txt'
  }
}

function exportDialogFilter(format: string): Electron.FileFilter {
  switch (format) {
    case 'json': return { name: 'JSON', extensions: ['json'] }
    case 'md': return { name: 'Markdown', extensions: ['md'] }
    case 'html': return { name: 'HTML', extensions: ['html'] }
    case 'txt': return { name: 'Text', extensions: ['txt'] }
    default: return { name: 'Text', extensions: ['txt'] }
  }
}

function formatTimestamp(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return timestamp
  }
}

function formatMessageAsMarkdown(message: ChatExportPayload['messages'][0]): string {
  const roleLabel = {
    user: '用户',
    assistant: '助手',
    system: '系统',
    tool: '工具'
  }[message.role]
  
  let content = message.content
  if (message.content.startsWith('```') && message.content.endsWith('```')) {
    content = message.content
  } else {
    content = message.content.replace(/`([^`]+)`/g, '`$1`')
  }
  
  let result = `**${roleLabel}**`
  if (message.toolName) {
    result += ` (${message.toolName})`
  }
  result += ` - ${formatTimestamp(message.timestamp)}\n\n`
  result += `${content}\n\n---\n\n`
  
  return result
}

function formatMessagesAsMarkdown(messages: ChatExportPayload['messages']): string {
  return messages.map(formatMessageAsMarkdown).join('')
}

function formatMessagesAsText(messages: ChatExportPayload['messages']): string {
  const roleLabel = {
    user: '用户',
    assistant: '助手',
    system: '系统',
    tool: '工具'
  }
  
  return messages.map((message) => {
    let line = `[${formatTimestamp(message.timestamp)}] ${roleLabel[message.role]}`
    if (message.toolName) {
      line += ` (${message.toolName})`
    }
    line += `:\n${message.content}\n${'='.repeat(80)}\n`
    return line
  }).join('\n')
}

function formatMessagesAsHtml(messages: ChatExportPayload['messages'], title: string): string {
  const roleColors: Record<string, string> = {
    user: '#3b82f6',
    assistant: '#10b981',
    system: '#6b7280',
    tool: '#8b5cf6'
  }

  const messagesHtml = messages.map((message) => `
    <div class="message">
      <div class="message-avatar ${message.role}" style="background: ${roleColors[message.role]}">
        ${message.role.charAt(0).toUpperCase()}
      </div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-role ${message.role}">${message.role === 'user' ? '用户' : message.role === 'assistant' ? '助手' : message.role === 'system' ? '系统' : '工具'}</span>
          ${message.toolName ? `<span class="message-tool-name">${message.toolName}</span>` : ''}
          <span class="message-timestamp">${formatTimestamp(message.timestamp)}</span>
        </div>
        <div class="message-body">${message.content.replace(/\n/g, '<br>').replace(/`([^`]+)`/g, '<code>$1</code>')}</div>
      </div>
    </div>
  `).join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${CHAT_EXPORT_CSS}</style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-title">${title}</div>
    <div class="chat-messages">${messagesHtml}</div>
  </div>
</body>
</html>`
}

async function showExportSaveDialog(
  title: string,
  format: string,
  parentWindow?: BrowserWindow | null
): Promise<Electron.SaveDialogReturnValue> {
  const options: Electron.SaveDialogOptions = {
    title: '导出对话记录',
    defaultPath: `chat-export${exportExtension(format)}`,
    filters: [exportDialogFilter(format)]
  }
  return parentWindow
    ? dialog.showSaveDialog(parentWindow, options)
    : dialog.showSaveDialog(options)
}

export async function exportChatMessages(
  payload: ChatExportPayload,
  options?: { parentWindow?: BrowserWindow | null }
): Promise<ChatExportResult> {
  try {
    const exportDialogResult = await showExportSaveDialog(
      payload.title || '对话记录',
      payload.format,
      options?.parentWindow
    )

    if (exportDialogResult.canceled || !exportDialogResult.filePath) {
      return { ok: false, canceled: true }
    }

    const targetPath = exportDialogResult.filePath
    const title = payload.title || '对话记录'
    
    let content: string
    switch (payload.format) {
      case 'json':
        content = JSON.stringify(payload.messages, null, 2)
        break
      case 'md':
        content = `# ${title}\n\n${formatMessagesAsMarkdown(payload.messages)}`
        break
      case 'html':
        content = formatMessagesAsHtml(payload.messages, title)
        break
      case 'txt':
      default:
        content = `${title}\n${'='.repeat(80)}\n\n${formatMessagesAsText(payload.messages)}`
        break
    }

    await writeFile(targetPath, content, 'utf8')

    return {
      ok: true,
      path: targetPath,
      exportedAt: new Date().toISOString()
    }
  } catch (error) {
    return {
      ok: false,
      canceled: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}