const PBKDF2_ITERATIONS = 100_000
const HASH_LENGTH = 256
const SALT_LENGTH = 16

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")

  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)

  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function deriveHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const encoder = new TextEncoder()

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LENGTH,
  )

  return new Uint8Array(bits)
}

function constantTimeEqual(
  a: Uint8Array,
  b: Uint8Array,
): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0

  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }

  return result === 0
}

export async function hashPassword(
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(
    new Uint8Array(SALT_LENGTH),
  )

  const hash = await deriveHash(
    password,
    salt,
    PBKDF2_ITERATIONS,
  )

  return [
    "pbkdf2_sha256",
    PBKDF2_ITERATIONS,
    bytesToBase64Url(salt),
    bytesToBase64Url(hash),
  ].join("$")
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$")

  if (parts.length !== 4) {
    return false
  }

  const [
    algorithm,
    iterationsText,
    saltText,
    hashText,
  ] = parts

  if (algorithm !== "pbkdf2_sha256") {
    return false
  }

  const iterations = Number(iterationsText)

  if (
    !Number.isInteger(iterations) ||
    iterations <= 0
  ) {
    return false
  }

  try {
    const salt = base64UrlToBytes(saltText)
    const expectedHash = base64UrlToBytes(hashText)

    const actualHash = await deriveHash(
      password,
      salt,
      iterations,
    )

    return constantTimeEqual(
      actualHash,
      expectedHash,
    )
  } catch {
    return false
  }
}
