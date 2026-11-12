import { hasPermission, requireAuth } from "../lib/authz"
import { getSiteSetting } from "../lib/site-settings"
import {
  deleteFileFromAiSearch,
  getAiSearchAnswer,
  getFileSearchInstance,
  indexFileForAiSearch,
  refreshFileAiSearchStatus,
  type AiSearchChunk,
} from "../lib/ai-search"

type Env = {
  DB: D1Database
  FILES_BUCKET: R2Bucket
  AI: Ai
  AI_SEARCH?: import("../lib/ai-search").AiSearchNamespace
}


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
  ai_search_item_id: string | null
  access_scope: 'all' | 'selected'
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
        archived_at,
        ai_search_item_id,
        access_scope
      FROM files
      WHERE object_key = ?
      LIMIT 1
    `)
    .bind(objectKey)
    .first()
}

async function canViewFileAccess(
  env: Env,
  userId: string,
  file: { id: string; uploaded_by: string; access_scope: 'all' | 'selected' },
): Promise<boolean> {
  if (file.access_scope !== 'selected' || file.uploaded_by === userId) return true
  const access = await env.DB.prepare(
    "SELECT 1 FROM file_user_access WHERE file_id = ? AND user_id = ? LIMIT 1",
  ).bind(file.id, userId).first()
  return Boolean(access)
}

async function canViewLinkedFile(
  env: Env,
  userId: string,
  fileId: string,
): Promise<boolean> {
  const links = await env.DB
    .prepare(`
      SELECT
        EXISTS (
          SELECT 1 FROM receipt_files
          WHERE file_id = ?
        ) AS has_receipt,
        EXISTS (
          SELECT 1 FROM task_files
          WHERE file_id = ?
        ) AS has_task,
        EXISTS (
          SELECT 1 FROM decision_files
          WHERE file_id = ?
        ) AS has_decision,
        EXISTS (
          SELECT 1 FROM submission_record_files
          WHERE file_id = ?
        ) AS has_submission
    `)
    .bind(fileId, fileId, fileId, fileId)
    .first<{
      has_receipt: number
      has_task: number
      has_decision: number
      has_submission: number
    }>()

  if (!links) {
    return false
  }

  if (
    links.has_receipt &&
    !(await hasPermission(env, userId, "accounting.view"))
  ) {
    return false
  }

  if (
    links.has_task &&
    !(await hasPermission(env, userId, "tasks.view"))
  ) {
    return false
  }

  if (
    links.has_decision &&
    !(await hasPermission(env, userId, "decisions.view"))
  ) {
    return false
  }

  // 提出物の添付ファイルは専用ダウンロードAPIからのみ取得させる。
  // submissions.view を持つユーザーでも汎用ファイルAPIでは取得できない。
  if (links.has_submission) {
    return false
  }

  return true
}

export async function handleFiles(
  request: Request,
  env: Env,
  pathParts: string[],
  ctx?: ExecutionContext,
): Promise<Response> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  const operationSettings = await getSiteSetting<{ upload_max_file_size_mb?: number }>(
    env,
    "operation_settings",
    { upload_max_file_size_mb: 25 },
  )
  const maxFileSize = Math.max(1, Math.min(100, Number(operationSettings.upload_max_file_size_mb) || 25)) * 1024 * 1024

  try {
    const url = new URL(request.url)


    if (pathParts[0] === "visibility-users" && request.method === "GET" && pathParts.length === 1) {
      if (!(await hasPermission(env, auth.user.id, "files.upload"))) {
        return json({ error: "Forbidden", permission: "files.upload" }, 403)
      }
      const result = await env.DB.prepare("SELECT id, name, nickname, student_number FROM users ORDER BY student_number, name")
        .all<{ id: string; name: string; nickname: string | null; student_number: string }>()
      return json({ users: result.results ?? [] })
    }

    if (pathParts[0] === "ai-search" && request.method === "POST") {
      if (!(await hasPermission(env, auth.user.id, "files.view"))) return json({ error: "Forbidden", permission: "files.view" }, 403)
      if (pathParts[1] === "sync-status") {
        if (!(await hasPermission(env, auth.user.id, "files.ai_search.manage"))) return json({ error: "Forbidden", permission: "files.ai_search.manage" }, 403)
        if (!env.AI_SEARCH) {
          return json({
            error: "AI Search is not configured for this Worker environment.",
            code: "AI_SEARCH_NOT_CONFIGURED",
          }, 503)
        }

        const processing = await env.DB.prepare(`
          SELECT id, object_key, original_name, ai_search_item_id
          FROM files
          WHERE archived_at IS NULL
            AND (
              ai_status = 'processing'
              OR (ai_status = 'failed' AND ai_error LIKE '%uploadAndPoll timed out%')
            )
          ORDER BY created_at ASC
          LIMIT 10
        `).all<{
          id: string
          object_key: string
          original_name: string
          ai_search_item_id: string | null
        }>()

        const results = await Promise.all((processing.results ?? []).map(async file => {
          try {
            return await refreshFileAiSearchStatus(env, file, ctx)
          } catch (error) {
            console.error("AI Search item status refresh failed:", file.id, error)
            return "check_failed"
          }
        }))

        return json({
          checked: results.length,
          completed: results.filter(status => status === "completed").length,
          failed: results.filter(status => ["error", "skipped", "outdated"].includes(status)).length,
          processing: results.filter(status => ["queued", "running"].includes(status)).length,
          notFound: results.filter(status => status === "not_found").length,
        })
      }

      if (pathParts[1] === "retry-failed") {
        if (!(await hasPermission(env, auth.user.id, "files.ai_search.manage"))) return json({ error: "Forbidden", permission: "files.ai_search.manage" }, 403)
        if (!env.AI_SEARCH) {
          return json({
            error: "AI Search is not configured for this Worker environment.",
            code: "AI_SEARCH_NOT_CONFIGURED",
          }, 503)
        }

        try {
          await getFileSearchInstance(env)
        } catch (error) {
          console.error("AI Search availability check failed:", error)
          return json({
            error: "AI Searchに接続できません。WorkerのAI Search設定を確認してください。",
            code: "AI_SEARCH_UNAVAILABLE",
          }, 503)
        }

        const failed = await env.DB.prepare(`
          SELECT id, object_key, original_name, content_type, size, category, uploaded_by, ai_search_item_id
          FROM files
          WHERE archived_at IS NULL AND ai_status = 'failed'
          ORDER BY created_at DESC
          LIMIT 10
        `).all<{
          id: string
          object_key: string
          original_name: string
          content_type: string
          size: number
          category: string
          uploaded_by: string
          ai_search_item_id: string | null
        }>()

        const filesToRetry = failed.results ?? []
        const claimedFiles = []
        for (const file of filesToRetry) {
          const claimed = await env.DB.prepare(`
            UPDATE files
            SET ai_status = 'processing', ai_error = NULL
            WHERE id = ? AND ai_status = 'failed' AND archived_at IS NULL
          `).bind(file.id).run()
          if (claimed.meta.changes > 0) claimedFiles.push(file)
        }

        const indexing = Promise.all(claimedFiles.map(file => indexFileForAiSearch(env, file, ctx)))
        if (ctx) ctx.waitUntil(indexing)
        else await indexing

        const remainingFailed = await env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM files
          WHERE archived_at IS NULL AND ai_status = 'failed'
        `).first<{ count: number }>()

        return json({
          queued: claimedFiles.length,
          remainingFailed: Number(remainingFailed?.count ?? 0),
        }, 202)
      }

      if (pathParts[1] === "reindex") {
        if (!(await hasPermission(env, auth.user.id, "files.ai_search.manage"))) return json({ error: "Forbidden", permission: "files.ai_search.manage" }, 403)
        if (!env.AI_SEARCH) {
          return json({
            error: "AI Search is not configured for this Worker environment. Start local development with the AI Search config.",
            code: "AI_SEARCH_NOT_CONFIGURED",
          }, 503)
        }

        const pending = await env.DB.prepare(`
          SELECT id, object_key, original_name, content_type, size, category, uploaded_by, ai_search_item_id
          FROM files
          WHERE archived_at IS NULL AND ai_status = 'pending'
          ORDER BY created_at DESC
          LIMIT 10
        `).all<{
          id: string
          object_key: string
          original_name: string
          content_type: string
          size: number
          category: string
          uploaded_by: string
          ai_search_item_id: string | null
        }>()

        const filesToIndex = pending.results ?? []
        if (filesToIndex.length) {
          const placeholders = filesToIndex.map(() => "?").join(", ")
          await env.DB.prepare(
            `UPDATE files SET ai_status = 'processing' WHERE id IN (${placeholders})`,
          ).bind(...filesToIndex.map(file => file.id)).run()

          const indexing = Promise.all(filesToIndex.map(file => indexFileForAiSearch(env, file, ctx)))
          if (ctx) ctx.waitUntil(indexing)
          else await indexing
        }

        const remaining = await env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM files
          WHERE archived_at IS NULL AND ai_status = 'pending'
        `).first<{ count: number }>()

        const failed = await env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM files
          WHERE archived_at IS NULL AND ai_status = 'failed'
        `).first<{ count: number }>()

        return json({
          queued: filesToIndex.length,
          remaining: Number(remaining?.count ?? 0),
          failed: Number(failed?.count ?? 0),
        }, 202)
      }

      let body: { query?: unknown; category?: unknown }
      try {
        body = await request.json()
      } catch {
        return json({ error: "Invalid JSON" }, 400)
      }

      const queryText = typeof body.query === "string" ? body.query.trim() : ""
      const category = typeof body.category === "string" ? body.category.trim() : ""
      if (!queryText || queryText.length > 300) {
        return json({ error: "検索文は1〜300文字で入力してください。" }, 400)
      }

      const [canViewReceipts, canViewTasks, canViewDecisions] = await Promise.all([
        hasPermission(env, auth.user.id, "accounting.view"),
        hasPermission(env, auth.user.id, "tasks.view"),
        hasPermission(env, auth.user.id, "decisions.view"),
      ])

      let visibleQuery = `
        SELECT f.id, f.original_name, f.object_key, f.content_type, f.size,
               f.category, f.uploaded_by, f.created_at, f.ai_summary, f.ai_status
        FROM files f
        WHERE f.archived_at IS NULL
          AND (f.access_scope = 'all' OR f.uploaded_by = ? OR EXISTS (
            SELECT 1 FROM file_user_access fua WHERE fua.file_id = f.id AND fua.user_id = ?
          ))
          AND NOT EXISTS (
            SELECT 1 FROM submission_record_files srf WHERE srf.file_id = f.id
          )
          AND (NOT EXISTS (
            SELECT 1 FROM receipt_files rf WHERE rf.file_id = f.id
          ) OR ?)
          AND (NOT EXISTS (
            SELECT 1 FROM task_files tf WHERE tf.file_id = f.id
          ) OR ?)
          AND (NOT EXISTS (
            SELECT 1 FROM decision_files df WHERE df.file_id = f.id
          ) OR ?)
      `
      const visibleBindings: (string | number)[] = [
        auth.user.id,
        auth.user.id,
        canViewReceipts ? 1 : 0,
        canViewTasks ? 1 : 0,
        canViewDecisions ? 1 : 0,
      ]
      if (category) {
        visibleQuery += " AND f.category = ?"
        visibleBindings.push(category)
      }
      visibleQuery += " ORDER BY f.created_at DESC LIMIT 200"

      const visibleResult = await env.DB.prepare(visibleQuery)
        .bind(...visibleBindings)
        .all<{
          id: string
          original_name: string
          object_key: string
          content_type: string
          size: number
          category: string
          uploaded_by: string
          created_at: string
          ai_summary: string | null
          ai_status: string
        }>()

      const visibleFiles = visibleResult.results ?? []
      const indexedFiles = visibleFiles.filter(file => file.ai_status === "completed")
      if (!indexedFiles.length) {
        return json({
          answer: "",
          results: [],
          message: "検索対象の資料がまだ登録されていません。管理者に既存資料のAI検索登録を依頼してください。",
          indexed_count: 0,
        })
      }

      try {
        const instance = await getFileSearchInstance(env)
        const response = await instance.chatCompletions({
          messages: [
            {
              role: "system",
              content: "あなたは38R星陵祭準備サイトの資料検索アシスタントです。検索で取得した資料の内容だけを根拠に日本語で回答してください。根拠が見つからない場合は、資料内では確認できないと答えてください。回答の最後に参照した資料名を列挙してください。資料にない情報を推測しないでください。",
            },
            { role: "user", content: queryText },
          ],
          ai_search_options: {
            retrieval: {
              retrieval_type: "hybrid",
              max_num_results: 10,
              keyword_match_mode: "or",
              filters: { file_id: { "$in": indexedFiles.map(file => file.id) } },
            },
          },
        })

        const fileMap = new Map(indexedFiles.map(file => [file.id, file]))
        const grouped = new Map<string, {
          file: typeof indexedFiles[number]
          score: number
          snippets: string[]
        }>()
        for (const chunk of (response.chunks ?? []) as AiSearchChunk[]) {
          const fileId = String(chunk.item?.metadata?.file_id ?? "")
          const file = fileMap.get(fileId)
          if (!file || !chunk.text) continue
          const existing = grouped.get(fileId) ?? {
            file,
            score: Number(chunk.score ?? 0),
            snippets: [],
          }
          existing.score = Math.max(existing.score, Number(chunk.score ?? 0))
          if (existing.snippets.length < 3) existing.snippets.push(chunk.text.slice(0, 1200))
          grouped.set(fileId, existing)
        }

        return json({
          answer: getAiSearchAnswer(response),
          results: [...grouped.values()]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(result => ({
              file: result.file,
              score: result.score,
              snippets: result.snippets,
            })),
          indexed_count: indexedFiles.length,
        })
      } catch (error) {
        console.error("AI Search query failed:", error)
        return json({
          error: "AI検索を実行できませんでした。AI Searchの設定を確認してください。",
          code: "AI_SEARCH_UNAVAILABLE",
        }, 503)
      }
    }

    if (pathParts[0] === "categories") {
      const categorySlug = pathParts.length >= 2
        ? decodeURIComponent(pathParts[1])
        : ""

      if (request.method === "GET" && pathParts.length === 1) {
        const includeInactive = url.searchParams.get("include_inactive") === "true"

        if (!(await hasPermission(env, auth.user.id, "files.view"))) return json({ error: "Forbidden", permission: "files.view" }, 403)
        if (includeInactive && !(await hasPermission(env, auth.user.id, "files.categories.manage"))) return json({ error: "Forbidden", permission: "files.categories.manage" }, 403)

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

      if (!(await hasPermission(env, auth.user.id, "files.categories.manage"))) return json({ error: "Forbidden", permission: "files.categories.manage" }, 403)

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

    // Share-link management is controlled by granular permissions.
    if (
      pathParts.length >= 2 &&
      pathParts[1] === "shares" &&
      pathParts.length <= 3
    ) {
      const isShareListRequest =
        request.method === "GET" && pathParts.length === 2
      const isShareCreateRequest =
        request.method === "POST" && pathParts.length === 2
      const isShareRevokeRequest =
        request.method === "DELETE" && pathParts.length === 3

      let allowed = false

      if (isShareCreateRequest) {
        allowed = await hasPermission(env, auth.user.id, "files.share.create")
      } else if (isShareRevokeRequest) {
        allowed = await hasPermission(env, auth.user.id, "files.share.revoke")
      } else if (isShareListRequest) {
        allowed =
          (await hasPermission(env, auth.user.id, "files.share.create")) ||
          (await hasPermission(env, auth.user.id, "files.share.revoke"))
      } else {
        return json({ error: "Method Not Allowed" }, 405)
      }

      if (!allowed) {
        return json({ error: "Forbidden" }, 403)
      }

      const fileId = decodeURIComponent(pathParts[0])
      const file = await env.DB.prepare(`
        SELECT id, archived_at FROM files WHERE id = ? LIMIT 1
      `).bind(fileId).first<{ id: string; archived_at: string | null }>()

      if (!file) return json({ error: "File not found" }, 404)

      if (request.method === "GET" && pathParts.length === 2) {
        const result = await env.DB.prepare(`
          SELECT id, created_at, revoked_at
          FROM file_shares
          WHERE file_id = ?
          ORDER BY created_at DESC
        `).bind(fileId).all()
        return json({ shares: result.results ?? [] })
      }

      if (request.method === "POST" && pathParts.length === 2) {
        if (file.archived_at) {
          return json({ error: "Archived files cannot be shared" }, 409)
        }

        const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
        let binary = ""
        for (const byte of tokenBytes) binary += String.fromCharCode(byte)
        const token = btoa(binary)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/g, "")

        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(token),
        )
        const tokenHash = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
        const shareId = crypto.randomUUID()

        await env.DB.prepare(`
          INSERT INTO file_shares (id, file_id, token_hash, created_by)
          VALUES (?, ?, ?, ?)
        `).bind(shareId, fileId, tokenHash, auth.user.id).run()

        return json({
          id: shareId,
          token,
          created_at: new Date().toISOString(),
        }, 201)
      }

      if (
        request.method === "DELETE" &&
        pathParts.length === 3
      ) {
        const shareId = decodeURIComponent(pathParts[2])
        const result = await env.DB.prepare(`
          UPDATE file_shares
          SET revoked_at = CURRENT_TIMESTAMP, revoked_by = ?
          WHERE id = ? AND file_id = ? AND revoked_at IS NULL
        `).bind(auth.user.id, shareId, fileId).run()

        if (!result.meta.changes) {
          return json({ error: "Active share link not found" }, 404)
        }

        return json({ success: true })
      }

      return json({ error: "Method Not Allowed" }, 405)
    }

    if (request.method === "GET" && pathParts.length === 0) {
      if (!(await hasPermission(env, auth.user.id, "files.view"))) return json({ error: "Forbidden", permission: "files.view" }, 403)
      const search = (url.searchParams.get("search") ?? "").trim()
      const category = (url.searchParams.get("category") ?? "").trim()
      const archived = url.searchParams.get("archived") === "true"
      if (archived && !(await hasPermission(env, auth.user.id, "files.archive")) && !(await hasPermission(env, auth.user.id, "files.restore"))) {
        return json({ error: "Forbidden", permission: "files.restore" }, 403)
      }
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
          f.folder_id,
          f.uploaded_by,
          f.created_at,
          f.archived_at,
          f.ai_status,
          f.ai_summary,
          f.ai_error,
          f.access_scope
        FROM files f
        WHERE ${archived ? "f.archived_at IS NOT NULL" : "f.archived_at IS NULL"}
          AND (f.access_scope = 'all' OR f.uploaded_by = ? OR EXISTS (
            SELECT 1 FROM file_user_access fua WHERE fua.file_id = f.id AND fua.user_id = ?
          ))
      `
      const bindings: (string | number)[] = [auth.user.id, auth.user.id]
      const requestedFolderId = url.searchParams.get("folder_id")
      if (!archived && requestedFolderId !== null) {
        if (requestedFolderId === "root") {
          query += " AND f.folder_id IS NULL"
        } else {
          query += " AND f.folder_id = ?"
          bindings.push(requestedFolderId)
        }
      }

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

      const [canViewReceipts, canViewTasks, canViewDecisions] =
        await Promise.all([
          hasPermission(env, auth.user.id, "accounting.view"),
          hasPermission(env, auth.user.id, "tasks.view"),
          hasPermission(env, auth.user.id, "decisions.view"),
        ])

      query += `
        AND NOT EXISTS (
          SELECT 1
          FROM submission_record_files srf
          WHERE srf.file_id = f.id
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM receipt_files rf
            WHERE rf.file_id = f.id
          )
          OR ?
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM task_files tf
            WHERE tf.file_id = f.id
          )
          OR ?
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM decision_files df
            WHERE df.file_id = f.id
          )
          OR ?
        )
      `
      bindings.push(
        canViewReceipts ? 1 : 0,
        canViewTasks ? 1 : 0,
        canViewDecisions ? 1 : 0,
      )

      query += " ORDER BY f.created_at DESC LIMIT ?"
      bindings.push(limit)

      const result = await env.DB
        .prepare(query)
        .bind(...bindings)
        .all<{
          id: string
          object_key: string
          original_name: string
          content_type: string
          size: number
          category: string
          folder_id: string | null
          uploaded_by: string
          created_at: string
          archived_at: string | null
          ai_status: string
          ai_summary: string | null
          ai_error: string | null
          access_scope: 'all' | 'selected'
        }>()

      const visibleFiles = result.results ?? []

      return json({
        files: visibleFiles,
        count: visibleFiles.length,
      })
    }

    if (request.method === "PATCH" && pathParts.length === 2 && pathParts[1] === "move") {
      const fileId = decodeURIComponent(pathParts[0])
      const file = await env.DB.prepare(
        "SELECT id, uploaded_by, archived_at FROM files WHERE id = ? LIMIT 1",
      ).bind(fileId).first<{ id: string; uploaded_by: string; archived_at: string | null }>()
      if (!file) return json({ error: "File not found" }, 404)
      const canMove = await hasPermission(env, auth.user.id, "files.move")
      if (!canMove && file.uploaded_by !== auth.user.id) return json({ error: "Forbidden", permission: "files.move" }, 403)
      if (file.archived_at) return json({ error: "Archived files cannot be moved" }, 409)
      let body: { folder_id?: unknown }
      try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
      const folderId = body.folder_id === null || body.folder_id === "" || body.folder_id === undefined
        ? null
        : typeof body.folder_id === "string" ? body.folder_id.trim() : false
      if (folderId === false) return json({ error: "Invalid folder_id" }, 400)
      if (folderId) {
        const folder = await env.DB.prepare("SELECT id FROM file_folders WHERE id = ? LIMIT 1").bind(folderId).first()
        if (!folder) return json({ error: "Folder not found" }, 404)
      }
      await env.DB.prepare("UPDATE files SET folder_id = ? WHERE id = ?").bind(folderId, fileId).run()
      return json({ success: true, id: fileId, folder_id: folderId })
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

      const permission = action === "archive" ? "files.archive" : "files.restore"
      if (!(await hasPermission(env, auth.user.id, permission))) return json({ error: "Forbidden", permission }, 403)

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
      if (!(await hasPermission(env, auth.user.id, "files.upload"))) return json({ error: "Forbidden", permission: "files.upload" }, 403)
      const contentLength = Number(
        request.headers.get("Content-Length") ?? 0,
      )

      if (
        Number.isFinite(contentLength) &&
        contentLength > maxFileSize + 1024 * 1024
      ) {
        return json(
          {
            error: "File is too large",
            max_size: maxFileSize,
          },
          413,
        )
      }

      const formData = await request.formData()
      const file = formData.get("file")
      const notifyUpload = formData.get("notify") === "true"
      const rawFolderId = formData.get("folder_id")
      if (rawFolderId !== null && typeof rawFolderId !== "string") return json({ error: "Invalid folder_id" }, 400)
      const folderId = typeof rawFolderId === "string" ? rawFolderId.trim() || null : null
      const rawAccessScope = formData.get("access_scope")
      const accessScope = rawAccessScope === null ? "all" : rawAccessScope
      if (accessScope !== "all" && accessScope !== "selected") return json({ error: "Invalid access_scope" }, 400)
      const rawVisibleUserIds = formData.getAll("visible_user_ids")
      if (!rawVisibleUserIds.every(value => typeof value === "string" && value.trim())) {
        return json({ error: "Invalid visible_user_ids" }, 400)
      }
      const visibleUserIds = [...new Set(rawVisibleUserIds.map(value => String(value).trim()))]
      if (visibleUserIds.length > 500 || (accessScope === "selected" && visibleUserIds.length === 0) || (accessScope === "all" && visibleUserIds.length > 0)) {
        return json({ error: "Invalid visibility selection" }, 400)
      }
      if (visibleUserIds.length) {
        const placeholders = visibleUserIds.map(() => "?").join(", ")
        const users = await env.DB.prepare("SELECT id FROM users WHERE id IN (" + placeholders + ")")
          .bind(...visibleUserIds).all<{ id: string }>()
        if (users.results.length !== visibleUserIds.length) return json({ error: "One or more users were not found" }, 400)
      }

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

      if (file.size > maxFileSize) {
        return json(
          {
            error: "File is too large",
            max_size: maxFileSize,
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

      if (folderId) {
        const folder = await env.DB.prepare("SELECT id FROM file_folders WHERE id = ? LIMIT 1").bind(folderId).first()
        if (!folder) return json({ error: "Folder not found" }, 404)
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
        await env.DB.batch([
          env.DB.prepare("INSERT INTO files (id, object_key, original_name, content_type, size, category, folder_id, uploaded_by, notify_on_upload, access_scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(id, objectKey, originalName, contentType, file.size, category, folderId, auth.user.id, notifyUpload ? 1 : 0, accessScope),
          ...visibleUserIds.map(userId => env.DB.prepare(
            "INSERT INTO file_user_access (file_id, user_id) VALUES (?, ?)",
          ).bind(id, userId)),
        ])
      } catch (error) {
        await env.FILES_BUCKET.delete(objectKey)
        throw error
      }

      await env.DB.prepare("UPDATE files SET ai_status = 'processing' WHERE id = ?").bind(id).run()
      if (ctx) {
        ctx.waitUntil(indexFileForAiSearch(env, {
          id,
          object_key: objectKey,
          original_name: originalName,
          content_type: contentType,
          size: file.size,
          category,
          uploaded_by: auth.user.id,
        }, ctx))
      }

      return json(
        {
          id,
          object_key: objectKey,
          original_name: originalName,
          content_type: contentType,
          size: file.size,
          category,
          folder_id: folderId,
          uploaded_by: auth.user.id,
          access_scope: accessScope,
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
        if (!(await hasPermission(env, auth.user.id, "files.view"))) return json({ error: "Forbidden", permission: "files.view" }, 403)
        if (url.searchParams.get("download") === "true" && !(await hasPermission(env, auth.user.id, "files.download"))) return json({ error: "Forbidden", permission: "files.download" }, 403)
        if (file.archived_at) {
          return json({ error: "File not found" }, 404)
        }

        const [canViewLinked, canViewScope] = await Promise.all([
          canViewLinkedFile(env, auth.user.id, file.id),
          canViewFileAccess(env, auth.user.id, file),
        ])

        if (!canViewLinked || !canViewScope) {
          return json({ error: "Forbidden" }, 403)
        }

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
          "private, no-store",
        )

        return new Response(object.body, {
          status: 200,
          headers,
        })
      }

      if (!(await hasPermission(env, auth.user.id, "files.delete"))) return json({ error: "Forbidden", permission: "files.delete" }, 403)

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

      const taskLink = await env.DB
        .prepare(`
          SELECT 1
          FROM task_files
          WHERE file_id = ?
          LIMIT 1
        `)
        .bind(file.id)
        .first()

      if (taskLink) {
        return json(
          {
            error: "This file is attached to a task",
            code: "FILE_HAS_TASK_LINK",
          },
          409,
        )
      }

      const decisionLink = await env.DB
        .prepare(`
          SELECT 1
          FROM decision_files
          WHERE file_id = ?
          LIMIT 1
        `)
        .bind(file.id)
        .first()

      if (decisionLink) {
        return json(
          {
            error: "This file is attached to a decision",
            code: "FILE_HAS_DECISION_LINK",
          },
          409,
        )
      }

      const submissionLink = await env.DB
        .prepare(`
          SELECT 1
          FROM submission_record_files
          WHERE file_id = ?
          LIMIT 1
        `)
        .bind(file.id)
        .first()

      if (submissionLink) {
        return json(
          {
            error: "This file is attached to a submission",
            code: "FILE_HAS_SUBMISSION_LINK",
          },
          409,
        )
      }

      try {
        await deleteFileFromAiSearch(env, file.ai_search_item_id)
      } catch (error) {
        console.error("AI Search item cleanup failed:", file.id, error)
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
