interface Env {
  DB: D1Database
}

const MIGRATIONS: Array<{ column: string; sql: string }> = [
  { column: 'erp_warehouse_code', sql: "ALTER TABLE orders ADD COLUMN erp_warehouse_code TEXT DEFAULT ''" },
  { column: 'erp_platform', sql: "ALTER TABLE orders ADD COLUMN erp_platform TEXT DEFAULT ''" },
  { column: 'erp_shipping_qty', sql: 'ALTER TABLE orders ADD COLUMN erp_shipping_qty INTEGER DEFAULT 0' },
  { column: 'erp_payment_time', sql: "ALTER TABLE orders ADD COLUMN erp_payment_time TEXT DEFAULT ''" },
  { column: 'erp_packing_time', sql: "ALTER TABLE orders ADD COLUMN erp_packing_time TEXT DEFAULT ''" },
  { column: 'erp_checkout_time', sql: "ALTER TABLE orders ADD COLUMN erp_checkout_time TEXT DEFAULT ''" },
  { column: 'erp_logistics_provider', sql: "ALTER TABLE orders ADD COLUMN erp_logistics_provider TEXT DEFAULT ''" },
  { column: 'erp_logistics_provider_display', sql: "ALTER TABLE orders ADD COLUMN erp_logistics_provider_display TEXT DEFAULT ''" },
  { column: 'erp_current_channel', sql: "ALTER TABLE orders ADD COLUMN erp_current_channel TEXT DEFAULT ''" },
  { column: 'erp_order_no', sql: "ALTER TABLE orders ADD COLUMN erp_order_no TEXT DEFAULT ''" },
  { column: 'erp_created_at', sql: "ALTER TABLE orders ADD COLUMN erp_created_at TEXT DEFAULT ''" },
  { column: 'erp_shipped_at', sql: "ALTER TABLE orders ADD COLUMN erp_shipped_at TEXT DEFAULT ''" },
  { column: 'erp_warehouse', sql: "ALTER TABLE orders ADD COLUMN erp_warehouse TEXT DEFAULT ''" },
  { column: 'erp_team', sql: "ALTER TABLE orders ADD COLUMN erp_team TEXT DEFAULT ''" },
  { column: 'sub_status', sql: "ALTER TABLE orders ADD COLUMN sub_status TEXT DEFAULT ''" },
  { column: 'carrier_code', sql: 'ALTER TABLE orders ADD COLUMN carrier_code INTEGER' },
  { column: 'exception_description', sql: "ALTER TABLE orders ADD COLUMN exception_description TEXT DEFAULT ''" },
]

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number)',
  'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
  'CREATE INDEX IF NOT EXISTS idx_orders_sub_status ON orders(sub_status)',
  'CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(destination_country)',
  'CREATE INDEX IF NOT EXISTS idx_orders_carrier ON orders(carrier)',
  'CREATE INDEX IF NOT EXISTS idx_orders_warehouse ON orders(erp_warehouse)',
  'CREATE INDEX IF NOT EXISTS idx_orders_team ON orders(erp_team)',
  'CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON orders(erp_shipped_at)',
  'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(erp_created_at)',
  'CREATE INDEX IF NOT EXISTS idx_orders_erp_order_no ON orders(erp_order_no)',
  'CREATE INDEX IF NOT EXISTS idx_orders_logistics_provider ON orders(erp_logistics_provider)',
  'CREATE INDEX IF NOT EXISTS idx_orders_current_channel ON orders(erp_current_channel)',
]

export const onRequest = [async (ctx: EventContext<Env, string, Record<string, unknown>>) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const tableInfo = await db.prepare("PRAGMA table_info(orders)").all()
    const existingColumns = new Set(tableInfo.results.map((r: any) => r.name))

    const added: string[] = []
    const skipped: string[] = []
    const failed: string[] = []

    for (const migration of MIGRATIONS) {
      if (existingColumns.has(migration.column)) {
        skipped.push(migration.column)
      } else {
        try {
          await db.prepare(migration.sql).run()
          added.push(migration.column)
        } catch (err: any) {
          failed.push(`${migration.column}: ${err.message}`)
        }
      }
    }

    for (const indexSql of INDEXES) {
      try {
        await db.prepare(indexSql).run()
      } catch {}
    }

    return Response.json({
      success: true,
      added,
      skipped,
      failed: failed.length > 0 ? failed : undefined,
      existingColumns: Array.from(existingColumns),
    }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
