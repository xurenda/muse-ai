import type { Highlighter } from 'shiki'

const HIGHLIGHT_LANGS = [
  'bash',
  'c',
  'cpp',
  'css',
  'diff',
  'go',
  'html',
  'java',
  'javascript',
  'json',
  'jsx',
  'markdown',
  'python',
  'rust',
  'shell',
  'sql',
  'text',
  'toml',
  'tsx',
  'typescript',
  'xml',
  'yaml',
] as const

const LANG_ALIASES: Record<string, (typeof HIGHLIGHT_LANGS)[number]> = {
  sh: 'bash',
  zsh: 'bash',
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  yml: 'yaml',
  md: 'markdown',
}

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: [...HIGHLIGHT_LANGS],
      }),
    )
  }
  return highlighterPromise
}

function resolveLanguage(lang: string, loadedLangs: string[]): string {
  const normalized = LANG_ALIASES[lang] ?? lang
  return loadedLangs.includes(normalized) ? normalized : 'text'
}

export async function highlightCode(code: string, lang: string, isDark: boolean): Promise<string> {
  const highlighter = await getHighlighter()
  const language = resolveLanguage(lang, highlighter.getLoadedLanguages())
  const theme = isDark ? 'github-dark' : 'github-light'

  return highlighter.codeToHtml(code, { lang: language, theme })
}
