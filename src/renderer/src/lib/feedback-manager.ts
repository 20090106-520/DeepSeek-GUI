export type FeedbackType = 'bug' | 'feature' | 'improvement' | 'question' | 'other'

export type FeedbackRating = 1 | 2 | 3 | 4 | 5

export interface FeedbackEntry {
  id: string
  type: FeedbackType
  rating?: FeedbackRating
  title: string
  description: string
  email?: string
  timestamp: number
  status: 'pending' | 'reviewed' | 'resolved'
}

export interface FeedbackStats {
  total: number
  byType: Record<FeedbackType, number>
  byRating: Record<FeedbackRating, number>
  resolvedCount: number
}

const STORAGE_KEY = 'deepseek-feedback'

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function saveFeedback(feedback: Omit<FeedbackEntry, 'id' | 'timestamp' | 'status'>): FeedbackEntry {
  const entries = getFeedbackEntries()
  const newEntry: FeedbackEntry = {
    ...feedback,
    id: generateId(),
    timestamp: Date.now(),
    status: 'pending'
  }
  entries.push(newEntry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  return newEntry
}

export function getFeedbackEntries(): FeedbackEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

export function getFeedbackEntry(id: string): FeedbackEntry | undefined {
  const entries = getFeedbackEntries()
  return entries.find(e => e.id === id)
}

export function updateFeedbackStatus(id: string, status: FeedbackEntry['status']): boolean {
  const entries = getFeedbackEntries()
  const index = entries.findIndex(e => e.id === id)
  if (index === -1) return false
  entries[index].status = status
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  return true
}

export function deleteFeedback(id: string): boolean {
  const entries = getFeedbackEntries()
  const filtered = entries.filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  return filtered.length !== entries.length
}

export function getFeedbackStats(): FeedbackStats {
  const entries = getFeedbackEntries()
  const stats: FeedbackStats = {
    total: entries.length,
    byType: {
      bug: 0,
      feature: 0,
      improvement: 0,
      question: 0,
      other: 0
    },
    byRating: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0
    },
    resolvedCount: 0
  }

  entries.forEach(entry => {
    stats.byType[entry.type]++
    if (entry.rating) {
      stats.byRating[entry.rating]++
    }
    if (entry.status === 'resolved') {
      stats.resolvedCount++
    }
  })

  return stats
}

export async function submitFeedbackToServer(
  feedback: FeedbackEntry
): Promise<{ success: boolean; message?: string }> {
  try {
    if (typeof window.dsGui?.submitFeedback === 'function') {
      const result = await window.dsGui.submitFeedback(feedback)
      return { success: result.ok, message: result.message }
    }
    
    return { success: true, message: 'Feedback saved locally' }
  } catch (error) {
    console.error('Failed to submit feedback:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  improvement: 'Improvement',
  question: 'Question',
  other: 'Other'
}

export const FEEDBACK_TYPE_DESCRIPTIONS: Record<FeedbackType, string> = {
  bug: 'Report a bug or issue you encountered',
  feature: 'Request a new feature',
  improvement: 'Suggest an improvement to existing features',
  question: 'Ask a question about using the app',
  other: 'Other feedback or comments'
}