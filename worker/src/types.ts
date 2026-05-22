export interface ErpOrder {
  orderNo: string;
  trackingNumber: string;
  carrierCode?: string;
  createdAt?: string;
  shippedAt?: string;
  warehouse?: string;
  team?: string;
  status?: string;
}

export interface ErpWebhookPayload {
  orders: ErpOrder[];
}

export interface Env {
  ORDERS_KV: KVNamespace;
  TRACK17_API_KEY: string;
  ERP_WEBHOOK_SECRET: string;
}
