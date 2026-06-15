import { DEFAULT_PORTS } from "@muse-ai/shared";

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`;

export function App() {
  return (
    <main className="app">
      <h1>MuseAI</h1>
      <p className="muted">阶段 0 — Web 骨架已就绪</p>
      <dl className="env-list">
        <div>
          <dt>Backend URL</dt>
          <dd>{backendUrl}</dd>
        </div>
        <div>
          <dt>CLI 默认端口</dt>
          <dd>{DEFAULT_PORTS.CLI}</dd>
        </div>
      </dl>
      <p className="hint">聊天 UI 将在阶段 4 接入；当前请用 curl 验证 CLI / Server health。</p>
    </main>
  );
}
