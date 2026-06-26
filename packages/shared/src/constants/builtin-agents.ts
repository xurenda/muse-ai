import { BASIC_KIT_PACKAGE_ID } from './market.js'

/** 内置「通用助手」Agent UUID，与 DEFAULT_AGENT_ID 一致 */
export const BUILTIN_GENERAL_AGENT_ID = '00000000-0000-4000-8000-000000000001'

/** 内置「编程助手」Agent UUID */
export const BUILTIN_CODING_AGENT_ID = '00000000-0000-4000-8000-000000000002'

/** 内置 Persona id（`museai/basic-kit` 套件内） */
export const BUILTIN_PERSONA_GENERAL = `${BASIC_KIT_PACKAGE_ID}/general`
export const BUILTIN_PERSONA_CODING = `${BASIC_KIT_PACKAGE_ID}/coding`

/** 内置 Skill id（`museai/basic-kit` 套件内） */
export const BUILTIN_SKILL_GIT = `${BASIC_KIT_PACKAGE_ID}/git`
export const BUILTIN_SKILL_REVIEW = `${BASIC_KIT_PACKAGE_ID}/review`
