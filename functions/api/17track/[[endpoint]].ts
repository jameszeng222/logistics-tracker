interface Env {
  TRACK17_API_KEY: string
  ERP_WEBHOOK_SECRET: string
  ORDERS_KV: KVNamespace
}

const TRACK17_BASE = "https://api.17track.net/track/v2.4"
const ALLOWED_ENDPOINTS = [
  "gettrackinfo", "gettracklist", "getquota",
  "getrealtimetrackinfo", "stop", "delete", "retrack",
]

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, 17token, Authorization",
  "Access-Control-Max-Age": "86400",
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(context.request.url)
  const pathParts = url.pathname.replace("/api/17track/", "").split("/")
  let endpoint = pathParts.join("/")

  if (endpoint.startsWith("track/v2.4/")) {
    endpoint = endpoint.replace("track/v2.4/", "")
  }

  if (endpoint === "test") {
    return handleTest(context.env)
  }

  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    return json({ error: `Unknown endpoint: ${endpoint}` }, 400)
  }

  return handleProxy(context.request, context.env, endpoint)
}

async function handleProxy(request: Request, env: Env, endpoint: string): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const clientToken = request.headers.get("17token")
  headers["17token"] = clientToken || env.TRACK17_API_KEY || ""

  let body: string | undefined
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text()
  }

  try {
    const upstream = await fetch(`${TRACK17_BASE}/${endpoint}`, {
      method: request.method,
      headers,
      body,
    })
    const responseBody = await upstream.text()
    return new Response(responseBody, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    })
  } catch (err: any) {
    return json({ code: -1, msg: err.message || "Proxy request failed" }, 502)
  }
}

async function handleTest(env: Env): Promise<Response> {
  const apiKey = env.TRACK17_API_KEY
  if (!apiKey) {
    return json({ success: false, message: "未配置 TRACK17_API_KEY" })
  }

  try {
    const res = await fetch(`${TRACK17_BASE}/getquota`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": apiKey },
      body: "[]",
    })
    const data: any = await res.json()

    if (res.status === 401) {
      return json({ success: false, message: "API密钥无效或未授权" })
    }
    if (data.code === 0) {
      return json({ success: true, message: "连接成功", quota: data.data })
    }
    if (data.data?.errors?.length) {
      const msg = data.data.errors.map((e: any) => e.message).join("; ")
      return json({ success: false, message: msg })
    }
    return json({ success: false, message: `未知响应: code ${data.code}` })
  } catch (err: any) {
    return json({ success: false, message: err.message || "连接失败" })
  }
}
