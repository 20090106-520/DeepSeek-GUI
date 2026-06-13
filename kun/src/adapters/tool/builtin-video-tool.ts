import type { LocalTool } from './local-tool-host.js'

export type VideoAspectRatio = '16:9' | '9:16' | '4:3' | '1:1' | '21:9'

export interface GenerateVideoOptions {
  prompt: string
  duration?: number
  aspectRatio?: VideoAspectRatio
  quality?: 'standard' | 'high' | 'ultra'
}

export interface GenerateVideoResult {
  success: boolean
  videoUrl?: string
  videoBase64?: string
  thumbnailUrl?: string
  error?: string
}

export interface VideoToolOperations {
  generateVideo?: (options: GenerateVideoOptions) => Promise<GenerateVideoResult>
}

export type VideoToolOptions = {
  operations?: VideoToolOperations
}

export class BuiltinVideoTool implements LocalTool {
  readonly name = 'generate_video'
  readonly description = 'Generate videos from text prompts using AI video generation models'
  readonly toolKind = 'tool_call' as const
  readonly policy = 'auto' as const

  get inputSchema(): Record<string, unknown> {
    return this.schema
  }

  private readonly operations: VideoToolOperations

  constructor(options: VideoToolOptions = {}) {
    this.operations = options.operations ?? {}
  }

  async execute(args: Record<string, unknown>, _context: unknown): Promise<{ output: unknown; isError?: boolean }> {
    const result = await this.call(args)
    const isError = !result.success
    return { output: result, isError }
  }

  async call(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const prompt = typeof args.prompt === 'string' ? args.prompt : ''
    const duration = typeof args.duration === 'number' ? args.duration : 10
    const aspectRatio = (typeof args.aspectRatio === 'string' ? args.aspectRatio : '16:9') as VideoAspectRatio
    const quality = (typeof args.quality === 'string' ? args.quality : 'standard') as 'standard' | 'high' | 'ultra'

    if (!prompt.trim()) {
      return {
        success: false,
        error: 'Prompt is required'
      }
    }

    if (this.operations.generateVideo) {
      const result = await this.operations.generateVideo({
        prompt,
        duration,
        aspectRatio,
        quality
      })
      return { ...result }
    }

    return {
      success: false,
      error: 'Video generation is not available'
    }
  }

  get schema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The text prompt to generate the video from'
        },
        duration: {
          type: 'integer',
          minimum: 5,
          maximum: 60,
          description: 'The duration of the generated video in seconds',
          default: 10
        },
        aspectRatio: {
          type: 'string',
          enum: ['16:9', '9:16', '4:3', '1:1', '21:9'],
          description: 'The aspect ratio of the generated video',
          default: '16:9'
        },
        quality: {
          type: 'string',
          enum: ['standard', 'high', 'ultra'],
          description: 'The quality level of the generated video',
          default: 'standard'
        }
      },
      required: ['prompt']
    }
  }
}

export function createVideoLocalTool(options: VideoToolOptions = {}): LocalTool {
  return new BuiltinVideoTool(options)
}