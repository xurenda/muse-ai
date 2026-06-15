import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function parseKey(hex: string): Buffer {
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY 必须为 32 字节 hex（64 字符）')
  }
  return key
}

/** AES-256-GCM 加密；输出 base64(iv + ciphertext + authTag) */
export function encryptSecret(plaintext: string, encryptionKeyHex: string): string {
  const key = parseKey(encryptionKeyHex)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, encrypted, authTag]).toString('base64')
}

export function decryptSecret(payloadBase64: string, encryptionKeyHex: string): string {
  const key = parseKey(encryptionKeyHex)
  const payload = Buffer.from(payloadBase64, 'base64')
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('无效的加密载荷')
  }
  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
