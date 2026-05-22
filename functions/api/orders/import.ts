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
        try {
          await db.prepare(`ALTER TABLE orders ADD COLUMN ${col} ${colType}`).run()
        } catch {}
      }
    }

    const body = await ctx.request.json() as { rows: Array<Record<string, string>> }
    if (!body.rows?.length) {
      return Response.json({ success: false, error: 'No rows provided' }, { status: 400, headers: corsHeaders })
    }

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < body.rows.length; i++) {
      const r = body.rows[i]

      const orderNo = (r.orderNo || '').trim()
      const trackingNumber = (r.trackingNumber || '').trim()

      if (!orderNo || !trackingNumber) {
        skipped++
        continue
      }

      const id = `ERP-${orderNo}`
      const destinationCountry = (r.destinationCountry || '').trim()
      const logisticsProvider = (r.logisticsProvider || '').trim()
      const checkoutTime = (r.checkoutTime || '').trim()
      const createdAt = (r.createdAt || '').trim()

      try {
        const existing = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first()

        if (existing) {
          await db.prepare(
            `UPDATE orders SET
              tracking_number = CASE WHEN ? != '' THEN ? ELSE tracking_number END,
              carrier = CASE WHEN ? != '' THEN ? ELSE carrier END,
              destination_country = CASE WHEN ? != '' THEN ? ELSE destination_country END,
              ship_date = CASE WHEN ? != '' THEN ? ELSE ship_date END,
              erp_order_no = CASE WHEN ? != '' THEN ? ELSE erp_order_no END,
              erp_created_at = CASE WHEN ? != '' THEN ? ELSE erp_created_at END,
              erp_shipped_at = CASE WHEN ? != '' THEN ? ELSE erp_shipped_at END,
              erp_warehouse = CASE WHEN ? != '' THEN ? ELSE erp_warehouse END,
              erp_warehouse_code = CASE WHEN ? != '' THEN ? ELSE erp_warehouse_code END,
              erp_platform = CASE WHEN ? != '' THEN ? ELSE erp_platform END,
              erp_shipping_qty = CASE WHEN ? != 0 THEN ? ELSE erp_shipping_qty END,
              erp_payment_time = CASE WHEN ? != '' THEN ? ELSE erp_payment_time END,
              erp_packing_time = CASE WHEN ? != '' THEN ? ELSE erp_packing_time END,
              erp_checkout_time = CASE WHEN ? != '' THEN ? ELSE erp_checkout_time END,
              erp_logistics_provider = CASE WHEN ? != '' THEN ? ELSE erp_logistics_provider END,
              erp_logistics_provider_display = CASE WHEN ? != '' THEN ? ELSE erp_logistics_provider_display END,
              erp_current_channel = CASE WHEN ? != '' THEN ? ELSE erp_current_channel END,
              updated_at = datetime('now')
            WHERE id = ?`
          ).bind(
            trackingNumber, trackingNumber,
            logisticsProvider, logisticsProvider,
            destinationCountry, destinationCountry,
            checkoutTime, checkoutTime,
            orderNo, orderNo,
            createdAt, createdAt,
            checkoutTime, checkoutTime,
            r.warehouseCode || '', r.warehouseCode || '',
            r.platform || '', r.platform || '',
            Number(r.shippingQty) || 0, Number(r.shippingQty) || 0,
            r.paymentTime || '', r.paymentTime || '',
            r.packingTime || '', r.packingTime || '',
            checkoutTime, checkoutTime,
            logisticsProvider, logisticsProvider,
            r.logisticsProviderDisplayName || '', r.logisticsProviderDisplayName || '',
            r.currentChannel || '', r.currentChannel || '',
            id
          ).run()
          updated++
        } else {
          await db.prepare(
            `INSERT INTO orders (
              id, order_id, tracking_number, carrier, destination_country, status,
              ship_date, erp_order_no, erp_created_at, erp_shipped_at,
              erp_warehouse, erp_warehouse_code, erp_platform, erp_shipping_qty,
              erp_payment_time, erp_packing_time, erp_checkout_time,
              erp_logistics_provider, erp_logistics_provider_display, erp_current_channel,
              sync_meta, events, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, 'not_found',
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?,
              '{}', '[]', datetime('now')
            )`
          ).bind(
            id, id, trackingNumber, logisticsProvider, destinationCountry,
            checkoutTime,
            orderNo, createdAt, checkoutTime,
            r.warehouseCode || '', r.platform || '', Number(r.shippingQty) || 0,
            r.paymentTime || '', r.packingTime || '', checkoutTime,
            logisticsProvider, r.logisticsProviderDisplayName || '', r.currentChannel || ''
          ).run()
          inserted++
        }
      } catch (err: any) {
        errors.push(`第${i + 1}行(${orderNo}): ${err.message}`)
        if (errors.length >= 20) break
      }
    }

    const countResult = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
    const totalInDb = (countResult as any)?.total || 0

    return Response.json({
      success: true,
      inserted,
      updated,
      skipped,
      totalInDb,
      errors: errors.length > 0 ? errors : undefined,
    }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
