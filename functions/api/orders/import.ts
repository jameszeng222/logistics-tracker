interface Env {
  DB: D1Database
}

const UPSERT_SQL = `INSERT INTO orders (
  id, order_id, tracking_number, carrier, destination_country,
  ship_date, erp_order_no, erp_created_at, erp_shipped_at,
  erp_warehouse, erp_warehouse_code, erp_platform, erp_shipping_qty,
  erp_payment_time, erp_packing_time, erp_checkout_time,
  erp_logistics_provider, erp_logistics_provider_display, erp_current_channel,
  status, sync_meta, events, updated_at
) VALUES (
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?,
  'not_found', '{}', '[]', datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  tracking_number = excluded.tracking_number,
  carrier = excluded.carrier,
  destination_country = excluded.destination_country,
  ship_date = excluded.ship_date,
  erp_order_no = excluded.erp_order_no,
  erp_created_at = excluded.erp_created_at,
  erp_shipped_at = excluded.erp_shipped_at,
  erp_warehouse = excluded.erp_warehouse,
  erp_warehouse_code = excluded.erp_warehouse_code,
  erp_platform = excluded.erp_platform,
  erp_shipping_qty = excluded.erp_shipping_qty,
  erp_payment_time = excluded.erp_payment_time,
  erp_packing_time = excluded.erp_packing_time,
  erp_checkout_time = excluded.erp_checkout_time,
  erp_logistics_provider = excluded.erp_logistics_provider,
  erp_logistics_provider_display = excluded.erp_logistics_provider_display,
  erp_current_channel = excluded.erp_current_channel,
  updated_at = datetime('now')`

function buildStmt(db: D1Database, r: Record<string, string>) {
  const orderNo = String(r.orderNo || '').trim()
  const trackingNumber = String(r.trackingNumber || '').trim()
  const id = `TN-${trackingNumber}`
  return db.prepare(UPSERT_SQL).bind(
    id,
    id,
    trackingNumber,
    String(r.logisticsProvider || '').trim(),
    String(r.destinationCountry || '').trim(),
    String(r.checkoutTime || '').trim(),
    orderNo,
    String(r.createdAt || '').trim(),
    String(r.checkoutTime || '').trim(),
    String(r.warehouseCode || '').trim(),
    String(r.warehouseCode || '').trim(),
    String(r.platform || '').trim(),
    Number(r.shippingQty) || 0,
    String(r.paymentTime || '').trim(),
    String(r.packingTime || '').trim(),
    String(r.checkoutTime || '').trim(),
    String(r.logisticsProvider || '').trim(),
    String(r.logisticsProviderDisplayName || '').trim(),
    String(r.currentChannel || '').trim(),
  )
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
    const tableInfo = await db.prepare("PRAGMA table_info(orders)").all()
    const existingColumns = new Set(tableInfo.results.map((r: any) => r.name))
    const requiredColumns = [
      'erp_warehouse_code', 'erp_platform', 'erp_shipping_qty', 'erp_payment_time',
      'erp_packing_time', 'erp_checkout_time', 'erp_logistics_provider',
      'erp_logistics_provider_display', 'erp_current_channel', 'erp_order_no',
      'erp_created_at', 'erp_shipped_at', 'erp_warehouse', 'erp_team', 'sub_status',
    ]
    for (const col of requiredColumns) {
      if (!existingColumns.has(col)) {
        const colType = col === 'erp_shipping_qty' ? 'INTEGER DEFAULT 0' : "TEXT DEFAULT ''"
        try { await db.prepare(`ALTER TABLE orders ADD COLUMN ${col} ${colType}`).run() } catch {}
      }
    }

    const body = await ctx.request.json() as { rows: Array<Record<string, string>> }
    if (!body.rows?.length) {
      return Response.json({ success: false, error: 'No rows provided' }, { status: 400, headers: corsHeaders })
    }

    const validRows: Array<{ index: number; row: Record<string, string> }> = []
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < body.rows.length; i++) {
      const r = body.rows[i]
      const orderNo = String(r.orderNo || '').trim()
      const trackingNumber = String(r.trackingNumber || '').trim()
      if (!orderNo || !trackingNumber) { skipped++; continue }
      validRows.push({ index: i, row: r })
    }

    let upserted = 0
    const BATCH_SIZE = 100

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE)
      const stmts = batch.map(({ row }) => buildStmt(db, row))

      try {
        await db.batch(stmts)
        upserted += batch.length
      } catch (err: any) {
        if (batch.length === 1) {
          const orderNo = String(batch[0].row.orderNo || '').trim()
          errors.push(`第${batch[0].index + 1}行(${orderNo}): ${err.message}`)
        } else {
          for (const item of batch) {
            try {
              await buildStmt(db, item.row).run()
              upserted++
            } catch (e2: any) {
              const orderNo = String(item.row.orderNo || '').trim()
              errors.push(`第${item.index + 1}行(${orderNo}): ${e2.message}`)
            }
          }
        }
        if (errors.length >= 20) break
      }
    }

    const countResult = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
    const totalInDb = (countResult as any)?.total || 0

    return Response.json({
      success: true,
      upserted,
      skipped,
      totalInDb,
      errors: errors.length > 0 ? errors : undefined,
    }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
