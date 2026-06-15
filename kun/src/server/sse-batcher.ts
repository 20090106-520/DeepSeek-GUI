import type { RuntimeEvent } from '../contracts/events.js'

export function encodeSseEvent(event: RuntimeEvent): string {
  return `id: ${event.seq}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`
}

export type SseBatchConfig = {
  maxBatchSize?: number
  flushIntervalMs?: number
  maxBufferBytes?: number
}

const DEFAULT_MAX_BATCH_SIZE = 20
const DEFAULT_FLUSH_INTERVAL_MS = 16
const DEFAULT_MAX_BUFFER_BYTES = 256 * 1024
const hasSetImmediate = typeof setImmediate === 'function'

export class SseEventBatcher {
  private readonly maxBatchSize: number
  private readonly flushIntervalMs: number
  private readonly maxBufferBytes: number
  private buffer: RuntimeEvent[] = []
  private bufferBytes = 0
  private flushTimer: ReturnType<typeof setTimeout> | ReturnType<typeof setImmediate> | null = null
  private readonly onFlush: (encoded: string) => void
  private closed = false

  constructor(onFlush: (encoded: string) => void, config?: SseBatchConfig) {
    this.onFlush = onFlush
    this.maxBatchSize = config?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE
    this.flushIntervalMs = config?.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS
    this.maxBufferBytes = config?.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES
  }

  push(event: RuntimeEvent): boolean {
    if (this.closed) return false

    const eventBytes = Buffer.byteLength(encodeSseEvent(event), 'utf8')

    if (this.bufferBytes + eventBytes > this.maxBufferBytes) {
      this.flush()
      if (eventBytes > this.maxBufferBytes) {
        return false
      }
    }

    this.buffer.push(event)
    this.bufferBytes += eventBytes

    if (this.buffer.length >= this.maxBatchSize) {
      this.flush()
    } else if (!this.flushTimer) {
      this.flushTimer = hasSetImmediate
        ? setImmediate(() => { this.flushTimer = null; this.flush() })
        : setTimeout(() => { this.flushTimer = null; this.flush() }, this.flushIntervalMs)
    }

    return true
  }

  flush(): void {
    if (this.closed || this.buffer.length === 0) return

    if (this.flushTimer) {
      if (hasSetImmediate) clearImmediate(this.flushTimer as ReturnType<typeof setImmediate>)
      else clearTimeout(this.flushTimer as ReturnType<typeof setTimeout>)
      this.flushTimer = null
    }

    const merged = this.mergeDeltas(this.buffer)
    const encoded = merged.map(encodeSseEvent).join('')
    this.buffer = []
    this.bufferBytes = 0

    try {
      this.onFlush(encoded)
    } catch {
      this.close()
    }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.flushTimer) {
      if (hasSetImmediate) clearImmediate(this.flushTimer as ReturnType<typeof setImmediate>)
      else clearTimeout(this.flushTimer as ReturnType<typeof setTimeout>)
      this.flushTimer = null
    }
    if (this.buffer.length > 0) {
      const merged = this.mergeDeltas(this.buffer)
      const encoded = merged.map(encodeSseEvent).join('')
      this.buffer = []
      this.bufferBytes = 0
      try {
        this.onFlush(encoded)
      } catch {
        // Best effort
      }
    }
  }

  get pendingCount(): number {
    return this.buffer.length
  }

  get isClosed(): boolean {
    return this.closed
  }

  private mergeDeltas(events: RuntimeEvent[]): RuntimeEvent[] {
    if (events.length <= 1) return events

    const result: RuntimeEvent[] = []
    let i = 0
    while (i < events.length) {
      const event = events[i]
      const mergeableKinds = ['assistant_text_delta', 'assistant_reasoning_delta']
      if (mergeableKinds.includes(event.kind) && i + 1 < events.length) {
        let combinedText = (event as { text?: string }).text ?? ''
        let j = i + 1
        while (j < events.length && events[j].kind === event.kind) {
          combinedText += (events[j] as { text?: string }).text ?? ''
          j += 1
        }
        if (j > i + 1) {
          result.push({ ...event, text: combinedText } as RuntimeEvent)
          i = j
          continue
        }
      }
      result.push(event)
      i += 1
    }
    return result
  }
}