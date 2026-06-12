import { LocalToolHost, type LocalTool } from './local-tool-host.js'
import type { ImageLocalToolOptions } from './builtin-tool-types.js'

export function createImageLocalTool(options: ImageLocalToolOptions = {}): LocalTool {
  const imageOps = options.operations
  return LocalToolHost.defineTool({
    name: 'generate_image',
    description: 'Generate images from text prompts using AI image generation models',
    inputSchema: {
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
      required: ['prompt'],
      additionalProperties: false
    },
    policy: 'on-request',
    toolKind: 'tool_call',
    execute: async (args) => {
      const prompt = typeof args.prompt === 'string' ? args.prompt : ''
      const style = typeof args.style === 'string' ? args.style as 'photorealistic' | 'illustration' | 'anime' | '3d' | 'abstract' | 'cartoon' : 'photorealistic'
      const width = typeof args.width === 'number' ? args.width : 1024
      const height = typeof args.height === 'number' ? args.height : 1024
      const quality = typeof args.quality === 'string' ? args.quality as 'standard' | 'high' | 'ultra' : 'standard'

      if (!prompt.trim()) {
        return { output: { success: false, error: 'Prompt is required' }, isError: true }
      }

      if (imageOps?.generateImage) {
        const result = await imageOps.generateImage({ prompt, style, width, height, quality })
        return { output: { ...result } }
      }

      return { output: { success: false, error: 'Image generation is not available' }, isError: true }
    }
  })
}
