interface Env {
  DB: D1Database
}

export const onRequest = [async (ctx: EventContext<Env, string, Record<string, unknown>>) => {
  const url = new URL(ctx.request.url)
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
    if (method === 'GET') {
      const status = url.searchParams.get('status')
      const country = url.searchParams.get('country')
      const carrier = url.searchParams.get('carrier')
      const warehouse = url.searchParams.get('warehouse')
      const team = url.searchParams.get('team')
      const search = url.searchParams.get('search')
      const timeField = url.searchParams.get('timeField') || 'erp_shipped_at'
      const timeStart = url.searchParams.get('timeStart')
      const timeEnd = url.searchParams.get('timeEnd')
      const subStatus = url.searchParams.get('subStatus')
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 50000)
      const offset = parseInt(url.searchParams.get('offset') || '0')

      const conditions: string[] = []
      const params: any[] = []

      if (status) { conditions.push('status = ?'); params.push(status) }
      if (subStatus) { conditions.push('sub_status = ?'); params.push(subStatus) }
      if (country) { conditions.push('destination_country = ?'); params.push(country) }
      if (carrier) { conditions.push('carrier = ?'); params.push(carrier) }
      if (warehouse) { conditions.push('erp_warehouse = ?'); params.push(warehouse) }
      if (team) { conditions.push('erp_team = ?'); params.push(team) }
      if (search) {
        conditions.push('(order_id LIKE ? OR tracking_number LIKE ? OR carrier LIKE ? OR destination LIKE ? OR erp_order_no LIKE ?)')
        const s = `%${search}%`
        params.push(s, s, s, s, s)
      }
      if (timeStart) { conditions.push(`${timeField} >= ?`); params.push(timeStart) }
      if (timeEnd) { conditions.push(`${timeField} <= ?`); params.push(timeEnd + ' 23:59:59') }

      const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

      const countResult = await db.prepare(`SELECT COUNT(*) as total FROM orders ${where}`).bind(...params).first()
      const total = (countResult as any)?.total || 0

      const rows = await db.prepare(
        `SELECT * FROM orders ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all()

      const orders = rows.results.map((row: any) => ({
        id: row.id,
        orderId: row.order_id,
        trackingNumber: row.tracking_number,
        carrier: row.carrier || '',
        carrierCode: row.carrier_code,
        origin: row.origin || '',
        destination: row.destination || '',
        destinationCountry: row.destination_country || '',
        status: row.status,
        subStatus: row.sub_status || '',
        shipDate: row.ship_date || '',
        deliveryDate: row.delivery_date || '',
        actualDays: row.actual_days,
        slaDays: row.sla_days || 20,
        exception: row.exception_description ? { description: row.exception_description } : undefined,
        erpInfo: (row.erp_order_no || row.erp_created_at || row.erp_checkout_time || row.erp_warehouse_code || row.erp_logistics_provider) ? {
          orderNo: row.erp_order_no || '',
          createdAt: row.erp_created_at || '',
          shippedAt: row.erp_shipped_at || '',
          warehouse: row.erp_warehouse || '',
          team: row.erp_team || '',
          warehouseCode: row.erp_warehouse_code || '',
          platform: row.erp_platform || '',
          shippingQty: row.erp_shipping_qty || 0,
          paymentTime: row.erp_payment_time || '',
          packingTime: row.erp_packing_time || '',
          checkoutTime: row.erp_checkout_time || '',
          logisticsProvider: row.erp_logistics_provider || '',
          logisticsProviderDisplayName: row.erp_logistics_provider_display || '',
          currentChannel: row.erp_current_channel || '',
        } : undefined,
        syncMeta: JSON.parse(row.sync_meta || '{}'),
        events: JSON.parse(row.events || '[]'),
      }))

      return Response.json({ success: true, orders, total, limit, offset }, { headers: corsHeaders })
    }

    if (method === 'POST') {
      const body = await ctx.request.json() as { orders: any[] }
      if (!body.orders?.length) {
        return Response.json({ success: false, error: 'No orders provided' }, { status: 400, headers: corsHeaders })
      }

      const stmts = body.orders.map((o: any) => {
        const id = o.id || o.orderId
        const events = typeof o.events === 'string' ? o.events : JSON.stringify(o.events || [])
        const syncMeta = typeof o.syncMeta === 'string' ? o.syncMeta : JSON.stringify(o.syncMeta || {})
        const erpInfo = o.erpInfo || {}

        return db.prepare(
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
          id, o.orderId || id, o.trackingNumber || '', o.carrier || '', o.carrierCode || null,
          o.origin || '', o.destination || '', o.destinationCountry || '',
          o.status || 'not_found', o.subStatus || (o.events?.[0]?.subStatus) || '',
          o.shipDate || '', o.deliveryDate || '', o.actualDays || null, o.slaDays || 20,
          o.exception?.description || '',
          erpInfo.orderNo || '', erpInfo.createdAt || '', erpInfo.shippedAt || '',
          erpInfo.warehouse || '', erpInfo.team || '',
          erpInfo.warehouseCode || '', erpInfo.platform || '', erpInfo.shippingQty || 0,
          erpInfo.paymentTime || '', erpInfo.packingTime || '', erpInfo.checkoutTime || '',
          erpInfo.logisticsProvider || '', erpInfo.logisticsProviderDisplayName || '',
          erpInfo.currentChannel || '',
          syncMeta, events
        )
      })

      const batchSize = 50
      let upserted = 0
      for (let i = 0; i < stmts.length; i += batchSize) {
        const batch = stmts.slice(i, i + batchSize)
        await db.batch(batch)
        upserted += batch.length
      }

      return Response.json({ success: true, upserted }, { headers: corsHeaders })
    }

    if (method === 'DELETE') {
      const parts = url.pathname.split('/').filter(Boolean)
      const lastPart = parts[parts.length - 1]
      if (!lastPart || lastPart === 'orders' || lastPart === 'clear' || lastPart === 'count' || lastPart === 'filters' || lastPart === 'tracking-list' || lastPart === 'lookup') {
        return Response.json({ success: false, error: 'Order ID required' }, { status: 400, headers: corsHeaders })
      }
      await db.prepare('DELETE FROM orders WHERE id = ?').bind(lastPart).run()
      return Response.json({ success: true }, { headers: corsHeaders })
    }

    return Response.json({ success: false, error: 'Not found' }, { status: 404, headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
