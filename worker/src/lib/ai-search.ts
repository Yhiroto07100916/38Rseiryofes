export interface FileSearchEnv {
  DB: D1Database
  FILES_BUCKET: R2Bucket
  AI_SEARCH?: AiSearchNamespace
}

export interface AiSearchChunk {
  id?: string
  text?: string
  score?: number
  item?: {
    key?: string
    metadata?: Record<string, unknown>
  }
}

export interface AiSearchResponse {
  chunks?: AiSearchChunk[]
  choices?: Array<{ message?: { content?: string } }>
}

export interface AiSearchInstance {
  info(): Promise<unknown>
  items: {
    uploadAndPoll(
      name: string,
      content: ArrayBuffer,
      options?: {
        metadata?: Record<string, string>
        pollIntervalMs?: number
        timeoutMs?: number
      },
    ): Promise<{ id: string; status: string }>
    delete(itemId: string): Promise<void>
  }
  chatCompletions(args: {
    messages: Array<{ role: string; content: string }>
    model?: string
    ai_search_options?: {
      retrieval?: {
        retrieval_type?: "vector" | "keyword" | "hybrid"
        max_num_results?: number
        keyword_match_mode?: "and" | "or"
        filters?: Record<string, unknown>
      }
    }
  }): Promise<AiSearchResponse>
}

export interface AiSearchNamespace {
  get(name: string): AiSearchInstance
  create(options: Record<string, unknown>): Promise<AiSearchInstance>
}

const INSTANCE_ID = "38r-files-knowledge-base"
const MAX_INDEXABLE_FILE_SIZE = 4 * 1024 * 1024

function getIndexingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "FILE_OBJECT_NOT_FOUND") {
    return "保存先のファイルデータを取得できませんでした。"
  }
  if (message === "AI_SEARCH_BINDING_NOT_CONFIGURED") {
    return "AI Searchの接続設定がありません。"
  }
  return message.slice(0, 500) || "原因不明のエラー"
}

function getExtension(filename: string): string {
  return filename.match(/\.[a-z0-9]{1,10}$/i)?.[0]?.toLowerCase() ?? ""
}

function isSupportedFile(filename: string, contentType: string, size: number): boolean {
  const extension = getExtension(filename)
  const isPdf = contentType === "application/pdf" || extension === ".pdf"
  const isText = contentType.startsWith("text/") ||
    ["application/json", "application/xml"].includes(contentType) ||
    [".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm"].includes(extension)

  const isSupportedType = isPdf || isText ||
    contentType.startsWith("image/") ||
    [".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt", ".rtf"].includes(extension)

  return isSupportedType && size <= MAX_INDEXABLE_FILE_SIZE
}

export async function getFileSearchInstance(env: FileSearchEnv): Promise<AiSearchInstance> {
  if (!env.AI_SEARCH) throw new Error("AI_SEARCH_BINDING_NOT_CONFIGURED")

  const instance = env.AI_SEARCH.get(INSTANCE_ID)
  try {
    await instance.info()
    return instance
  } catch (lookupError) {
    const lookupMessage = lookupError instanceof Error ? lookupError.message : String(lookupError)
    if (!lookupMessage.includes("ai_search_not_found")) {
      throw new Error(`AI_SEARCH_INSTANCE_LOOKUP_FAILED: ${lookupMessage}`)
    }

    try {
      return await env.AI_SEARCH.create({
        id: INSTANCE_ID,
        index_method: { vector: true, keyword: true },
        fusion_method: "rrf",
        indexing_options: { keyword_tokenizer: "trigram", use_ocr: true },
        retrieval_options: { keyword_match_mode: "or" },
        custom_metadata: [
          { field_name: "file_id", data_type: "text" },
          { field_name: "category", data_type: "text" },
          { field_name: "uploaded_by", data_type: "text" },
          { field_name: "original_name", data_type: "text" },
        ],
        chunk_size: 512,
        chunk_overlap: 64,
        max_num_results: 10,
        reranking: true,
        ai_search_model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      })
    } catch (createError) {
      const createMessage = createError instanceof Error ? createError.message : String(createError)
      throw new Error(`AI_SEARCH_INSTANCE_CREATE_FAILED: ${createMessage}`)
    }
  }
}

export async function indexFileForAiSearch(
  env: FileSearchEnv,
  file: {
    id: string
    object_key: string
    original_name: string
    content_type: string
    size: number
    category: string
    uploaded_by: string
    ai_search_item_id?: string | null
  },
): Promise<void> {
  try {
    if (!isSupportedFile(file.original_name, file.content_type, file.size)) {
      await env.DB.prepare(
        "UPDATE files SET ai_status = 'failed', ai_summary = NULL, ai_search_item_id = NULL, ai_error = ? WHERE id = ?",
      ).bind("AI検索対象外の形式またはサイズです（上限4 MiB）。", file.id).run()
      return
    }

    const object = await env.FILES_BUCKET.get(file.object_key)
    if (!object) throw new Error("FILE_OBJECT_NOT_FOUND")

    const instance = await getFileSearchInstance(env)
    if (file.ai_search_item_id) {
      try {
        await instance.items.delete(file.ai_search_item_id)
      } catch {
        // A failed prior item may already have expired or been removed.
      }
    }

    const extension = getExtension(file.original_name)
    const item = await instance.items.uploadAndPoll(
      `${file.id}${extension}`,
      await object.arrayBuffer(),
      {
        metadata: {
          file_id: file.id,
          category: file.category,
          uploaded_by: file.uploaded_by,
          original_name: file.original_name.slice(0, 200),
        },
        pollIntervalMs: 1000,
        timeoutMs: 25000,
      },
    )

    await env.DB.prepare(
      "UPDATE files SET ai_search_item_id = ?, ai_status = ?, ai_error = ? WHERE id = ?",
    ).bind(
      item.id,
      item.status === "completed" ? "completed" : "failed",
      item.status === "completed" ? null : `AI Searchの解析が完了しませんでした（status: ${item.status}）。`,
      file.id,
    ).run()

    if (item.status !== "completed") return

    try {
      const summaryResponse = await instance.chatCompletions({
        messages: [
          {
            role: "system",
            content: "あなたは資料整理アシスタントです。必ず資料本文に書かれている情報だけを使い、日本語で要点を簡潔にまとめてください。不明なことは推測せず、資料に記載がないと明記してください。",
          },
          {
            role: "user",
            content: `ファイル「${file.original_name}」の内容を、概要・重要事項・日付や数値の順に整理して要約してください。`,
          },
        ],
        ai_search_options: {
          retrieval: {
            retrieval_type: "hybrid",
            max_num_results: 20,
            keyword_match_mode: "or",
            filters: { file_id: file.id },
          },
        },
      })

      const summary = summaryResponse.choices?.[0]?.message?.content?.trim().slice(0, 8000) || null
      const extractedText = (summaryResponse.chunks ?? [])
        .map(chunk => chunk.text ?? "")
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 50000)

      await env.DB.prepare(
        "UPDATE files SET ai_summary = ?, extracted_text = ?, ai_status = 'completed', ai_error = NULL WHERE id = ?",
      ).bind(summary, extractedText || null, file.id).run()
    } catch (error) {
      console.error("AI file summary failed:", file.id, error)
      await env.DB.prepare(
        "UPDATE files SET ai_status = 'completed', ai_error = NULL WHERE id = ?",
      ).bind(file.id).run()
    }
  } catch (error) {
    console.error("AI file indexing failed:", file.id, error)
    await env.DB.prepare(
      "UPDATE files SET ai_status = 'failed', ai_error = ? WHERE id = ?",
    ).bind(getIndexingErrorMessage(error), file.id).run()
  }
}

export async function deleteFileFromAiSearch(
  env: FileSearchEnv,
  itemId: string | null | undefined,
): Promise<void> {
  if (!itemId || !env.AI_SEARCH) return
  const instance = await getFileSearchInstance(env)
  await instance.items.delete(itemId)
}

export function getAiSearchAnswer(response: AiSearchResponse): string {
  return response.choices?.[0]?.message?.content?.trim() ?? ""
}
