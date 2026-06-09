import { APP_NAME } from '@muse-ai/shared'
import { Button } from '@/components/ui/button'

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-foreground">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="text-muted-foreground">Vite + React 前端已就绪，可在此基础上继续开发。</p>
      </div>
      <Button type="button">开始使用</Button>
    </main>
  )
}
