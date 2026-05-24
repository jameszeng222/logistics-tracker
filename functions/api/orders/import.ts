interface Env {
  DB: D1Database
}

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  '美国': 'US', '英国': 'GB', '德国': 'DE', '法国': 'FR', '意大利': 'IT',
  '西班牙': 'ES', '日本': 'JP', '韩国': 'KR', '加拿大': 'CA', '澳大利亚': 'AU',
  '新西兰': 'NZ', '墨西哥': 'MX', '巴西': 'BR', '印度': 'IN', '俄罗斯': 'RU',
  '荷兰': 'NL', '比利时': 'BE', '瑞士': 'CH', '奥地利': 'AT', '瑞典': 'SE',
  '挪威': 'NO', '丹麦': 'DK', '芬兰': 'FI', '波兰': 'PL', '捷克': 'CZ',
  '葡萄牙': 'PT', '爱尔兰': 'IE', '希腊': 'GR', '匈牙利': 'HU', '罗马尼亚': 'RO',
  '保加利亚': 'BG', '克罗地亚': 'HR', '斯洛伐克': 'SK', '斯洛文尼亚': 'SI',
  '爱沙尼亚': 'EE', '拉脱维亚': 'LV', '立陶宛': 'LT', '卢森堡': 'LU',
  '马耳他': 'MT', '塞浦路斯': 'CY', '以色列': 'IL', '沙特阿拉伯': 'SA',
  '阿联酋': 'AE', '土耳其': 'TR', '泰国': 'TH', '越南': 'VN', '马来西亚': 'MY',
  '新加坡': 'SG', '印度尼西亚': 'ID', '菲律宾': 'PH', '智利': 'CL',
  '哥伦比亚': 'CO', '阿根廷': 'AR', '秘鲁': 'PE', '南非': 'ZA',
  '尼日利亚': 'NG', '埃及': 'EG', '肯尼亚': 'KE', '乌克兰': 'UA',
}

function normalizeCountryCode(value: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed
  if (/^[a-z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  return COUNTRY_NAME_TO_ISO[trimmed] || trimmed
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
  carrier = CASE WHEN excluded.erp_logistics_provider_display != '' THEN excluded.erp_logistics_provider_display WHEN excluded.carrier != '' THEN excluded.carrier ELSE orders.carrier END,
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
    String(r.logisticsProviderDisplayName || r.logisticsProvider || '').trim(),
    normalizeCountryCode(String(r.destinationCountry || '')),
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
