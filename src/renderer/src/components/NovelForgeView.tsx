import type { ReactElement } from 'react'
import { useState, useCallback } from 'react'
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
  CheckCircle
} from 'lucide-react'
import { useChatStore } from '../store/chat-store'

type NovelForgeStatus = 'unknown' | 'starting' | 'running' | 'error'

export function NovelForgeView(): ReactElement {
  const { t } = useTranslation()
  const [status, setStatus] = useState<NovelForgeStatus>('unknown')
  const [errorMsg, setErrorMsg] = useState('')

  const handleStartNovelForge = useCallback(async () => {
    setStatus('starting')
    setErrorMsg('')
    try {
      const response = await fetch('http://127.0.0.1:54321/health', {
        signal: AbortSignal.timeout(3_000)
      })
      if (response.ok) {
        setStatus('running')
        window.open('http://127.0.0.1:54321', '_blank')
      } else {
        setStatus('error')
        setErrorMsg('NovelForge 服务未响应')
      }
    } catch {
      setStatus('error')
      setErrorMsg('NovelForge 服务未启动，请先运行 novelforge/backend/main.py')
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="ds-chat-column-inset mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-8 pb-10 pt-8">
        {/* Hero */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
            <BookOpen className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            NovelForge 小说创作引擎
          </h1>
          <p className="max-w-lg text-sm text-gray-500 dark:text-gray-400">
            新一代AI长篇小说创作引擎，集成卡片式创作、知识图谱、工作流引擎，支持百万字级连载
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-3">
          {status === 'running' ? (
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
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
        <div className="flex justify-center">
          <button
            onClick={handleStartNovelForge}
            disabled={status === 'starting'}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            打开 NovelForge
          </button>
        </div>

        {/* Setup Guide */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
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
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                {feature.icon}
              </div>
              <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {feature.title}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Credits */}
        <div className="text-center text-xs text-gray-400 dark:text-gray-500">
          NovelForge by <a href="https://github.com/RhythmicWave/NovelForge" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">RhythmicWave</a> · MIT License
        </div>
      </div>
    </div>
  )
}