interface ErpOrder {
  orderNo: string
  trackingNumber: string
  carrierCode?: string | number
  createdAt?: string
  shippedAt?: string
  warehouse?: string
  team?: string
}

interface Env {
  TRACK17_API_KEY: string
  ERP_WEBHOOK_SECRET: string
  ORDERS_KV: KVNamespace
}

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

  if (url.pathname.endsWith("/orders/") || url.pathname.split("/").pop()?.includes(".")) {
    return handleSingleOrder(context)
  }

  switch (context.request.method) {
    case "GET":
      return handleListOrders(context.env)
    case "POST":
      return handlePushOrders(context)
    default:
      return json({ error: "Method not allowed" }, 405)
  }
}

async function handlePushOrders(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response> {
  const authHeader = context.request.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")

  if (!token || token !== context.env.ERP_WEBHOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await context.request.json() as { orders: ErpOrder[] }

    if (!body.orders?.length) {
      return json({ error: "No orders provided" }, 400)
    }

    const accepted: string[] = []
    const rejected: Array<{ orderNo: string; reason: string }> = []

    for (const order of body.orders) {
      if (!order.trackingNumber || !order.orderNo) {
        rejected.push({ orderNo: order.orderNo || "unknown", reason: "Missing trackingNumber or orderNo" })
        continue
      }
      await context.env.ORDERS_KV.put(
        `order:${order.trackingNumber}`,
        JSON.stringify({ ...order, updatedAt: new Date().toISOString() }),
      )
      accepted.push(order.trackingNumber)
    }

    return json({ success: true, accepted: accepted.length, rejected })
  } catch (err: any) {
    return json({ error: err.message || "Invalid request body" }, 400)
  }
}

async function handleListOrders(env: Env): Promise<Response> {
  const list = await env.ORDERS_KV.list({ prefix: "order:" })
  const orders = []

  for (const key of list.keys) {
    const value = await env.ORDERS_KV.get(key.name)
    if (value) {
      try { orders.push(JSON.parse(value)) } catch {}
    }
  }

  return json({ orders })
}

async function handleSingleOrder(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response> {
  const url = new URL(context.request.url)
  const parts = url.pathname.split("/")
  const trackingNumber = parts[parts.length - 1] || parts[parts.length - 2]
  const key = `order:${trackingNumber}`

  if (context.request.method === "DELETE") {
    await context.env.ORDERS_KV.delete(key)
    return json({ success: true })
  }

  const value = await context.env.ORDERS_KV.get(key)
  if (!value) {
    return json({ error: "Order not found" }, 404)
  }

  return json({ order: JSON.parse(value) })
}
