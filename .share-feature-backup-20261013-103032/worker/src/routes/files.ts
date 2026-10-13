import { requireAuth } from "../lib/authz"

type Env = {
  DB: D1Database
  FILES_BUCKET: R2Bucket
  AI: Ai
}

const MAX_FILE_SIZE = 25 * 1024 * 1024

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

async function normalizeCategory(
  env: Env,
  value: unknown,
): Promise<string> {
  const category = String(value ?? "uploads").trim()

  const existing = await env.DB
    .prepare(`
      SELECT slug
      FROM file_categories
      WHERE slug = ?
        AND is_active = 1
      LIMIT 1
    `)
    .bind(category)
    .first<{ slug: string }>()

  if (!existing) {
    throw new Error("INVALID_FILE_CATEGORY")
  }

  return existing.slug
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
  archived_at: string | null
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
        created_at,
        archived_at
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
    const url = new URL(request.url)

    if (pathParts[0] === "categories") {
      const categorySlug = pathParts.length >= 2
        ? decodeURIComponent(pathParts[1])
        : ""

      if (request.method === "GET" && pathParts.length === 1) {
        const includeInactive = url.searchParams.get("include_inactive") === "true"

        if (includeInactive) {
          const canManage = await env.DB
            .prepare(`
              SELECT 1
              FROM user_account_roles uar
              INNER JOIN account_roles ar
                ON ar.id = uar.account_role_id
              WHERE uar.user_id = ?
                AND ar.name IN ('admin', 'class_representative')
              LIMIT 1
            `)
            .bind(auth.user.id)
            .first()

          if (!canManage) {
            return json({ error: "Forbidden" }, 403)
          }
        }

        const result = await env.DB
          .prepare(`
            SELECT slug, name, description, sort_order, is_active,
                   created_at, updated_at
            FROM file_categories
            ${includeInactive ? "" : "WHERE is_active = 1"}
            ORDER BY sort_order, name
          `)
          .all()

        return json({ categories: result.results ?? [] })
      }

      const canManage = await env.DB
        .prepare(`
          SELECT 1
          FROM user_account_roles uar
          INNER JOIN account_roles ar
            ON ar.id = uar.account_role_id
          WHERE uar.user_id = ?
            AND ar.name IN ('admin', 'class_representative')
          LIMIT 1
        `)
        .bind(auth.user.id)
        .first()

      if (!canManage) {
        return json(
          { error: "Only class representatives and administrators can manage categories" },
          403,
        )
      }

      if (request.method === "POST" && pathParts.length === 1) {
        let body: { slug?: unknown; name?: unknown; description?: unknown; sort_order?: unknown }

        try {
          body = await request.json()
        } catch {
          return json({ error: "Invalid JSON" }, 400)
        }

        const slug = typeof body.slug === "string" ? body.slug.trim() : ""
        const name = typeof body.name === "string" ? body.name.trim() : ""
        const description =
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim()
            : null
        const sortOrder = Number(body.sort_order ?? 100)

        if (!/^[a-z0-9_-]{1,40}$/.test(slug) || !name || name.length > 100) {
          return json({ error: "Invalid category slug or name" }, 400)
        }

        if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
          return json({ error: "Invalid sort_order" }, 400)
        }

        try {
          await env.DB
            .prepare(`
              INSERT INTO file_categories (slug, name, description, sort_order, created_by)
              VALUES (?, ?, ?, ?, ?)
            `)
            .bind(slug, name, description, sortOrder, auth.user.id)
            .run()
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (/unique|constraint/i.test(message)) {
            return json({ error: "Category slug already exists" }, 409)
          }
          throw error
        }

        return json({ success: true, slug }, 201)
      }

      if (pathParts.length === 2 && request.method === "PATCH") {
        let body: { name?: unknown; description?: unknown; sort_order?: unknown; is_active?: unknown }

        try {
          body = await request.json()
        } catch {
          return json({ error: "Invalid JSON" }, 400)
        }

        const existing = await env.DB
          .prepare("SELECT slug FROM file_categories WHERE slug = ? LIMIT 1")
          .bind(categorySlug)
          .first()

        if (!existing) {
          return json({ error: "Category not found" }, 404)
        }

        if (
          body.name !== undefined &&
          (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100)
        ) {
          return json({ error: "Invalid category name" }, 400)
        }

        if (
          body.description !== undefined &&
          body.description !== null &&
          typeof body.description !== "string"
        ) {
          return json({ error: "Invalid description" }, 400)
        }

        const sortOrder = body.sort_order === undefined ? null : Number(body.sort_order)
        if (sortOrder !== null && (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000)) {
          return json({ error: "Invalid sort_order" }, 400)
        }

        if (body.is_active !== undefined && ![0, 1, true, false].includes(body.is_active as never)) {
          return json({ error: "is_active must be a boolean or 0/1" }, 400)
        }

        await env.DB
          .prepare(`
            UPDATE file_categories
            SET
              name = COALESCE(?, name),
              description = CASE WHEN ? = 1 THEN ? ELSE description END,
              sort_order = COALESCE(?, sort_order),
              is_active = COALESCE(?, is_active),
              updated_at = CURRENT_TIMESTAMP
            WHERE slug = ?
          `)
          .bind(
            typeof body.name === "string" ? body.name.trim() : null,
            body.description !== undefined ? 1 : 0,
            typeof body.description === "string" ? (body.description.trim() || null) : null,
            sortOrder,
            body.is_active === undefined ? null : (body.is_active === true || body.is_active === 1 ? 1 : 0),
            categorySlug,
          )
          .run()

        return json({ success: true, slug: categorySlug })
      }

      if (pathParts.length === 2 && request.method === "DELETE") {
        const result = await env.DB
          .prepare(`
            UPDATE file_categories
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE slug = ? AND is_active = 1
          `)
          .bind(categorySlug)
          .run()

        if (!result.meta.changes) {
          return json({ error: "Category not found or already inactive" }, 404)
        }

        return json({ success: true, slug: categorySlug, is_active: false })
      }

      return json({ error: "Not Found" }, 404)
    }

    if (request.method === "GET" && pathParts.length === 0) {
      const search = (url.searchParams.get("search") ?? "").trim()
      const category = (url.searchParams.get("category") ?? "").trim()
      const archived = url.searchParams.get("archived") === "true"
      const limit = Math.min(
        Math.max(Number(url.searchParams.get("limit") ?? 100) || 100, 1),
        200,
      )

      let query = `
        SELECT
          f.id,
          f.object_key,
          f.original_name,
          f.content_type,
          f.size,
          f.category,
          f.uploaded_by,
          f.created_at,
          f.archived_at,
          f.ai_status,
          f.ai_summary
        FROM files f
        WHERE ${archived ? "f.archived_at IS NOT NULL" : "f.archived_at IS NULL"}
      `
      const bindings: (string | number)[] = []

      if (category) {
        query += " AND f.category = ?"
        bindings.push(category)
      }

      if (search) {
        query += ` AND (
          f.original_name LIKE ?
          OR COALESCE(f.ai_summary, '') LIKE ?
          OR COALESCE(f.extracted_text, '') LIKE ?
        )`
        const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`
        bindings.push(term, term, term)
      }

      query += " ORDER BY f.created_at DESC LIMIT ?"
      bindings.push(limit)

      const result = await env.DB
        .prepare(query)
        .bind(...bindings)
        .all()

      return json({
        files: result.results ?? [],
        count: result.results?.length ?? 0,
      })
    }

    if (
      request.method === "POST" &&
      pathParts.length === 2 &&
      ["archive", "restore"].includes(pathParts[1])
    ) {
      const fileId = decodeURIComponent(pathParts[0])
      const action = pathParts[1]

      const file = await env.DB
        .prepare(`
          SELECT id, uploaded_by, archived_at
          FROM files
          WHERE id = ?
          LIMIT 1
        `)
        .bind(fileId)
        .first<{
          id: string
          uploaded_by: string
          archived_at: string | null
        }>()

      if (!file) {
        return json({ error: "File not found" }, 404)
      }

      const canManageFiles = await env.DB
        .prepare(`
          SELECT 1
          FROM user_account_roles uar
          INNER JOIN account_roles ar
            ON ar.id = uar.account_role_id
          WHERE uar.user_id = ?
            AND ar.name IN ('admin', 'class_representative')
          LIMIT 1
        `)
        .bind(auth.user.id)
        .first()

      if (!canManageFiles) {
        return json(
          { error: "Only class representatives and administrators can archive or restore files" },
          403,
        )
      }

      if (action === "archive") {
        if (file.archived_at) {
          return json({ error: "File is already archived" }, 409)
        }

        await env.DB
          .prepare(`
            UPDATE files
            SET archived_at = CURRENT_TIMESTAMP,
                archived_by = ?
            WHERE id = ?
              AND archived_at IS NULL
          `)
          .bind(auth.user.id, fileId)
          .run()
      } else {
        if (!file.archived_at) {
          return json({ error: "File is not archived" }, 409)
        }

        await env.DB
          .prepare(`
            UPDATE files
            SET archived_at = NULL,
                archived_by = NULL
            WHERE id = ?
              AND archived_at IS NOT NULL
          `)
          .bind(fileId)
          .run()
      }

      return json({
        success: true,
        id: fileId,
        action,
      })
    }

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

      let category: string

      try {
        category = await normalizeCategory(
          env,
          formData.get("category"),
        )
      } catch (error) {
        if (error instanceof Error && error.message === "INVALID_FILE_CATEGORY") {
          return json({ error: "Invalid or inactive file category" }, 400)
        }
        throw error
      }

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

      if (!admin) {
        return json(
          { error: "Only administrators can permanently delete files" },
          403,
        )
      }

      if (!file.archived_at) {
        return json(
          {
            error: "Archive the file before permanently deleting it",
            code: "FILE_MUST_BE_ARCHIVED",
          },
          409,
        )
      }

      const receiptLink = await env.DB
        .prepare(`
          SELECT 1
          FROM receipt_files
          WHERE file_id = ?
          LIMIT 1
        `)
        .bind(file.id)
        .first()

      if (receiptLink) {
        return json(
          {
            error: "This file is attached to an accounting receipt",
            code: "FILE_HAS_RECEIPT_LINK",
          },
          409,
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
