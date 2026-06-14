export type SseFrame = {
  event?: string
  data: string
  id?: string
  retry?: number
}

export type SseParserState = 'field' | 'value' | 'dispatch'

const CR = 0x0d
const LF = 0x0a
const COLON = 0x3a
const SPACE = 0x20

export class SseStateParser {
  private buffer = ''
  private currentEvent = ''
  private currentData: string[] = []
  private currentId = ''
  private currentRetry: number | undefined

  feed(chunk: string): SseFrame[] {
    this.buffer += chunk
    const frames: SseFrame[] = []

    let pos = 0
    while (pos < this.buffer.length) {
      const char = this.buffer.charCodeAt(pos)

      if (char === LF || char === CR) {
        if (char === CR && pos + 1 < this.buffer.length && this.buffer.charCodeAt(pos + 1) === LF) {
          pos += 1
        }

        if (this.currentData.length > 0 || this.currentEvent || this.currentId) {
          const frame: SseFrame = {
            data: this.currentData.join('\n'),
            ...(this.currentEvent ? { event: this.currentEvent } : {}),
            ...(this.currentId ? { id: this.currentId } : {}),
            ...(this.currentRetry !== undefined ? { retry: this.currentRetry } : {})
          }
          frames.push(frame)
          this.currentEvent = ''
          this.currentData = []
          this.currentId = ''
          this.currentRetry = undefined
        }

        pos += 1
        continue
      }

      if (char === COLON) {
        pos += 1
        if (pos < this.buffer.length && this.buffer.charCodeAt(pos) === SPACE) {
          pos += 1
        }
        continue
      }

      const lineEnd = this.findLineEnd(pos)
      const line = this.buffer.slice(pos, lineEnd)
      pos = lineEnd

      const colonIndex = line.indexOf(':')
      if (colonIndex >= 0) {
        const field = line.slice(0, colonIndex)
        let value = line.slice(colonIndex + 1)
        if (value.charCodeAt(0) === SPACE) {
          value = value.slice(1)
        }
        this.processField(field, value)
      } else {
        this.processField(line, '')
      }
    }

    this.buffer = ''
    return frames
  }

  reset(): void {
    this.buffer = ''
    this.currentEvent = ''
    this.currentData = []
    this.currentId = ''
    this.currentRetry = undefined
  }

  private processField(field: string, value: string): void {
    switch (field) {
      case 'event':
        this.currentEvent = value
        break
      case 'data':
        this.currentData.push(value)
        break
      case 'id':
        this.currentId = value
        break
      case 'retry':
        const parsed = Number(value)
        if (!Number.isNaN(parsed) && parsed > 0) {
          this.currentRetry = parsed
        }
        break
    }
  }

  private findLineEnd(start: number): number {
    for (let i = start; i < this.buffer.length; i += 1) {
      const char = this.buffer.charCodeAt(i)
      if (char === LF || char === CR) {
        return i
      }
    }
    return this.buffer.length
  }
}