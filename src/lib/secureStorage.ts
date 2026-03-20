// Secure localStorage helpers using Web Crypto (AES-GCM with PBKDF2)
// Stores payload as base64(salt):base64(iv):base64(cipher)

function bufToBase64(buf: Uint8Array) {
  let binary = ''
  const len = buf.byteLength
  for (let i = 0; i < len; i++) binary += String.fromCharCode(buf[i])
  return btoa(binary)
}

function base64ToBuf(b64: string) {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const enc = new TextEncoder()
  const passkey = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations: 200_000, hash: 'SHA-256' },
    passkey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  return key
}

export async function encryptToLocalStorage(name: string, value: any, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const enc = new TextEncoder()
  const data = enc.encode(JSON.stringify(value))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const payload = `${bufToBase64(salt)}:${bufToBase64(iv)}:${bufToBase64(new Uint8Array(ct))}`
  localStorage.setItem(name, payload)
}

export async function decryptFromLocalStorage(name: string, passphrase: string): Promise<any | null> {
  const raw = localStorage.getItem(name)
  if (!raw) return null
  const parts = raw.split(':')
  if (parts.length !== 3) return null
  const salt = base64ToBuf(parts[0])
  const iv = base64ToBuf(parts[1])
  const ct = base64ToBuf(parts[2])
  try {
    const key = await deriveKey(passphrase, new Uint8Array(salt))
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, ct)
    const dec = new TextDecoder()
    return JSON.parse(dec.decode(new Uint8Array(plain)))
  } catch (e) {
    return null
  }
}

export function removeItemEncrypted(name: string) {
  localStorage.removeItem(name)
}
