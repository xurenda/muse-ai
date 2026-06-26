import { z } from 'zod'
import { isReservedUsername } from '../constants/market.js'

/** slug 段：`^[a-z0-9]+(?:-[a-z0-9]+)*$` */
export const marketSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

/** 市场包 id：`{username}/{package-slug}` */
export const packageIdSchema = z.string().refine(value => {
  const parts = value.split('/')
  if (parts.length !== 2) return false
  return parts.every(part => marketSlugSchema.safeParse(part).success)
}, '应为 {username}/{package-slug} 格式')

/** 资产 id（至少两段路径），如 `museai/basic-kit/general`、`local/my-draft` */
export const scopedAssetIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/)

/** 注册用户名：3–32 字符，存小写；保留名由 refine 拒绝 */
export const usernameSchema = z
  .string()
  .transform(value => value.toLowerCase())
  .pipe(
    z
      .string()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '用户名仅允许小写字母、数字与连字符')
      .refine(value => !isReservedUsername(value), { message: 'username_taken' }),
  )

export type PackageId = z.infer<typeof packageIdSchema>
export type ScopedAssetId = z.infer<typeof scopedAssetIdSchema>
export type Username = z.infer<typeof usernameSchema>
