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

const EXPECTED_PARAM_COUNT = 19

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

    let upserted = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < body.rows.length; i++) {
      const r = body.rows[i]
      const orderNo = String(r.orderNo || '').trim()
      const trackingNumber = String(r.trackingNumber || '').trim()
      if (!orderNo || !trackingNumber) { skipped++; continue }

      const id = `ERP-${orderNo}`
      const logisticsProvider = String(r.logisticsProvider || '').trim()
      const destinationCountry = String(r.destinationCountry || '').trim()
      const checkoutTime = String(r.checkoutTime || '').trim()
      const createdAt = String(r.createdAt || '').trim()
      const warehouseCode = String(r.warehouseCode || '').trim()
      const platform = String(r.platform || '').trim()
      const shippingQty = Number(r.shippingQty) || 0
      const paymentTime = String(r.paymentTime || '').trim()
      const packingTime = String(r.packingTime || '').trim()
      const providerDisplay = String(r.logisticsProviderDisplayName || '').trim()
      const currentChannel = String(r.currentChannel || '').trim()

      const params = [
        id,
        id,
        trackingNumber,
        logisticsProvider,
        destinationCountry,
        checkoutTime,
        orderNo,
        createdAt,
        checkoutTime,
        warehouseCode,
        warehouseCode,
        platform,
        shippingQty,
        paymentTime,
        packingTime,
        checkoutTime,
        logisticsProvider,
        providerDisplay,
        currentChannel,
      ]

      if (params.length !== EXPECTED_PARAM_COUNT) {
        errors.push(`第${i + 1}行(${orderNo}): 参数数量错误 expected=${EXPECTED_PARAM_COUNT} actual=${params.length}`)
        continue
      }

      try {
        await db.prepare(UPSERT_SQL).bind(...params).run()
        upserted++
      } catch (err: any) {
        errors.push(`第${i + 1}行(${orderNo}): ${err.message}`)
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
