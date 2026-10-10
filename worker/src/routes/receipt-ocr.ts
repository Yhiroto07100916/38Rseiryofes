import { hasPermission, requireAuth } from "../lib/authz"

type Env = {
  DB: D1Database
  FILES_BUCKET: R2Bucket
  AI: Ai
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct"

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function extractJson(value: string): Record<string, unknown> {
  const cleaned = value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")

  if (start < 0 || end <= start) {
    throw new Error("OCR結果をJSONとして読み取れませんでした")
  }

  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1))

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OCR結果の形式が不正です")
  }

  return parsed as Record<string, unknown>
}

export async function handleReceiptOcr(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ message: "Method Not Allowed" }, 405)
  }

  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  if (!(await hasPermission(env, auth.user.id, "accounting.create"))) {
    return json({ message: "会計登録権限がありません" }, 403)
  }

  try {
    const form = await request.formData()
    const file = form.get("file")

    if (!(file instanceof File) || file.size === 0) {
      return json({ message: "レシート画像を選択してください" }, 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return json({ message: "画像は10MB以下にしてください" }, 413)
    }

    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
    ])

    if (!allowedTypes.has(file.type)) {
      return json(
        { message: "JPEG・PNG・WebP形式の画像を選択してください" },
        400,
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    let result: unknown

    try {
      result = await env.AI.run(MODEL, {
        prompt: [
          "あなたは日本語のレシート画像から情報を抽出するシステムです。",
          "画像に実際に印刷されている情報だけを読み取り、読めない値は推測せずnullにしてください。",
          "商品明細は、レシートに印刷された実際の商品行ごとに1要素を作ってください。",
          "商品行を省略したり、複数の商品を1つにまとめたり、同じ商品行を重複して追加したりしないでください。",
          "商品名、単価、数量、商品行の金額を区別してください。",
          "単価638円、数量8、行の金額5104円と印字されている場合、unit_priceは638、quantityは8、amountは5104です。",
          "数量が明記されていない商品はquantityを1にしてください。",
          "商品行以外の小計、税額、合計、預かり金、釣銭、ポイント、決済情報、会員番号、商品コード、バーコード番号をitemsに含めないでください。",
          "total_amountは、客が支払う最終的な合計金額です。小計や税額単独の値ではありません。",
          "現金の預かり金額やクレジットカード利用額の説明、釣銭をtotal_amountに設定しないでください。",
          "例えば小計7572円、税額757円、合計8329円、預かり10000円、釣銭1671円ならtotal_amountは8329です。",
          "小計、税額、合計、預かり金、釣銭などの数字を商品明細として追加しないでください。",
          "商品行のamountはその商品行の合計金額です。レシートから読めない場合はnullにしてください。",
          "購入日、店舗名、単価、割引率、税率、金額が読み取れない場合はnullにしてください。",
          "割引率が印字されていない場合は0にしてください。",
          "税率は8または10などの数値で返し、判断できない場合はnullにしてください。",
          "price_typeは、単価が税込と明記または明確に読み取れる場合tax_included、税抜と明記されている場合tax_excluded、それ以外はunknownにしてください。",
          "金額は通貨記号と桁区切りを除いた数値、数量は数値にしてください。",
          "購入日は確実に読み取れる場合だけYYYY-MM-DD形式にしてください。",
          "itemsは画像の上から順番に並べてください。",
          "必ず指定されたJSONオブジェクトだけを返してください。説明文、Markdown、コードフェンスは付けないでください。",
          '形式: {"purchased_at":null,"store_name":null,"total_amount":null,"items":[{"name":"商品名","unit_price":null,"quantity":1,"discount_rate":0,"tax_rate":null,"price_type":"unknown","amount":null}]}',
        ].join("\n"),
        image: `data:${file.type};base64,${btoa(
          Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
        )}`,
        max_tokens: 3500,
        temperature: 0,
      })
    } catch (error) {
      console.error("Receipt OCR model error:", error)
      return json(
        { message: "OCRに失敗しました。画像を確認して再度お試しください。" },
        502,
      )
    }

    console.log(
      "Receipt OCR result structure:",
      JSON.stringify(
        result,
        (key, value) =>
          key === "image" ? "[image omitted]" : value,
      ).slice(0, 12000),
    )

    const responseText =
      result && typeof result === "object" && "response" in result
        ? typeof (result as { response: unknown }).response === "string"
          ? (result as { response: string }).response
          : JSON.stringify((result as { response: unknown }).response ?? "")
        : typeof result === "string"
          ? result
          : JSON.stringify(result ?? "")

    let ocr: Record<string, unknown>

    try {
      ocr = extractJson(responseText)
    } catch (error) {
      console.error("Receipt OCR JSON parse error:", error)
      console.error("Receipt OCR raw response:", responseText)
      return json(
        {
          message: "画像を読み取れませんでした。手入力してください。",
          detail: error instanceof Error ? error.message : String(error),
        },
        422,
      )
    }

    const rawItems = Array.isArray(ocr.items) ? ocr.items : []
    console.log("Receipt OCR parsed item count:", rawItems.length)
    const items = rawItems
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item),
      )
      .map((item) => ({
        name: typeof item.name === "string" ? item.name : "",
        unit_price:
          typeof item.unit_price === "number" &&
          Number.isFinite(item.unit_price)
            ? Math.max(0, Math.round(item.unit_price))
            : null,
        quantity:
          typeof item.quantity === "number" &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0
            ? item.quantity
            : 1,
        discount_rate:
          typeof item.discount_rate === "number" &&
          Number.isFinite(item.discount_rate)
            ? Math.min(100, Math.max(0, Math.round(item.discount_rate)))
            : 0,
        tax_rate:
          typeof item.tax_rate === "number" &&
          Number.isFinite(item.tax_rate)
            ? Math.min(100, Math.max(0, Math.round(item.tax_rate)))
            : null,
        price_type:
          item.price_type === "tax_included" || item.price_type === "tax_excluded"
            ? item.price_type
            : "unknown",
        amount:
          typeof item.amount === "number" &&
          Number.isFinite(item.amount)
            ? Math.max(0, Math.round(item.amount))
            : null,
      }))

    return json({
      ocr: {
        purchased_at:
          typeof ocr.purchased_at === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(ocr.purchased_at)
            ? ocr.purchased_at
            : null,
        store_name:
          typeof ocr.store_name === "string" ? ocr.store_name : "",
        total_amount:
          typeof ocr.total_amount === "number" &&
          Number.isFinite(ocr.total_amount)
            ? Math.max(0, Math.round(ocr.total_amount))
            : null,
        items,
      },
    })
  } catch (error) {
    console.error("Receipt OCR request error:", error)
    return json({ message: "OCR処理中にエラーが発生しました" }, 500)
  }
}
