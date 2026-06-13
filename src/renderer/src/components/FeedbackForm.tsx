import { useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, CheckCircle, XCircle, Star } from 'lucide-react'
import {
  saveFeedback,
  submitFeedbackToServer,
  type FeedbackType,
  type FeedbackRating
} from '../lib/feedback-manager'

export function FeedbackForm(): ReactElement {
  const { t } = useTranslation('settings')
  
  const [type, setType] = useState<FeedbackType>('improvement')
  const [rating, setRating] = useState<FeedbackRating | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setError(t('feedbackError'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const feedback = saveFeedback({
        type,
        rating,
        title: title.trim(),
        description: description.trim(),
        email: email.trim() || undefined
      })

      await submitFeedbackToServer(feedback)
      setSubmitted(true)
    } catch (err) {
      setError(t('feedbackError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setType('improvement')
    setRating(undefined)
    setTitle('')
    setDescription('')
    setEmail('')
    setError(null)
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-ds-ink">{t('feedbackThankYou')}</h3>
        <p className="mt-2 text-sm text-ds-muted">{t('feedbackSuccess')}</p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-6 rounded-xl bg-ds-userbubble px-5 py-2 text-sm font-medium text-ds-userbubbleFg transition hover:opacity-90"
        >
          {t('submitAnotherFeedback') || 'Submit Another Feedback'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-ds-ink mb-2">
          {t('feedbackType')}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {(['bug', 'feature', 'improvement', 'question', 'other'] as FeedbackType[]).map((typeOption) => (
            <button
              key={typeOption}
              type="button"
              onClick={() => setType(typeOption)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                type === typeOption
                  ? 'bg-ds-accent text-white'
                  : 'bg-ds-card border border-ds-border text-ds-ink hover:bg-ds-hover'
              }`}
            >
              {t(`feedbackType${typeOption.charAt(0).toUpperCase() + typeOption.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ds-ink mb-2">
          {t('feedbackRating')}
        </label>
        <p className="text-xs text-ds-muted mb-2">{t('feedbackRatingDesc')}</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star as FeedbackRating)}
              className={`p-2 rounded-lg transition ${
                rating && star <= rating
                  ? 'text-amber-500 fill-amber-500'
                  : 'text-ds-muted hover:text-amber-400'
              }`}
              title={`${star} ${t('star') || 'star'}`}
            >
              <Star className="w-6 h-6" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ds-ink mb-2">
          {t('feedbackTitle')}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('feedbackTitlePlaceholder')}
          className="w-full rounded-xl border border-ds-border bg-ds-card px-4 py-2 text-sm text-ds-ink placeholder:text-ds-faint focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ds-ink mb-2">
          {t('feedbackDescription')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('feedbackDescriptionPlaceholder')}
          rows={5}
          className="w-full rounded-xl border border-ds-border bg-ds-card px-4 py-2 text-sm text-ds-ink placeholder:text-ds-faint resize-none focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ds-ink mb-2">
          {t('feedbackEmail')}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('feedbackEmailPlaceholder')}
          className="w-full rounded-xl border border-ds-border bg-ds-card px-4 py-2 text-sm text-ds-ink placeholder:text-ds-faint focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !title.trim() || !description.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-ds-userbubble px-5 py-2.5 text-sm font-medium text-ds-userbubbleFg transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {t('feedbackSubmitting')}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {t('feedbackSubmit')}
          </>
        )}
      </button>
    </div>
  )
}