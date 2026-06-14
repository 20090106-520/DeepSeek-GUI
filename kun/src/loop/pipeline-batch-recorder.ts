export type PipelineStage = {
  threadId: string
  turnId: string
  stage: string
  details: Record<string, unknown>
  timestamp: number
}

export type PipelineBatchConfig = {
  maxBatchSize?: number
  flushIntervalMs?: number
}

const DEFAULT_MAX_BATCH_SIZE = 10
const DEFAULT_FLUSH_INTERVAL_MS = 200

export class PipelineBatchRecorder {
  private readonly maxBatchSize: number
  private readonly flushIntervalMs: number
  private buffer: PipelineStage[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private readonly onFlush: (stages: PipelineStage[]) => Promise<void>
  private closed = false

  constructor(onFlush: (stages: PipelineStage[]) => Promise<void>, config?: PipelineBatchConfig) {
    this.onFlush = onFlush
    this.maxBatchSize = config?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE
    this.flushIntervalMs = config?.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS
  }

  record(threadId: string, turnId: string, stage: string, details: Record<string, unknown> = {}): void {
    if (this.closed) return

    this.buffer.push({
      threadId,
      turnId,
      stage,
      details,
      timestamp: Date.now()
    })

    if (this.buffer.length >= this.maxBatchSize) {
      this.flush()
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        this.flush()
      }, this.flushIntervalMs)
    }
  }

  flush(): void {
    if (this.closed || this.buffer.length === 0) return

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    const stages = this.buffer
    this.buffer = []

    void this.onFlush(stages)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    if (this.buffer.length > 0) {
      const stages = this.buffer
      this.buffer = []
      void this.onFlush(stages)
    }
  }

  get pendingCount(): number {
    return this.buffer.length
  }
}