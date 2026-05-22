interface Env {
  DB: D1Database
}

export const onRequest = [async (ctx: EventContext<Env, string, Record<string, unknown>>) => {
  const method = ctx.request.method
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (!ctx.env.DB) {
    return Response.json({ success: false, error: 'D1 database not bound' }, { status: 500, headers: corsHeaders })
  }

  const db = ctx.env.DB

  try {
    let totalDeleted = 0
    for (let attempt = 0; attempt < 20; attempt++) {
      const result = await db.prepare(
        'DELETE FROM orders WHERE rowid IN (SELECT rowid FROM orders LIMIT 10000)'
      ).run()
      const changes = result.meta?.changes || 0
      totalDeleted += changes
      if (changes === 0) break
    }

    const check = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
    const remaining = (check as any)?.total || 0

    if (remaining > 0) {
      for (let attempt = 0; attempt < 10; attempt++) {
        await db.prepare(
          'DELETE FROM orders WHERE rowid IN (SELECT rowid FROM orders LIMIT 10000)'
        ).run()
        const recheck = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
        if ((recheck as any)?.total === 0) break
      }
    }

    const finalCheck = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
    const finalRemaining = (finalCheck as any)?.total || 0

    return Response.json({
      success: finalRemaining === 0,
      deleted: totalDeleted,
      remaining: finalRemaining,
      message: finalRemaining === 0
        ? `Successfully deleted ${totalDeleted} orders`
        : `Deleted ${totalDeleted} orders, ${finalRemaining} remaining`,
    }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message, deleted: 0 }, { status: 500, headers: corsHeaders })
  }
}]
