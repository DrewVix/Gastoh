import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY not set')
  return Buffer.from(key, 'hex')
}

export function encrypt(plaintext: string): { iv: string; tag: string; cipher: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    cipher: encrypted.toString('hex'),
  }
}

export function decrypt(iv: string, tag: string, cipherHex: string): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
