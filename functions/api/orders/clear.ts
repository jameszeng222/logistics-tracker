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
    await db.prepare('DELETE FROM orders').run()

    const check = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
    const remaining = (check as any)?.total || 0

    if (remaining > 0) {
      await db.prepare('DELETE FROM orders').run()
    }

    const finalCheck = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
    const finalRemaining = (finalCheck as any)?.total || 0

    return Response.json({
      success: true,
      message: finalRemaining === 0 ? 'All orders cleared' : `${finalRemaining} orders could not be deleted`,
      remaining: finalRemaining,
    }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
