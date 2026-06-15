import type { ReactElement } from 'react'
import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  Sparkles,
  Layers,
  Brain,
  PenTool,
  Workflow,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  Play,
  Square
} from 'lucide-react'
import { useChatStore } from '../store/chat-store'

type NovelForgeStatus = 'unknown' | 'starting' | 'running' | 'error'

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    }
  }
}

async function invokeIpc(channel: string, ...args: unknown[]): Promise<unknown> {
  if (window.electronAPI?.invoke) {
    return window.electronAPI.invoke(channel, ...args)
  }
  return null
}

interface Particle {
  id: number
  x: number
  y: number
  size: number
  delay: number
  duration: number
}

export function NovelForgeView(): ReactElement {
  const { t } = useTranslation()
  const [status, setStatus] = useState<NovelForgeStatus>('unknown')
  const [errorMsg, setErrorMsg] = useState('')
  const [particles, setParticles] = useState<Particle[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const newParticles: Particle[] = []
    for (let i = 0; i < 25; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 1,
        delay: Math.random() * 8,
        duration: Math.random() * 6 + 4,
      })
    }
    setParticles(newParticles)
    setTimeout(() => setIsLoaded(true), 100)
  }, [])

  const handleStartNovelForge = useCallback(async () => {
    setStatus('starting')
    setErrorMsg('')
    try {
      const result = await invokeIpc('novelforge:start') as { success: boolean; message: string } | null
      if (result?.success) {
        setStatus('running')
        window.open('http://127.0.0.1:54321', '_blank')
      } else {
        setStatus('error')
        setErrorMsg(result?.message ?? 'NovelForge 启动失败')
      }
    } catch {
      setStatus('error')
      setErrorMsg('NovelForge 启动失败，请检查 Python 环境和依赖')
    }
  }, [])

  const handleStopNovelForge = useCallback(async () => {
    try {
      await invokeIpc('novelforge:stop')
      setStatus('unknown')
    } catch { /* ignore */ }
  }, [])

  const handleCheckStatus = useCallback(async () => {
    try {
      const result = await invokeIpc('novelforge:status') as { state: string; port: number } | null
      if (result?.state === 'running') {
        setStatus('running')
      } else if (result?.state === 'starting') {
        setStatus('starting')
      } else {
        setStatus('unknown')
      }
    } catch {
      try {
        const response = await fetch('http://127.0.0.1:54321/health', {
          signal: AbortSignal.timeout(3_000)
        })
        setStatus(response.ok ? 'running' : 'unknown')
      } catch {
        setStatus('unknown')
      }
    }
  }, [])

  const features = [
    {
      icon: <Layers className="h-6 w-6" />,
      title: '卡片式创作',
      desc: '世界观、角色、章节以卡片组织，Schema驱动结构化AI生成'
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: '知识图谱',
      desc: 'Neo4j图数据库追踪人物关系、伏笔线索，百万字不矛盾'
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: '流式AI生成',
      desc: '字段粒度流式填充，可控可修正，告别整段重写'
    },
    {
      icon: <Workflow className="h-6 w-6" />,
      title: '工作流引擎',
      desc: '代码式工作流编排，从拆书仿写到自动连载'
    },
    {
      icon: <PenTool className="h-6 w-6" />,
      title: '正文字数控制',
      desc: '精确控制每章字数，支持扩写、缩写、精修'
    },
    {
      icon: <BookOpen className="h-6 w-6" />,
      title: '百万字长篇',
      desc: '上下文注入+记忆系统，支撑百万字级连载创作'
    }
  ]

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* 背景粒子 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-purple-500/20"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animation: `particle-float ${particle.duration}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
        {/* 光晕背景 */}
        <div 
          className="absolute -top-40 -left-40 w-[300px] h-[300px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
            animation: 'float-slow 25s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute -bottom-40 -right-40 w-[250px] h-[250px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.06) 0%, transparent 70%)',
            animation: 'float-slow 20s ease-in-out infinite reverse',
          }}
        />
      </div>

      <div className="relative ds-chat-column-inset mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-8 pb-10 pt-8">
        {/* Hero */}
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Logo */}
          <div 
            className={`relative transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="relative">
              {/* 旋转光环 */}
              <div 
                className="absolute inset-0 -m-4 rounded-3xl"
                style={{
                  border: '2px solid rgba(168, 85, 247, 0.2)',
                  animation: 'spin-slow 15s linear infinite',
                }}
              />
              <div 
                className="absolute inset-0 -m-6 rounded-3xl"
                style={{
                  border: '1px solid rgba(139, 92, 246, 0.15)',
                  animation: 'spin-reverse 10s linear infinite',
                }}
              />
              {/* Logo容器 */}
              <div 
                className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 text-white shadow-xl"
                style={{
                  animation: 'logo-float 4s ease-in-out infinite',
                  boxShadow: '0 0 40px rgba(168, 85, 247, 0.4), 0 0 80px rgba(139, 92, 246, 0.2)',
                }}
              >
                <BookOpen className="h-10 w-10" />
              </div>
              {/* 发光点 */}
              {[0, 90, 180, 270].map((angle, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-white"
                  style={{
                    animation: 'glow-pulse 2s ease-in-out infinite',
                    animationDelay: `${i * 0.25}s`,
                    transform: `rotate(${angle}deg) translateX(45px)`,
                    boxShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(168, 85, 247, 0.6)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* 标题 */}
          <div 
            className={`transition-all duration-1000 delay-200 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <h1 
              className="text-3xl font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #1f2937 0%, #374151 50%, #1f2937 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              NovelForge 小说创作引擎
            </h1>
          </div>

          {/* 描述 */}
          <p 
            className={`max-w-lg text-sm text-gray-500 transition-all duration-1000 delay-400 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            新一代AI长篇小说创作引擎，集成卡片式创作、知识图谱、工作流引擎，支持百万字级连载
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-3">
          {status === 'running' ? (
            <div 
              className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400"
              style={{ animation: 'status-pulse 2s ease-in-out infinite' }}
            >
              <CheckCircle className="h-4 w-4" />
              NovelForge 运行中
            </div>
          ) : status === 'starting' ? (
            <div className="flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-2 text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在检测...
            </div>
          ) : status === 'error' ? (
            <div className="flex items-center gap-2 rounded-full bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              {errorMsg}
            </div>
          ) : null}
        </div>

        {/* Launch Button */}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={handleStartNovelForge}
            disabled={status === 'starting'}
            className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {/* 按钮闪光效果 */}
            <span className="absolute inset-0 overflow-hidden rounded-xl">
              <span 
                className="absolute -left-full top-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{ animation: 'shine-move 3s ease-in-out infinite' }}
              />
            </span>
            <Play className="h-4 w-4 transition-transform group-hover:scale-110" />
            启动 NovelForge
          </button>
          {status === 'running' && (
            <button
              onClick={handleStopNovelForge}
              className="group flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Square className="h-4 w-4 transition-transform group-hover:scale-110" />
              停止
            </button>
          )}
          {status === 'running' && (
            <button
              onClick={() => window.open('http://127.0.0.1:54321', '_blank')}
              className="group flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-emerald-700 hover:shadow-xl hover:scale-105"
            >
              <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              打开界面
            </button>
          )}
        </div>

        {/* Setup Guide */}
        <div 
          className={`rounded-xl border border-gray-200 bg-gray-50 p-6 transition-all duration-700 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} dark:border-gray-700 dark:bg-gray-800/50`}
        >
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            启动指南
          </h3>
          <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex gap-2">
              <span className="font-mono text-purple-600 dark:text-purple-400">1.</span>
              安装 Python 3.10+ 和依赖：<code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs dark:bg-gray-700">pip install -r novelforge/backend/requirements.txt</code>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-purple-600 dark:text-purple-400">2.</span>
              配置 .env 文件（复制 <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs dark:bg-gray-700">novelforge/backend/.env.example</code>）
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-purple-600 dark:text-purple-400">3.</span>
              启动后端：<code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs dark:bg-gray-700">python novelforge/backend/main.py</code>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-purple-600 dark:text-purple-400">4.</span>
              点击上方"打开 NovelForge"按钮
            </li>
          </ol>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group relative rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 dark:border-gray-700 dark:bg-gray-800 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${600 + index * 100}ms` }}
            >
              {/* 卡片光晕效果 */}
              <div 
                className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)',
                }}
              />
              <div className="relative">
                <div 
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 transition-all duration-300 group-hover:scale-110 group-hover:bg-purple-500/20 dark:text-purple-400"
                >
                  {feature.icon}
                </div>
                <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {feature.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Credits */}
        <div className="text-center text-xs text-gray-400 dark:text-gray-500">
          NovelForge by <a href="https://github.com/RhythmicWave/NovelForge" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">RhythmicWave</a> · MIT License
        </div>
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes particle-float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-10px) translateX(-5px); opacity: 0.4; }
          75% { transform: translateY(-15px) translateX(8px); opacity: 0.5; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -20px); }
          66% { transform: translate(-20px, 20px); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes logo-float {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(-6px); }
          50% { transform: translateY(-3px); }
          75% { transform: translateY(-8px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.6; transform: rotate(var(--angle)) translateX(45px) scale(1); }
          50% { opacity: 1; transform: rotate(var(--angle)) translateX(45px) scale(1.3); }
        }
        @keyframes status-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
        }
        @keyframes shine-move {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}