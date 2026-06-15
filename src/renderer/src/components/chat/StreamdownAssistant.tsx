import type { ComponentPropsWithRef, MouseEvent, ReactElement } from 'react'
import { memo } from 'react'
import { Streamdown, type AnimateOptions, type StreamdownProps } from 'streamdown'
import remarkGfm from 'remark-gfm'
import { harden } from 'rehype-harden'
import 'streamdown/styles.css'
import { parseFileReferenceHref, rehypeFileReferences } from '../../lib/file-references'
import { useValidatedFileReference } from '../../lib/file-reference-validation'
import { openWorkspacePathInEditor } from '../../lib/open-workspace-path'
import { previewWorkspaceFile } from '../../lib/workspace-file-preview'
import { useChatStore } from '../../store/chat-store'
import { StreamdownCode } from './StreamdownCode'

const STREAMING_ANIMATED: AnimateOptions = {
  sep: 'char',
  duration: 80,
  stagger: 4,
  easing: 'ease-out',
  animation: 'fadeIn'
}

const STREAMING_ANIMATED_WORD: AnimateOptions = {
  sep: 'word',
  duration: 60,
  stagger: 6,
  easing: 'ease-out',
  animation: 'fadeIn'
}

const rehypePlugins = [
  rehypeFileReferences,
  [
    harden,
    {
      allowedLinkPrefixes: ['*']
    }
  ]
] satisfies StreamdownProps['rehypePlugins']

const components = {
  code: StreamdownCode,
  a: StreamdownLink
} satisfies StreamdownProps['components']

type StreamdownLinkProps = ComponentPropsWithRef<'a'> & { node?: unknown }

function StreamdownLink({
  href,
  children,
  className,
  title
}: StreamdownLinkProps): ReactElement {
  const workspaceRoot = useChatStore((s) => s.workspaceRoot)
  const fileTarget = parseFileReferenceHref(href)
  const validation = useValidatedFileReference(fileTarget, workspaceRoot)
  const isExternal = href ? /^(https?:|mailto:)/i.test(href) : false
  const cleanClassName = className?.replace(/\bds-file-reference-link\b/g, '').trim()

  if (fileTarget && validation.status !== 'valid') {
    return (
      <span className={cleanClassName} title={title}>
        {children}
      </span>
    )
  }

  const resolvedFileTarget =
    fileTarget && validation.status === 'valid'
      ? { ...fileTarget, path: validation.path }
      : null

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (resolvedFileTarget) {
      event.preventDefault()
      previewWorkspaceFile({ ...resolvedFileTarget, workspaceRoot })
      return
    }

    if (isExternal && href && typeof window.dsGui?.openExternal === 'function') {
      event.preventDefault()
      void window.dsGui.openExternal(href).catch(() => undefined)
    }
  }

  const handleDoubleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!resolvedFileTarget) return
    event.preventDefault()
    void openWorkspacePathInEditor(resolvedFileTarget, workspaceRoot).then((result) => {
      if (!result.ok) {
        void window.dsGui?.logError?.('editor-open', 'Failed to open file reference', {
          message: result.message,
          target: resolvedFileTarget
        })?.catch(() => undefined)
      }
    })
  }

  return (
    <a
      href={href}
      title={title}
      className={[
        resolvedFileTarget ? 'ds-file-reference-link' : '',
        cleanClassName
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {children}
    </a>
  )
}

const BLOCK_MARKDOWN_REGEX =
  /(^|\n)\s{0,3}(#{1,6}\s|[-+*]\s|\d+\.\s|>\s|```|~~~)|(^|\n)\|.+\|/m

const INLINE_STRUCTURED_MARKDOWN_REGEX =
  /`[^`\n]+`|!\[[^\]]*]\([^)\n]+\)|\[[^\]]+]\([^)\n]+\)/
const MULTILINE_TEXT_REGEX = /\r?\n/
const MAX_ANIMATED_STREAMING_CHARS = 600
const MAX_WORD_ANIMATED_STREAMING_CHARS = 4000

export function shouldAnimateStreamingText(text: string): AnimateOptions | false {
  const trimmed = text.trim()
  if (!trimmed) return false
  const hasBlockMarkdown = BLOCK_MARKDOWN_REGEX.test(trimmed)
  const hasInlineStructured = INLINE_STRUCTURED_MARKDOWN_REGEX.test(trimmed)
  const isMultiline = MULTILINE_TEXT_REGEX.test(trimmed)

  if (!isMultiline && !hasBlockMarkdown && !hasInlineStructured && trimmed.length <= MAX_ANIMATED_STREAMING_CHARS) {
    return STREAMING_ANIMATED
  }

  if (trimmed.length <= MAX_WORD_ANIMATED_STREAMING_CHARS) {
    return STREAMING_ANIMATED_WORD
  }

  return false
}

type Props = {
  /** Markdown source */
  text: string
  /**
   * When true (live SSE chunking), uses Streamdown `streaming` mode with a
   * fast char-level fade so the output feels responsive without the heavy blur.
   */
  streaming: boolean
  className?: string
}

function StreamdownAssistantComponent({ text, streaming, className }: Props): ReactElement {
  const animated = streaming ? shouldAnimateStreamingText(text) : false
  const isAnimating = animated !== false

  return (
    <Streamdown
      className={className}
      mode={streaming ? 'streaming' : 'static'}
      parseIncompleteMarkdown={streaming}
      isAnimating={isAnimating}
      animated={animated}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {text}
    </Streamdown>
  )
}

export const StreamdownAssistant = memo(StreamdownAssistantComponent)
