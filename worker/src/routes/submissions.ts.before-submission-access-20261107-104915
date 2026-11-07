import { hasPermission, requireAuth } from "../lib/authz"

type Env = {
  DB: D1Database
  FILES_BUCKET: R2Bucket
  AI: Ai
}

type SubmissionStatus =
  | "preparing"
  | "ready_to_submit"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "resubmitted"
  | "completed"
  | "cancelled"

type SubmissionRow = {
  id: string
  title: string
  description: string | null
  destination: string
  due_at: string | null
  assigned_role_id: string | null
  status: SubmissionStatus
  created_by: string
  created_at: string
  updated_at: string
  version: number
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status })


async function permitted(
  request: Request,
  env: Env,
  permission: string,
) {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  if (!(await hasPermission(env, auth.user.id, permission))) {
    return json(
      {
        error: "Forbidden",
        permission,
      },
      403,
    )
  }

  return auth
}

async function getSubmission(
  env: Env,
  id: string,
): Promise<SubmissionRow | null> {
  return env.DB
    .prepare(`
      SELECT
        id,
        title,
        description,
        destination,
        due_at,
        assigned_role_id,
        status,
        created_by,
        created_at,
        updated_at,
        version
      FROM submissions
      WHERE id = ?
      LIMIT 1
    `)
    .bind(id)
    .first<SubmissionRow>()
}

function addHistory(
  env: Env,
  submissionId: string,
  actorId: string,
  action: string,
  fromStatus: SubmissionStatus | null,
  toStatus: SubmissionStatus | null,
  details: unknown = null,
) {
  return env.DB
    .prepare(`
      INSERT INTO submission_history (
        id,
        submission_id,
        actor_id,
        action,
        from_status,
        to_status,
        details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      submissionId,
      actorId,
      action,
      fromStatus,
      toStatus,
      details === null ? null : JSON.stringify(details),
    )
}

async function validateFiles(
  env: Env,
  fileIds: string[],
): Promise<string | null> {
  if (fileIds.length > 20) {
    return "一度に紐付けられるファイルは20件までです"
  }

  if (new Set(fileIds).size !== fileIds.length) {
    return "同じファイルが重複しています"
  }

  if (fileIds.length === 0) {
    return null
  }

  const placeholders = fileIds.map(() => "?").join(", ")

  const result = await env.DB
    .prepare(`
      SELECT id
      FROM files
      WHERE id IN (${placeholders})
        AND archived_at IS NULL
    `)
    .bind(...fileIds)
    .all<{ id: string }>()

  if (result.results.length !== fileIds.length) {
    return "存在しないファイル、またはアーカイブ済みのファイルが含まれています"
  }

  return null
}

function readFileIds(value: unknown): string[] | null {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return null
  }

  if (
    !value.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    )
  ) {
    return null
  }

  return value.map((item: string) => item.trim())
}

export async function handleSubmissions(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const method = request.method
  const id = pathParts[0]
  const sub = pathParts[1]

  if (method === "GET" && !id) {
    const auth = await permitted(request, env, "submissions.view")

    if (auth instanceof Response) {
      return auth
    }

    const rows = await env.DB
      .prepare(`
        SELECT
          s.*,
          creator.name AS creator_name,
          assigned_role.name AS assigned_role_name,
          (
            SELECT COUNT(*)
            FROM submission_records sr
            WHERE sr.submission_id = s.id
          ) AS record_count,
          (
            SELECT MAX(sr.submitted_at)
            FROM submission_records sr
            WHERE sr.submission_id = s.id
          ) AS latest_submitted_at
        FROM submissions s
        LEFT JOIN users creator
          ON creator.id = s.created_by
        LEFT JOIN roles assigned_role
          ON assigned_role.id = s.assigned_role_id
        ORDER BY
          CASE WHEN s.due_at IS NULL THEN 1 ELSE 0 END,
          s.due_at ASC,
          s.updated_at DESC
      `)
      .all()

    return json({ submissions: rows.results })
  }

  if (method === "POST" && !id) {
    const auth = await permitted(request, env, "submissions.create")

    if (auth instanceof Response) {
      return auth
    }

    const body = await request.json().catch(() => null) as
      | Record<string, unknown>
      | null

    if (
      !body ||
      typeof body.title !== "string" ||
      !body.title.trim() ||
      typeof body.destination !== "string" ||
      !body.destination.trim()
    ) {
      return json(
        { error: "提出物名と提出先は必須です" },
        400,
      )
    }

    const title = body.title.trim()
    const description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null
    const destination = body.destination.trim()
    const dueAt =
      typeof body.due_at === "string" && body.due_at.trim()
        ? body.due_at.trim()
        : null
    const assignedRoleId =
      typeof body.assigned_role_id === "string" &&
      body.assigned_role_id.trim()
        ? body.assigned_role_id.trim()
        : null

    if (title.length > 200 || destination.length > 200) {
      return json(
        { error: "提出物名と提出先は200文字以内にしてください" },
        400,
      )
    }

    if (description && description.length > 5000) {
      return json(
        { error: "説明は5000文字以内にしてください" },
        400,
      )
    }

    const submissionId = crypto.randomUUID()

    await env.DB.batch([
      env.DB
        .prepare(`
          INSERT INTO submissions (
            id,
            title,
            description,
            destination,
            due_at,
            assigned_role_id,
            status,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, 'preparing', ?)
        `)
        .bind(
          submissionId,
          title,
          description,
          destination,
          dueAt,
          assignedRoleId,
          auth.user.id,
        ),
      addHistory(
        env,
        submissionId,
        auth.user.id,
        "created",
        null,
        "preparing",
        {
          title,
          destination,
        },
      ),
    ])

    return json(
      {
        id: submissionId,
        status: "preparing",
      },
      201,
    )
  }

  if (!id) {
    return json({ error: "Not Found" }, 404)
  }

  if (method === "GET" && !sub) {
    const auth = await permitted(request, env, "submissions.view")

    if (auth instanceof Response) {
      return auth
    }

    const current = await getSubmission(env, id)

    if (!current) {
      return json({ error: "Not Found" }, 404)
    }

    const [submission, records, history] = await Promise.all([
      env.DB
        .prepare(`
          SELECT
            s.*,
            creator.name AS creator_name,
            assigned_role.name AS assigned_role_name
          FROM submissions s
          LEFT JOIN users creator
            ON creator.id = s.created_by
          LEFT JOIN roles assigned_role
            ON assigned_role.id = s.assigned_role_id
          WHERE s.id = ?
        `)
        .bind(id)
        .first(),

      env.DB
        .prepare(`
          SELECT
            sr.*,
            u.name AS submitted_by_name,
            (
              SELECT json_group_array(
                json_object(
                  'id', f.id,
                  'original_name', f.original_name,
                  'content_type', f.content_type,
                  'size', f.size
                )
              )
              FROM submission_record_files srf
              JOIN files f
                ON f.id = srf.file_id
              WHERE srf.record_id = sr.id
            ) AS files
          FROM submission_records sr
          LEFT JOIN users u
            ON u.id = sr.submitted_by
          WHERE sr.submission_id = ?
          ORDER BY sr.attempt_number DESC
        `)
        .bind(id)
        .all(),

      env.DB
        .prepare(`
          SELECT
            h.*,
            u.name AS actor_name
          FROM submission_history h
          LEFT JOIN users u
            ON u.id = h.actor_id
          WHERE h.submission_id = ?
          ORDER BY h.created_at DESC
        `)
        .bind(id)
        .all(),
    ])

    return json({
      submission,
      records: records.results,
      history: history.results,
    })
  }

  if (method === "PATCH" && !sub) {
    const auth = await permitted(request, env, "submissions.edit")

    if (auth instanceof Response) {
      return auth
    }

    const current = await getSubmission(env, id)

    if (!current) {
      return json({ error: "Not Found" }, 404)
    }

    const body = await request.json().catch(() => null) as
      | Record<string, unknown>
      | null

    if (!body) {
      return json({ error: "Invalid body" }, 400)
    }

    if (
      current.status === "completed" ||
      current.status === "cancelled"
    ) {
      return json(
        { error: "完了または取消済みの提出物は編集できません" },
        409,
      )
    }

    const updates: Record<string, string | null> = {}

    if (body.title !== undefined) {
      if (
        typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.trim().length > 200
      ) {
        return json({ error: "提出物名が不正です" }, 400)
      }
      updates.title = body.title.trim()
    }

    if (body.description !== undefined) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        return json({ error: "説明が不正です" }, 400)
      }

      const description =
        typeof body.description === "string"
          ? body.description.trim()
          : null

      if (description && description.length > 5000) {
        return json({ error: "説明は5000文字以内です" }, 400)
      }

      updates.description = description || null
    }

    if (body.destination !== undefined) {
      if (
        typeof body.destination !== "string" ||
        !body.destination.trim() ||
        body.destination.trim().length > 200
      ) {
        return json({ error: "提出先が不正です" }, 400)
      }
      updates.destination = body.destination.trim()
    }

    if (body.due_at !== undefined) {
      if (
        body.due_at !== null &&
        typeof body.due_at !== "string"
      ) {
        return json({ error: "提出期限が不正です" }, 400)
      }
      updates.due_at =
        typeof body.due_at === "string" && body.due_at.trim()
          ? body.due_at.trim()
          : null
    }

    if (body.assigned_role_id !== undefined) {
      if (
        body.assigned_role_id !== null &&
        typeof body.assigned_role_id !== "string"
      ) {
        return json({ error: "担当係が不正です" }, 400)
      }
      updates.assigned_role_id =
        typeof body.assigned_role_id === "string" &&
        body.assigned_role_id.trim()
          ? body.assigned_role_id.trim()
          : null
    }

    const columns = Object.keys(updates)

    if (columns.length === 0) {
      return json({ error: "変更内容がありません" }, 400)
    }

    const assignments = columns
      .map((column) => `${column} = ?`)
      .join(", ")

    const results = await env.DB.batch([
      env.DB
        .prepare(`
          UPDATE submissions
          SET ${assignments},
              version = version + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND version = ?
            AND status = ?
        `)
        .bind(
          ...columns.map((column) => updates[column]),
          id,
          current.version,
          current.status,
        ),

      env.DB
        .prepare(`
          INSERT INTO submission_history (
            id,
            submission_id,
            actor_id,
            action,
            from_status,
            to_status,
            details
          )
          SELECT ?, ?, ?, 'edited', ?, ?, ?
          WHERE EXISTS (
            SELECT 1
            FROM submissions
            WHERE id = ?
              AND version = ?
              AND status = ?
          )
        `)
        .bind(
          crypto.randomUUID(),
          id,
          auth.user.id,
          current.status,
          current.status,
          JSON.stringify(updates),
          id,
          current.version + 1,
          current.status,
        ),
    ])

    if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
      return json(
        { error: "別のユーザーによって更新されています。再読み込みしてください" },
        409,
      )
    }

    return json({ ok: true, version: current.version + 1 })
  }

  if (method === "POST" && sub === "records") {
    const auth = await permitted(request, env, "submissions.submit")

    if (auth instanceof Response) {
      return auth
    }

    const current = await getSubmission(env, id)

    if (!current) {
      return json({ error: "Not Found" }, 404)
    }

    if (
      current.status !== "ready_to_submit" &&
      current.status !== "changes_requested"
    ) {
      return json(
        { error: "提出または再提出できる状態ではありません" },
        409,
      )
    }

    const body = await request.json().catch(() => null) as
      | Record<string, unknown>
      | null

    if (!body) {
      return json({ error: "Invalid body" }, 400)
    }

    const note =
      typeof body.note === "string"
        ? body.note.trim() || null
        : null

    if (note && note.length > 3000) {
      return json({ error: "備考は3000文字以内です" }, 400)
    }

    const fileIds = readFileIds(body.file_ids)

    if (fileIds === null) {
      return json({ error: "file_ids の形式が不正です" }, 400)
    }

    const fileError = await validateFiles(env, fileIds)

    if (fileError) {
      return json({ error: fileError }, 400)
    }

    const latest = await env.DB
      .prepare(`
        SELECT COALESCE(MAX(attempt_number), 0) AS attempt_number
        FROM submission_records
        WHERE submission_id = ?
      `)
      .bind(id)
      .first<{ attempt_number: number }>()

    const attemptNumber = Number(latest?.attempt_number ?? 0) + 1
    const recordId = crypto.randomUUID()
    const nextStatus: SubmissionStatus =
      current.status === "changes_requested"
        ? "resubmitted"
        : "submitted"

    const results = await env.DB.batch([
      env.DB
        .prepare(`
          UPDATE submissions
          SET status = ?,
              version = version + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND version = ?
            AND status = ?
        `)
        .bind(nextStatus, id, current.version, current.status),

      env.DB
        .prepare(`
          INSERT INTO submission_records (
            id,
            submission_id,
            attempt_number,
            submitted_by,
            note
          )
          SELECT ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1
            FROM submissions
            WHERE id = ?
              AND version = ?
              AND status = ?
          )
        `)
        .bind(
          recordId,
          id,
          attemptNumber,
          auth.user.id,
          note,
          id,
          current.version + 1,
          nextStatus,
        ),

      ...fileIds.map((fileId) =>
        env.DB
          .prepare(`
            INSERT INTO submission_record_files (
              record_id,
              file_id
            )
            SELECT ?, ?
            WHERE EXISTS (
              SELECT 1
              FROM submission_records
              WHERE id = ?
                AND submission_id = ?
            )
          `)
          .bind(recordId, fileId, recordId, id),
      ),

      env.DB
        .prepare(`
          INSERT INTO submission_history (
            id,
            submission_id,
            actor_id,
            action,
            from_status,
            to_status,
            details
          )
          SELECT ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1
            FROM submission_records
            WHERE id = ?
              AND submission_id = ?
          )
        `)
        .bind(
          crypto.randomUUID(),
          id,
          auth.user.id,
          nextStatus === "resubmitted" ? "resubmitted" : "submitted",
          current.status,
          nextStatus,
          JSON.stringify({
            record_id: recordId,
            attempt_number: attemptNumber,
            file_ids: fileIds,
            note,
          }),
          recordId,
          id,
        ),
    ])

    if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
      return json(
        { error: "別のユーザーによって提出状態が変更されています。再読み込みしてください" },
        409,
      )
    }

    return json(
      {
        id: recordId,
        attempt_number: attemptNumber,
        status: nextStatus,
        version: current.version + 1,
      },
      201,
    )
  }

  if (method === "PATCH" && sub === "status") {
    const body = await request.json().catch(() => null) as
      | Record<string, unknown>
      | null

    if (!body || typeof body.action !== "string") {
      return json({ error: "action は必須です" }, 400)
    }

    const action = body.action
    const note =
      typeof body.note === "string"
        ? body.note.trim()
        : ""

    const permissionByAction: Record<string, string> = {
      ready_to_submit: "submissions.edit",
      start_review: "submissions.review",
      request_changes: "submissions.review",
      complete: "submissions.review",
      cancel: "submissions.edit",
    }

    const permission = permissionByAction[action]

    if (!permission) {
      return json({ error: "Unsupported action" }, 400)
    }

    const auth = await permitted(request, env, permission)

    if (auth instanceof Response) {
      return auth
    }

    const current = await getSubmission(env, id)

    if (!current) {
      return json({ error: "Not Found" }, 404)
    }

    let nextStatus: SubmissionStatus = current.status

    if (action === "ready_to_submit") {
      if (current.status !== "preparing") {
        return json(
          { error: "準備中の提出物のみ提出待ちにできます" },
          409,
        )
      }
      nextStatus = "ready_to_submit"
    } else if (action === "start_review") {
      if (
        current.status !== "submitted" &&
        current.status !== "resubmitted"
      ) {
        return json(
          { error: "提出済みの提出物のみ確認を開始できます" },
          409,
        )
      }
      nextStatus = "under_review"
    } else if (action === "request_changes") {
      if (current.status !== "under_review") {
        return json(
          { error: "確認中の提出物のみ修正依頼できます" },
          409,
        )
      }
      if (!note) {
        return json(
          { error: "修正依頼の理由を入力してください" },
          400,
        )
      }
      nextStatus = "changes_requested"
    } else if (action === "complete") {
      if (
        current.status !== "submitted" &&
        current.status !== "resubmitted" &&
        current.status !== "under_review"
      ) {
        return json(
          { error: "この状態の提出物は完了にできません" },
          409,
        )
      }
      nextStatus = "completed"
    } else if (action === "cancel") {
      if (
        current.status === "completed" ||
        current.status === "cancelled"
      ) {
        return json(
          { error: "この提出物は取消できません" },
          409,
        )
      }
      nextStatus = "cancelled"
    }

    const results = await env.DB.batch([
      env.DB
        .prepare(`
          UPDATE submissions
          SET status = ?,
              version = version + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND version = ?
            AND status = ?
        `)
        .bind(nextStatus, id, current.version, current.status),

      env.DB
        .prepare(`
          INSERT INTO submission_history (
            id,
            submission_id,
            actor_id,
            action,
            from_status,
            to_status,
            details
          )
          SELECT ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1
            FROM submissions
            WHERE id = ?
              AND version = ?
              AND status = ?
          )
        `)
        .bind(
          crypto.randomUUID(),
          id,
          auth.user.id,
          action,
          current.status,
          nextStatus,
          note ? JSON.stringify({ note }) : null,
          id,
          current.version + 1,
          nextStatus,
        ),
    ])

    if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
      return json(
        { error: "別のユーザーによって状態が変更されています。再読み込みしてください" },
        409,
      )
    }

    return json({
      ok: true,
      status: nextStatus,
      version: current.version + 1,
    })
  }

  return json({ error: "Not Found" }, 404)
}
