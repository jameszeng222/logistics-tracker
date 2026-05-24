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

const COUNTRY_FIXES: Record<string, string> = {
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

    let countryFixed = 0
    for (const [cn, iso] of Object.entries(COUNTRY_FIXES)) {
      try {
        const result = await db.prepare(
          "UPDATE orders SET destination_country = ? WHERE destination_country = ?"
        ).bind(iso, cn).run()
        countryFixed += (result.meta?.changes || 0) as number
      } catch {}
    }

    return Response.json({
      success: true,
      added,
      skipped,
      countryFixed,
      failed: failed.length > 0 ? failed : undefined,
      existingColumns: Array.from(existingColumns),
    }, { headers: corsHeaders })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders })
  }
}]
