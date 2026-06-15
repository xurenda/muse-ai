import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from '@/crypto/aes-gcm.js'

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('aes-gcm', () => {
  it('应能加解密 API Key', () => {
    const encrypted = encryptSecret('sk-test-key', TEST_KEY)
    expect(encrypted).not.toContain('sk-test-key')
    expect(decryptSecret(encrypted, TEST_KEY)).toBe('sk-test-key')
  })
})
