import { lazy, Suspense, useEffect, useState, useRef } from 'react'
import { useChatStore } from './store/chat-store'
import { supportsDesktopTitleBar, WindowsTitleBar } from './components/WindowsTitleBar'
import { logError } from './lib/error-handler'

const Workbench = lazy(() =>
  import('./components/Workbench').then((module) => ({ default: module.Workbench }))
)
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((module) => ({ default: module.SettingsView }))
)
const InitialSetupDialog = lazy(() =>
  import('./components/InitialSetupDialog').then((module) => ({
    default: module.InitialSetupDialog
  }))
)

function RouteFallback(): React.ReactElement {
  return <div className="h-full bg-ds-main" />
}

export default function AppShell(): React.ReactElement {
  const [bootError, setBootError] = useState<Error | null>(null)
  const [bootComplete, setBootComplete] = useState(false)
  const [dsGuiMissing, setDsGuiMissing] = useState(false)
  
  const route = useChatStore((s) => s.route)
  const initialSetupOpen = useChatStore((s) => s.initialSetupOpen)
  const getBoot = useChatStore((s) => s.boot)
  const bootRef = useRef(getBoot)
  
  useEffect(() => {
    bootRef.current = getBoot
  }, [getBoot])
  
  const platform = typeof window !== 'undefined' ? window.dsGui?.platform ?? 'unknown' : 'unknown'
  const hasDesktopTitleBar = supportsDesktopTitleBar(platform)

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.dsGui === 'undefined') {
      setDsGuiMissing(true)
      return
    }

    const executeBoot = async () => {
      try {
        await bootRef.current()
        setBootComplete(true)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logError('AppShell', 'Boot failed', {
          category: 'runtime' as const,
          message: err.message,
          metadata: { attempt: 1, maxRetries: 2 }
        })
        setBootError(err)
      }
    }

    const timer = window.setTimeout(executeBoot, 100)
    return () => window.clearTimeout(timer)
  }, [])

  if (dsGuiMissing) {
    return (
      <div className="flex h-full items-center justify-center bg-ds-main">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🔌</div>
          <h1 className="text-xl text-red-400 mb-2">Bridge Not Connected</h1>
          <p className="text-gray-400 text-sm max-w-md mb-4">
            The Electron bridge (window.dsGui) is not available. This may indicate an issue with the preload script.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="flex h-full items-center justify-center bg-ds-main">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl text-red-400 mb-2">Startup Error</h1>
          <p className="text-gray-400 text-sm max-w-md mb-4">{bootError.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={hasDesktopTitleBar ? 'ds-windows-app-frame flex h-full min-h-0 flex-col bg-ds-main' : 'flex h-full min-h-0 flex-col bg-transparent'}>
      {hasDesktopTitleBar ? <WindowsTitleBar platform={platform} /> : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<RouteFallback />}>
          {route === 'settings' ? <SettingsView /> : <Workbench />}
        </Suspense>
      </div>
      {initialSetupOpen ? (
        <Suspense fallback={null}>
          <InitialSetupDialog />
        </Suspense>
      ) : null}
    </div>
  )
}