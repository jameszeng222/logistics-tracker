export interface StatusKeywordRule {
  id: string
  name: string
  statusKey: string
  keywords: string[]
  enabled: boolean
}

export interface StatusKeyDef {
  key: string
  label: string
  description: string
}

export const STATUS_KEYS: StatusKeyDef[] = [
  { key: 'online', label: '已上网', description: '包裹被承运商揽收/扫描入库' },
  { key: 'customs_in', label: '清关中', description: '包裹进入海关清关流程' },
  { key: 'customs_out', label: '清关完成', description: '包裹完成海关清关放行' },
  { key: 'delivery', label: '派送中', description: '包裹正在末端派送' },
  { key: 'delivered', label: '已签收', description: '包裹已妥投签收' },
  { key: 'returning', label: '退件中', description: '包裹正在退回' },
]

const STORAGE_KEY = 'status_keyword_rules'

export const DEFAULT_STATUS_KEYWORD_RULES: StatusKeywordRule[] = [
  {
    id: 'skr_1',
    name: '揽收上网',
    statusKey: 'online',
    keywords: ['pick up', 'picked up', 'collected', '揽收', '收寄', 'acceptance', 'received by carrier', 'shipment received', 'collection'],
    enabled: true,
  },
  {
    id: 'skr_2',
    name: '清关中',
    statusKey: 'customs_in',
    keywords: ['customs', 'clearance', '清关', '海关', 'import clearance'],
    enabled: true,
  },
  {
    id: 'skr_3',
    name: '清关完成',
    statusKey: 'customs_out',
    keywords: ['customs released', 'cleared customs', '清关完成', '清关放行', 'released by customs'],
    enabled: true,
  },
  {
    id: 'skr_4',
    name: '派送中',
    statusKey: 'delivery',
    keywords: ['out for delivery', 'delivering', '派送', '投递', 'with delivery courier'],
    enabled: true,
  },
  {
    id: 'skr_5',
    name: '已签收',
    statusKey: 'delivered',
    keywords: ['delivered', 'signed', '签收', '妥投', 'delivery confirmed'],
    enabled: true,
  },
  {
    id: 'skr_6',
    name: '退件中',
    statusKey: 'returning',
    keywords: ['return', 'returning', '退回', '退件', 'sending back', 'returned to sender'],
    enabled: true,
  },
]

export function loadStatusKeywordRules(): StatusKeywordRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...DEFAULT_STATUS_KEYWORD_RULES]
}

export function saveStatusKeywordRules(rules: StatusKeywordRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export function findEventByStatusKey(
  events: { timestamp: string; description: string }[],
  statusKey: string,
  rules?: StatusKeywordRule[],
): { timestamp: string; description: string } | null {
  const ruleList = rules || loadStatusKeywordRules()
  const matchedRules = ruleList.filter((r) => r.enabled && r.statusKey === statusKey)
  if (matchedRules.length === 0) return null

  const allKeywords = matchedRules.flatMap((r) => r.keywords)

  for (const event of events) {
    const desc = event.description.toLowerCase()
    if (allKeywords.some((kw) => desc.includes(kw.toLowerCase()))) {
      return event
    }
  }
  return null
}

export function getOnlineTime(
  events: { timestamp: string; description: string }[],
  rules?: StatusKeywordRule[],
): string | null {
  const result = findEventByStatusKey(events, 'online', rules)
  return result?.timestamp || null
}
