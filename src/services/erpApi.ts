import type { ErpInfo } from '@/types'

const API_BASE = '/api/erp'

export interface ErpOrderPayload {
  orderNo: string
  trackingNumber: string
  carrierCode?: number
  createdAt?: string
  shippedAt?: string
  warehouse?: string
  team?: string
}

export interface ErpWebhookResponse {
  success: boolean
  accepted: number
  rejected: Array<{ orderNo: string; reason: string }>
}

export interface ErpOrdersResponse {
  orders: Array<{
    orderNo: string
    trackingNumber: string
    carrierCode?: string
    createdAt?: string
    shippedAt?: string
    warehouse?: string
    team?: string
    status?: string
  }>
}

export async function pushErpOrders(
  orders: ErpOrderPayload[],
  webhookSecret: string,
  apiBase?: string,
): Promise<ErpWebhookResponse> {
  const base = apiBase || API_BASE
  const res = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${webhookSecret}`,
    },
    body: JSON.stringify({ orders }),
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('ERP webhook 认证失败，请检查密钥')
    throw new Error(`ERP推送失败: HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchErpOrders(apiBase?: string): Promise<ErpOrdersResponse> {
  const base = apiBase || API_BASE
  const res = await fetch(`${base}/orders`)
  if (!res.ok) throw new Error(`获取ERP订单失败: HTTP ${res.status}`)
  return res.json()
}

export async function deleteErpOrder(trackingNumber: string, apiBase?: string): Promise<void> {
  const base = apiBase || API_BASE
  const res = await fetch(`${base}/orders/${encodeURIComponent(trackingNumber)}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) throw new Error(`删除ERP订单失败: HTTP ${res.status}`)
}

export function mapErpOrderToInfo(erpOrder: ErpOrdersResponse['orders'][0]): ErpInfo {
  return {
    orderNo: erpOrder.orderNo,
    createdAt: erpOrder.createdAt,
    shippedAt: erpOrder.shippedAt,
    warehouse: erpOrder.warehouse,
    team: erpOrder.team,
  }
}
