import { isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '@/components/chat/code-block'
import { cn } from '@/lib/utils'

interface HastTextNode {
  type: 'text'
  value: string
}

interface CodeElementProps {
  node?: { tagName?: string; children?: unknown[] }
  className?: string
  children?: ReactNode
}

function readCodeText(children: ReactNode): string {
  if (typeof children === 'string') {
    return children.replace(/\n$/, '')
  }

  if (Array.isArray(children)) {
    return children.map(child => readCodeText(child)).join('')
  }

  if (isValidElement<{ children?: ReactNode }>(children)) {
    return readCodeText(children.props.children)
  }

  return String(children ?? '').replace(/\n$/, '')
}

function getCodeText(node: { children?: unknown[] } | undefined, children: ReactNode): string {
  const textValue = node?.children
    ?.filter((child): child is HastTextNode => {
      return typeof child === 'object' && child !== null && 'type' in child && child.type === 'text' && 'value' in child && typeof child.value === 'string'
    })
    .map(child => child.value)
    .join('')

  if (textValue) {
    return textValue.replace(/\n$/, '')
  }

  return readCodeText(children)
}

function resolveBlockLanguage(className: string | undefined): string {
  const languageMatch = /language-([\w-]+)/.exec(className ?? '')
  return languageMatch?.[1] ?? 'text'
}

const markdownComponents: Components = {
  pre({ children }) {
    if (!isValidElement<CodeElementProps>(children) || children.props.node?.tagName !== 'code') {
      return <pre>{children}</pre>
    }

    const { node, className, children: codeChildren } = children.props

    return <CodeBlock code={getCodeText(node, codeChildren)} language={resolveBlockLanguage(className)} />
  },
  code({ className, children, ...props }) {
    return (
      <code className={cn('rounded bg-accent px-1 py-0.5 font-mono text-[0.8125rem]', className)} {...props}>
        {children}
      </code>
    )
  },
}

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content.trim()) return null

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-foreground prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 prose-pre:shadow-none dark:prose-invert',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
