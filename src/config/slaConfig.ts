import { loadProviders, loadChannels } from '@/config/carrierConfig'

export interface SlaRule {
  id: string
  name: string
  country: string
  primaryCarrierId: string
  secondaryChannelId: string
  slaDays: number
  enabled: boolean
}

export const DESTINATION_REGIONS = [
  { value: 'southeast_asia', label: '东南亚' },
  { value: 'east_asia', label: '东亚' },
  { value: 'south_asia', label: '南亚' },
  { value: 'middle_east', label: '中东' },
  { value: 'europe', label: '欧洲' },
  { value: 'north_america', label: '北美' },
  { value: 'south_america', label: '南美' },
  { value: 'africa', label: '非洲' },
  { value: 'oceania', label: '大洋洲' },
  { value: '*', label: '全部区域' },
] as const

export const DESTINATION_REGION_MAP: Record<string, string> = {
  VN: 'southeast_asia', TH: 'southeast_asia', PH: 'southeast_asia',
  MY: 'southeast_asia', ID: 'southeast_asia', SG: 'southeast_asia',
  KH: 'southeast_asia', MM: 'southeast_asia', LA: 'southeast_asia',
  BN: 'southeast_asia', TL: 'southeast_asia',
  CN: 'east_asia', JP: 'east_asia', KR: 'east_asia',
  TW: 'east_asia', HK: 'east_asia', MO: 'east_asia',
  IN: 'south_asia', PK: 'south_asia', BD: 'south_asia',
  LK: 'south_asia', NP: 'south_asia',
  SA: 'middle_east', AE: 'middle_east', IL: 'middle_east',
  TR: 'middle_east', IR: 'middle_east', QA: 'middle_east',
  KW: 'middle_east', BH: 'middle_east', OM: 'middle_east',
  GB: 'europe', DE: 'europe', FR: 'europe', IT: 'europe',
  ES: 'europe', NL: 'europe', BE: 'europe', PL: 'europe',
  CZ: 'europe', PT: 'europe', SE: 'europe', AT: 'europe',
  CH: 'europe', DK: 'europe', NO: 'europe', FI: 'europe',
  IE: 'europe', GR: 'europe', RO: 'europe', HU: 'europe',
  US: 'north_america', CA: 'north_america', MX: 'north_america',
  BR: 'south_america', AR: 'south_america', CL: 'south_america',
  CO: 'south_america', PE: 'south_america', VE: 'south_america',
  EG: 'africa', ZA: 'africa', NG: 'africa', KE: 'africa',
  MA: 'africa', GH: 'africa', TZ: 'africa', ET: 'africa',
  AU: 'oceania', NZ: 'oceania',
}

export const DEFAULT_SLA_RULES: SlaRule[] = [
  { id: 'r1', name: '东南亚标准', country: 'VN', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 7, enabled: true },
  { id: 'r1b', name: '泰国标准', country: 'TH', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 7, enabled: true },
  { id: 'r1c', name: '菲律宾标准', country: 'PH', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 7, enabled: true },
  { id: 'r1d', name: '马来西亚标准', country: 'MY', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 7, enabled: true },
  { id: 'r1e', name: '印尼标准', country: 'ID', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 7, enabled: true },
  { id: 'r1f', name: '新加坡标准', country: 'SG', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 7, enabled: true },
  { id: 'r2', name: '东亚标准', country: 'JP', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 7, enabled: true },
  { id: 'r2b', name: '韩国标准', country: 'KR', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 7, enabled: true },
  { id: 'r3', name: '南亚标准', country: 'IN', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 12, enabled: true },
  { id: 'r4', name: '中东标准', country: 'AE', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 15, enabled: true },
  { id: 'r4b', name: '沙特标准', country: 'SA', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 15, enabled: true },
  { id: 'r5', name: '英国标准', country: 'GB', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 15, enabled: true },
  { id: 'r5b', name: '德国标准', country: 'DE', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 15, enabled: true },
  { id: 'r5c', name: '法国标准', country: 'FR', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 15, enabled: true },
  { id: 'r6', name: '美国标准', country: 'US', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 15, enabled: true },
  { id: 'r6b', name: '加拿大标准', country: 'CA', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 15, enabled: true },
  { id: 'r7', name: '巴西标准', country: 'BR', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 25, enabled: true },
  { id: 'r8', name: '南非标准', country: 'ZA', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 25, enabled: true },
  { id: 'r9', name: '澳洲标准', country: 'AU', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 12, enabled: true },
  { id: 'r10', name: '快递渠道全球', country: '*', primaryCarrierId: 'pc_1', secondaryChannelId: '*', slaDays: 5, enabled: true },
  { id: 'r10b', name: 'FedEx全球', country: '*', primaryCarrierId: 'pc_2', secondaryChannelId: '*', slaDays: 5, enabled: true },
  { id: 'r10c', name: 'UPS全球', country: '*', primaryCarrierId: 'pc_3', secondaryChannelId: '*', slaDays: 5, enabled: true },
  { id: 'r11', name: '默认SLA', country: '*', primaryCarrierId: '*', secondaryChannelId: '*', slaDays: 20, enabled: true },
]

const STORAGE_KEY = 'sla_rules'

export function loadSlaRules(): SlaRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...DEFAULT_SLA_RULES]
}

export function saveSlaRules(rules: SlaRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export function matchSlaRule(
  destinationCountry: string,
  carrier: string,
  rules?: SlaRule[],
): SlaRule | null {
  const list = rules || loadSlaRules()
  for (const rule of list) {
    if (!rule.enabled) continue
    const countryMatch = rule.country === '*' || rule.country === destinationCountry
    if (!countryMatch) continue
    if (rule.primaryCarrierId === '*' && rule.secondaryChannelId === '*') return rule
    if (rule.primaryCarrierId !== '*') {
      const providers = loadProviders()
      const matched = providers.find((p) => p.id === rule.primaryCarrierId)
      if (matched && carrier.includes(matched.name)) {
        if (rule.secondaryChannelId === '*') return rule
        const channels = loadChannels()
        const chMatched = channels.find((c) => c.id === rule.secondaryChannelId)
        if (chMatched && carrier.includes(chMatched.name)) return rule
      }
      continue
    }
    if (rule.primaryCarrierId === '*' && rule.secondaryChannelId !== '*') return rule
  }
  return null
}
