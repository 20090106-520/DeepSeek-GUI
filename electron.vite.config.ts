import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

function copyStaticFile(from: string, to: string) {
  return {
    name: 'copy-static-file',
    generateBundle() {
      const source = readFileSync(from)
      this.emitFile({ type: 'asset', fileName: to, source })
    }
  }
}

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      copyStaticFile(resolve('src/main/public/splash.html'), 'splash.html')
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'claw-schedule-mcp-node-entry': resolve('src/main/claw-schedule-mcp-node-entry.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    optimizeDeps: {
      include: ['react', 'react-dom', 'zustand', 'react-i18next', 'i18next', 'lucide-react'],
      exclude: ['@tencent-weixin/openclaw-weixin']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            i18n: ['react-i18next', 'i18next'],
            ui: ['lucide-react']
          }
        }
      }
    }
  }
})
