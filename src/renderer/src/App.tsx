import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { SplashScreen } from './components/SplashScreen'

const AppShell = lazy(() => import('./AppShell'))

export type BootStep = {
  id: number
  message: string
  status: 'pending' | 'running' | 'completed' | 'error'
}

const bootSteps: BootStep[] = [
  { id: 1, message: 'Initializing runtime...', status: 'pending' },
  { id: 2, message: 'Loading settings...', status: 'pending' },
  { id: 3, message: 'Connecting to workspace...', status: 'pending' },
  { id: 4, message: 'Preparing UI...', status: 'pending' },
  { id: 5, message: 'Ready.', status: 'pending' },
]

function StartupShell(): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-gradient-to-br from-[#0f0a1e] via-[#1a1530] to-[#0d1117] text-gray-400">
      <div className="flex items-center gap-2 rounded-full border border-gray-700/50 bg-gray-900/30 px-4 py-2 text-[13px] shadow-sm backdrop-blur-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-purple-500" aria-hidden />
        <span>Loading DeepSeek GUI...</span>
      </div>
    </div>
  )
}

export default function App(): React.ReactElement {
  const [showSplash, setShowSplash] = useState(true)
  const [bootProgress, setBootProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<BootStep[]>(bootSteps)
  const [bootError, setBootError] = useState<string | null>(null)
  const hasBooted = useRef(false)

  useEffect(() => {
    if (hasBooted.current) return
    hasBooted.current = true

    const simulateBoot = async () => {
      try {
        const stepDelay = [300, 400, 350, 300, 200]
        const initialSteps = [...bootSteps]
        
        for (let i = 0; i < initialSteps.length; i++) {
          setSteps(prev => prev.map((step, idx) => 
            idx === i ? { ...step, status: 'running' as const } : step
          ))
          setCurrentStep(i)
          setBootProgress(Math.min(95, ((i + 1) / initialSteps.length) * 95))
          
          await new Promise(resolve => setTimeout(resolve, stepDelay[i]))
          
          setSteps(prev => prev.map((step, idx) => 
            idx === i ? { ...step, status: 'completed' as const } : step
          ))
        }
        
        setBootProgress(100)
        await new Promise(resolve => setTimeout(resolve, 500))
        setShowSplash(false)
      } catch (error) {
        setBootError(error instanceof Error ? error.message : 'Unknown error')
        console.error('Boot error:', error)
      }
    }

    void simulateBoot()
  }, [])

  return (
    <AppErrorBoundary>
      {showSplash && (
        <SplashScreen 
          progress={bootProgress}
          currentStep={currentStep}
          steps={steps}
          error={bootError}
        />
      )}
      <Suspense fallback={<StartupShell />}>
        <AppShell />
      </Suspense>
    </AppErrorBoundary>
  )
}