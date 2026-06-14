import { describe, expect, it } from 'vitest'
import { shouldAnimateStreamingText } from './StreamdownAssistant'

describe('shouldAnimateStreamingText', () => {
  it('returns char-level animation for short single-line text', () => {
    const result = shouldAnimateStreamingText('正在检查配置。')
    expect(result).not.toBe(false)
    if (result !== false) expect(result.sep).toBe('char')
  })

  it('returns word-level animation for multiline text within limit', () => {
    const result = shouldAnimateStreamingText('First line\nSecond line')
    expect(result).not.toBe(false)
    if (result !== false) expect(result.sep).toBe('word')
  })

  it('returns word-level animation for structured markdown within limit', () => {
    const result = shouldAnimateStreamingText('- one\n- two')
    expect(result).not.toBe(false)
    if (result !== false) expect(result.sep).toBe('word')
    const result2 = shouldAnimateStreamingText('Use `npm test` next.')
    expect(result2).not.toBe(false)
    if (result2 !== false) expect(result2.sep).toBe('word')
  })

  it('returns false for very long text exceeding word animation limit', () => {
    const longText = 'a'.repeat(5000)
    expect(shouldAnimateStreamingText(longText)).toBe(false)
  })

  it('returns false for empty text', () => {
    expect(shouldAnimateStreamingText('')).toBe(false)
    expect(shouldAnimateStreamingText('   ')).toBe(false)
  })
})
