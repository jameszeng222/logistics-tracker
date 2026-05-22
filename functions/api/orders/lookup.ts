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
    return Response.json({ success: false, error: 'D1 database not bound' }, { status: 500, headers: corsHeaders })
  }

  const db = ctx.env.DB

  try {
    const body = await ctx.request.json() as { trackingNumbers?: string[]; orderNos?: string[] }
    const conditions: string[] = []
    const params: any[] = []

    if (body.trackingNumbers?.length) {
      const placeholders = body.trackingNumbers.map(() => '?').join(',')
      conditions.push(`tracking_number IN (${placeholders})`)
      params.push(...body.trackingNumbers)
    }
    if (body.orderNos?.length) {
      const placeholders = body.orderNos.map(() => '?').join(',')
      const cond = `erp_order_no IN (${placeholders})`
      conditions.push(conditions.length > 0 ? `OR ${cond}` : cond)
      params.push(...body.orderNos)
    }

    if (conditions.length === 0) {
      return Response.json({ success: true, orders: [] }, { headers: corsHeaders })
    }

    const rows = await db.prepare(
      `SELECT * FROM orders WHERE ${conditions.join(' ')} LIMIT 5000`
    ).bind(...params).all()

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

    return Response.json({ success: true, orders }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
