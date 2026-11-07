import { getSessionUser } from "../lib/session"

type AvatarEnv = Env & {
  FILES_BUCKET: R2Bucket
}

const MAX_AVATAR_SIZE = 2 * 1024 * 1024
const MAX_MULTIPART_OVERHEAD = 64 * 1024

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

function detectImageType(
  bytes: Uint8Array,
): { contentType: string; extension: string } | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" }
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" }
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" }
  }

  return null
}

export async function handleAvatarMutation(
  request: Request,
  env: AvatarEnv,
): Promise<Response> {
  const user = await getSessionUser(request, env)

  if (!user) {
    return json({ error: "Unauthorized" }, 401)
  }

  if (request.method === "POST") {
    const contentLength = Number(request.headers.get("Content-Length"))

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_AVATAR_SIZE + MAX_MULTIPART_OVERHEAD
    ) {
      return json({ error: "画像は2MB以下にしてください" }, 413)
    }

    let form: FormData

    try {
      form = await request.formData()
    } catch {
      return json({ error: "Invalid form data" }, 400)
    }

    const file = form.get("avatar")

    if (!(file instanceof File)) {
      return json({ error: "Avatar image is required" }, 400)
    }

    if (file.size === 0 || file.size > MAX_AVATAR_SIZE) {
      return json({ error: "画像は2MB以下にしてください" }, 413)
    }

    const buffer = await file.arrayBuffer()
    const image = detectImageType(new Uint8Array(buffer))

    if (!image) {
      return json(
        { error: "JPEG・PNG・WebP形式の画像を選択してください" },
        400,
      )
    }

    const key = `avatars/${user.id}/${crypto.randomUUID()}.${image.extension}`

    await env.FILES_BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: image.contentType,
        contentDisposition: "inline",
        cacheControl: "no-store",
      },
      customMetadata: {
        userId: user.id,
        purpose: "profile-avatar",
      },
    })

    try {
      await env.DB
        .prepare("UPDATE users SET avatar_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(key, user.id)
        .run()
    } catch (error) {
      await env.FILES_BUCKET.delete(key)
      throw error
    }

    if (user.avatar_key && user.avatar_key !== key) {
      try {
        await env.FILES_BUCKET.delete(user.avatar_key)
      } catch (error) {
        console.error("Failed to delete previous avatar:", error)
      }
    }

    return json({ avatar_key: key })
  }

  if (request.method === "DELETE") {
    if (!user.avatar_key) {
      return json({ avatar_key: null })
    }

    await env.DB
      .prepare("UPDATE users SET avatar_key = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(user.id)
      .run()

    try {
      await env.FILES_BUCKET.delete(user.avatar_key)
    } catch (error) {
      console.error("Failed to delete avatar object:", error)
    }

    return json({ avatar_key: null })
  }

  return json({ error: "Method Not Allowed" }, 405)
}

export async function handleAvatarImage(
  request: Request,
  env: AvatarEnv,
  pathParts: string[],
): Promise<Response> {
  if (request.method !== "GET" || pathParts.length !== 1) {
    return json({ error: "Not Found" }, 404)
  }

  const userId = pathParts[0]
  const user = await env.DB
    .prepare("SELECT avatar_key FROM users WHERE id = ? LIMIT 1")
    .bind(userId)
    .first<{ avatar_key: string | null }>()

  if (
    !user?.avatar_key ||
    !user.avatar_key.startsWith(`avatars/${userId}/`)
  ) {
    return json({ error: "Avatar not found" }, 404)
  }

  const object = await env.FILES_BUCKET.get(user.avatar_key)

  if (!object) {
    return json({ error: "Avatar not found" }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set("Content-Disposition", "inline")
  headers.set("Cache-Control", "no-store")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Referrer-Policy", "no-referrer")

  return new Response(object.body, { status: 200, headers })
}
