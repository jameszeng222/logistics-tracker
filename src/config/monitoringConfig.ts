import { getOnlineTime, loadStatusKeywordRules } from '@/config/statusKeywords'

export interface MonitoringRule {
  id: string
  name: string
  type: 'not_online' | 'not_delivered' | 'not_shipped' | 'keyword'
  enabled: boolean
  country: string
  primaryCarrierId: string
  secondaryChannelId: string
  hoursThreshold: number
  timeBase: 'createdAt' | 'shippedAt'
  keywords: string[]
  matchMode: 'any' | 'all'
}

const STORAGE_KEY = 'monitoring_rules'

export const DEFAULT_MONITORING_RULES: MonitoringRule[] = [
  {
    id: 'mr_1',
    name: '超时未上网',
    type: 'not_online',
    enabled: true,
    country: '*',
    primaryCarrierId: '*',
    secondaryChannelId: '*',
    hoursThreshold: 120,
    timeBase: 'shippedAt',
    keywords: [],
    matchMode: 'any',
  },
  {
    id: 'mr_2',
    name: '超时未妥投',
    type: 'not_delivered',
    enabled: true,
    country: '*',
    primaryCarrierId: '*',
    secondaryChannelId: '*',
    hoursThreshold: 720,
    timeBase: 'shippedAt',
    keywords: [],
    matchMode: 'any',
  },
  {
    id: 'mr_6',
    name: '超时未出库',
    type: 'not_shipped',
    enabled: true,
    country: '*',
    primaryCarrierId: '*',
    secondaryChannelId: '*',
    hoursThreshold: 48,
    timeBase: 'createdAt',
    keywords: [],
    matchMode: 'any',
  },
  {
    id: 'mr_3',
    name: '扣留监控',
    type: 'keyword',
    enabled: true,
    country: '*',
    primaryCarrierId: '*',
    secondaryChannelId: '*',
    hoursThreshold: 0,
    timeBase: 'shippedAt',
    keywords: ['扣留', '海关扣留', 'detained', 'seized', 'customs hold'],
    matchMode: 'any',
  },
  {
    id: 'mr_4',
    name: '退回监控',
    type: 'keyword',
    enabled: true,
    country: '*',
    primaryCarrierId: '*',
    secondaryChannelId: '*',
    hoursThreshold: 0,
    timeBase: 'shippedAt',
    keywords: ['退回', '退件', 'return', 'returned', 'sending back'],
    matchMode: 'any',
  },
  {
    id: 'mr_5',
    name: '损坏监控',
    type: 'keyword',
    enabled: true,
    country: '*',
    primaryCarrierId: '*',
    secondaryChannelId: '*',
    hoursThreshold: 0,
    timeBase: 'shippedAt',
    keywords: ['损坏', '破损', 'damaged', 'broken'],
    matchMode: 'any',
  },
]

export function loadMonitoringRules(): MonitoringRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...DEFAULT_MONITORING_RULES]
}

export function saveMonitoringRules(rules: MonitoringRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export function checkNotOnline(
  order: { status: string; erpInfo?: { shippedAt?: string; createdAt?: string }; shipDate: string; events: { timestamp: string; description: string }[] },
  rule: MonitoringRule,
): boolean {
  if (rule.type !== 'not_online') return false
  const onlineTime = getOnlineTime(order.events)
  if (onlineTime) return false
  const baseTime = order.erpInfo?.shippedAt
  if (!baseTime) return false
  const now = Date.now()
  const base = new Date(baseTime).getTime()
  if (isNaN(base)) return false
  const hoursDiff = (now - base) / (1000 * 60 * 60)
  return hoursDiff > rule.hoursThreshold
}

export function checkNotShipped(
  order: { status: string; erpInfo?: { shippedAt?: string; createdAt?: string }; shipDate: string },
  rule: MonitoringRule,
): boolean {
  if (rule.type !== 'not_shipped') return false
  if (order.status === 'delivered') return false
  if (!(!order.erpInfo?.shippedAt && !order.shipDate)) return false
  const createdAt = order.erpInfo?.createdAt
  if (!createdAt) return false
  const now = Date.now()
  const base = new Date(createdAt).getTime()
  if (isNaN(base)) return false
  const hoursDiff = (now - base) / (1000 * 60 * 60)
  return hoursDiff > rule.hoursThreshold
}

export function checkNotDelivered(
  order: { status: string; erpInfo?: { shippedAt?: string }; shipDate: string },
  rule: MonitoringRule,
): boolean {
  if (rule.type !== 'not_delivered') return false
  if (order.status === 'delivered') return false
  const baseTime = order.erpInfo?.shippedAt
  if (!baseTime) return false
  const now = Date.now()
  const base = new Date(baseTime).getTime()
  if (isNaN(base)) return false
  const hoursDiff = (now - base) / (1000 * 60 * 60)
  return hoursDiff > rule.hoursThreshold
}

export function checkKeyword(
  order: { events: { description: string }[] },
  rule: MonitoringRule,
): boolean {
  if (rule.type !== 'keyword') return false
  if (!rule.keywords || rule.keywords.length === 0) return false
  const allText = order.events.map((e) => e.description.toLowerCase()).join(' ')
  if (rule.matchMode === 'all') {
    return rule.keywords.every((kw) => allText.includes(kw.toLowerCase()))
  }
  return rule.keywords.some((kw) => allText.includes(kw.toLowerCase()))
}

export function matchMonitoringRule(
  order: {
    status: string
    destinationCountry: string
    carrier: string
    erpInfo?: { shippedAt?: string; createdAt?: string }
    shipDate: string
    events: { timestamp: string; description: string }[]
  },
  rule: MonitoringRule,
  primaryCarriers?: { id: string; name: string }[],
): boolean {
  if (!rule.enabled) return false
  if (rule.country !== '*' && order.destinationCountry !== rule.country) return false
  if (rule.primaryCarrierId !== '*') {
    const carriers = primaryCarriers || []
    const carrier = carriers.find((c) => c.id === rule.primaryCarrierId)
    if (carrier && !order.carrier.includes(carrier.name)) return false
  }
  if (rule.type === 'not_online') return checkNotOnline(order, rule)
  if (rule.type === 'not_shipped') return checkNotShipped(order, rule)
  if (rule.type === 'not_delivered') return checkNotDelivered(order, rule)
  if (rule.type === 'keyword') return checkKeyword(order, rule)
  return false
}
