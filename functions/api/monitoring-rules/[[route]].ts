interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

const DEFAULT_RULES = [
  { id: 'mr_1', name: '超时未上网', type: 'not_online', enabled: 1, country: '*', primary_carrier_id: '*', secondary_channel_id: '*', hours_threshold: 120, time_base: 'shippedAt', keywords: '[]', match_mode: 'any' },
  { id: 'mr_2', name: '超时未妥投', type: 'not_delivered', enabled: 1, country: '*', primary_carrier_id: '*', secondary_channel_id: '*', hours_threshold: 720, time_base: 'shippedAt', keywords: '[]', match_mode: 'any' },
  { id: 'mr_6', name: '超时未出库', type: 'not_shipped', enabled: 1, country: '*', primary_carrier_id: '*', secondary_channel_id: '*', hours_threshold: 48, time_base: 'createdAt', keywords: '[]', match_mode: 'any' },
  { id: 'mr_3', name: '扣留监控', type: 'keyword', enabled: 1, country: '*', primary_carrier_id: '*', secondary_channel_id: '*', hours_threshold: 0, time_base: 'shippedAt', keywords: '["扣留","海关扣留","detained","seized","customs hold"]', match_mode: 'any' },
  { id: 'mr_4', name: '退回监控', type: 'keyword', enabled: 1, country: '*', primary_carrier_id: '*', secondary_channel_id: '*', hours_threshold: 0, time_base: 'shippedAt', keywords: '["退回","退件","return","returned","sending back"]', match_mode: 'any' },
  { id: 'mr_5', name: '损坏监控', type: 'keyword', enabled: 1, country: '*', primary_carrier_id: '*', secondary_channel_id: '*', hours_threshold: 0, time_base: 'shippedAt', keywords: '["损坏","破损","damaged","broken"]', match_mode: 'any' },
]

async function seedDefaults(db: D1Database) {
  const stmts = [
    db.prepare('DELETE FROM monitoring_rules'),
    ...DEFAULT_RULES.map((r) =>
      db.prepare(
        `INSERT INTO monitoring_rules (id, name, type, enabled, country, primary_carrier_id, secondary_channel_id, hours_threshold, time_base, keywords, match_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(r.id, r.name, r.type, r.enabled, r.country, r.primary_carrier_id, r.secondary_channel_id, r.hours_threshold, r.time_base, r.keywords, r.match_mode)
    ),
  ]
  await db.batch(stmts)
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
  const path = url.pathname.replace('/api/monitoring-rules/', '').replace(/\/$/, '')

  try {
    if (method === 'GET') {
      await db.prepare(`CREATE TABLE IF NOT EXISTS monitoring_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        country TEXT DEFAULT '*',
        primary_carrier_id TEXT DEFAULT '*',
        secondary_channel_id TEXT DEFAULT '*',
        hours_threshold INTEGER DEFAULT 0,
        time_base TEXT DEFAULT 'shippedAt',
        keywords TEXT DEFAULT '[]',
        match_mode TEXT DEFAULT 'any',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`).run()
      const rows = await db.prepare('SELECT * FROM monitoring_rules ORDER BY id').all()
      if (rows.results.length === 0) {
        await seedDefaults(db)
        const seeded = await db.prepare('SELECT * FROM monitoring_rules ORDER BY id').all()
        return Response.json({ success: true, rules: seeded.results }, { headers: corsHeaders })
      }
      return Response.json({ success: true, rules: rows.results }, { headers: corsHeaders })
    }

    if (method === 'POST' && path === 'reset') {
      await seedDefaults(db)
      const rows = await db.prepare('SELECT * FROM monitoring_rules ORDER BY id').all()
      return Response.json({ success: true, rules: rows.results }, { headers: corsHeaders })
    }

    if (method === 'POST') {
      await db.prepare(`CREATE TABLE IF NOT EXISTS monitoring_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        country TEXT DEFAULT '*',
        primary_carrier_id TEXT DEFAULT '*',
        secondary_channel_id TEXT DEFAULT '*',
        hours_threshold INTEGER DEFAULT 0,
        time_base TEXT DEFAULT 'shippedAt',
        keywords TEXT DEFAULT '[]',
        match_mode TEXT DEFAULT 'any',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`).run()
      const body = await ctx.request.json() as { rules: any[] }
      const rules = body.rules || []
      const stmts = [
        db.prepare('DELETE FROM monitoring_rules'),
        ...rules.map((r: any) =>
          db.prepare(
            `INSERT INTO monitoring_rules (id, name, type, enabled, country, primary_carrier_id, secondary_channel_id, hours_threshold, time_base, keywords, match_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(r.id, r.name, r.type, r.enabled, r.country, r.primary_carrier_id, r.secondary_channel_id, r.hours_threshold, r.time_base, r.keywords, r.match_mode)
        ),
      ]
      await db.batch(stmts)
      return Response.json({ success: true }, { headers: corsHeaders })
    }

    return Response.json({ success: false, error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
