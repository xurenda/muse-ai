# 阶段 2：可组合 Agent

**状态**：⬜ 未开始  
**预估周期**：~1–2 周

---

## 目标

Persona + Skills 可组装成 Agent，切换 agent 后 system prompt 与 skills 行为明显不同。

---

## 计划任务

- [ ] Persona 格式：`persona.json` + `system.md`
- [ ] Skill 格式：`SKILL.md`（兼容 pi/Cursor 惯例）
- [ ] `MuseAgentRegistry`：加载、列出、实例化 Harness
- [ ] 内置资产：通用助手、编程助手 + git/review 等 skills
- [ ] CLI：`muse agent list/create/use`
- [ ] CLI HTTP API：`/agents`、`/sessions` 真实数据

---

## 验收标准

- 新建/切换 agent 后对话行为符合所选 Persona + Skills
- `~/.muse/agents/`、`personas/`、`skills/` 目录结构稳定

---

## 完成记录

_（阶段完成后在此填写）_
