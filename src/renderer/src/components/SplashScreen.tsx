import { useState, useEffect } from 'react'

export interface BootStep {
  id: number
  message: string
  status: 'pending' | 'running' | 'completed' | 'error'
}

interface SplashScreenProps {
  progress: number
  currentStep: number
  steps: BootStep[]
  error: string | null
}

export function SplashScreen({ progress, currentStep, steps, error }: SplashScreenProps): React.ReactElement {
  const [isComplete, setIsComplete] = useState(false)
  const [eyeBlink, setEyeBlink] = useState(false)

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setEyeBlink(true)
      setTimeout(() => setEyeBlink(false), 200)
    }, 4000 + Math.random() * 3000)

    return () => clearInterval(blinkInterval)
  }, [])

  useEffect(() => {
    if (progress >= 100) {
      setTimeout(() => setIsComplete(true), 300)
    }
  }, [progress])

  if (error) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0f1419] to-[#0a0a0f] flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-xl text-red-400 mb-2">Startup Error</h1>
          <p className="text-gray-400 text-sm max-w-md">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0f1419] to-[#0a0a0f] flex flex-col items-center justify-center transition-all duration-800 ${
        isComplete ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${2 + Math.random() * 4}s`,
              opacity: Math.random() * 0.6 + 0.1,
              animationTimingFunction: 'ease-in-out'
            }}
          />
        ))}

        {[...Array(3)].map((_, i) => (
          <div
            key={`halo-${i}`}
            className="absolute rounded-full opacity-10"
            style={{
              width: `${200 + i * 80}px`,
              height: `${200 + i * 80}px`,
              left: `calc(50% - ${100 + i * 40}px)`,
              top: `calc(50% - ${100 + i * 40}px)`,
              background: `radial-gradient(circle, rgba(${139 + i * 40}, 92, 246, 0.3) 0%, transparent 70%)`,
              animation: `drift ${15 + i * 5}s ease-in-out infinite`,
              animationDelay: `${i * 2}s`
            }}
          />
        ))}

        {[...Array(20)].map((_, i) => (
          <div
            key={`float-particle-${i}`}
            className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `rgba(${118 + Math.random() * 60}, ${75 + Math.random() * 60}, ${162 + Math.random() * 60}, 0.6)`,
              animation: `float-particle ${8 + Math.random() * 8}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 8}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-8">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
              width: '160px',
              height: '160px',
              animation: 'pulse-glow 2.5s ease-in-out infinite'
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 60%)',
              width: '180px',
              height: '180px',
              animation: 'pulse-glow 3.5s ease-in-out infinite',
              animationDelay: '0.7s'
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 50%)',
              width: '200px',
              height: '200px',
              animation: 'pulse-glow 4.5s ease-in-out infinite',
              animationDelay: '1.4s'
            }}
          />

          <div className="relative w-[160px] h-[160px] animate-float">
            <svg viewBox="0 0 512 512" className="w-full h-full drop-shadow-2xl">
              <defs>
                <linearGradient id="dolphinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                <linearGradient id="bellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fef9c3" />
                  <stop offset="100%" stopColor="#fde047" />
                </linearGradient>
                <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="50%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              <circle cx="256" cy="256" r="240" fill="#0f172a" opacity="0.5" />

              <g className="animate-sway" style={{ transformOrigin: '256px 380px' }}>
                <ellipse cx="280" cy="380" rx="145" ry="105" fill="url(#dolphinGrad)" stroke="#1e40af" strokeWidth="4" />

                <ellipse cx="280" cy="425" rx="105" ry="65" fill="url(#bellyGrad)" />

                <path
                  d="M280 490 Q255 515 230 495 Q210 475 255 460 Q300 445 300 490"
                  fill="#4f9efc"
                  stroke="#1e40af"
                  strokeWidth="3"
                />
                <path
                  d="M280 490 Q305 510 330 490"
                  stroke="#1e40af"
                  strokeWidth="2"
                  fill="none"
                />

                <path
                  d="M430 275 Q495 255 475 320 Q465 365 410 385 Q370 405 350 365"
                  fill="url(#dolphinGrad)"
                  stroke="#1e40af"
                  strokeWidth="4"
                />
                <path
                  d="M350 365 Q340 385 350 400"
                  stroke="#1e40af"
                  strokeWidth="2"
                  fill="none"
                />

                <path
                  d="M210 305 Q165 285 145 325 Q125 365 165 385 Q210 405 235 365"
                  fill="url(#dolphinGrad)"
                  stroke="#1e40af"
                  strokeWidth="4"
                />
                <ellipse cx="175" cy="345" rx="28" ry="22" fill="url(#bellyGrad)" />

                <g className="animate-flipper">
                  <path
                    d="M155 365 Q135 390 145 415"
                    stroke="#1e40af"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </g>

                <g className="animate-eye-group">
                  <circle cx="195" cy="275" r="38" fill="white" stroke="#1e40af" strokeWidth="3" filter="url(#glow)" />
                  <circle cx="317" cy="275" r="38" fill="white" stroke="#1e40af" strokeWidth="3" filter="url(#glow)" />
                  
                  {eyeBlink ? (
                    <>
                      <path d="M175 275 L215 275" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
                      <path d="M297 275 L337 275" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <circle cx="200" cy="275" r="20" fill="#1f2937" />
                      <circle cx="322" cy="275" r="20" fill="#1f2937" />
                      <circle cx="205" cy="270" r="7" fill="white" />
                      <circle cx="327" cy="270" r="7" fill="white" />
                      <circle cx="207" cy="268" r="3" fill="#1f2937" />
                      <circle cx="329" cy="268" r="3" fill="#1f2937" />
                    </>
                  )}
                </g>

                <ellipse cx="256" cy="315" rx="20" ry="14" fill="#1f2937" />

                <ellipse cx="160" cy="295" rx="25" ry="20" fill="#f87171" opacity="0.8" />
                <ellipse cx="352" cy="295" rx="25" ry="20" fill="#f87171" opacity="0.8" />
                <ellipse cx="163" cy="290" rx="10" ry="7" fill="#fda4af" opacity="0.5" />
                <ellipse cx="355" cy="290" rx="10" ry="7" fill="#fda4af" opacity="0.5" />

                <path
                  d="M235 330 Q256 345 277 330"
                  stroke="#1f2937"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />

                <g className="animate-sparkle">
                  <path
                    d="M285 175 Q300 135 275 110 Q255 90 230 110 Q210 135 225 175"
                    fill="url(#dolphinGrad)"
                    stroke="#1e40af"
                    strokeWidth="3"
                  />
                  <ellipse cx="253" cy="155" rx="18" ry="14" fill="#fbbf24" />
                  <path
                    d="M253 150 L253 138 L258 145"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <circle cx="195" cy="155" r="20" fill="white" stroke="#1e40af" strokeWidth="2" filter="url(#glow)" />
                  <circle cx="200" cy="150" r="11" fill="#1f2937" />
                  <circle cx="203" cy="147" r="5" fill="white" />

                  <circle cx="243" cy="155" r="20" fill="white" stroke="#1e40af" strokeWidth="2" filter="url(#glow)" />
                  <circle cx="248" cy="150" r="11" fill="#1f2937" />
                  <circle cx="251" cy="147" r="5" fill="white" />

                  <ellipse cx="217" cy="172" rx="12" ry="10" fill="#f87171" opacity="0.7" />
                  <ellipse cx="222" cy="175" rx="5" ry="4" fill="#f9a8d4" />

                  <path
                    d="M217 182 Q222 186 227 182"
                    stroke="#1f2937"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />

                  <path
                    d="M250 187 Q262 182 272 192 Q277 198 267 203"
                    fill="url(#dolphinGrad)"
                    stroke="#1e40af"
                    strokeWidth="2"
                  />
                  <path
                    d="M272 192 Q282 198 287 187"
                    stroke="#1e40af"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </g>
              </g>

              <g className="animate-orbit-slow">
                {[...Array(8)].map((_, i) => (
                  <circle
                    key={i}
                    cx={256 + Math.cos((i * Math.PI) / 4) * 150}
                    cy={256 + Math.sin((i * Math.PI) / 4) * 150}
                    r="6"
                    fill="url(#waveGrad)"
                    opacity="0.7"
                    filter="url(#glow)"
                  />
                ))}
              </g>

              <g className="animate-orbit-medium" style={{ animationDirection: 'reverse' }}>
                {[...Array(6)].map((_, i) => (
                  <circle
                    key={i}
                    cx={256 + Math.cos((i * Math.PI * 2) / 6) * 170}
                    cy={256 + Math.sin((i * Math.PI * 2) / 6) * 170}
                    r="4"
                    fill="#c084fc"
                    opacity="0.5"
                  />
                ))}
              </g>

              <circle cx="256" cy="256" r="180" fill="none" stroke="url(#waveGrad)" strokeWidth="1" opacity="0.2" className="animate-spin" style={{ animationDuration: '30s' }} />
              <circle cx="256" cy="256" r="195" fill="none" stroke="#818cf8" strokeWidth="1" opacity="0.15" className="animate-spin" style={{ animationDuration: '22s', animationDirection: 'reverse' }} />
            </svg>
          </div>

          {[...Array(6)].map((_, i) => (
            <div
              key={`particle-${i}`}
              className="absolute w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-blue-500 animate-pulse"
              style={{
                top: '50%',
                left: '50%',
                transform: `rotate(${i * 60}deg) translateY(-90px) translateX(-50%)`,
                animationDelay: `${i * 0.25}s`,
                animationDuration: `${1.5 + (i % 3) * 0.3}s`,
                boxShadow: '0 0 15px rgba(139, 92, 246, 0.7), 0 0 30px rgba(99, 102, 241, 0.4)'
              }}
            />
          ))}
        </div>

        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-wide" style={{
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #c084fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 30px rgba(139, 92, 246, 0.4)',
            animation: 'text-shimmer 3s ease-in-out infinite'
          }}>
            DeepSeek
          </h1>
          <p className="text-gray-400 text-sm md:text-base mb-6 tracking-wide">
            AI Coding Assistant
          </p>
        </div>

        <div className="w-64 md:w-80">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span className="font-medium">{steps[currentStep]?.message}</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-[2.5px] bg-gray-800 rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #a855f7 100%)',
                boxShadow: '0 0 12px rgba(139, 92, 246, 0.9), 0 0 24px rgba(99, 102, 241, 0.5)'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-flash" style={{ animationDuration: '1.5s' }} />
          </div>
          <div className="flex justify-between mt-3">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  step.status === 'completed'
                    ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]'
                    : step.status === 'running'
                    ? 'bg-purple-400 shadow-[0_0_8px_rgba(139,92,246,0.6)] animate-pulse'
                    : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(1deg); }
          50% { transform: translateY(-12px) rotate(0deg); }
          75% { transform: translateY(-8px) rotate(-1deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(15px, -10px) rotate(5deg); }
          50% { transform: translate(5px, -15px) rotate(0deg); }
          75% { transform: translate(-10px, -5px) rotate(-5deg); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(10px, -15px) scale(1.2); }
          50% { transform: translate(5px, -25px) scale(0.8); }
          75% { transform: translate(-8px, -10px) scale(1.1); }
        }
        @keyframes sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(2deg); }
        }
        @keyframes flipper {
          0%, 100% { transform: rotate(0deg); transform-origin: 155px 365px; }
          50% { transform: rotate(-15deg); transform-origin: 155px 365px; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes orbit-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbit-medium {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes text-shimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.2); }
        }
        @keyframes flash {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.5; }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-sway {
          animation: sway 4s ease-in-out infinite;
          transform-origin: 256px 380px;
        }
        .animate-flipper {
          animation: flipper 2s ease-in-out infinite;
        }
        .animate-sparkle {
          animation: shimmer 2s ease-in-out infinite;
        }
        .animate-orbit-slow {
          animation: orbit-slow 30s linear infinite;
          transform-origin: 256px 256px;
        }
        .animate-orbit-medium {
          animation: orbit-medium 20s linear infinite;
          transform-origin: 256px 256px;
        }
      `}</style>
    </div>
  )
}