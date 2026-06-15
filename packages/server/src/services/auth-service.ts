import { randomBytes, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'
import type { LoginResponse, RegisterRequest } from '@muse-ai/shared'
import type { MuseDb } from '../db/client.js'
import { users } from '../db/schema.js'

const BCRYPT_ROUNDS = 10
const JWT_EXPIRY = '7d'

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

  private async issueToken(user: AuthUser): Promise<LoginResponse> {
    const accessToken = await new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .sign(this.secretKey())
    return {
      accessToken,
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
