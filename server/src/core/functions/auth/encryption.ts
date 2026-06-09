import crypto from 'crypto'
import CryptoJS from 'crypto-js'

import {
  Decrypt2Func,
  DecryptFunc,
  Encrypt2Func,
  EncryptFunc
} from '@lifeforge/server-utils'

const ALGORITHM = 'aes-256-ctr'

const encrypt: EncryptFunc = (buffer: Buffer, key: string) => {
  const iv = Uint8Array.from(crypto.randomBytes(16))

  key = crypto
    .createHash('sha256')
    .update(String(key))
    .digest('base64')
    .slice(0, 32)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encryptedChunk = Uint8Array.from(cipher.update(Uint8Array.from(buffer)))
  const finalChunk = Uint8Array.from(cipher.final())

  const result = Buffer.from(
    Uint8Array.from([...iv, ...encryptedChunk, ...finalChunk])
  )

  return result
}

const decrypt: DecryptFunc = (encrypted: Buffer, key: string) => {
  const iv = Uint8Array.from(encrypted.subarray(0, 16))

  encrypted = encrypted.subarray(16)
  key = crypto
    .createHash('sha256')
    .update(String(key))
    .digest('base64')
    .slice(0, 32)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  const decryptedChunk = Uint8Array.from(
    decipher.update(Uint8Array.from(encrypted))
  )
  const finalChunk = Uint8Array.from(decipher.final())

  const result = Buffer.from(
    Uint8Array.from([...decryptedChunk, ...finalChunk])
  )

  return result
}

const encrypt2: Encrypt2Func = (message: string, key: string) =>
  CryptoJS.AES.encrypt(message, key).toString()

const decrypt2: Decrypt2Func = (encrypted: string, key: string) =>
  CryptoJS.AES.decrypt(encrypted, key).toString(CryptoJS.enc.Utf8)

export { decrypt, decrypt2, encrypt, encrypt2 }
