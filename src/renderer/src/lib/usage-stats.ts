export interface UsageEvent {
  type: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface UsageStats {
  totalConversations: number
  totalMessages: number
  totalTokens: number
  totalSessions: number
  averageSessionLength: number
  featureUsage: Record<string, number>
  dailyUsage: Record<string, number>
  weeklyUsage: Record<string, number>
  lastActivity: number
}

const USAGE_STORAGE_KEY = 'deepseek-usage-stats'
const MAX_EVENTS = 1000

export function getUsageStats(): UsageStats {
  const stored = localStorage.getItem(USAGE_STORAGE_KEY)
  if (!stored) return createEmptyStats()
  
  try {
    return JSON.parse(stored)
  } catch {
    return createEmptyStats()
  }
}

function createEmptyStats(): UsageStats {
  const today = new Date().toISOString().split('T')[0]
  return {
    totalConversations: 0,
    totalMessages: 0,
    totalTokens: 0,
    totalSessions: 0,
    averageSessionLength: 0,
    featureUsage: {},
    dailyUsage: { [today]: 0 },
    weeklyUsage: { [getWeekKey()]: 0 },
    lastActivity: Date.now()
  }
}

function getWeekKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const week = getWeekNumber(now)
  return `${year}-W${week.toString().padStart(2, '0')}`
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function saveUsageStats(stats: UsageStats): void {
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(stats))
  } catch (error) {
    console.error('[UsageStats] Failed to save:', error)
  }
}

export function trackEvent(type: string, metadata?: Record<string, unknown>): void {
  const stats = getUsageStats()
  const today = new Date().toISOString().split('T')[0]
  const weekKey = getWeekKey()
  
  stats.featureUsage[type] = (stats.featureUsage[type] || 0) + 1
  stats.dailyUsage[today] = (stats.dailyUsage[today] || 0) + 1
  stats.weeklyUsage[weekKey] = (stats.weeklyUsage[weekKey] || 0) + 1
  stats.lastActivity = Date.now()
  
  const daysToKeep = 30
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  const cutoffKey = cutoffDate.toISOString().split('T')[0]
  
  Object.keys(stats.dailyUsage).forEach(key => {
    if (key < cutoffKey) {
      delete stats.dailyUsage[key]
    }
  })
  
  const weeksToKeep = 12
  const cutoffWeek = getWeekNumber(cutoffDate)
  const currentYear = new Date().getFullYear()
  
  Object.keys(stats.weeklyUsage).forEach(key => {
    const [year, weekPart] = key.split('-W')
    const weekNum = parseInt(weekPart)
    const keyYear = parseInt(year)
    
    if (keyYear < currentYear - 1 || 
        (keyYear === currentYear - 1 && weekNum < cutoffWeek) ||
        (keyYear === currentYear && weekNum > getWeekNumber(new Date()))) {
      delete stats.weeklyUsage[key]
    }
  })
  
  saveUsageStats(stats)
}

export function trackConversation(action: 'create' | 'message' | 'complete'): void {
  const stats = getUsageStats()
  
  switch (action) {
    case 'create':
      stats.totalConversations++
      stats.totalSessions++
      break
    case 'message':
      stats.totalMessages++
      break
    case 'complete':
      if (stats.totalSessions > 0) {
        stats.averageSessionLength = stats.totalMessages / stats.totalSessions
      }
      break
  }
  
  stats.lastActivity = Date.now()
  saveUsageStats(stats)
}

export function trackTokens(count: number): void {
  const stats = getUsageStats()
  stats.totalTokens += count
  stats.lastActivity = Date.now()
  saveUsageStats(stats)
}

export function getDailyUsage(date?: Date): number {
  const stats = getUsageStats()
  const key = (date || new Date()).toISOString().split('T')[0]
  return stats.dailyUsage[key] || 0
}

export function getWeeklyUsage(weekOffset: number = 0): number {
  const stats = getUsageStats()
  const now = new Date()
  now.setDate(now.getDate() - weekOffset * 7)
  const weekKey = `${now.getFullYear()}-W${getWeekNumber(now).toString().padStart(2, '0')}`
  return stats.weeklyUsage[weekKey] || 0
}

export function getTopFeatures(count: number = 5): { feature: string; count: number }[] {
  const stats = getUsageStats()
  return Object.entries(stats.featureUsage)
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
}

export function resetUsageStats(): void {
  localStorage.removeItem(USAGE_STORAGE_KEY)
}

export function exportUsageStats(): void {
  const stats = getUsageStats()
  const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `usage-stats-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function clearUsageStats(): void {
  localStorage.removeItem(USAGE_STORAGE_KEY)
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}