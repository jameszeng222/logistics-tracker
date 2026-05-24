interface Env {
  DB: D1Database
  TRACK17_API_KEY: string
  ENVIRONMENT: string
}

const TRACK17_BASE = "https://api.17track.net/track/v2.4"
const BATCH_SIZE = 40

const STATUS_17_TO_INTERNAL: Record<string, string> = {
  NotFound: "not_found",
  InfoReceived: "info_received",
  InTransit: "in_transit",
  Expired: "expired",
  AvailableForPickup: "available_for_pickup",
  OutForDelivery: "out_for_delivery",
  DeliveryFailure: "delivery_failure",
  Delivered: "delivered",
  Exception: "exception",
}

const SUB_STATUS_EXCEPTION_TYPES: Record<string, string> = {
  Exception_Returning: "return",
  Exception_Returned: "return",
  Exception_NoBody: "address",
  Exception_Security: "security",
  Exception_Damage: "damaged",
  Exception_Rejected: "return",
  Exception_Delayed: "delayed",
  Exception_Lost: "lost",
  Exception_Destroyed: "destroyed",
  Exception_Cancel: "cancelled",
  DeliveryFailure_NoBody: "address",
  DeliveryFailure_Security: "security",
  DeliveryFailure_Rejected: "return",
  DeliveryFailure_InvalidAddress: "address",
  Expired_Other: "timeout",
}

interface TrackEvent17 {
  time: string
  time_raw: number
  status: string
  sub_status: string
  location: string
  description: string
}

interface TrackProvider {
  provider_key: number
  provider_name: string
  events: TrackEvent17[]
}

interface TrackInfoItem {
  number: string
  carrier: number
  track_info?: {
    shipping_info?: {
      shipper_address?: { country?: string; state?: string; city?: string; postal_code?: string }
      recipient_address?: { country?: string; state?: string; city?: string; postal_code?: string }
    }
    latest_status?: { status: string; sub_status: string }
    latest_event?: TrackEvent17
    tracking?: { providers: TrackProvider[] }
    pickup_time?: string
    destination_country?: string
    origin_country?: string
  }
  latest_status?: { status: string; sub_status: string }
  latest_event?: TrackEvent17
  tracking?: { providers: TrackProvider[] }
  pickup_time?: string
}

interface TrackInfoResponse {
  code: number
  data: {
    accepted?: TrackInfoItem[]
    rejected?: Array<{ number: string; error: { code: number; message: string } }>
    errors?: Array<{ code: number; message: string }>
  }
}

interface PendingOrder {
  tracking_number: string
  carrier_code: number | null
  status: string
}

interface RefreshResult {
  total: number
  refreshed: number
  updated: number
  errors: number
  statusChanges: Array<{ tracking_number: string; old_status: string; new_status: string }>
  errorDetails: Array<{ tracking_number: string; error: string }>
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

async function fetchTrackInfo(
  apiKey: string,
  items: Array<{ number: string; carrier?: number }>
): Promise<TrackInfoResponse> {
  const res = await fetch(`${TRACK17_BASE}/gettrackinfo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "17token": apiKey,
    },
    body: JSON.stringify(items),
  })

  if (res.status === 401) throw new Error("17track API key invalid or unauthorized")
  if (res.status === 429) throw new Error("17track rate limit exceeded")
  if (!res.ok) throw new Error(`17track request failed: HTTP ${res.status}`)

  return res.json() as Promise<TrackInfoResponse>
}

function extractProviderName(item: TrackInfoItem): string {
  const providers = item.track_info?.tracking?.providers || item.tracking?.providers
  if (providers && providers.length > 0) {
    return providers[0].provider_name || ""
  }
  return ""
}

function extractAllEvents(item: TrackInfoItem): TrackEvent17[] {
  const providers = item.track_info?.tracking?.providers || item.tracking?.providers
  if (!providers || providers.length === 0) {
    return []
  }
  const allEvents: TrackEvent17[] = []
  for (const provider of providers) {
    if (provider.events && provider.events.length > 0) {
      allEvents.push(...provider.events)
    }
  }
  allEvents.sort((a, b) => b.time_raw - a.time_raw)
  return allEvents
}

function mapStatus(status17: string): string {
  return STATUS_17_TO_INTERNAL[status17] || "not_found"
}

function getExceptionDescription(subStatus: string): string {
  return SUB_STATUS_EXCEPTION_TYPES[subStatus] || ""
}

function computeActualDays(shipDate: string, deliveryDate: string): number | null {
  if (!shipDate || !deliveryDate) return null
  const start = new Date(shipDate).getTime()
  const end = new Date(deliveryDate).getTime()
  if (isNaN(start) || isNaN(end)) return null
  return Math.round((end - start) / (1000 * 60 * 60 * 24) * 10) / 10
}

function parseTrackItem(item: TrackInfoItem, oldStatus: string): {
  status: string
  sub_status: string
  events: string
  carrier: string
  carrier_code: number
  delivery_date: string
  actual_days: number | null
  ship_date: string
  exception_description: string
  sync_meta: string
  statusChanged: boolean
} {
  const latestStatus = item.track_info?.latest_status || item.latest_status
  const latestEvent = item.track_info?.latest_event || item.latest_event

  const status17 = latestStatus?.status || "NotFound"
  const subStatus17 = latestStatus?.sub_status || ""
  const status = mapStatus(status17)
  const sub_status = subStatus17

  const allEvents = extractAllEvents(item)
  const events = JSON.stringify(
    allEvents.map((e) => ({
      time: e.time,
      status: e.status ? mapStatus(e.status) : "",
      sub_status: e.sub_status || "",
      location: e.location || "",
      description: e.description || "",
    }))
  )

  const carrier = extractProviderName(item)
  const carrier_code = item.carrier || 0

  let delivery_date = ""
  let ship_date = ""

  if (status === "delivered" && latestEvent?.time) {
    delivery_date = latestEvent.time
  }

  const pickupTime = item.track_info?.pickup_time || item.pickup_time
  if (pickupTime) {
    ship_date = pickupTime
  } else if (allEvents.length > 0) {
    const earliest = allEvents[allEvents.length - 1]
    if (earliest && (earliest.status === "InfoReceived" || earliest.sub_status === "InTransit_PickedUp")) {
      ship_date = earliest.time
    }
  }

  const actual_days = computeActualDays(ship_date, delivery_date)

  let exception_description = ""
  if (status === "exception" || status === "delivery_failure" || status === "expired") {
    exception_description = getExceptionDescription(sub_status)
    if (!exception_description && latestEvent?.description) {
      exception_description = latestEvent.description
    }
  }

  const sync_meta = JSON.stringify({
    last_17track_sync: new Date().toISOString(),
    status_17: status17,
    sub_status_17: subStatus17,
  })

  const statusChanged = status !== oldStatus

  return {
    status,
    sub_status,
    events,
    carrier,
    carrier_code,
    delivery_date,
    actual_days,
    ship_date,
    exception_description,
    sync_meta,
    statusChanged,
  }
}

async function refreshOrders(db: D1Database, apiKey: string, limit = 100): Promise<RefreshResult> {
  const result: RefreshResult = {
    total: 0,
    refreshed: 0,
    updated: 0,
    errors: 0,
    statusChanges: [],
    errorDetails: [],
  }

  const rows = await db
    .prepare(
      `SELECT tracking_number, carrier_code, status FROM orders
       WHERE status != 'delivered' AND status != 'not_found'
       ORDER BY updated_at ASC
       LIMIT ?`
    )
    .bind(limit)
    .all<PendingOrder>()

  const orders = rows.results
  result.total = orders.length

  if (orders.length === 0) {
    return result
  }

  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE)

    const apiItems = batch.map((o) => ({
      number: o.tracking_number,
      ...(o.carrier_code ? { carrier: o.carrier_code } : {}),
    }))

    let trackResponse: TrackInfoResponse
    try {
      trackResponse = await fetchTrackInfo(apiKey, apiItems)
    } catch (err: any) {
      for (const o of batch) {
        result.errors++
        result.errorDetails.push({ tracking_number: o.tracking_number, error: err.message })
      }
      continue
    }

    if (trackResponse.code !== 0 && trackResponse.data?.errors?.length) {
      const errMsg = trackResponse.data.errors.map((e) => `${e.code}: ${e.message}`).join("; ")
      for (const o of batch) {
        result.errors++
        result.errorDetails.push({ tracking_number: o.tracking_number, error: errMsg })
      }
      continue
    }

    const rejectedNumbers = new Set(
      (trackResponse.data.rejected || []).map((r) => r.number)
    )

    const acceptedMap = new Map<string, TrackInfoItem>()
    for (const item of trackResponse.data.accepted || []) {
      acceptedMap.set(item.number, item)
    }

    const stmts: D1PreparedStatement[] = []

    for (const order of batch) {
      if (rejectedNumbers.has(order.tracking_number)) {
        result.errors++
        const rejected = trackResponse.data.rejected!.find(
          (r) => r.number === order.tracking_number
        )
        result.errorDetails.push({
          tracking_number: order.tracking_number,
          error: rejected?.error?.message || "Rejected by 17track",
        })
        continue
      }

      const trackItem = acceptedMap.get(order.tracking_number)
      if (!trackItem) {
        result.errors++
        result.errorDetails.push({
          tracking_number: order.tracking_number,
          error: "No tracking data returned",
        })
        continue
      }

      const parsed = parseTrackItem(trackItem, order.status)

      stmts.push(
        db
          .prepare(
            `UPDATE orders SET
              status = ?, sub_status = ?, events = ?, carrier = ?,
              carrier_code = ?, delivery_date = ?, actual_days = ?, ship_date = ?,
              exception_description = ?, sync_meta = ?, updated_at = datetime('now')
            WHERE tracking_number = ?`
          )
          .bind(
            parsed.status,
            parsed.sub_status,
            parsed.events,
            parsed.carrier,
            parsed.carrier_code,
            parsed.delivery_date,
            parsed.actual_days,
            parsed.ship_date,
            parsed.exception_description,
            parsed.sync_meta,
            order.tracking_number
          )
      )

      result.refreshed++

      if (parsed.statusChanged) {
        result.updated++
        result.statusChanges.push({
          tracking_number: order.tracking_number,
          old_status: order.status,
          new_status: parsed.status,
        })
      }
    }

    if (stmts.length > 0) {
      try {
        await db.batch(stmts)
      } catch (err: any) {
        for (const stmt of stmts) {
          result.errors++
        }
        result.errorDetails.push({
          tracking_number: "batch",
          error: `D1 batch update failed: ${err.message}`,
        })
      }
    }
  }

  return result
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[Cron] Starting scheduled refresh at ${new Date().toISOString()}`)

    if (!env.TRACK17_API_KEY) {
      console.error("[Cron] TRACK17_API_KEY not configured, aborting")
      return
    }

    if (!env.DB) {
      console.error("[Cron] D1 database not bound, aborting")
      return
    }

    try {
      const result = await refreshOrders(env.DB, env.TRACK17_API_KEY, 100)

      console.log(
        `[Cron] Refresh complete: total=${result.total}, refreshed=${result.refreshed}, ` +
        `updated=${result.updated}, errors=${result.errors}`
      )

      if (result.statusChanges.length > 0) {
        console.log(`[Cron] Status changes:`)
        for (const change of result.statusChanges) {
          console.log(`  ${change.tracking_number}: ${change.old_status} → ${change.new_status}`)
        }
      }

      if (result.errorDetails.length > 0) {
        console.warn(`[Cron] Errors:`)
        for (const err of result.errorDetails.slice(0, 20)) {
          console.warn(`  ${err.tracking_number}: ${err.error}`)
        }
      }
    } catch (err: any) {
      console.error(`[Cron] Fatal error: ${err.message}`)
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === "/" && request.method === "GET") {
      return jsonResponse({
        worker: "logistics-tracker-cron",
        environment: env.ENVIRONMENT || "unknown",
        cron_schedule: "0 */4 * * *",
        d1_bound: !!env.DB,
        api_key_configured: !!env.TRACK17_API_KEY,
        timestamp: new Date().toISOString(),
      })
    }

    if (path === "/refresh" && request.method === "POST") {
      if (!env.TRACK17_API_KEY) {
        return jsonResponse({ success: false, error: "TRACK17_API_KEY not configured" }, 500)
      }
      if (!env.DB) {
        return jsonResponse({ success: false, error: "D1 database not bound" }, 500)
      }

      const limitParam = url.searchParams.get("limit")
      const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 500) : 100

      try {
        const result = await refreshOrders(env.DB, env.TRACK17_API_KEY, limit)
        return jsonResponse({ success: true, ...result })
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500)
      }
    }

    return jsonResponse({ error: "Not Found" }, 404)
  },
}
