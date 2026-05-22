import type { LogisticsOrder } from '@/types'

const API_BASE = '/api/orders'

function orderToRow(o: LogisticsOrder): Record<string, any> {
  return {
    id: o.orderId,
    orderId: o.orderId,
    trackingNumber: o.trackingNumber,
    carrier: o.carrier,
    carrierCode: o.syncMeta?.carrierCode || null,
    origin: o.origin,
    destination: o.destination,
    destinationCountry: o.destinationCountry,
    status: o.status,
    subStatus: o.events?.[0]?.subStatus || '',
    shipDate: o.shipDate,
    deliveryDate: o.deliveryDate,
    actualDays: o.actualDays,
    slaDays: o.slaDays,
    exceptionDescription: o.exception?.description || '',
    erpOrderNo: o.erpInfo?.orderNo || '',
    erpCreatedAt: o.erpInfo?.createdAt || '',
    erpShippedAt: o.erpInfo?.shippedAt || '',
    erpWarehouse: o.erpInfo?.warehouse || '',
    erpTeam: o.erpInfo?.team || '',
    syncMeta: o.syncMeta || {},
    events: o.events || [],
  }
}

export interface FetchOrdersParams {
  status?: string
  subStatus?: string
  country?: string
  carrier?: string
  warehouse?: string
  team?: string
  search?: string
  timeField?: string
  timeStart?: string
  timeEnd?: string
  limit?: number
  offset?: number
}

export interface FetchOrdersResult {
  success: boolean
  orders: LogisticsOrder[]
  total: number
}

export interface FilterOptions {
  countries: string[]
  carriers: string[]
  warehouses: string[]
  teams: string[]
  statuses: { status: string; count: number }[]
}

export async function fetchOrdersFromD1(params: FetchOrdersParams = {}): Promise<FetchOrdersResult> {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  })
  const res = await fetch(`${API_BASE}?${qs.toString()}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch orders')
  return { success: true, orders: data.orders, total: data.total }
}

export async function upsertOrdersToD1(orders: LogisticsOrder[]): Promise<number> {
  const rows = orders.map(orderToRow)
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders: rows }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to upsert orders')
  return data.upserted || 0
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const res = await fetch(`${API_BASE}/filters`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch filters')
  return data
}

export async function deleteOrderFromD1(id: string): Promise<void> {
  await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function clearAllOrdersFromD1(): Promise<void> {
  await fetch(`${API_BASE}/clear`, { method: 'DELETE' })
}

export async function getOrderCountFromD1(): Promise<number> {
  const res = await fetch(`${API_BASE}/count`)
  const data = await res.json()
  return data.total || 0
}
