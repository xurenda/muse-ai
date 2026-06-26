import { z } from 'zod'
import { packageIdSchema } from '../schemas/market-id.js'
import { personaSchema, skillMetaSchema } from './agent.js'
import { assetSourceSchema, installedPackagesFileSchema, semverSchema } from './market.js'

export const marketInstallRequestSchema = z.object({
  packageId: packageIdSchema,
  version: semverSchema.optional(),
})

export type MarketInstallRequest = z.infer<typeof marketInstallRequestSchema>

export const marketUninstallRequestSchema = z.object({
  packageId: packageIdSchema,
})

export type MarketUninstallRequest = z.infer<typeof marketUninstallRequestSchema>

export const marketUpdateRequestSchema = z.object({
  packageId: packageIdSchema,
})

export type MarketUpdateRequest = z.infer<typeof marketUpdateRequestSchema>

export const marketInstallResponseSchema = z.object({
  packageId: packageIdSchema,
  version: semverSchema,
  action: z.enum(['installed', 'updated']),
})

export type MarketInstallResponse = z.infer<typeof marketInstallResponseSchema>

export const marketUninstallResponseSchema = z.object({
  packageId: packageIdSchema,
  uninstalled: z.literal(true),
})

export type MarketUninstallResponse = z.infer<typeof marketUninstallResponseSchema>

export const marketInstalledResponseSchema = installedPackagesFileSchema

export type MarketInstalledResponse = z.infer<typeof marketInstalledResponseSchema>

export const personaWithSourceSchema = personaSchema.extend({
  source: assetSourceSchema,
})

export type PersonaWithSource = z.infer<typeof personaWithSourceSchema>

export const skillWithSourceSchema = skillMetaSchema.extend({
  source: assetSourceSchema,
})

export type SkillWithSource = z.infer<typeof skillWithSourceSchema>

export const personasListResponseSchema = z.object({
  personas: z.array(personaWithSourceSchema),
})

export type PersonasListResponse = z.infer<typeof personasListResponseSchema>

export const skillsListResponseSchema = z.object({
  skills: z.array(skillWithSourceSchema),
})

export type SkillsListResponse = z.infer<typeof skillsListResponseSchema>
