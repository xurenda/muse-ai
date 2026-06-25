import { randomBytes, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, eq, gt } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'
import type { LoginResponse, RegisterRequest } from '@museai/shared'
import type { MuseDb } from '../db/client.js'
import { refreshTokens, users } from '../db/schema.js'

const BCRYPT_ROUNDS = 10
/** access token 有效期：7 天 */
const ACCESS_TOKEN_EXPIRY = '7d'
/** access token 有效秒数（用于写入 expiresAt 时间戳） */
const ACCESS_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60
/** refresh token 有效期：30 天 */
const REFRESH_TOKEN_EXPIRY_DAYS = 30

export interface AuthUser {
  id: string
  email: string
}

export class AuthService {
  constructor(
    private readonly db: MuseDb,
    private readonly jwtSecret: string,
  ) {}

  private secretKey(): Uint8Array {
    return new TextEncoder().encode(this.jwtSecret)
  }

  async register(input: RegisterRequest): Promise<LoginResponse> {
    const normalized = input.email.toLowerCase()
    const [existing] = await this.db.select().from(users).where(eq(users.email, normalized)).limit(1)
    if (existing) {
      throw new AuthError('email_taken', '邮箱已被注册')
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    const [row] = await this.db.insert(users).values({ email: normalized, passwordHash }).returning({ id: users.id, email: users.email })
    if (!row) throw new Error('注册失败')
    return this.issueToken(row)
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const normalized = email.toLowerCase()
    const [row] = await this.db.select().from(users).where(eq(users.email, normalized)).limit(1)
    if (!row) {
      throw new AuthError('invalid_credentials', '邮箱或密码错误')
    }
    const ok = await bcrypt.compare(password, row.passwordHash)
    if (!ok) {
      throw new AuthError('invalid_credentials', '邮箱或密码错误')
    }
    return this.issueToken({ id: row.id, email: row.email })
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey())
      const sub = payload.sub
      if (typeof sub !== 'string') {
        throw new AuthError('invalid_token', '无效的访问令牌')
      }
      const email = payload.email
      if (typeof email !== 'string') {
        throw new AuthError('invalid_token', '无效的访问令牌')
      }
      return { id: sub, email }
    } catch {
      throw new AuthError('invalid_token', '无效的访问令牌')
    }
  }

  /**
   * 用 refresh token 换取新的 access token + 新的 refresh token（轮换策略）。
   * 旧 refresh token 在返回新 token 后立即吊销，防止重放攻击。
   */
  async refreshAccessToken(oldRefreshToken: string): Promise<LoginResponse> {
    const now = new Date()
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.token, oldRefreshToken), eq(refreshTokens.revoked, false), gt(refreshTokens.expiresAt, now)))
      .limit(1)

    if (!row) {
      throw new AuthError('invalid_token', '无效或已过期的 refresh token')
    }

    // 先吊销旧 token，再签发新 token（原子性最佳实践）
    await this.db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, row.id))

    const [userRow] = await this.db.select().from(users).where(eq(users.id, row.userId)).limit(1)
    if (!userRow) {
      throw new AuthError('invalid_token', '用户不存在')
    }

    return this.issueToken({ id: userRow.id, email: userRow.email })
  }

  private async issueToken(user: AuthUser): Promise<LoginResponse> {
    const now = Math.floor(Date.now() / 1000)
    const accessTokenExpiresAt = now + ACCESS_TOKEN_EXPIRY_SECONDS

    const accessToken = await new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(this.secretKey())

    // 生成随机 refresh token 并持久化
    const refreshToken = randomBytes(40).toString('hex')
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    await this.db.insert(refreshTokens).values({ userId: user.id, token: refreshToken, expiresAt })

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      user: { id: user.id, email: user.email },
    }
  }
}

export function hashDeviceToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_ROUNDS)
}

export async function verifyDeviceToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash)
}

export function generateDeviceToken(): string {
  return randomBytes(32).toString('hex')
}

/** 常量时间比较配对码 */
export function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export class AuthError extends Error {
  constructor(
    readonly code: 'email_taken' | 'invalid_credentials' | 'invalid_token',
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}
