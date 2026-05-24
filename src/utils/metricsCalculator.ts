import type { LogisticsOrder } from '@/types'
import { loadSlaRules, matchSlaRule, DESTINATION_REGION_MAP } from '@/config/slaConfig'

export interface MetricsResult {
  totalOrders: number
  validOrders: number
  deliveredOrders: number
  inTransitOrders: number
  exceptionOrders: number
  notFoundOrders: number
  deliveryRate: number
  avgTransitDays: number
  slaComplianceRate: number
  slaTotal: number
  slaPassed: number
  exceptionRate: number
  inTransitRate: number
  deliveryRateByCarrier: Record<string, { total: number; delivered: number; rate: number }>
  deliveryRateByCountry: Record<string, { total: number; delivered: number; rate: number }>
  transitDaysByCountry: Record<string, { avg: number; count: number; days: number[] }>
  transitDaysByCarrier: Record<string, { avg: number; count: number; days: number[] }>
  slaByCountry: Record<string, { rate: number; total: number; passed: number }>
  slaByCarrier: Record<string, { rate: number; total: number; passed: number }>
  byCountryAndCarrier: Record<string, Record<string, { total: number; delivered: number; rate: number; avgDays: number; slaPassed: number; slaTotal: number; slaRate: number }>>
}

function getShipDate(order: LogisticsOrder): string | null {
  if (order.erpInfo?.shippedAt) return order.erpInfo.shippedAt
  return null
}

function getDeliveryDate(order: LogisticsOrder): string | null {
  if (order.deliveryDate) return order.deliveryDate
  for (const ev of order.events) {
    if (ev.subStatus === 'Delivered_Other' || ev.status === 'delivered') {
      return ev.timestamp
    }
  }
  if (order.status === 'delivered' && order.events.length > 0) {
    return order.events[0].timestamp
  }
  return null
}

function calcDaysBetween(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (isNaN(s) || isNaN(e)) return -1
  return Math.round((e - s) / (1000 * 60 * 60 * 24) * 10) / 10
}

export function calculateMetrics(orders: LogisticsOrder[]): MetricsResult {
  const rules = loadSlaRules()

  const totalOrders = orders.length
  const notFoundOrders = orders.filter((o) => o.status === 'not_found').length
  const validOrders = totalOrders - notFoundOrders
  const deliveredOrders = orders.filter((o) => o.status === 'delivered').length
  const inTransitOrders = orders.filter((o) =>
    ['info_received', 'in_transit', 'available_for_pickup', 'out_for_delivery'].includes(o.status)
  ).length
  const exceptionOrders = orders.filter((o) =>
    ['expired', 'delivery_failure', 'exception'].includes(o.status)
  ).length

  const deliveryRate = validOrders > 0 ? deliveredOrders / validOrders : 0
  const exceptionRate = validOrders > 0 ? exceptionOrders / validOrders : 0
  const inTransitRate = validOrders > 0 ? inTransitOrders / validOrders : 0

  const deliveredList = orders.filter((o) => o.status === 'delivered')
  const transitDaysList: number[] = []
  const slaResults: { passed: boolean; region: string; carrier: string; country: string }[] = []

  for (const o of deliveredList) {
    const shipDate = getShipDate(o)
    const deliveryDate = getDeliveryDate(o)
    if (!shipDate || !deliveryDate) continue
    const days = calcDaysBetween(shipDate, deliveryDate)
    if (days < 0) continue
    transitDaysList.push(days)

    const region = DESTINATION_REGION_MAP[o.destinationCountry] || 'other'
    const matchedRule = matchSlaRule(o.destinationCountry, o.carrier, rules)
    const slaDays = matchedRule ? matchedRule.slaDays : o.slaDays
    const passed = days <= slaDays
    slaResults.push({ passed, region, carrier: o.carrier, country: o.destinationCountry })
  }

  const avgTransitDays = transitDaysList.length > 0
    ? Math.round((transitDaysList.reduce((a, b) => a + b, 0) / transitDaysList.length) * 10) / 10
    : 0

  const slaTotal = slaResults.length
  const slaPassed = slaResults.filter((r) => r.passed).length
  const slaComplianceRate = slaTotal > 0 ? slaPassed / slaTotal : 0

  const deliveryRateByCarrier: Record<string, { total: number; delivered: number; rate: number }> = {}
  for (const o of orders) {
    if (o.status === 'not_found') continue
    if (!deliveryRateByCarrier[o.carrier]) deliveryRateByCarrier[o.carrier] = { total: 0, delivered: 0, rate: 0 }
    deliveryRateByCarrier[o.carrier].total++
    if (o.status === 'delivered') deliveryRateByCarrier[o.carrier].delivered++
  }
  for (const v of Object.values(deliveryRateByCarrier)) {
    v.rate = v.total > 0 ? v.delivered / v.total : 0
  }

  const slaByCarrier: Record<string, { rate: number; total: number; passed: number }> = {}
  for (const r of slaResults) {
    if (!slaByCarrier[r.carrier]) slaByCarrier[r.carrier] = { rate: 0, total: 0, passed: 0 }
    slaByCarrier[r.carrier].total++
    if (r.passed) slaByCarrier[r.carrier].passed++
  }
  for (const v of Object.values(slaByCarrier)) {
    v.rate = v.total > 0 ? v.passed / v.total : 0
  }

  const deliveryRateByCountry: Record<string, { total: number; delivered: number; rate: number }> = {}
  for (const o of orders) {
    if (o.status === 'not_found') continue
    const c = o.destinationCountry || 'unknown'
    if (!deliveryRateByCountry[c]) deliveryRateByCountry[c] = { total: 0, delivered: 0, rate: 0 }
    deliveryRateByCountry[c].total++
    if (o.status === 'delivered') deliveryRateByCountry[c].delivered++
  }
  for (const v of Object.values(deliveryRateByCountry)) {
    v.rate = v.total > 0 ? v.delivered / v.total : 0
  }

  const transitDaysByCountry: Record<string, { avg: number; count: number; days: number[] }> = {}
  for (const o of deliveredList) {
    const shipDate = getShipDate(o)
    const deliveryDate = getDeliveryDate(o)
    if (!shipDate || !deliveryDate) continue
    const days = calcDaysBetween(shipDate, deliveryDate)
    if (days < 0) continue
    const c = o.destinationCountry || 'unknown'
    if (!transitDaysByCountry[c]) transitDaysByCountry[c] = { avg: 0, count: 0, days: [] }
    transitDaysByCountry[c].days.push(days)
    transitDaysByCountry[c].count++
  }
  for (const v of Object.values(transitDaysByCountry)) {
    v.avg = v.days.length > 0
      ? Math.round((v.days.reduce((a, b) => a + b, 0) / v.days.length) * 10) / 10
      : 0
  }

  const transitDaysByCarrier: Record<string, { avg: number; count: number; days: number[] }> = {}
  for (const o of deliveredList) {
    const shipDate = getShipDate(o)
    const deliveryDate = getDeliveryDate(o)
    if (!shipDate || !deliveryDate) continue
    const days = calcDaysBetween(shipDate, deliveryDate)
    if (days < 0) continue
    if (!transitDaysByCarrier[o.carrier]) transitDaysByCarrier[o.carrier] = { avg: 0, count: 0, days: [] }
    transitDaysByCarrier[o.carrier].days.push(days)
    transitDaysByCarrier[o.carrier].count++
  }
  for (const v of Object.values(transitDaysByCarrier)) {
    v.avg = v.days.length > 0
      ? Math.round((v.days.reduce((a, b) => a + b, 0) / v.days.length) * 10) / 10
      : 0
  }

  const slaByCountry: Record<string, { rate: number; total: number; passed: number }> = {}
  for (const r of slaResults) {
    if (!slaByCountry[r.country]) slaByCountry[r.country] = { rate: 0, total: 0, passed: 0 }
    slaByCountry[r.country].total++
    if (r.passed) slaByCountry[r.country].passed++
  }
  for (const v of Object.values(slaByCountry)) {
    v.rate = v.total > 0 ? v.passed / v.total : 0
  }

  const byCountryAndCarrier: MetricsResult['byCountryAndCarrier'] = {}
  for (const o of orders) {
    if (o.status === 'not_found') continue
    const country = o.destinationCountry || 'unknown'
    const carrier = o.carrier
    if (!byCountryAndCarrier[country]) byCountryAndCarrier[country] = {}
    if (!byCountryAndCarrier[country][carrier]) {
      byCountryAndCarrier[country][carrier] = { total: 0, delivered: 0, rate: 0, avgDays: 0, slaPassed: 0, slaTotal: 0, slaRate: 0 }
    }
    byCountryAndCarrier[country][carrier].total++
    if (o.status === 'delivered') byCountryAndCarrier[country][carrier].delivered++
  }
  for (const o of deliveredList) {
    const country = o.destinationCountry || 'unknown'
    const carrier = o.carrier
    const cell = byCountryAndCarrier[country]?.[carrier]
    if (!cell) continue
    const shipDate = getShipDate(o)
    const deliveryDate = getDeliveryDate(o)
    if (!shipDate || !deliveryDate) continue
    const days = calcDaysBetween(shipDate, deliveryDate)
    if (days < 0) continue
    const matchedRule = matchSlaRule(o.destinationCountry, o.carrier, rules)
    const slaDays = matchedRule ? matchedRule.slaDays : o.slaDays
    cell.avgDays = cell.avgDays === 0 ? days : (cell.avgDays * cell.slaTotal + days) / (cell.slaTotal + 1)
    cell.slaTotal++
    if (days <= slaDays) cell.slaPassed++
  }
  for (const countryObj of Object.values(byCountryAndCarrier)) {
    for (const cell of Object.values(countryObj)) {
      cell.rate = cell.total > 0 ? cell.delivered / cell.total : 0
      cell.avgDays = cell.slaTotal > 0 ? Math.round(cell.avgDays * 10) / 10 : 0
      cell.slaRate = cell.slaTotal > 0 ? cell.slaPassed / cell.slaTotal : 0
    }
  }

  return {
    totalOrders,
    validOrders,
    deliveredOrders,
    inTransitOrders,
    exceptionOrders,
    notFoundOrders,
    deliveryRate,
    avgTransitDays,
    slaComplianceRate,
    slaTotal,
    slaPassed,
    exceptionRate,
    inTransitRate,
    deliveryRateByCarrier,
    deliveryRateByCountry,
    transitDaysByCountry,
    transitDaysByCarrier,
    slaByCountry,
    slaByCarrier,
    byCountryAndCarrier,
  }
}
