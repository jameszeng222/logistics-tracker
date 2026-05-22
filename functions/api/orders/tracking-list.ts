interface Env {
  DB: D1Database
}

export const onRequest = [async (ctx: EventContext<Env, string, Record<string, unknown>>) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (!ctx.env.DB) {
    return Response.json({ success: false, error: 'D1 database not bound' }, { status: 500, headers: corsHeaders })
  }

  try {
    const rows = await ctx.env.DB.prepare(
      `SELECT tracking_number, carrier_code FROM orders WHERE tracking_number != '' ORDER BY updated_at DESC`
    ).all()
    const items = rows.results.map((r: any) => ({
      trackingNumber: r.tracking_number,
      carrierCode: r.carrier_code,
    }))
    return Response.json({ success: true, items }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
