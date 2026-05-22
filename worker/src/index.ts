import { withCors, corsPreflightResponse } from "./cors";
import { saveOrder, getOrder, listOrders, deleteOrder, saveBatch } from "./kv";
import type { Env, ErpOrder, ErpWebhookPayload } from "./types";

const TRACK17_BASE = "https://api.17track.net/track/v2.4";
const ALLOWED_ENDPOINTS = [
  "gettrackinfo",
  "gettracklist",
  "getquota",
  "getrealtimetrackinfo",
  "stop",
  "delete",
  "retrack",
];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handle17trackProxy(request: Request, env: Env, endpoint: string): Promise<Response> {
  if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
    return jsonResponse({ error: `Unknown endpoint: ${endpoint}` }, 400);
  }

  const url = `${TRACK17_BASE}/${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const clientToken = request.headers.get("17token");
  headers["17token"] = clientToken || env.TRACK17_API_KEY || "";

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
    });

    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return jsonResponse({ code: -1, msg: err.message || "Proxy request failed" }, 502);
  }
}

async function handle17trackTest(env: Env): Promise<Response> {
  const apiKey = env.TRACK17_API_KEY;
  if (!apiKey) {
    return jsonResponse({ success: false, message: "Worker 未配置 TRACK17_API_KEY" });
  }

  try {
    const res = await fetch(`${TRACK17_BASE}/getquota`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": apiKey },
      body: "[]",
    });

    const data: any = await res.json();

    if (res.status === 401) {
      return jsonResponse({ success: false, message: "API密钥无效或未授权" });
    }

    if (data.code === 0) {
      return jsonResponse({ success: true, message: "连接成功", quota: data.data });
    }

    if (data.data?.errors?.length) {
      const msg = data.data.errors.map((e: any) => e.message).join("; ");
      return jsonResponse({ success: false, message: msg });
    }

    return jsonResponse({ success: false, message: `未知响应: code ${data.code}` });
  } catch (err: any) {
    return jsonResponse({ success: false, message: err.message || "连接失败" });
  }
}

async function handleErpPost(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== env.ERP_WEBHOOK_SECRET) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: ErpWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!payload.orders || !Array.isArray(payload.orders)) {
    return jsonResponse({ error: "Missing or invalid orders array" }, 400);
  }

  const accepted: ErpOrder[] = [];
  const rejected: { orderNo: string; reason: string }[] = [];

  for (const order of payload.orders) {
    if (!order.orderNo || !order.trackingNumber) {
      rejected.push({ orderNo: order.orderNo || "", reason: "Missing orderNo or trackingNumber" });
      continue;
    }
    accepted.push(order);
  }

  if (accepted.length > 0) {
    await saveBatch(env.ORDERS_KV, accepted);
  }

  return jsonResponse({ success: true, accepted: accepted.length, rejected });
}

async function handleErpGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const result = await listOrders(env.ORDERS_KV, { status });
  return jsonResponse({ orders: result.orders });
}

async function handleErpDelete(env: Env, trackingNumber: string): Promise<Response> {
  const deleted = await deleteOrder(env.ORDERS_KV, trackingNumber);
  if (!deleted) {
    return jsonResponse({ error: "Order not found" }, 404);
  }
  return jsonResponse({ success: true });
}

function handleHealth(): Response {
  return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return corsPreflightResponse();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    let response: Response;

    if (path === "/api/17track/test") {
      response = await handle17trackTest(env);
    } else if (path.startsWith("/api/17track/")) {
      let endpoint = path.replace("/api/17track/", "");
      if (endpoint.startsWith("track/v2.4/")) {
        endpoint = endpoint.replace("track/v2.4/", "");
      }
      response = await handle17trackProxy(request, env, endpoint);
    } else if (path === "/api/erp/orders" && request.method === "POST") {
      response = await handleErpPost(request, env);
    } else if (path === "/api/erp/orders" && request.method === "GET") {
      response = await handleErpGet(request, env);
    } else if (path.startsWith("/api/erp/orders/") && request.method === "DELETE") {
      const trackingNumber = decodeURIComponent(path.replace("/api/erp/orders/", ""));
      response = await handleErpDelete(env, trackingNumber);
    } else if (path === "/api/health") {
      response = handleHealth();
    } else {
      response = jsonResponse({ error: "Not Found" }, 404);
    }

    return withCors(response);
  },
};
