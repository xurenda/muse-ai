import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from '@/app'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import '@/i18n/setup'
import '@/styles/index.css'
import { applyTheme } from '@/utils/apply-theme'

applyTheme('system')

const root = document.getElementById('root')
if (!root) {
  throw new Error('找不到 #root 挂载点')
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
)
