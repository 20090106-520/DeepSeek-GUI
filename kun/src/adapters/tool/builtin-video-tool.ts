import { LocalToolHost, type LocalTool } from './local-tool-host.js'
import type { VideoLocalToolOptions } from './builtin-tool-types.js'

export function createVideoLocalTool(options: VideoLocalToolOptions = {}): LocalTool {
  const videoOps = options.operations
  return LocalToolHost.defineTool({
    name: 'generate_video',
    description: 'Generate videos from text prompts using AI video generation models',
    inputSchema: {
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
      required: ['prompt'],
      additionalProperties: false
    },
    policy: 'on-request',
    toolKind: 'tool_call',
    execute: async (args) => {
      const prompt = typeof args.prompt === 'string' ? args.prompt : ''
      const duration = typeof args.duration === 'number' ? args.duration : 10
      const aspectRatio = typeof args.aspectRatio === 'string' ? args.aspectRatio as '16:9' | '9:16' | '4:3' | '1:1' | '21:9' : '16:9'
      const quality = typeof args.quality === 'string' ? args.quality as 'standard' | 'high' | 'ultra' : 'standard'

      if (!prompt.trim()) {
        return { output: { success: false, error: 'Prompt is required' }, isError: true }
      }

      if (videoOps?.generateVideo) {
        const result = await videoOps.generateVideo({ prompt, duration, aspectRatio, quality })
        return { output: { ...result } }
      }

      return { output: { success: false, error: 'Video generation is not available' }, isError: true }
    }
  })
}
