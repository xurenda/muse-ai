import { describe, expect, it, vi } from 'vitest'
import type { MuseDb } from '@/db/client.js'
import { AuthError, AuthService } from '@/services/auth-service.js'

const JWT_SECRET = 'test-jwt-secret'

function createSelectChain(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  }
}

function createMockDb(options: { emailRows?: unknown[]; usernameRows?: unknown[]; insertRow?: unknown }): MuseDb {
  let selectCall = 0
  return {
    select: () => {
      selectCall += 1
      if (selectCall === 1) {
        return createSelectChain(options.emailRows ?? [])
      }
      return createSelectChain(options.usernameRows ?? [])
    },
    insert: () => ({
      values: () => ({
        returning: async () => [options.insertRow ?? { id: 'user-id', email: 'a@b.c', username: 'kingen' }],
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  } as unknown as MuseDb
}

describe('AuthService.register', () => {
  it('保留用户名应返回 username_taken', async () => {
    const service = new AuthService(createMockDb({}), JWT_SECRET)
    await expect(service.register({ email: 'a@b.c', password: 'password123', username: 'museai' })).rejects.toMatchObject({ code: 'username_taken' })
  })

  it('邮箱已存在应返回 email_taken', async () => {
    const service = new AuthService(createMockDb({ emailRows: [{ id: 'existing' }] }), JWT_SECRET)
    await expect(service.register({ email: 'a@b.c', password: 'password123', username: 'kingen' })).rejects.toMatchObject({ code: 'email_taken' })
  })

  it('用户名已存在应返回 username_taken', async () => {
    const service = new AuthService(createMockDb({ usernameRows: [{ id: 'existing' }] }), JWT_SECRET)
    await expect(service.register({ email: 'a@b.c', password: 'password123', username: 'kingen' })).rejects.toMatchObject({ code: 'username_taken' })
  })

  it('合法请求应写入 username 并签发 token', async () => {
    const insertValues = vi.fn().mockReturnValue({
      returning: async () => [{ id: 'new-id', email: 'user@example.com', username: 'kingen' }],
    })
    const db = {
      select: () => createSelectChain([]),
      insert: () => ({ values: insertValues }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    } as unknown as MuseDb

    const service = new AuthService(db, JWT_SECRET)
    const result = await service.register({ email: 'user@example.com', password: 'password123', username: 'kingen' })

    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ email: 'user@example.com', username: 'kingen' }))
    expect(result.user).toMatchObject({ id: 'new-id', email: 'user@example.com', username: 'kingen' })
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
  })
})

describe('AuthError', () => {
  it('应暴露错误码', () => {
    const error = new AuthError('username_taken', '用户名已存在')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('username_taken')
  })
})
