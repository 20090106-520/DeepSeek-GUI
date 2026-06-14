import type { LocalTool } from './local-tool-host.js'

export type ImageGenerationStyle = 'photorealistic' | 'illustration' | 'anime' | '3d' | 'abstract' | 'cartoon'

export interface GenerateImageOptions {
  prompt: string
  style?: ImageGenerationStyle
  width?: number
  height?: number
  quality?: 'standard' | 'high' | 'ultra'
}

export interface GenerateImageResult {
  success: boolean
  imageUrl?: string
  imageBase64?: string
  error?: string
}

export interface ImageToolOperations {
  generateImage?: (options: GenerateImageOptions) => Promise<GenerateImageResult>
}

export type ImageToolOptions = {
  operations?: ImageToolOperations
}

export class BuiltinImageTool implements LocalTool {
  readonly name = 'generate_image'
  readonly description = 'Generate images from text prompts using AI image generation models'
  readonly toolKind = 'tool_call' as const
  readonly policy = 'auto' as const

  get inputSchema(): Record<string, unknown> {
    return this.schema
  }

  private readonly operations: ImageToolOperations

  constructor(options: ImageToolOptions = {}) {
    this.operations = options.operations ?? {}
  }

  async execute(args: Record<string, unknown>, _context: unknown): Promise<{ output: unknown; isError?: boolean }> {
    const result = await this.call(args)
    const isError = !result.success
    return { output: result, isError }
  }

  async call(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const prompt = typeof args.prompt === 'string' ? args.prompt : ''
    const style = (typeof args.style === 'string' ? args.style : 'photorealistic') as ImageGenerationStyle
    const width = typeof args.width === 'number' ? args.width : 1024
    const height = typeof args.height === 'number' ? args.height : 1024
    const quality = (typeof args.quality === 'string' ? args.quality : 'standard') as 'standard' | 'high' | 'ultra'

    if (!prompt.trim()) {
      return {
        success: false,
        error: 'Prompt is required'
      }
    }

    if (this.operations.generateImage) {
      const result = await this.operations.generateImage({
        prompt,
        style,
        width,
        height,
        quality
      })
      return { ...result }
    }

    return {
      success: false,
      error: 'Image generation is not available'
    }
  }

  get schema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The text prompt to generate the image from'
        },
        style: {
          type: 'string',
          enum: ['photorealistic', 'illustration', 'anime', '3d', 'abstract', 'cartoon'],
          description: 'The style of the generated image',
          default: 'photorealistic'
        },
        width: {
          type: 'integer',
          minimum: 256,
          maximum: 4096,
          description: 'The width of the generated image',
          default: 1024
        },
        height: {
          type: 'integer',
          minimum: 256,
          maximum: 4096,
          description: 'The height of the generated image',
          default: 1024
        },
        quality: {
          type: 'string',
          enum: ['standard', 'high', 'ultra'],
          description: 'The quality level of the generated image',
          default: 'standard'
        }
      },
      required: ['prompt']
    }
  }
}

export function createImageLocalTool(options: ImageToolOptions = {}): LocalTool {
  return new BuiltinImageTool(options)
}