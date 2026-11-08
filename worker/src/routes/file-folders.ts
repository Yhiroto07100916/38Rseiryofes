import { hasPermission, requireAuth } from "../lib/authz"

type Env = {
  DB: D1Database
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

async function canManageFolders(env: Env, userId: string): Promise<boolean> {
  const result = await env.DB.prepare(`
    SELECT 1
    FROM user_account_roles uar
    INNER JOIN account_roles ar ON ar.id = uar.account_role_id
    WHERE uar.user_id = ?
      AND ar.name IN ('admin', 'class_representative')
    LIMIT 1
  `).bind(userId).first()
  return Boolean(result)
}

async function validCategory(env: Env, category: unknown): Promise<string | null | false> {
  if (category === null || category === undefined || category === "") return null
  if (typeof category !== "string") return false
  const slug = category.trim()
  const row = await env.DB.prepare(`
    SELECT slug FROM file_categories
    WHERE slug = ? AND is_active = 1
    LIMIT 1
  `).bind(slug).first<{ slug: string }>()
  return row?.slug ?? false
}

async function validParent(env: Env, parentId: unknown): Promise<string | null | false> {
  if (parentId === null || parentId === undefined || parentId === "") return null
  if (typeof parentId !== "string") return false
  const row = await env.DB.prepare(
    "SELECT id FROM file_folders WHERE id = ? LIMIT 1",
  ).bind(parentId).first<{ id: string }>()
  return row?.id ?? false
}

export async function handleFileFolders(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)

  if (request.method === "GET" && pathParts.length === 0 && url.searchParams.get("all") === "true") {
    const result = await env.DB.prepare(`
      WITH RECURSIVE folder_tree(id, name, parent_id, category, category_name, depth, path) AS (
        SELECT
          folder.id, folder.name, folder.parent_id, folder.category,
          category.name, 0, folder.name
        FROM file_folders folder
        LEFT JOIN file_categories category ON category.slug = folder.category
        WHERE folder.parent_id IS NULL
        UNION ALL
        SELECT
          child.id, child.name, child.parent_id, child.category,
          category.name, parent.depth + 1, parent.path || ' / ' || child.name
        FROM file_folders child
        INNER JOIN folder_tree parent ON child.parent_id = parent.id
        LEFT JOIN file_categories category ON category.slug = child.category
      )
      SELECT id, name, parent_id, category, category_name, depth, path
      FROM folder_tree
      ORDER BY path COLLATE NOCASE
    `).all()
    return json({ folders: result.results ?? [] })
  }

  if (request.method === "GET" && pathParts.length === 0) {
    const rawParentId = url.searchParams.get("parent_id")
    const parentId = rawParentId || null

    if (parentId) {
      const parent = await env.DB.prepare(`
        SELECT id, name, parent_id, category, description
        FROM file_folders WHERE id = ? LIMIT 1
      `).bind(parentId).first()
      if (!parent) return json({ error: "Parent folder not found" }, 404)
    }

    const [canViewReceipts, canViewTasks, canViewDecisions] = await Promise.all([
      hasPermission(env, auth.user.id, "accounting.view"),
      hasPermission(env, auth.user.id, "tasks.view"),
      hasPermission(env, auth.user.id, "decisions.view"),
    ])

    const result = await env.DB.prepare(`
      SELECT
        folder.id,
        folder.name,
        folder.parent_id,
        folder.category,
        category.name AS category_name,
        folder.description,
        folder.created_by,
        folder.created_at,
        folder.updated_at,
        (SELECT COUNT(*) FROM file_folders child WHERE child.parent_id = folder.id) AS folder_count,
        (
          SELECT COUNT(*) FROM files file
          WHERE file.folder_id = folder.id
            AND file.archived_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM submission_record_files srf WHERE srf.file_id = file.id)
            AND (NOT EXISTS (SELECT 1 FROM receipt_files rf WHERE rf.file_id = file.id) OR ?)
            AND (NOT EXISTS (SELECT 1 FROM task_files tf WHERE tf.file_id = file.id) OR ?)
            AND (NOT EXISTS (SELECT 1 FROM decision_files df WHERE df.file_id = file.id) OR ?)
        ) AS file_count
      FROM file_folders folder
      LEFT JOIN file_categories category ON category.slug = folder.category
      WHERE folder.parent_id IS ?
      ORDER BY folder.name COLLATE NOCASE
    `).bind(
      canViewReceipts ? 1 : 0,
      canViewTasks ? 1 : 0,
      canViewDecisions ? 1 : 0,
      parentId,
    ).all()

    return json({ folders: result.results ?? [], parent_id: parentId })
  }

  if (request.method === "POST" && pathParts.length === 0) {
    let body: { name?: unknown; parent_id?: unknown; category?: unknown; description?: unknown }
    try {
      body = await request.json()
    } catch {
      return json({ error: "Invalid JSON" }, 400)
    }

    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name || name.length > 100) {
      return json({ error: "Folder name must be 1-100 characters" }, 400)
    }

    const parentId = await validParent(env, body.parent_id)
    if (parentId === false) return json({ error: "Parent folder not found" }, 404)

    const category = await validCategory(env, body.category)
    if (category === false) return json({ error: "Invalid folder category" }, 400)

    if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
      return json({ error: "Invalid description" }, 400)
    }

    const id = crypto.randomUUID()
    await env.DB.prepare(`
      INSERT INTO file_folders (id, name, parent_id, category, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      name,
      parentId,
      category,
      typeof body.description === "string" ? body.description.trim() || null : null,
      auth.user.id,
    ).run()

    return json({ success: true, id }, 201)
  }

  const folderId = pathParts.length === 1 ? decodeURIComponent(pathParts[0]) : ""
  if (!folderId) return json({ error: "Not Found" }, 404)

  const folder = await env.DB.prepare(`
    SELECT id, name, parent_id, category, description, created_by
    FROM file_folders WHERE id = ? LIMIT 1
  `).bind(folderId).first<{
    id: string
    name: string
    parent_id: string | null
    category: string | null
    description: string | null
    created_by: string
  }>()
  if (!folder) return json({ error: "Folder not found" }, 404)

  if (request.method === "PATCH") {
    const manager = await canManageFolders(env, auth.user.id)
    if (!manager && folder.created_by !== auth.user.id) {
      return json({ error: "Forbidden" }, 403)
    }

    let body: { name?: unknown; parent_id?: unknown; category?: unknown; description?: unknown }
    try {
      body = await request.json()
    } catch {
      return json({ error: "Invalid JSON" }, 400)
    }

    const name = body.name === undefined ? folder.name : body.name
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      return json({ error: "Folder name must be 1-100 characters" }, 400)
    }

    const parentId = body.parent_id === undefined
      ? folder.parent_id
      : await validParent(env, body.parent_id)
    if (parentId === false) return json({ error: "Parent folder not found" }, 404)
    if (parentId === folderId) return json({ error: "A folder cannot be its own parent" }, 400)

    if (parentId) {
      const descendants = await env.DB.prepare(`
        WITH RECURSIVE descendants(id) AS (
          SELECT id FROM file_folders WHERE parent_id = ?
          UNION ALL
          SELECT child.id FROM file_folders child
          INNER JOIN descendants ON child.parent_id = descendants.id
        )
        SELECT id FROM descendants WHERE id = ? LIMIT 1
      `).bind(folderId, parentId).first()
      if (descendants) return json({ error: "Cannot move a folder into its descendant" }, 409)
    }

    const category = body.category === undefined
      ? folder.category
      : await validCategory(env, body.category)
    if (category === false) return json({ error: "Invalid folder category" }, 400)

    const description = body.description === undefined
      ? folder.description
      : (typeof body.description === "string" ? body.description.trim() || null : null)
    if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
      return json({ error: "Invalid description" }, 400)
    }

    await env.DB.prepare(`
      UPDATE file_folders
      SET name = ?, parent_id = ?, category = ?, description = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name.trim(), parentId, category, description, folderId).run()

    return json({ success: true, id: folderId })
  }

  if (request.method === "DELETE") {
    const manager = await canManageFolders(env, auth.user.id)
    if (!manager && folder.created_by !== auth.user.id) {
      return json({ error: "Forbidden" }, 403)
    }

    const [children, files] = await Promise.all([
      env.DB.prepare("SELECT 1 FROM file_folders WHERE parent_id = ? LIMIT 1").bind(folderId).first(),
      env.DB.prepare("SELECT 1 FROM files WHERE folder_id = ? LIMIT 1").bind(folderId).first(),
    ])
    if (children || files) {
      return json({ error: "Folder is not empty", code: "FOLDER_NOT_EMPTY" }, 409)
    }

    await env.DB.prepare("DELETE FROM file_folders WHERE id = ?").bind(folderId).run()
    return json({ success: true, id: folderId })
  }

  return json({ error: "Method Not Allowed" }, 405)
}
