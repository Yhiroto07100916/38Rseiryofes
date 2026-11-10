interface SiteConfigResponse {
  site_name?: string
  site_description?: string
  logo_url?: string
}

interface PagesFunctionContext {
  request: Request
  env: {
    API_BASE_URL?: string
  }
}

const FALLBACK_MANIFEST = {
  id: "/",
  name: "38R 星陵祭準備サイト",
  short_name: "38R準備",
  description: "38Rの星陵祭準備を管理するサイトです。",
  lang: "ja",
  start_url: "/",
  scope: "/",
  display: "standalone",
  theme_color: "#123a5c",
  background_color: "#ffffff",
  icons: [
    { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  let manifest = FALLBACK_MANIFEST
  const apiBaseUrl = (context.env.API_BASE_URL || "https://api.38r-seiryofes.com").replace(/\/$/, "")

  try {
    const response = await fetch(`${apiBaseUrl}/api/site-config`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    })
    if (response.ok) {
      const config = await response.json() as SiteConfigResponse
      const name = config.site_name?.trim() || FALLBACK_MANIFEST.name
      manifest = {
        ...FALLBACK_MANIFEST,
        name,
        short_name: Array.from(name).slice(0, 12).join("") || FALLBACK_MANIFEST.short_name,
        description: config.site_description?.trim() || FALLBACK_MANIFEST.description,
        icons: config.logo_url
          ? [
              ...FALLBACK_MANIFEST.icons,
              { src: config.logo_url, sizes: "any", type: "image/png", purpose: "any" },
            ]
          : FALLBACK_MANIFEST.icons,
      }
    }
  } catch {
    // The static fallback keeps PWA installation available while the API is unavailable.
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
