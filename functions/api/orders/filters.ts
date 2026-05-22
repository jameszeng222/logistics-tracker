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

  const db = ctx.env.DB

  try {
    const [countries, carriers, warehouses, teams, statuses] = await Promise.all([
      db.prepare('SELECT DISTINCT destination_country FROM orders WHERE destination_country != "" ORDER BY destination_country').all(),
      db.prepare('SELECT DISTINCT carrier FROM orders WHERE carrier != "" ORDER BY carrier').all(),
      db.prepare('SELECT DISTINCT erp_warehouse FROM orders WHERE erp_warehouse != "" ORDER BY erp_warehouse').all(),
      db.prepare('SELECT DISTINCT erp_team FROM orders WHERE erp_team != "" ORDER BY erp_team').all(),
      db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all(),
    ])

    return Response.json({
      success: true,
      countries: countries.results.map((r: any) => r.destination_country),
      carriers: carriers.results.map((r: any) => r.carrier),
      warehouses: warehouses.results.map((r: any) => r.erp_warehouse),
      teams: teams.results.map((r: any) => r.erp_team),
      statuses,
    }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
