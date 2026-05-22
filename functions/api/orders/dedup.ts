interface Env {
  DB: D1Database
}

export const onRequest = [async (ctx: EventContext<Env, string, Record<string, unknown>>) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (!ctx.env.DB) {
    return Response.json({ success: false, error: 'D1 not bound' }, { status: 500, headers: corsHeaders })
  }

  const db = ctx.env.DB

  try {
    let deletedOldFormat = 0

    const oldPrefixes = ['ERP-', '17T-']
    for (const prefix of oldPrefixes) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const result = await db.prepare(
          `DELETE FROM orders WHERE rowid IN (SELECT rowid FROM orders WHERE id LIKE ? LIMIT 5000)`
        ).bind(`${prefix}%`).run()
        const changes = result.meta?.changes || 0
        deletedOldFormat += changes
        if (changes === 0) break
      }
    }

    const dupResult = await db.prepare(`
      SELECT tracking_number, COUNT(*) as cnt
      FROM orders
      WHERE tracking_number != ''
      GROUP BY tracking_number
      HAVING cnt > 1
      LIMIT 100
    `).all()

    let deletedDuplicates = 0
    if (dupResult.results.length > 0) {
      for (const dup of dupResult.results) {
        const tn = (dup as any).tracking_number
        const rows = await db.prepare(
          'SELECT id, rowid FROM orders WHERE tracking_number = ? ORDER BY updated_at DESC'
        ).bind(tn).all()
        if (rows.results.length > 1) {
          const keepId = (rows.results[0] as any).id
          const delResult = await db.prepare(
            'DELETE FROM orders WHERE tracking_number = ? AND id != ?'
          ).bind(tn, keepId).run()
          deletedDuplicates += delResult.meta?.changes || 0
        }
      }
    }

    const countResult = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
    const totalInDb = (countResult as any)?.total || 0

    return Response.json({
      success: true,
      deletedOldFormat,
      deletedDuplicates,
      totalInDb,
    }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
