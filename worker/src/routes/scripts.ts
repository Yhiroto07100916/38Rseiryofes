import { hasPermission, requireAuth } from "../lib/authz"

interface Script {
  id: string
  title: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface ScriptAct {
  id: string
  script_id: string
  title: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
  scenes?: ScriptScene[]
}

interface ScriptScene {
  id: string
  act_id: string
  title: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

interface CreateScriptBody {
  title?: unknown
  description?: unknown
}

interface UpdateScriptBody {
  title?: unknown
  description?: unknown
}

interface CreateActBody {
  title?: unknown
  description?: unknown
  sort_order?: unknown
}

interface UpdateActBody {
  title?: unknown
  description?: unknown
  sort_order?: unknown
}

interface CreateSceneBody {
  title?: unknown
  description?: unknown
  sort_order?: unknown
}

interface UpdateSceneBody {
  title?: unknown
  description?: unknown
  sort_order?: unknown
}

interface CreateCharacterBody {
  name?: unknown
  description?: unknown
  sort_order?: unknown
}

interface UpdateCharacterBody {
  name?: unknown
  description?: unknown
  sort_order?: unknown
}

interface CreateCastBody {
  user_id?: unknown
  cast_order?: unknown
}

interface UpdateCastBody {
  user_id?: unknown
  cast_order?: unknown
}

interface CreateBlockBody {
  type?: unknown
  character_id?: unknown
  content?: unknown
  sort_order?: unknown
}

interface UpdateBlockBody {
  type?: unknown
  character_id?: unknown
  content?: unknown
  sort_order?: unknown
}

function generateId(): string {
  return crypto.randomUUID()
}

function normalizeRequiredString(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()

  return normalized === "" ? null : normalized
}

function normalizeOptionalString(
  value: unknown,
): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()

  return normalized === "" ? null : normalized
}

function normalizeStringId(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()

  return normalized === "" ? null : normalized
}

function normalizeBlockType(
  value: unknown,
): "dialogue" | "direction" | "sound" | "lighting" | null {
  if (value === "dialogue" || value === "direction" || value === "sound" || value === "lighting") {
    return value
  }

  return null
}

function normalizeSortOrder(
  value: unknown,
): number | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null
  }

  return value
}

async function getScript(
  env: Env,
  scriptId: string,
): Promise<Script | null> {
  return await env.DB
    .prepare(`
      SELECT
        id,
        title,
        description,
        created_by,
        created_at,
        updated_at
      FROM scripts
      WHERE id = ?
    `)
    .bind(scriptId)
    .first<Script>()
}

async function getAct(
  env: Env,
  scriptId: string,
  actId: string,
): Promise<ScriptAct | null> {
  return await env.DB
    .prepare(`
      SELECT
        a.id,
        a.script_id,
        a.title,
        a.description,
        a.sort_order,
        a.created_at,
        a.updated_at
      FROM script_acts a
      WHERE a.id = ?
        AND a.script_id = ?
    `)
    .bind(actId, scriptId)
    .first<ScriptAct>()
}

async function getCharacter(
  env: Env,
  scriptId: string,
  characterId: string,
) {
  return await env.DB
    .prepare(`
      SELECT
        id,
        script_id,
        name,
        description,
        sort_order,
        created_at,
        updated_at
      FROM script_characters
      WHERE id = ?
        AND script_id = ?
    `)
    .bind(characterId, scriptId)
    .first()
}

async function getSceneCharacter(
  env: Env,
  sceneId: string,
  characterId: string,
) {
  return await env.DB
    .prepare(`
      SELECT
        ssc.scene_id,
        ssc.character_id,
        c.name AS character_name,
        c.description AS character_description
      FROM script_scene_characters ssc
      INNER JOIN script_characters c
        ON c.id = ssc.character_id
      WHERE ssc.scene_id = ?
        AND ssc.character_id = ?
    `)
    .bind(sceneId, characterId)
    .first()
}

async function getBlock(
  env: Env,
  sceneId: string,
  blockId: string,
) {
  return await env.DB
    .prepare(`
      SELECT
        b.id,
        b.scene_id,
        b.type,
        b.character_id,
        c.name AS character_name,
        b.content,
        b.sort_order,
        b.created_at,
        b.updated_at
      FROM script_blocks b
      LEFT JOIN script_characters c
        ON c.id = b.character_id
      WHERE b.id = ?
        AND b.scene_id = ?
    `)
    .bind(blockId, sceneId)
    .first()
}

async function getScene(
  env: Env,
  actId: string,
  sceneId: string,
): Promise<ScriptScene | null> {
  return await env.DB
    .prepare(`
      SELECT
        id,
        act_id,
        title,
        description,
        sort_order,
        created_at,
        updated_at
      FROM script_scenes
      WHERE id = ?
        AND act_id = ?
    `)
    .bind(sceneId, actId)
    .first<ScriptScene>()
}

export async function handleScripts(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  if (request.method === "GET") {
    if (!(await hasPermission(
      env,
      auth.user.id,
      "script.view",
    ))) {
      return Response.json(
        { error: "Forbidden", permission: "script.view" },
        { status: 403 },
      )
    }
  }

  if (
    request.method !== "GET" &&
    request.method !== "OPTIONS"
  ) {
    if (!(await hasPermission(
      env,
      auth.user.id,
      "script.edit",
    ))) {
      return Response.json(
        { error: "Forbidden", permission: "script.edit" },
        { status: 403 },
      )
    }
  }

  if (pathParts.length === 0) {
    if (request.method === "GET") {
      const result = await env.DB
        .prepare(`
          SELECT
            id,
            title,
            description,
            created_by,
            created_at,
            updated_at
          FROM scripts
          ORDER BY updated_at DESC, id DESC
        `)
        .all<Script>()

      return Response.json({
        scripts: result.results,
      })
    }

    if (request.method === "POST") {
      let body: CreateScriptBody

      try {
        body = await request.json()
      } catch {
        return Response.json(
          { error: "Invalid JSON" },
          { status: 400 },
        )
      }

      const title = normalizeRequiredString(body.title)

      if (!title) {
        return Response.json(
          { error: "title is required" },
          { status: 400 },
        )
      }

      const description = normalizeOptionalString(
        body.description,
      )

      const id = generateId()

      await env.DB
        .prepare(`
          INSERT INTO scripts (
            id,
            title,
            description,
            created_by
          )
          VALUES (?, ?, ?, ?)
        `)
        .bind(
          id,
          title,
          description ?? null,
          auth.user.id,
        )
        .run()

      const script = await getScript(env, id)

      return Response.json(
        { script },
        { status: 201 },
      )
    }

    return Response.json(
      { error: "Method Not Allowed" },
      { status: 405 },
    )
  }

  const scriptId = pathParts[0]

  const script = await getScript(env, scriptId)

  if (!script) {
    return Response.json(
      { error: "Script not found" },
      { status: 404 },
    )
  }

  if (pathParts.length === 1) {
    if (request.method === "GET") {
      const acts = await env.DB
        .prepare(`
          SELECT
            id,
            script_id,
            title,
            description,
            sort_order,
            created_at,
            updated_at
          FROM script_acts
          WHERE script_id = ?
          ORDER BY sort_order ASC, id ASC
        `)
        .bind(scriptId)
        .all<ScriptAct>()

      const scenes = await env.DB
        .prepare(`
          SELECT
            id,
            act_id,
            title,
            description,
            sort_order,
            created_at,
            updated_at
          FROM script_scenes
          WHERE act_id IN (
            SELECT id
            FROM script_acts
            WHERE script_id = ?
          )
          ORDER BY sort_order ASC, id ASC
        `)
        .bind(scriptId)
        .all<ScriptScene>()

      const characters = await env.DB
        .prepare(`
          SELECT
            id,
            script_id,
            name,
            description,
            sort_order,
            created_at,
            updated_at
          FROM script_characters
          WHERE script_id = ?
          ORDER BY sort_order ASC, id ASC
        `)
        .bind(scriptId)
        .all()

      const scenesByAct = new Map<string, ScriptScene[]>()

      for (const scene of scenes.results) {
        const actScenes = scenesByAct.get(scene.act_id) ?? []
        actScenes.push(scene)
        scenesByAct.set(scene.act_id, actScenes)
      }

      const actsWithScenes = acts.results.map((act) => ({
        ...act,
        scenes: scenesByAct.get(act.id) ?? [],
      }))

      return Response.json({
        script,
        acts: actsWithScenes,
        characters: characters.results,
      })
    }

    if (request.method === "PATCH") {
      let body: UpdateScriptBody

      try {
        body = await request.json()
      } catch {
        return Response.json(
          { error: "Invalid JSON" },
          { status: 400 },
        )
      }

      const title = body.title === undefined
        ? undefined
        : normalizeRequiredString(body.title)

      if (body.title !== undefined && !title) {
        return Response.json(
          { error: "title must not be empty" },
          { status: 400 },
        )
      }

      const description = normalizeOptionalString(
        body.description,
      )

      const updates: string[] = []
      const values: unknown[] = []

      if (title !== undefined) {
        updates.push("title = ?")
        values.push(title)
      }

      if (description !== undefined) {
        updates.push("description = ?")
        values.push(description)
      }

      if (updates.length === 0) {
        return Response.json(
          { error: "No fields to update" },
          { status: 400 },
        )
      }

      updates.push("updated_at = CURRENT_TIMESTAMP")

      await env.DB
        .prepare(`
          UPDATE scripts
          SET ${updates.join(", ")}
          WHERE id = ?
        `)
        .bind(...values, scriptId)
        .run()

      return Response.json({
        script: await getScript(env, scriptId),
      })
    }

    if (request.method === "DELETE") {
      await env.DB
        .prepare(`
          DELETE FROM scripts
          WHERE id = ?
        `)
        .bind(scriptId)
        .run()

      return new Response(null, { status: 204 })
    }

    return Response.json(
      { error: "Method Not Allowed" },
      { status: 405 },
    )
  }

  if (pathParts[1] === "characters") {
    if (pathParts.length === 2) {
      if (request.method === "GET") {
        const result = await env.DB
          .prepare(`
            SELECT
              id,
              script_id,
              name,
              description,
              sort_order,
              created_at,
              updated_at
            FROM script_characters
            WHERE script_id = ?
            ORDER BY sort_order ASC, id ASC
          `)
          .bind(scriptId)
          .all()

        return Response.json({
          characters: result.results,
        })
      }

      if (request.method === "POST") {
        let body: CreateCharacterBody

        try {
          body = await request.json()
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400 },
          )
        }

        const name = normalizeRequiredString(body.name)

        if (!name) {
          return Response.json(
            { error: "name is required" },
            { status: 400 },
          )
        }

        const description = normalizeOptionalString(
          body.description,
        )

        const sortOrder = normalizeSortOrder(
          body.sort_order,
        )

        if (sortOrder === null) {
          return Response.json(
            { error: "sort_order must be a non-negative integer" },
            { status: 400 },
          )
        }

        const id = generateId()

        await env.DB
          .prepare(`
            INSERT INTO script_characters (
              id,
              script_id,
              name,
              description,
              sort_order
            )
            VALUES (?, ?, ?, ?, ?)
          `)
          .bind(
            id,
            scriptId,
            name,
            description ?? null,
            sortOrder ?? 0,
          )
          .run()

        await env.DB
          .prepare(`
            UPDATE scripts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(scriptId)
          .run()

        return Response.json(
          {
            character: await getCharacter(
              env,
              scriptId,
              id,
            ),
          },
          { status: 201 },
        )
      }

      return Response.json(
        { error: "Method Not Allowed" },
        { status: 405 },
      )
    }

    const characterId = pathParts[2]
    const character = await getCharacter(
      env,
      scriptId,
      characterId,
    )

    if (!character) {
      return Response.json(
        { error: "Character not found" },
        { status: 404 },
      )
    }

    if (pathParts.length === 3) {
      if (request.method === "GET") {
        const casts = await env.DB
          .prepare(`
            SELECT
              sc.id,
              sc.character_id,
              sc.user_id,
              u.student_number,
              u.name,
              u.nickname,
              sc.cast_order,
              sc.created_at
            FROM script_casts sc
            INNER JOIN users u
              ON u.id = sc.user_id
            WHERE sc.character_id = ?
            ORDER BY sc.cast_order ASC, sc.id ASC
          `)
          .bind(characterId)
          .all()

        return Response.json({
          character,
          casts: casts.results,
        })
      }

      if (request.method === "PATCH") {
        let body: UpdateCharacterBody

        try {
          body = await request.json()
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400 },
          )
        }

        const name = body.name === undefined
          ? undefined
          : normalizeRequiredString(body.name)

        if (body.name !== undefined && !name) {
          return Response.json(
            { error: "name must not be empty" },
            { status: 400 },
          )
        }

        const description = normalizeOptionalString(
          body.description,
        )

        const sortOrder = normalizeSortOrder(
          body.sort_order,
        )

        if (sortOrder === null) {
          return Response.json(
            { error: "sort_order must be a non-negative integer" },
            { status: 400 },
          )
        }

        const updates: string[] = []
        const values: unknown[] = []

        if (name !== undefined) {
          updates.push("name = ?")
          values.push(name)
        }

        if (description !== undefined) {
          updates.push("description = ?")
          values.push(description)
        }

        if (sortOrder !== undefined) {
          updates.push("sort_order = ?")
          values.push(sortOrder)
        }

        if (updates.length === 0) {
          return Response.json(
            { error: "No fields to update" },
            { status: 400 },
          )
        }

        updates.push("updated_at = CURRENT_TIMESTAMP")

        await env.DB
          .prepare(`
            UPDATE script_characters
            SET ${updates.join(", ")}
            WHERE id = ?
              AND script_id = ?
          `)
          .bind(...values, characterId, scriptId)
          .run()

        await env.DB
          .prepare(`
            UPDATE scripts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(scriptId)
          .run()

        return Response.json({
          character: await getCharacter(
            env,
            scriptId,
            characterId,
          ),
        })
      }

      if (request.method === "DELETE") {
        await env.DB
          .prepare(`
            DELETE FROM script_casts
            WHERE character_id = ?
          `)
          .bind(characterId)
          .run()

        await env.DB
          .prepare(`
            DELETE FROM script_scene_characters
            WHERE character_id = ?
          `)
          .bind(characterId)
          .run()

        await env.DB
          .prepare(`
            UPDATE script_blocks
            SET character_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE character_id = ?
          `)
          .bind(characterId)
          .run()

        await env.DB
          .prepare(`
            DELETE FROM script_characters
            WHERE id = ?
              AND script_id = ?
          `)
          .bind(characterId, scriptId)
          .run()

        await env.DB
          .prepare(`
            UPDATE scripts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(scriptId)
          .run()

        return new Response(null, { status: 204 })
      }

      return Response.json(
        { error: "Method Not Allowed" },
        { status: 405 },
      )
    }

    if (pathParts[3] === "casts") {
      if (pathParts.length === 4) {
        if (request.method === "GET") {
          const result = await env.DB
            .prepare(`
              SELECT
                sc.id,
                sc.character_id,
                sc.user_id,
                u.student_number,
                u.name,
                u.nickname,
                sc.cast_order,
                sc.created_at
              FROM script_casts sc
              INNER JOIN users u
                ON u.id = sc.user_id
              WHERE sc.character_id = ?
              ORDER BY sc.cast_order ASC, sc.id ASC
            `)
            .bind(characterId)
            .all()

          return Response.json({
            casts: result.results,
          })
        }

        if (request.method === "POST") {
          let body: CreateCastBody

          try {
            body = await request.json()
          } catch {
            return Response.json(
              { error: "Invalid JSON" },
              { status: 400 },
            )
          }

          const userId = normalizeStringId(body.user_id)

          if (!userId) {
            return Response.json(
              { error: "user_id is required" },
              { status: 400 },
            )
          }

          const castOrder = normalizeSortOrder(
            body.cast_order,
          )

          if (castOrder === null) {
            return Response.json(
              { error: "cast_order must be a non-negative integer" },
              { status: 400 },
            )
          }

          const user = await env.DB
            .prepare(`
              SELECT id
              FROM users
              WHERE id = ?
            `)
            .bind(userId)
            .first<{ id: string }>()

          if (!user) {
            return Response.json(
              { error: "User not found" },
              { status: 404 },
            )
          }

          const existing = await env.DB
            .prepare(`
              SELECT id
              FROM script_casts
              WHERE character_id = ?
                AND user_id = ?
            `)
            .bind(characterId, userId)
            .first<{ id: string }>()

          if (existing) {
            return Response.json(
              { error: "Cast already assigned" },
              { status: 409 },
            )
          }

          const id = generateId()

          await env.DB
            .prepare(`
              INSERT INTO script_casts (
                id,
                character_id,
                user_id,
                cast_order
              )
              VALUES (?, ?, ?, ?)
            `)
            .bind(
              id,
              characterId,
              userId,
              castOrder ?? 0,
            )
            .run()

          return Response.json(
            {
              cast: await env.DB
                .prepare(`
                  SELECT
                    sc.id,
                    sc.character_id,
                    sc.user_id,
                    u.student_number,
                    u.name,
                    u.nickname,
                    sc.cast_order,
                    sc.created_at
                  FROM script_casts sc
                  INNER JOIN users u
                    ON u.id = sc.user_id
                  WHERE sc.id = ?
                `)
                .bind(id)
                .first(),
            },
            { status: 201 },
          )
        }

        return Response.json(
          { error: "Method Not Allowed" },
          { status: 405 },
        )
      }

      const castId = pathParts[4]

      if (request.method === "PATCH") {
        let body: UpdateCastBody

        try {
          body = await request.json()
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400 },
          )
        }

        const updates: string[] = []
        const values: unknown[] = []

        if (body.user_id !== undefined) {
          const userId = normalizeStringId(body.user_id)

          if (!userId) {
            return Response.json(
              { error: "user_id must not be empty" },
              { status: 400 },
            )
          }

          const user = await env.DB
            .prepare(`
              SELECT id
              FROM users
              WHERE id = ?
            `)
            .bind(userId)
            .first<{ id: string }>()

          if (!user) {
            return Response.json(
              { error: "User not found" },
              { status: 404 },
            )
          }

          updates.push("user_id = ?")
          values.push(userId)
        }

        if (body.cast_order !== undefined) {
          const castOrder = normalizeSortOrder(
            body.cast_order,
          )

          if (castOrder === null) {
            return Response.json(
              { error: "cast_order must be a non-negative integer" },
              { status: 400 },
            )
          }

          updates.push("cast_order = ?")
          values.push(castOrder)
        }

        if (updates.length === 0) {
          return Response.json(
            { error: "No fields to update" },
            { status: 400 },
          )
        }

        try {
          await env.DB
            .prepare(`
              UPDATE script_casts
              SET ${updates.join(", ")}
              WHERE id = ?
                AND character_id = ?
            `)
            .bind(...values, castId, characterId)
            .run()
        } catch (error) {
          console.error("Script cast update error:", error)

          return Response.json(
            { error: "Cast already assigned or update failed" },
            { status: 409 },
          )
        }

        return Response.json({
          cast: await env.DB
            .prepare(`
              SELECT
                sc.id,
                sc.character_id,
                sc.user_id,
                u.student_number,
                u.name,
                u.nickname,
                sc.cast_order,
                sc.created_at
              FROM script_casts sc
              INNER JOIN users u
                ON u.id = sc.user_id
              WHERE sc.id = ?
                AND sc.character_id = ?
            `)
            .bind(castId, characterId)
            .first(),
        })
      }

      if (request.method === "DELETE") {
        await env.DB
          .prepare(`
            DELETE FROM script_casts
            WHERE id = ?
              AND character_id = ?
          `)
          .bind(castId, characterId)
          .run()

        return new Response(null, { status: 204 })
      }

      return Response.json(
        { error: "Method Not Allowed" },
        { status: 405 },
      )
    }
  }

  if (pathParts[1] === "cast-members") {
    if (pathParts.length !== 2) {
      return Response.json(
        { error: "Not Found" },
        { status: 404 },
      )
    }

    if (request.method === "GET") {
      const result = await env.DB
        .prepare(`
          SELECT
            id,
            student_number,
            name,
            nickname
          FROM users
          ORDER BY student_number ASC
        `)
        .all<{
          id: string
          student_number: string
          name: string
          nickname: string | null
        }>()

      return Response.json({
        members: result.results,
      })
    }

    return Response.json(
      { error: "Method Not Allowed" },
      { status: 405 },
    )
  }

  if (pathParts[1] === "acts") {
    if (pathParts.length === 2) {
      if (request.method === "GET") {
        const result = await env.DB
          .prepare(`
            SELECT
              id,
              script_id,
              title,
              description,
              sort_order,
              created_at,
              updated_at
            FROM script_acts
            WHERE script_id = ?
            ORDER BY sort_order ASC, id ASC
          `)
          .bind(scriptId)
          .all<ScriptAct>()

        return Response.json({
          acts: result.results,
        })
      }

      if (request.method === "POST") {
        let body: CreateActBody

        try {
          body = await request.json()
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400 },
          )
        }

        const title = normalizeRequiredString(body.title)

        if (!title) {
          return Response.json(
            { error: "title is required" },
            { status: 400 },
          )
        }

        const description = normalizeOptionalString(
          body.description,
        )

        const sortOrder = normalizeSortOrder(
          body.sort_order,
        )

        if (sortOrder === null) {
          return Response.json(
            { error: "sort_order must be a non-negative integer" },
            { status: 400 },
          )
        }

        const id = generateId()

        await env.DB
          .prepare(`
            INSERT INTO script_acts (
              id,
              script_id,
              title,
              description,
              sort_order
            )
            VALUES (?, ?, ?, ?, ?)
          `)
          .bind(
            id,
            scriptId,
            title,
            description ?? null,
            sortOrder ?? 0,
          )
          .run()

        await env.DB
          .prepare(`
            UPDATE scripts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(scriptId)
          .run()

        return Response.json(
          {
            act: await getAct(env, scriptId, id),
          },
          { status: 201 },
        )
      }

      return Response.json(
        { error: "Method Not Allowed" },
        { status: 405 },
      )
    }

    const actId = pathParts[2]
    const act = await getAct(env, scriptId, actId)

    if (!act) {
      return Response.json(
        { error: "Act not found" },
        { status: 404 },
      )
    }

    if (pathParts.length === 3) {
      if (request.method === "PATCH") {
        let body: UpdateActBody

        try {
          body = await request.json()
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400 },
          )
        }

        const title = body.title === undefined
          ? undefined
          : normalizeRequiredString(body.title)

        if (body.title !== undefined && !title) {
          return Response.json(
            { error: "title must not be empty" },
            { status: 400 },
          )
        }

        const description = normalizeOptionalString(
          body.description,
        )

        const sortOrder = normalizeSortOrder(
          body.sort_order,
        )

        if (sortOrder === null) {
          return Response.json(
            { error: "sort_order must be a non-negative integer" },
            { status: 400 },
          )
        }

        const updates: string[] = []
        const values: unknown[] = []

        if (title !== undefined) {
          updates.push("title = ?")
          values.push(title)
        }

        if (description !== undefined) {
          updates.push("description = ?")
          values.push(description)
        }

        if (sortOrder !== undefined) {
          updates.push("sort_order = ?")
          values.push(sortOrder)
        }

        if (updates.length === 0) {
          return Response.json(
            { error: "No fields to update" },
            { status: 400 },
          )
        }

        updates.push("updated_at = CURRENT_TIMESTAMP")

        await env.DB
          .prepare(`
            UPDATE script_acts
            SET ${updates.join(", ")}
            WHERE id = ?
              AND script_id = ?
          `)
          .bind(...values, actId, scriptId)
          .run()

        await env.DB
          .prepare(`
            UPDATE scripts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(scriptId)
          .run()

        return Response.json({
          act: await getAct(env, scriptId, actId),
        })
      }

      if (request.method === "DELETE") {
        await env.DB
          .prepare(`
            DELETE FROM script_acts
            WHERE id = ?
              AND script_id = ?
          `)
          .bind(actId, scriptId)
          .run()

        await env.DB
          .prepare(`
            UPDATE scripts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(scriptId)
          .run()

        return new Response(null, { status: 204 })
      }

      if (request.method === "GET") {
        const scenes = await env.DB
          .prepare(`
            SELECT
              id,
              act_id,
              title,
              description,
              sort_order,
              created_at,
              updated_at
            FROM script_scenes
            WHERE act_id = ?
            ORDER BY sort_order ASC, id ASC
          `)
          .bind(actId)
          .all<ScriptScene>()

        return Response.json({
          act,
          scenes: scenes.results,
        })
      }

      return Response.json(
        { error: "Method Not Allowed" },
        { status: 405 },
      )
    }

    if (pathParts[3] === "scenes") {
      if (pathParts.length === 4) {
        if (request.method === "GET") {
          const result = await env.DB
            .prepare(`
              SELECT
                id,
                act_id,
                title,
                description,
                sort_order,
                created_at,
                updated_at
              FROM script_scenes
              WHERE act_id = ?
              ORDER BY sort_order ASC, id ASC
            `)
            .bind(actId)
            .all<ScriptScene>()

          return Response.json({
            scenes: result.results,
          })
        }

        if (request.method === "POST") {
          let body: CreateSceneBody

          try {
            body = await request.json()
          } catch {
            return Response.json(
              { error: "Invalid JSON" },
              { status: 400 },
            )
          }

          const title = normalizeRequiredString(body.title)

          if (!title) {
            return Response.json(
              { error: "title is required" },
              { status: 400 },
            )
          }

          const description = normalizeOptionalString(
            body.description,
          )

          const sortOrder = normalizeSortOrder(
            body.sort_order,
          )

          if (sortOrder === null) {
            return Response.json(
              { error: "sort_order must be a non-negative integer" },
              { status: 400 },
            )
          }

          const id = generateId()

          await env.DB
            .prepare(`
              INSERT INTO script_scenes (
                id,
                act_id,
                title,
                description,
                sort_order
              )
              VALUES (?, ?, ?, ?, ?)
            `)
            .bind(
              id,
              actId,
              title,
              description ?? null,
              sortOrder ?? 0,
            )
            .run()

          await env.DB
            .prepare(`
              UPDATE scripts
              SET updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .bind(scriptId)
            .run()

          return Response.json(
            {
              scene: await getScene(env, actId, id),
            },
            { status: 201 },
          )
        }

        return Response.json(
          { error: "Method Not Allowed" },
          { status: 405 },
        )
      }

      const sceneId = pathParts[4]
      const scene = await getScene(env, actId, sceneId)

      if (!scene) {
        return Response.json(
          { error: "Scene not found" },
          { status: 404 },
        )
      }

      if (
        pathParts.length === 6 &&
        pathParts[5] === "characters"
      ) {
        if (request.method === "GET") {
          const result = await env.DB
            .prepare(`
              SELECT
                ssc.scene_id,
                ssc.character_id,
                c.name AS character_name,
                c.description AS character_description,
                c.sort_order AS character_sort_order
              FROM script_scene_characters ssc
              INNER JOIN script_characters c
                ON c.id = ssc.character_id
              WHERE ssc.scene_id = ?
              ORDER BY c.sort_order ASC, c.id ASC
            `)
            .bind(sceneId)
            .all()

          return Response.json({
            characters: result.results,
          })
        }

        if (request.method === "POST") {
          let body: { character_id?: unknown }

          try {
            body = await request.json()
          } catch {
            return Response.json(
              { error: "Invalid JSON" },
              { status: 400 },
            )
          }

          const characterId = normalizeStringId(
            body.character_id,
          )

          if (!characterId) {
            return Response.json(
              { error: "character_id is required" },
              { status: 400 },
            )
          }

          const character = await getCharacter(
            env,
            scriptId,
            characterId,
          )

          if (!character) {
            return Response.json(
              { error: "Character not found" },
              { status: 404 },
            )
          }

          const existing = await getSceneCharacter(
            env,
            sceneId,
            characterId,
          )

          if (existing) {
            return Response.json(
              { error: "Character already added to scene" },
              { status: 409 },
            )
          }

          await env.DB
            .prepare(`
              INSERT INTO script_scene_characters (
                scene_id,
                character_id
              )
              VALUES (?, ?)
            `)
            .bind(sceneId, characterId)
            .run()

          await env.DB
            .prepare(`
              UPDATE scripts
              SET updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .bind(scriptId)
            .run()

          return Response.json(
            {
              character: await getSceneCharacter(
                env,
                sceneId,
                characterId,
              ),
            },
            { status: 201 },
          )
        }

        return Response.json(
          { error: "Method Not Allowed" },
          { status: 405 },
        )
      }

      if (
        pathParts.length === 7 &&
        pathParts[5] === "characters"
      ) {
        const characterId = pathParts[6]

        if (request.method !== "DELETE") {
          return Response.json(
            { error: "Method Not Allowed" },
            { status: 405 },
          )
        }

        await env.DB
          .prepare(`
            DELETE FROM script_scene_characters
            WHERE scene_id = ?
              AND character_id = ?
          `)
          .bind(sceneId, characterId)
          .run()

        await env.DB
          .prepare(`
            UPDATE scripts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(scriptId)
          .run()

        return new Response(null, { status: 204 })
      }

      if (
        pathParts.length === 6 &&
        pathParts[5] === "blocks"
      ) {
        if (request.method === "GET") {
          const result = await env.DB
            .prepare(`
              SELECT
                b.id,
                b.scene_id,
                b.type,
                b.character_id,
                c.name AS character_name,
                b.content,
                b.sort_order,
                b.created_at,
                b.updated_at
              FROM script_blocks b
              LEFT JOIN script_characters c
                ON c.id = b.character_id
              WHERE b.scene_id = ?
              ORDER BY b.sort_order ASC, b.id ASC
            `)
            .bind(sceneId)
            .all()

          return Response.json({
            blocks: result.results,
          })
        }

        if (request.method === "POST") {
          let body: CreateBlockBody

          try {
            body = await request.json()
          } catch {
            return Response.json(
              { error: "Invalid JSON" },
              { status: 400 },
            )
          }

          const type = normalizeBlockType(body.type)

          if (!type) {
            return Response.json(
              {
                error: "type must be dialogue, direction, sound, or lighting",
              },
              { status: 400 },
            )
          }

          const content = normalizeOptionalString(
            body.content,
          ) ?? ""

          const sortOrder = normalizeSortOrder(
            body.sort_order,
          )

          if (sortOrder === null) {
            return Response.json(
              {
                error: "sort_order must be a non-negative integer",
              },
              { status: 400 },
            )
          }

          let characterId: string | null = null

          if (type === "dialogue") {
            characterId = normalizeStringId(
              body.character_id,
            )

            if (!characterId) {
              return Response.json(
                {
                  error:
                    "character_id is required for dialogue",
                },
                { status: 400 },
              )
            }

            const character = await getCharacter(
              env,
              scriptId,
              characterId,
            )

            if (!character) {
              return Response.json(
                { error: "Character not found" },
                { status: 404 },
              )
            }
          }

          if (
            type === "direction" &&
            body.character_id !== undefined &&
            body.character_id !== null
          ) {
            return Response.json(
              {
                error:
                  "character_id must be null for direction",
              },
              { status: 400 },
            )
          }

          const id = generateId()

          await env.DB
            .prepare(`
              INSERT INTO script_blocks (
                id,
                scene_id,
                type,
                character_id,
                content,
                sort_order
              )
              VALUES (?, ?, ?, ?, ?, ?)
            `)
            .bind(
              id,
              sceneId,
              type,
              characterId,
              content,
              sortOrder ?? 0,
            )
            .run()

          await env.DB
            .prepare(`
              UPDATE scripts
              SET updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .bind(scriptId)
            .run()

          return Response.json(
            {
              block: await getBlock(
                env,
                sceneId,
                id,
              ),
            },
            { status: 201 },
          )
        }

        return Response.json(
          { error: "Method Not Allowed" },
          { status: 405 },
        )
      }

      if (
        pathParts.length === 7 &&
        pathParts[5] === "blocks"
      ) {
        const blockId = pathParts[6]
        const block = await getBlock(
          env,
          sceneId,
          blockId,
        )

        if (!block) {
          return Response.json(
            { error: "Block not found" },
            { status: 404 },
          )
        }

        if (request.method === "GET") {
          return Response.json({
            block,
          })
        }

        if (request.method === "PATCH") {
          let body: UpdateBlockBody

          try {
            body = await request.json()
          } catch {
            return Response.json(
              { error: "Invalid JSON" },
              { status: 400 },
            )
          }

          const currentType =
            typeof block.type === "string"
              ? block.type
              : null

          const type = body.type === undefined
            ? currentType
            : normalizeBlockType(body.type)

          if (
            type !== "dialogue" &&
            type !== "direction" &&
            type !== "sound" &&
            type !== "lighting"
          ) {
            return Response.json(
              {
                error:
                  "type must be dialogue or direction",
              },
              { status: 400 },
            )
          }

          const content = body.content === undefined
            ? undefined
            : normalizeOptionalString(body.content) ?? ""

          const sortOrder = normalizeSortOrder(
            body.sort_order,
          )

          if (sortOrder === null) {
            return Response.json(
              {
                error:
                  "sort_order must be a non-negative integer",
              },
              { status: 400 },
            )
          }

          let characterId: string | null | undefined =
            undefined

          if (body.character_id !== undefined) {
            characterId =
              body.character_id === null
                ? null
                : normalizeStringId(
                    body.character_id,
                  )

            if (
              body.character_id !== null &&
              !characterId
            ) {
              return Response.json(
                {
                  error:
                    "character_id must be a valid ID or null",
                },
                { status: 400 },
              )
            }
          }

          if (type === "dialogue") {
            if (characterId === undefined) {
              characterId =
                typeof block.character_id === "string"
                  ? block.character_id
                  : null
            }

            if (!characterId) {
              return Response.json(
                {
                  error:
                    "character_id is required for dialogue",
                },
                { status: 400 },
              )
            }

            const character = await getCharacter(
              env,
              scriptId,
              characterId,
            )

            if (!character) {
              return Response.json(
                { error: "Character not found" },
                { status: 404 },
              )
            }
          } else {
            characterId = null
          }

          const updates: string[] = []
          const values: unknown[] = []

          if (body.type !== undefined) {
            updates.push("type = ?")
            values.push(type)
          } else if (
            typeof block.type === "string" &&
            block.type !== type
          ) {
            updates.push("type = ?")
            values.push(type)
          }

          if (
            body.character_id !== undefined ||
            (
              body.type !== undefined &&
              type === "direction"
            )
          ) {
            updates.push("character_id = ?")
            values.push(characterId ?? null)
          }

          if (content !== undefined) {
            updates.push("content = ?")
            values.push(content)
          }

          if (sortOrder !== undefined) {
            updates.push("sort_order = ?")
            values.push(sortOrder)
          }

          if (updates.length === 0) {
            return Response.json(
              { error: "No fields to update" },
              { status: 400 },
            )
          }

          updates.push(
            "updated_at = CURRENT_TIMESTAMP",
          )

          await env.DB
            .prepare(`
              UPDATE script_blocks
              SET ${updates.join(", ")}
              WHERE id = ?
                AND scene_id = ?
            `)
            .bind(...values, blockId, sceneId)
            .run()

          await env.DB
            .prepare(`
              UPDATE scripts
              SET updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .bind(scriptId)
            .run()

          return Response.json({
            block: await getBlock(
              env,
              sceneId,
              blockId,
            ),
          })
        }

        if (request.method === "DELETE") {
          await env.DB
            .prepare(`
              DELETE FROM script_blocks
              WHERE id = ?
                AND scene_id = ?
            `)
            .bind(blockId, sceneId)
            .run()

          await env.DB
            .prepare(`
              UPDATE scripts
              SET updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .bind(scriptId)
            .run()

          return new Response(null, { status: 204 })
        }

        return Response.json(
          { error: "Method Not Allowed" },
          { status: 405 },
        )
      }

      if (pathParts.length === 5) {
        if (request.method === "GET") {
          const characters = await env.DB
            .prepare(`
              SELECT
                ssc.scene_id,
                ssc.character_id,
                c.name AS character_name,
                c.description AS character_description,
                c.sort_order AS character_sort_order
              FROM script_scene_characters ssc
              INNER JOIN script_characters c
                ON c.id = ssc.character_id
              WHERE ssc.scene_id = ?
              ORDER BY c.sort_order ASC, c.id ASC
            `)
            .bind(sceneId)
            .all()

          const blocks = await env.DB
            .prepare(`
              SELECT
                b.id,
                b.scene_id,
                b.type,
                b.character_id,
                c.name AS character_name,
                b.content,
                b.sort_order,
                b.created_at,
                b.updated_at
              FROM script_blocks b
              LEFT JOIN script_characters c
                ON c.id = b.character_id
              WHERE b.scene_id = ?
              ORDER BY b.sort_order ASC, b.id ASC
            `)
            .bind(sceneId)
            .all()

          return Response.json({
            scene,
            characters: characters.results,
            blocks: blocks.results,
          })
        }

        if (request.method === "PATCH") {
          let body: UpdateSceneBody

          try {
            body = await request.json()
          } catch {
            return Response.json(
              { error: "Invalid JSON" },
              { status: 400 },
            )
          }

          const title = body.title === undefined
            ? undefined
            : normalizeRequiredString(body.title)

          if (body.title !== undefined && !title) {
            return Response.json(
              { error: "title must not be empty" },
              { status: 400 },
            )
          }

          const description = normalizeOptionalString(
            body.description,
          )

          const sortOrder = normalizeSortOrder(
            body.sort_order,
          )

          if (sortOrder === null) {
            return Response.json(
              { error: "sort_order must be a non-negative integer" },
              { status: 400 },
            )
          }

          const updates: string[] = []
          const values: unknown[] = []

          if (title !== undefined) {
            updates.push("title = ?")
            values.push(title)
          }

          if (description !== undefined) {
            updates.push("description = ?")
            values.push(description)
          }

          if (sortOrder !== undefined) {
            updates.push("sort_order = ?")
            values.push(sortOrder)
          }

          if (updates.length === 0) {
            return Response.json(
              { error: "No fields to update" },
              { status: 400 },
            )
          }

          updates.push("updated_at = CURRENT_TIMESTAMP")

          await env.DB
            .prepare(`
              UPDATE script_scenes
              SET ${updates.join(", ")}
              WHERE id = ?
                AND act_id = ?
            `)
            .bind(...values, sceneId, actId)
            .run()

          await env.DB
            .prepare(`
              UPDATE scripts
              SET updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .bind(scriptId)
            .run()

          return Response.json({
            scene: await getScene(env, actId, sceneId),
          })
        }

        if (request.method === "DELETE") {
          await env.DB
            .prepare(`
              DELETE FROM script_scenes
              WHERE id = ?
                AND act_id = ?
            `)
            .bind(sceneId, actId)
            .run()

          await env.DB
            .prepare(`
              UPDATE scripts
              SET updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .bind(scriptId)
            .run()

          return new Response(null, { status: 204 })
        }

        return Response.json(
          { error: "Method Not Allowed" },
          { status: 405 },
        )
      }
    }
  }

  return Response.json(
    { error: "Not Found" },
    { status: 404 },
  )
}
