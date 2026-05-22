import type { LogisticsOrder } from '@/types'

const API_BASE = '/api/orders'
const STATS_BASE = '/api/orders/stats'

function orderToRow(o: LogisticsOrder): Record<string, any> {
  return {
    id: o.orderId,
    orderId: o.orderId,
    trackingNumber: o.trackingNumber,
    carrier: o.carrier,
    carrierCode: o.syncMeta?.carrierCode ?? null,
    origin: o.origin,
    destination: o.destination,
    destinationCountry: o.destinationCountry,
    status: o.status,
    subStatus: o.events?.[0]?.subStatus || '',
    shipDate: o.shipDate,
    deliveryDate: o.deliveryDate || '',
    actualDays: o.actualDays ?? null,
    slaDays: o.slaDays || 20,
    exceptionDescription: o.exception?.description || '',
    erpOrderNo: o.erpInfo?.orderNo || '',
    erpCreatedAt: o.erpInfo?.createdAt || '',
    erpShippedAt: o.erpInfo?.shippedAt || '',
    erpWarehouse: o.erpInfo?.warehouse || '',
    erpTeam: o.erpInfo?.team || '',
    erpWarehouseCode: o.erpInfo?.warehouseCode || '',
    erpPlatform: o.erpInfo?.platform || '',
    erpShippingQty: o.erpInfo?.shippingQty || 0,
    erpPaymentTime: o.erpInfo?.paymentTime || '',
    erpPackingTime: o.erpInfo?.packingTime || '',
    erpCheckoutTime: o.erpInfo?.checkoutTime || '',
    erpLogisticsProvider: o.erpInfo?.logisticsProvider || '',
    erpLogisticsProviderDisplay: o.erpInfo?.logisticsProviderDisplayName || '',
    erpCurrentChannel: o.erpInfo?.currentChannel || '',
    erpInfo: {
      orderNo: o.erpInfo?.orderNo || '',
      createdAt: o.erpInfo?.createdAt || '',
      shippedAt: o.erpInfo?.shippedAt || '',
      warehouse: o.erpInfo?.warehouse || '',
      team: o.erpInfo?.team || '',
      warehouseCode: o.erpInfo?.warehouseCode || '',
      platform: o.erpInfo?.platform || '',
      shippingQty: o.erpInfo?.shippingQty || 0,
      paymentTime: o.erpInfo?.paymentTime || '',
      packingTime: o.erpInfo?.packingTime || '',
      checkoutTime: o.erpInfo?.checkoutTime || '',
      logisticsProvider: o.erpInfo?.logisticsProvider || '',
      logisticsProviderDisplayName: o.erpInfo?.logisticsProviderDisplayName || '',
      currentChannel: o.erpInfo?.currentChannel || '',
    },
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

export interface StatsFilterParams {
  country?: string
  carrier?: string
  warehouse?: string
  team?: string
  timeField?: string
  timeStart?: string
  timeEnd?: string
}

export interface KpiResult {
  totalOrders: number
  validOrders: number
  deliveredOrders: number
  inTransitOrders: number
  exceptionOrders: number
  deliveryRate: number
  avgTransitDays: number
  slaComplianceRate: number
  slaTotal: number
  slaPassed: number
}

export interface StatusDistributionResult {
  byStatus: Record<string, number>
  bySubStatus: Record<string, number>
  total: number
}

export interface CarrierStatsItem {
  carrier: string
  total: number
  delivered: number
  deliveryRate: number
  avgDays: number
  slaTotal: number
  slaPassed: number
  slaRate: number
}

export interface CountryStatsItem {
  country: string
  total: number
  delivered: number
  deliveryRate: number
  avgDays: number
  slaTotal: number
  slaPassed: number
  slaRate: number
}

export interface P90MatrixResult {
  carrierList: string[]
  countryList: string[]
  matrix: Record<string, Record<string, { p90: number; slaDays: number | null; passed: boolean | null; count: number }>>
}

export interface TransitDistributionItem {
  country: string
  le2: { count: number; pct: number }
  d3: { count: number; pct: number }
  d4_5: { count: number; pct: number }
  d6_7: { count: number; pct: number }
  d8_10: { count: number; pct: number }
  gt10: { count: number; pct: number }
  total: number
}

export interface SlaTrendItem {
  month: string
  rate: number
  total: number
  passed: number
}

export interface CarrierP90Item {
  carrier: string
  p90: number
  avg: number
  slaDays: number | null
  count: number
}

export interface MonitoringAlertItem {
  orderId: string
  trackingNumber: string
  carrier: string
  destinationCountry: string
  warehouse: string
  team: string
  status: string
  createdAt: string
  checkoutTime: string
  ruleNames: string[]
  alertTypes: string[]
}

export interface MonitoringAlertsResult {
  alerts: MonitoringAlertItem[]
  total: number
  counts: {
    not_shipped: number
    not_online: number
    not_delivered: number
    keyword: number
  }
}

function buildStatsQs(params: StatsFilterParams): string {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  })
  return qs.toString()
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

export async function clearAllOrdersFromD1(): Promise<{ deleted: number; remaining: number }> {
  const res = await fetch(`${API_BASE}/clear`, { method: 'POST' })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || `清空失败，剩余 ${data.remaining || 0} 条`)
  return { deleted: data.deleted || 0, remaining: data.remaining || 0 }
}

export async function getOrderCountFromD1(): Promise<number> {
  const res = await fetch(`${API_BASE}/count`)
  const data = await res.json()
  return data.total || 0
}

export async function fetchTrackingList(): Promise<{ trackingNumber: string; carrierCode: number | null }[]> {
  const res = await fetch(`${API_BASE}/tracking-list`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch tracking list')
  return data.items || []
}

export async function lookupOrders(keys: { trackingNumbers?: string[]; orderNos?: string[] }): Promise<LogisticsOrder[]> {
  const res = await fetch(`${API_BASE}/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keys),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to lookup orders')
  return data.orders || []
}

export async function fetchKpi(params: StatsFilterParams = {}): Promise<KpiResult> {
  const qs = buildStatsQs(params)
  const res = await fetch(`${STATS_BASE}/kpi${qs ? '?' + qs : ''}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch KPI')
  return data.data
}

export async function fetchStatusDistribution(params: StatsFilterParams = {}): Promise<StatusDistributionResult> {
  const qs = buildStatsQs(params)
  const res = await fetch(`${STATS_BASE}/status-distribution${qs ? '?' + qs : ''}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch status distribution')
  return data.data
}

export async function fetchByCarrier(params: StatsFilterParams = {}): Promise<CarrierStatsItem[]> {
  const qs = buildStatsQs(params)
  const res = await fetch(`${STATS_BASE}/by-carrier${qs ? '?' + qs : ''}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch carrier stats')
  return data.data
}

export async function fetchByCountry(params: StatsFilterParams = {}): Promise<CountryStatsItem[]> {
  const qs = buildStatsQs(params)
  const res = await fetch(`${STATS_BASE}/by-country${qs ? '?' + qs : ''}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch country stats')
  return data.data
}

export async function fetchP90Matrix(params: StatsFilterParams = {}): Promise<P90MatrixResult> {
  const qs = buildStatsQs(params)
  const res = await fetch(`${STATS_BASE}/p90-matrix${qs ? '?' + qs : ''}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch P90 matrix')
  return data.data
}

export async function fetchTransitDistribution(params: StatsFilterParams = {}): Promise<TransitDistributionItem[]> {
  const qs = buildStatsQs(params)
  const res = await fetch(`${STATS_BASE}/transit-distribution${qs ? '?' + qs : ''}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch transit distribution')
  return data.data
}

export async function fetchSlaTrend(params: StatsFilterParams = {}): Promise<SlaTrendItem[]> {
  const qs = buildStatsQs(params)
  const res = await fetch(`${STATS_BASE}/sla-trend${qs ? '?' + qs : ''}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch SLA trend')
  return data.data
}

export async function fetchCarrierP90(params: StatsFilterParams = {}): Promise<CarrierP90Item[]> {
  const qs = buildStatsQs(params)
  const res = await fetch(`${STATS_BASE}/carrier-p90${qs ? '?' + qs : ''}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch carrier P90')
  return data.data
}

export async function fetchMonitoringAlerts(
  params: StatsFilterParams & { limit?: number; offset?: number } = {},
  rules: any[] = [],
  keywordRules: any[] = [],
): Promise<MonitoringAlertsResult> {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  })
  const res = await fetch(`${STATS_BASE}/monitoring-alerts${qs ? '?' + qs : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules, keywordRules }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch monitoring alerts')
  return { alerts: data.alerts, total: data.total, counts: data.counts }
}
