import { useState, useEffect, useCallback } from 'react'
import { X, RefreshCw, Trash2, Filter, Download } from 'lucide-react'

export interface LogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'stdout' | 'stderr'
  category: string
  message: string
}

export function LogViewer({ onClose }: { onClose: () => void }): React.ReactElement {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      const response = await window.dsGui?.getLogs?.()
      if (response) {
        const parsedLogs: LogEntry[] = JSON.parse(response)
        setLogs(parsedLogs)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [loadLogs, autoRefresh])

  const filteredLogs = logs.filter(log => {
    const matchesFilter = log.message.toLowerCase().includes(filter.toLowerCase()) ||
                         log.category.toLowerCase().includes(filter.toLowerCase())
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter
    return matchesFilter && matchesLevel
  })

  const handleClearLogs = async () => {
    try {
      await window.dsGui?.clearLogs?.()
      setLogs([])
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  const handleExport = () => {
    const content = filteredLogs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}`
    ).join('\n')
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deepseek-gui-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400 bg-red-500/10'
      case 'warn': return 'text-yellow-400 bg-yellow-500/10'
      case 'info': return 'text-blue-400 bg-blue-500/10'
      case 'stdout': return 'text-green-400 bg-green-500/10'
      case 'stderr': return 'text-orange-400 bg-orange-500/10'
      default: return 'text-gray-400 bg-gray-500/10'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex h-[80vh] w-[90vw] max-w-5xl flex-col rounded-xl bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-700/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-white">日志查看器</span>
            <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-400">
              {filteredLogs.length} 条
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                autoRefresh ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:bg-gray-800'
              }`}
              title="自动刷新"
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              自动刷新
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
              title="导出日志"
            >
              <Download className="h-4 w-4" />
              导出
            </button>
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              title="清空日志"
            >
              <Trash2 className="h-4 w-4" />
              清空
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 border-b border-gray-700/50 px-6 py-3">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="搜索日志..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="all">全部级别</option>
            <option value="error">错误</option>
            <option value="warn">警告</option>
            <option value="info">信息</option>
            <option value="stdout">标准输出</option>
            <option value="stderr">错误输出</option>
          </select>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              没有日志记录
            </div>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="group rounded px-3 py-2 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-gray-500">{log.timestamp}</span>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${getLevelColor(log.level)}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="shrink-0 text-gray-500">[{log.category}]</span>
                    <span className="break-all text-gray-300">{log.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}