interface Env {
  DB: D1Database
}

export const onRequest = [async (ctx: EventContext<Env, string, Record<string, unknown>>) => {
  const method = ctx.request.method
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (method !== 'POST') {
    return Response.json({ success: false, error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  if (!ctx.env.DB) {
    return Response.json({ success: false, error: 'D1 database not bound' }, { status: 500, headers: corsHeaders })
  }

  const db = ctx.env.DB

  try {
    const body = await ctx.request.json() as { orders: any[] }
    if (!body.orders?.length) {
      return Response.json({ success: false, error: 'No orders provided' }, { status: 400, headers: corsHeaders })
    }

    const beforeCount = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
    const before = (beforeCount as any)?.total || 0

    let upserted = 0
    let errors: string[] = []

    for (let i = 0; i < body.orders.length; i++) {
      const o = body.orders[i]
      try {
        const id = o.id || o.orderId
        if (!id) {
          errors.push(`Row ${i}: missing id/orderId`)
          continue
        }
        if (!o.trackingNumber) {
          errors.push(`Row ${i}: missing trackingNumber`)
          continue
        }

        const events = typeof o.events === 'string' ? o.events : JSON.stringify(o.events || [])
        const syncMeta = typeof o.syncMeta === 'string' ? o.syncMeta : JSON.stringify(o.syncMeta || {})
        const erpInfo = o.erpInfo || {}
        const e = (key: string, flatKey: string) => erpInfo[key] || o[flatKey] || ''
        const carrierCode = o.carrierCode ?? null

        await db.prepare(
          `INSERT INTO orders (id, order_id, tracking_number, carrier, carrier_code, origin, destination, destination_country, status, sub_status, ship_date, delivery_date, actual_days, sla_days, exception_description, erp_order_no, erp_created_at, erp_shipped_at, erp_warehouse, erp_team, erp_warehouse_code, erp_platform, erp_shipping_qty, erp_payment_time, erp_packing_time, erp_checkout_time, erp_logistics_provider, erp_logistics_provider_display, erp_current_channel, sync_meta, events, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             order_id = CASE WHEN excluded.order_id != '' THEN excluded.order_id ELSE orders.order_id END,
             tracking_number = CASE WHEN excluded.tracking_number != '' THEN excluded.tracking_number ELSE orders.tracking_number END,
             carrier = CASE WHEN excluded.carrier != '' THEN excluded.carrier ELSE orders.carrier END,
             carrier_code = COALESCE(excluded.carrier_code, orders.carrier_code),
             origin = CASE WHEN excluded.origin != '' THEN excluded.origin ELSE orders.origin END,
             destination = CASE WHEN excluded.destination != '' THEN excluded.destination ELSE orders.destination END,
             destination_country = CASE WHEN excluded.destination_country != '' THEN excluded.destination_country ELSE orders.destination_country END,
             status = excluded.status,
             sub_status = excluded.sub_status,
             ship_date = CASE WHEN excluded.ship_date != '' THEN excluded.ship_date ELSE orders.ship_date END,
             delivery_date = CASE WHEN excluded.delivery_date != '' THEN excluded.delivery_date ELSE orders.delivery_date END,
             actual_days = COALESCE(excluded.actual_days, orders.actual_days),
             sla_days = CASE WHEN excluded.sla_days != 20 THEN excluded.sla_days ELSE orders.sla_days END,
             exception_description = excluded.exception_description,
             erp_order_no = CASE WHEN excluded.erp_order_no != '' THEN excluded.erp_order_no ELSE orders.erp_order_no END,
             erp_created_at = CASE WHEN excluded.erp_created_at != '' THEN excluded.erp_created_at ELSE orders.erp_created_at END,
             erp_shipped_at = CASE WHEN excluded.erp_shipped_at != '' THEN excluded.erp_shipped_at ELSE orders.erp_shipped_at END,
             erp_warehouse = CASE WHEN excluded.erp_warehouse != '' THEN excluded.erp_warehouse ELSE orders.erp_warehouse END,
             erp_team = CASE WHEN excluded.erp_team != '' THEN excluded.erp_team ELSE orders.erp_team END,
             erp_warehouse_code = CASE WHEN excluded.erp_warehouse_code != '' THEN excluded.erp_warehouse_code ELSE orders.erp_warehouse_code END,
             erp_platform = CASE WHEN excluded.erp_platform != '' THEN excluded.erp_platform ELSE orders.erp_platform END,
             erp_shipping_qty = CASE WHEN excluded.erp_shipping_qty != 0 THEN excluded.erp_shipping_qty ELSE orders.erp_shipping_qty END,
             erp_payment_time = CASE WHEN excluded.erp_payment_time != '' THEN excluded.erp_payment_time ELSE orders.erp_payment_time END,
             erp_packing_time = CASE WHEN excluded.erp_packing_time != '' THEN excluded.erp_packing_time ELSE orders.erp_packing_time END,
             erp_checkout_time = CASE WHEN excluded.erp_checkout_time != '' THEN excluded.erp_checkout_time ELSE orders.erp_checkout_time END,
             erp_logistics_provider = CASE WHEN excluded.erp_logistics_provider != '' THEN excluded.erp_logistics_provider ELSE orders.erp_logistics_provider END,
             erp_logistics_provider_display = CASE WHEN excluded.erp_logistics_provider_display != '' THEN excluded.erp_logistics_provider_display ELSE orders.erp_logistics_provider_display END,
             erp_current_channel = CASE WHEN excluded.erp_current_channel != '' THEN excluded.erp_current_channel ELSE orders.erp_current_channel END,
             sync_meta = excluded.sync_meta,
             events = CASE WHEN excluded.events != '[]' THEN excluded.events ELSE orders.events END,
             updated_at = datetime('now')`
        ).bind(
          id, o.orderId || id, o.trackingNumber || '', o.carrier || '', carrierCode,
          o.origin || '', o.destination || '', o.destinationCountry || '',
          o.status || 'not_found', o.subStatus || '', o.shipDate || '', o.deliveryDate || '',
          o.actualDays ?? null, o.slaDays || 20, o.exception?.description || o.exceptionDescription || '',
          e('orderNo', 'erpOrderNo'), e('createdAt', 'erpCreatedAt'), e('shippedAt', 'erpShippedAt'),
          e('warehouse', 'erpWarehouse'), e('team', 'erpTeam'),
          e('warehouseCode', 'erpWarehouseCode'), e('platform', 'erpPlatform'), erpInfo.shippingQty ?? o.erpShippingQty ?? 0,
          e('paymentTime', 'erpPaymentTime'), e('packingTime', 'erpPackingTime'), e('checkoutTime', 'erpCheckoutTime'),
          e('logisticsProvider', 'erpLogisticsProvider'), e('logisticsProviderDisplayName', 'erpLogisticsProviderDisplay'),
          e('currentChannel', 'erpCurrentChannel'),
          syncMeta, events
        ).run()

        upserted++
      } catch (err: any) {
        errors.push(`Row ${i} (${o.orderId || o.trackingNumber || 'unknown'}): ${err.message}`)
        if (errors.length > 10) {
          errors.push('... and more errors')
          break
        }
      }
    }

    const afterCount = await db.prepare('SELECT COUNT(*) as total FROM orders').first()
    const after = (afterCount as any)?.total || 0

    return Response.json({
      success: upserted > 0,
      upserted,
      beforeCount: before,
      afterCount: after,
      totalInput: body.orders.length,
      errors: errors.length > 0 ? errors : undefined,
    }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message, upserted: 0 }, { status: 500, headers: corsHeaders })
  }
}]
