import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, MessageSquare, Zap, Clock, TrendingUp, Activity } from 'lucide-react'
import { getUsageStats, formatNumber, getTopFeatures, getDailyUsage, getWeeklyUsage } from '../lib/usage-stats'

export function UsageStatsView(): ReactElement {
  const { t } = useTranslation('settings')
  const stats = getUsageStats()
  const topFeatures = getTopFeatures(5)
  const todayUsage = getDailyUsage()
  const weekUsage = getWeeklyUsage()
  const lastWeekUsage = getWeeklyUsage(1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<MessageSquare className="w-5 h-5" />}
          label={t('totalConversations')}
          value={formatNumber(stats.totalConversations)}
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label={t('totalMessages')}
          value={formatNumber(stats.totalMessages)}
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label={t('totalTokens')}
          value={formatNumber(stats.totalTokens)}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label={t('averageSessionLength')}
          value={stats.averageSessionLength.toFixed(1)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label={t('usageToday')}
          value={formatNumber(todayUsage)}
          trend={todayUsage > 0 ? 'up' : undefined}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label={t('usageThisWeek')}
          value={formatNumber(weekUsage)}
          trend={weekUsage > lastWeekUsage ? 'up' : weekUsage < lastWeekUsage ? 'down' : undefined}
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label={t('totalSessions')}
          value={formatNumber(stats.totalSessions)}
        />
      </div>

      {topFeatures.length > 0 && (
        <div className="bg-ds-card rounded-xl border border-ds-border p-4">
          <h3 className="text-sm font-medium text-ds-ink mb-3">{t('mostUsedFeatures')}</h3>
          <div className="space-y-2">
            {topFeatures.map((item, index) => (
              <div key={item.feature} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-ds-accent/10 text-ds-accent text-xs font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-ds-ink">{item.feature}</span>
                <span className="text-sm text-ds-muted">{formatNumber(item.count)}</span>
                <div className="w-20 h-2 bg-ds-main rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ds-accent rounded-full"
                    style={{ width: `${Math.min((item.count / topFeatures[0].count) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-ds-card rounded-xl border border-ds-border p-4">
        <h3 className="text-sm font-medium text-ds-ink mb-3">{t('usageThisWeek')}</h3>
        <WeeklyChart weekUsage={weekUsage} lastWeekUsage={lastWeekUsage} />
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  trend?: 'up' | 'down'
}

function StatCard({ icon, label, value, trend }: StatCardProps): ReactElement {
  return (
    <div className="bg-ds-card rounded-xl border border-ds-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-ds-accent">{icon}</span>
        <span className="text-xs text-ds-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-ds-ink">{value}</span>
        {trend === 'up' && <span className="text-xs text-emerald-500">↑</span>}
        {trend === 'down' && <span className="text-xs text-red-500">↓</span>}
      </div>
    </div>
  )
}

interface WeeklyChartProps {
  weekUsage: number
  lastWeekUsage: number
}

function WeeklyChart({ weekUsage, lastWeekUsage }: WeeklyChartProps): ReactElement {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const currentDay = new Date().getDay()
  const adjustedDay = currentDay === 0 ? 6 : currentDay - 1
  
  const avgPerDay = weekUsage / 7
  const data = days.map((day, index) => {
    let value = avgPerDay
    if (index < adjustedDay) {
      value = Math.max(0, avgPerDay * (index + 1) / adjustedDay)
    }
    return { day, value: Math.round(value) }
  })

  const maxValue = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 h-24">
        {data.map((item, index) => (
          <div key={item.day} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center h-16">
              <div
                className={`w-6 rounded-t transition-all ${
                  index === adjustedDay ? 'bg-ds-accent' : 'bg-ds-accent/40'
                }`}
                style={{ height: `${Math.max((item.value / maxValue) * 100, 4)}%` }}
              />
            </div>
            <span className={`text-xs ${index === adjustedDay ? 'text-ds-ink font-medium' : 'text-ds-muted'}`}>
              {item.day}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}