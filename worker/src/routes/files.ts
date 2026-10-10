import { requireAuth } from "../lib/authz"

type Env = {
  DB: D1Database
  FILES_BUCKET: R2Bucket
  AI: Ai
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

const allowedCategories = new Set([
  "receipts",
  "photos",
  "documents",
  "scripts",
  "uploads",
])

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeCategory(value: unknown): string {
  const category = String(value ?? "uploads").trim()

  if (!allowedCategories.has(category)) {
    throw new Error(
      "category must be one of: receipts, photos, documents, scripts, uploads",
    )
  }

  return category
}

function sanitizeExtension(filename: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]{1,10})$/)

  if (!match) {
    return ""
  }

  return `.${match[1].toLowerCase()}`
}

async function getFile(
  env: Env,
  objectKey: string,
): Promise<{
  id: string
  object_key: string
  original_name: string
  content_type: string
  size: number
  category: string
  uploaded_by: string
  created_at: string
} | null> {
  return env.DB
    .prepare(`
      SELECT
        id,
        object_key,
        original_name,
        content_type,
        size,
        category,
        uploaded_by,
        created_at
      FROM files
      WHERE object_key = ?
      LIMIT 1
    `)
    .bind(objectKey)
    .first()
}

export async function handleFiles(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  try {
    if (request.method === "POST" && pathParts.length === 0) {
      const contentLength = Number(
        request.headers.get("Content-Length") ?? 0,
      )

      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_FILE_SIZE + 1024 * 1024
      ) {
        return json(
          {
            error: "File is too large",
            max_size: MAX_FILE_SIZE,
          },
          413,
        )
      }

      const formData = await request.formData()
      const file = formData.get("file")

      if (!(file instanceof File)) {
        return json(
          { error: "file is required" },
          400,
        )
      }

      if (file.size === 0) {
        return json(
          { error: "file must not be empty" },
          400,
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        return json(
          {
            error: "File is too large",
            max_size: MAX_FILE_SIZE,
          },
          413,
        )
      }

      const category = normalizeCategory(
        formData.get("category"),
      )

      const originalName = file.name.trim() || "file"
      const contentType =
        file.type.trim() || "application/octet-stream"

      const id = crypto.randomUUID()
      const extension = sanitizeExtension(originalName)
      const objectKey = `${category}/${id}${extension}`

      await env.FILES_BUCKET.put(
        objectKey,
        file.stream(),
        {
          httpMetadata: {
            contentType,
            contentDisposition:
              `inline; filename="${originalName.replace(/["\\]/g, "_")}"`,
          },
          customMetadata: {
            fileId: id,
            originalName,
            category,
            uploadedBy: auth.user.id,
          },
        },
      )

      try {
        await env.DB
          .prepare(`
            INSERT INTO files (
              id,
              object_key,
              original_name,
              content_type,
              size,
              category,
              uploaded_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            id,
            objectKey,
            originalName,
            contentType,
            file.size,
            category,
            auth.user.id,
          )
          .run()
      } catch (error) {
        await env.FILES_BUCKET.delete(objectKey)
        throw error
      }

      return json(
        {
          id,
          object_key: objectKey,
          original_name: originalName,
          content_type: contentType,
          size: file.size,
          category,
          uploaded_by: auth.user.id,
        },
        201,
      )
    }

    if (
      (request.method === "GET" || request.method === "DELETE") &&
      pathParts.length > 0
    ) {
      const objectKey = pathParts
        .map((part) => decodeURIComponent(part))
        .join("/")

      const file = await getFile(env, objectKey)

      if (!file) {
        return json(
          { error: "File not found" },
          404,
        )
      }

      if (request.method === "GET") {
        const object = await env.FILES_BUCKET.get(objectKey)

        if (!object) {
          return json(
            { error: "File object not found" },
            404,
          )
        }

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set("etag", object.httpEtag)
        headers.set(
          "Cache-Control",
          "private, max-age=3600",
        )

        return new Response(object.body, {
          status: 200,
          headers,
        })
      }

      const isOwner = file.uploaded_by === auth.user.id

      const admin = await env.DB
        .prepare(`
          SELECT 1
          FROM user_account_roles uar
          INNER JOIN account_roles ar
            ON ar.id = uar.account_role_id
          WHERE uar.user_id = ?
            AND ar.name = 'admin'
          LIMIT 1
        `)
        .bind(auth.user.id)
        .first()

      if (!isOwner && !admin) {
        return json(
          { error: "Forbidden" },
          403,
        )
      }

      await env.FILES_BUCKET.delete(objectKey)

      await env.DB
        .prepare(`
          DELETE FROM files
          WHERE object_key = ?
        `)
        .bind(objectKey)
        .run()

      return json({
        success: true,
        object_key: objectKey,
      })
    }

    return json(
      { error: "Not Found" },
      404,
    )
  } catch (error) {
    console.error("Files API error:", error)

    return json(
      {
        error: "Internal Server Error",
        detail: errorMessage(error),
      },
      500,
    )
  }
}
