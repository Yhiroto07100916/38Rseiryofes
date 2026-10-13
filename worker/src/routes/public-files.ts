type Env = {
  DB: D1Database
  FILES_BUCKET: R2Bucket
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function handlePublicFiles(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  if (request.method !== "GET" || pathParts.length !== 1) {
    return json({ error: "Not Found" }, 404)
  }

  const token = pathParts[0]
  // 32 bytes of random data encoded as base64url (43 characters).
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return json({ error: "Share link not found or revoked" }, 404)
  }

  try {
    const tokenHash = await sha256(token)
    const share = await env.DB.prepare(`
      SELECT f.object_key, f.original_name, f.content_type, f.archived_at
      FROM file_shares s
      INNER JOIN files f ON f.id = s.file_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
      LIMIT 1
    `).bind(tokenHash).first<{
      object_key: string
      original_name: string
      content_type: string
      archived_at: string | null
    }>()

    if (!share || share.archived_at) {
      return json({ error: "Share link not found or revoked" }, 404)
    }

    const object = await env.FILES_BUCKET.get(share.object_key)
    if (!object) {
      return json({ error: "File not found" }, 404)
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set("Content-Type", share.content_type || "application/octet-stream")
    headers.set("Content-Disposition", "inline")
    headers.set("Cache-Control", "no-store")
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox")
    headers.set("Referrer-Policy", "no-referrer")
    headers.set("X-Share-File-Name", encodeURIComponent(share.original_name))

    return new Response(object.body, { status: 200, headers })
  } catch (error) {
    console.error("Public file retrieval failed:", error)
    return json({ error: "Unable to retrieve file" }, 500)
  }
}
