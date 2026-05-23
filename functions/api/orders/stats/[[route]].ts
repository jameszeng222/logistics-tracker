interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

function buildFilters(url: URL): { where: string; params: any[] } {
  const conditions: string[] = []
  const params: any[] = []
  const country = url.searchParams.get('country')
  const carrier = url.searchParams.get('carrier')
  const warehouse = url.searchParams.get('warehouse')
  const team = url.searchParams.get('team')
  const timeField = url.searchParams.get('timeField') || 'erp_shipped_at'
  const timeStart = url.searchParams.get('timeStart')
  const timeEnd = url.searchParams.get('timeEnd')

  if (country) { conditions.push('destination_country = ?'); params.push(country) }
  if (carrier) { conditions.push('carrier = ?'); params.push(carrier) }
  if (warehouse) { conditions.push('erp_warehouse = ?'); params.push(warehouse) }
  if (team) { conditions.push('erp_team = ?'); params.push(team) }
  if (timeStart) { conditions.push(`${timeField} >= ?`); params.push(timeStart) }
  if (timeEnd) { conditions.push(`${timeField} <= ?`); params.push(timeEnd + ' 23:59:59') }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  return { where, params }
}

function appendWhere(base: string, extra: string[]): string {
  if (extra.length === 0) return base
  const clause = extra.join(' AND ')
  return base ? base + ' AND ' + clause : 'WHERE ' + clause
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function handleKpi(db: D1Database, where: string, params: any[]) {
  const row = await db.prepare(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status != 'not_found' THEN 1 ELSE 0 END) as valid,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status IN ('info_received','in_transit','available_for_pickup','out_for_delivery') THEN 1 ELSE 0 END) as in_transit,
      SUM(CASE WHEN status IN ('expired','delivery_failure','exception') THEN 1 ELSE 0 END) as exception,
      AVG(CASE WHEN status = 'delivered' AND actual_days IS NOT NULL THEN actual_days END) as avg_days,
      SUM(CASE WHEN status = 'delivered' AND actual_days IS NOT NULL THEN 1 ELSE 0 END) as sla_total,
      SUM(CASE WHEN status = 'delivered' AND actual_days IS NOT NULL AND actual_days <= sla_days THEN 1 ELSE 0 END) as sla_passed
    FROM orders ${where}`
  ).bind(...params).first()

  const r = row as any
  const valid = r?.valid || 0
  const delivered = r?.delivered || 0
  const slaTotal = r?.sla_total || 0
  const slaPassed = r?.sla_passed || 0

  return {
    totalOrders: r?.total || 0,
    validOrders: valid,
    deliveredOrders: delivered,
    inTransitOrders: r?.in_transit || 0,
    exceptionOrders: r?.exception || 0,
    deliveryRate: valid > 0 ? Math.round((delivered / valid) * 10000) / 10000 : 0,
    avgTransitDays: r?.avg_days ? Math.round(r.avg_days * 10) / 10 : 0,
    slaComplianceRate: slaTotal > 0 ? Math.round((slaPassed / slaTotal) * 10000) / 10000 : 0,
    slaTotal,
    slaPassed,
  }
}

async function handleStatusDistribution(db: D1Database, where: string, params: any[]) {
  const byStatusRows = await db.prepare(
    `SELECT status, COUNT(*) as count FROM orders ${where} GROUP BY status`
  ).bind(...params).all()

  const subWhere = appendWhere(where, ["sub_status != ''"])
  const bySubStatusRows = await db.prepare(
    `SELECT sub_status, COUNT(*) as count FROM orders ${subWhere} GROUP BY sub_status`
  ).bind(...params).all()

  const byStatus: Record<string, number> = {}
  for (const r of byStatusRows.results) byStatus[(r as any).status] = (r as any).count

  const bySubStatus: Record<string, number> = {}
  for (const r of bySubStatusRows.results) bySubStatus[(r as any).sub_status] = (r as any).count

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
  return { byStatus, bySubStatus, total }
}

async function handleByCarrier(db: D1Database, where: string, params: any[]) {
  const rows = await db.prepare(
    `SELECT carrier,
      SUM(CASE WHEN status != 'not_found' THEN 1 ELSE 0 END) as total,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      ROUND(AVG(CASE WHEN status = 'delivered' AND actual_days IS NOT NULL THEN actual_days END), 1) as avg_days,
      SUM(CASE WHEN status = 'delivered' AND actual_days IS NOT NULL THEN 1 ELSE 0 END) as sla_total,
      SUM(CASE WHEN status = 'delivered' AND actual_days IS NOT NULL AND actual_days <= sla_days THEN 1 ELSE 0 END) as sla_passed
    FROM orders ${where} GROUP BY carrier`
  ).bind(...params).all()

  return rows.results.map((r: any) => ({
    carrier: r.carrier,
    total: r.total,
    delivered: r.delivered,
    deliveryRate: r.total > 0 ? Math.round((r.delivered / r.total) * 10000) / 10000 : 0,
    avgDays: r.avg_days || 0,
    slaTotal: r.sla_total || 0,
    slaPassed: r.sla_passed || 0,
    slaRate: (r.sla_total || 0) > 0 ? Math.round((r.sla_passed / r.sla_total) * 10000) / 10000 : 0,
  }))
}

async function handleByCountry(db: D1Database, where: string, params: any[]) {
  const rows = await db.prepare(
    `SELECT destination_country,
      SUM(CASE WHEN status != 'not_found' THEN 1 ELSE 0 END) as total,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      ROUND(AVG(CASE WHEN status = 'delivered' AND actual_days IS NOT NULL THEN actual_days END), 1) as avg_days,
      SUM(CASE WHEN status = 'delivered' AND actual_days IS NOT NULL THEN 1 ELSE 0 END) as sla_total,
      SUM(CASE WHEN status = 'delivered' AND actual_days IS NOT NULL AND actual_days <= sla_days THEN 1 ELSE 0 END) as sla_passed
    FROM orders ${where} GROUP BY destination_country ORDER BY total DESC`
  ).bind(...params).all()

  return rows.results.map((r: any) => ({
    country: r.destination_country,
    total: r.total,
    delivered: r.delivered,
    deliveryRate: r.total > 0 ? Math.round((r.delivered / r.total) * 10000) / 10000 : 0,
    avgDays: r.avg_days || 0,
    slaTotal: r.sla_total || 0,
    slaPassed: r.sla_passed || 0,
    slaRate: (r.sla_total || 0) > 0 ? Math.round((r.sla_passed / r.sla_total) * 10000) / 10000 : 0,
  }))
}

async function handleP90Matrix(db: D1Database, where: string, params: any[]) {
  const extra = ["status = 'delivered'", 'actual_days IS NOT NULL']
  const fullWhere = appendWhere(where, extra)

  const rows = await db.prepare(
    `SELECT carrier, destination_country, actual_days, sla_days
    FROM orders ${fullWhere}
    ORDER BY carrier, destination_country, actual_days`
  ).bind(...params).all()

  const groupDays: Record<string, Record<string, number[]>> = {}
  const groupSla: Record<string, Record<string, number>> = {}
  const carrierSet = new Set<string>()
  const countrySet = new Set<string>()

  for (const r of rows.results) {
    const row = r as any
    const c = row.carrier
    const co = row.destination_country
    carrierSet.add(c)
    countrySet.add(co)
    if (!groupDays[c]) groupDays[c] = {}
    if (!groupDays[c][co]) groupDays[c][co] = []
    groupDays[c][co].push(row.actual_days)
    if (!groupSla[c]) groupSla[c] = {}
    if (groupSla[c][co] === undefined) groupSla[c][co] = row.sla_days
  }

  const carrierList = Array.from(carrierSet).sort()
  const countryList = Array.from(countrySet).sort()

  const matrix: Record<string, Record<string, { p90: number; slaDays: number | null; passed: boolean | null; count: number }>> = {}
  for (const carrier of carrierList) {
    matrix[carrier] = {}
    for (const country of countryList) {
      const daysArr = groupDays[carrier]?.[country] || []
      const p90 = percentile(daysArr, 90)
      const slaDays = groupSla[carrier]?.[country] ?? null
      matrix[carrier][country] = {
        p90,
        slaDays,
        passed: slaDays ? p90 <= slaDays : null,
        count: daysArr.length,
      }
    }
  }

  return { carrierList, countryList, matrix }
}

async function handleTransitDistribution(db: D1Database, where: string, params: any[]) {
  const extra = ["status = 'delivered'", 'actual_days IS NOT NULL']
  const fullWhere = appendWhere(where, extra)

  const rows = await db.prepare(
    `SELECT destination_country,
      COUNT(*) as total,
      SUM(CASE WHEN actual_days <= 2 THEN 1 ELSE 0 END) as le2,
      SUM(CASE WHEN actual_days = 3 THEN 1 ELSE 0 END) as d3,
      SUM(CASE WHEN actual_days >= 4 AND actual_days <= 5 THEN 1 ELSE 0 END) as d4_5,
      SUM(CASE WHEN actual_days >= 6 AND actual_days <= 7 THEN 1 ELSE 0 END) as d6_7,
      SUM(CASE WHEN actual_days >= 8 AND actual_days <= 10 THEN 1 ELSE 0 END) as d8_10,
      SUM(CASE WHEN actual_days > 10 THEN 1 ELSE 0 END) as gt10
    FROM orders ${fullWhere}
    GROUP BY destination_country
    ORDER BY total DESC`
  ).bind(...params).all()

  return rows.results.map((r: any) => {
    const total = r.total || 0
    const pct = (v: number) => total > 0 ? Math.round(v / total * 1000) / 10 : 0
    return {
      country: r.destination_country,
      le2: { count: r.le2 || 0, pct: pct(r.le2 || 0) },
      d3: { count: r.d3 || 0, pct: pct(r.d3 || 0) },
      d4_5: { count: r.d4_5 || 0, pct: pct(r.d4_5 || 0) },
      d6_7: { count: r.d6_7 || 0, pct: pct(r.d6_7 || 0) },
      d8_10: { count: r.d8_10 || 0, pct: pct(r.d8_10 || 0) },
      gt10: { count: r.gt10 || 0, pct: pct(r.gt10 || 0) },
      total,
    }
  })
}

async function handleSlaTrend(db: D1Database, where: string, params: any[]) {
  const extra = ["status = 'delivered'", 'actual_days IS NOT NULL', "erp_shipped_at != ''"]
  const fullWhere = appendWhere(where, extra)

  const rows = await db.prepare(
    `SELECT strftime('%Y-%m', erp_shipped_at) as month,
      COUNT(*) as total,
      SUM(CASE WHEN actual_days <= sla_days THEN 1 ELSE 0 END) as passed
    FROM orders ${fullWhere}
    GROUP BY month
    ORDER BY month`
  ).bind(...params).all()

  return rows.results.map((r: any) => ({
    month: r.month,
    rate: r.total > 0 ? Number(((r.passed / r.total) * 100).toFixed(1)) : 0,
    total: r.total,
    passed: r.passed,
  }))
}

async function handleCarrierP90(db: D1Database, where: string, params: any[]) {
  const extra = ["status = 'delivered'", 'actual_days IS NOT NULL']
  const fullWhere = appendWhere(where, extra)

  const rows = await db.prepare(
    `SELECT carrier, actual_days, sla_days
    FROM orders ${fullWhere}
    ORDER BY carrier, actual_days`
  ).bind(...params).all()

  const groupDays: Record<string, number[]> = {}
  const groupSla: Record<string, number> = {}

  for (const r of rows.results) {
    const row = r as any
    if (!groupDays[row.carrier]) groupDays[row.carrier] = []
    groupDays[row.carrier].push(row.actual_days)
    if (groupSla[row.carrier] === undefined) groupSla[row.carrier] = row.sla_days
  }

  return Object.entries(groupDays).map(([carrier, days]) => ({
    carrier,
    p90: percentile(days, 90),
    avg: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
    slaDays: groupSla[carrier] || null,
    count: days.length,
  })).sort((a, b) => b.count - a.count)
}

async function handleMonitoringAlerts(db: D1Database, url: URL, body: any) {
  const rules: any[] = body?.rules || []
  const keywordRules: any[] = body?.keywordRules || []
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const conditions: string[] = []
  const params: any[] = []
  const country = url.searchParams.get('country')
  const carrier = url.searchParams.get('carrier')

  if (country) { conditions.push('destination_country = ?'); params.push(country) }
  if (carrier) { conditions.push('carrier = ?'); params.push(carrier) }
  const baseAnd = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''

  const alertMap = new Map<string, any>()
  const alertCounts = { not_shipped: 0, not_online: 0, not_delivered: 0, keyword: 0 }

  const enabledRules = rules.filter((r: any) => r.enabled)

  for (const rule of enabledRules) {
    const ruleConds = [...conditions]
    const ruleParams = [...params]

    if (rule.country && rule.country !== '*') {
      ruleConds.push('destination_country = ?')
      ruleParams.push(rule.country)
    }
    const ruleAnd = ruleConds.length > 0 ? 'AND ' + ruleConds.join(' AND ') : ''

    if (rule.type === 'not_shipped') {
      const rows = await db.prepare(
        `SELECT id, order_id, tracking_number, carrier, destination_country, status,
          erp_warehouse, erp_team, erp_created_at, erp_checkout_time, events
        FROM orders
        WHERE (erp_checkout_time = '' OR erp_checkout_time IS NULL) AND erp_created_at != '' AND erp_created_at IS NOT NULL
        AND (julianday('now') - julianday(erp_created_at)) * 24 > ?
        ${ruleAnd}
        ORDER BY erp_created_at DESC
        LIMIT 500`
      ).bind(rule.hoursThreshold, ...ruleParams).all()

      for (const r of rows.results) {
        const row = r as any
        alertCounts.not_shipped++
        addAlert(alertMap, row, rule.name, 'not_shipped')
      }
    } else if (rule.type === 'not_delivered') {
      const rows = await db.prepare(
        `SELECT id, order_id, tracking_number, carrier, destination_country, status,
          erp_warehouse, erp_team, erp_created_at, erp_checkout_time, events
        FROM orders
        WHERE erp_checkout_time != '' AND erp_checkout_time IS NOT NULL AND status != 'delivered'
        AND (julianday('now') - julianday(erp_checkout_time)) * 24 > ?
        ${ruleAnd}
        ORDER BY erp_checkout_time DESC
        LIMIT 500`
      ).bind(rule.hoursThreshold, ...ruleParams).all()

      for (const r of rows.results) {
        const row = r as any
        alertCounts.not_delivered++
        addAlert(alertMap, row, rule.name, 'not_delivered')
      }
    } else if (rule.type === 'not_online') {
      const rows = await db.prepare(
        `SELECT id, order_id, tracking_number, carrier, destination_country, status,
          erp_warehouse, erp_team, erp_created_at, erp_checkout_time, events
        FROM orders
        WHERE erp_checkout_time != '' AND erp_checkout_time IS NOT NULL AND status != 'delivered'
        AND (julianday('now') - julianday(erp_checkout_time)) * 24 > ?
        ${ruleAnd}
        ORDER BY erp_checkout_time DESC
        LIMIT 500`
      ).bind(rule.hoursThreshold, ...ruleParams).all()

      const onlineKeywords = getKeywordsForStatus(keywordRules, 'online')
      for (const r of rows.results) {
        const row = r as any
        let events: any[] = []
        try { events = JSON.parse(row.events || '[]') } catch {}
        const hasOnline = onlineKeywords.length === 0
          ? false
          : events.some((e: any) =>
              onlineKeywords.some((kw: string) =>
                (e.description || '').toLowerCase().includes(kw.toLowerCase())
              )
            )
        if (!hasOnline) {
          alertCounts.not_online++
          addAlert(alertMap, row, rule.name, 'not_online')
        }
      }
    } else if (rule.type === 'keyword') {
      const rows = await db.prepare(
        `SELECT id, order_id, tracking_number, carrier, destination_country, status,
          erp_warehouse, erp_team, erp_created_at, erp_checkout_time, events
        FROM orders
        WHERE 1=1 ${ruleAnd}
        ORDER BY updated_at DESC
        LIMIT 500`
      ).bind(...ruleParams).all()

      const keywords = rule.keywords || []
      const matchMode = rule.matchMode || 'any'
      for (const r of rows.results) {
        const row = r as any
        let events: any[] = []
        try { events = JSON.parse(row.events || '[]') } catch {}
        const matches = keywords.map((kw: string) =>
          events.some((e: any) => (e.description || '').toLowerCase().includes(kw.toLowerCase()))
        )
        const matched = matchMode === 'all' ? matches.every(Boolean) : matches.some(Boolean)
        if (matched) {
          alertCounts.keyword++
          addAlert(alertMap, row, rule.name, 'keyword')
        }
      }
    }
  }

  const allAlerts = Array.from(alertMap.values())
  const total = allAlerts.length
  const paged = allAlerts.slice(offset, offset + limit)

  return { alerts: paged, total, counts: alertCounts }
}

function addAlert(map: Map<string, any>, row: any, ruleName: string, alertType: string) {
  const existing = map.get(row.order_id)
  if (existing) {
    if (!existing.ruleNames.includes(ruleName)) existing.ruleNames.push(ruleName)
    if (!existing.alertTypes.includes(alertType)) existing.alertTypes.push(alertType)
  } else {
    map.set(row.order_id, {
      orderId: row.order_id,
      trackingNumber: row.tracking_number,
      carrier: row.carrier,
      destinationCountry: row.destination_country,
      warehouse: row.erp_warehouse || '',
      team: row.erp_team || '',
      status: row.status,
      createdAt: row.erp_created_at || '',
      checkoutTime: row.erp_checkout_time || '',
      ruleNames: [ruleName],
      alertTypes: [alertType],
    })
  }
}

function getKeywordsForStatus(keywordRules: any[], statusKey: string): string[] {
  const defaultOnlineKeywords = ['pick up', 'picked up', 'collected', 'received by carrier', 'accepted']
  if (!keywordRules || keywordRules.length === 0) return defaultOnlineKeywords
  const rule = keywordRules.find((r: any) => r.statusKey === statusKey && r.enabled)
  if (rule && rule.keywords && rule.keywords.length > 0) return rule.keywords
  return defaultOnlineKeywords
}

export const onRequest = [async (ctx: EventContext<Env, string, Record<string, unknown>>) => {
  const url = new URL(ctx.request.url)
  const method = ctx.request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (!ctx.env.DB) {
    return Response.json({ success: false, error: 'D1 database not bound' }, { status: 500, headers: corsHeaders })
  }

  const db = ctx.env.DB
  const path = url.pathname.replace('/api/orders/stats/', '').replace(/\/$/, '')

  try {
    if (path === 'monitoring-alerts') {
      const body = method === 'POST' ? await ctx.request.json() : {}
      const result = await handleMonitoringAlerts(db, url, body)
      return Response.json({ success: true, ...result }, { headers: corsHeaders })
    }

    const { where, params } = buildFilters(url)

    let result: any
    switch (path) {
      case 'kpi':
        result = await handleKpi(db, where, params)
        break
      case 'status-distribution':
        result = await handleStatusDistribution(db, where, params)
        break
      case 'by-carrier':
        result = await handleByCarrier(db, where, params)
        break
      case 'by-country':
        result = await handleByCountry(db, where, params)
        break
      case 'p90-matrix':
        result = await handleP90Matrix(db, where, params)
        break
      case 'transit-distribution':
        result = await handleTransitDistribution(db, where, params)
        break
      case 'sla-trend':
        result = await handleSlaTrend(db, where, params)
        break
      case 'carrier-p90':
        result = await handleCarrierP90(db, where, params)
        break
      default:
        return Response.json({ success: false, error: 'Unknown stats type: ' + path }, { status: 404, headers: corsHeaders })
    }

    return Response.json({ success: true, data: result }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
