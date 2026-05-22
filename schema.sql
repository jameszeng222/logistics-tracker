CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  carrier TEXT DEFAULT '',
  carrier_code INTEGER,
  origin TEXT DEFAULT '',
  destination TEXT DEFAULT '',
  destination_country TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_found',
  sub_status TEXT DEFAULT '',
  ship_date TEXT DEFAULT '',
  delivery_date TEXT DEFAULT '',
  actual_days REAL,
  sla_days REAL DEFAULT 20,
  exception_description TEXT DEFAULT '',
  erp_order_no TEXT DEFAULT '',
  erp_created_at TEXT DEFAULT '',
  erp_shipped_at TEXT DEFAULT '',
  erp_warehouse TEXT DEFAULT '',
  erp_team TEXT DEFAULT '',
  erp_warehouse_code TEXT DEFAULT '',
  erp_platform TEXT DEFAULT '',
  erp_shipping_qty INTEGER DEFAULT 0,
  erp_payment_time TEXT DEFAULT '',
  erp_packing_time TEXT DEFAULT '',
  erp_checkout_time TEXT DEFAULT '',
  erp_logistics_provider TEXT DEFAULT '',
  erp_logistics_provider_display TEXT DEFAULT '',
  erp_current_channel TEXT DEFAULT '',
  sync_meta TEXT DEFAULT '{}',
  events TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_sub_status ON orders(sub_status);
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(destination_country);
CREATE INDEX IF NOT EXISTS idx_orders_carrier ON orders(carrier);
CREATE INDEX IF NOT EXISTS idx_orders_warehouse ON orders(erp_warehouse);
CREATE INDEX IF NOT EXISTS idx_orders_team ON orders(erp_team);
CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON orders(erp_shipped_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(erp_created_at);
CREATE INDEX IF NOT EXISTS idx_orders_erp_order_no ON orders(erp_order_no);
CREATE INDEX IF NOT EXISTS idx_orders_logistics_provider ON orders(erp_logistics_provider);
CREATE INDEX IF NOT EXISTS idx_orders_current_channel ON orders(erp_current_channel);
