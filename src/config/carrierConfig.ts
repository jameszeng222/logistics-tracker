export interface CarrierMapping {
  erpName: string
  track17Names: string[]
}

const MAPPING_KEY = 'carrier_name_mappings_v3'

export const DEFAULT_MAPPINGS: CarrierMapping[] = [
  { erpName: '云途物流', track17Names: ['YunExpress'] },
  { erpName: '万邑通', track17Names: ['Wanyitong', 'WYT'] },
  { erpName: '递四方', track17Names: ['4PX', '4PX Express'] },
  { erpName: '燕文物流', track17Names: ['Yanwen', 'YANWEN Express'] },
  { erpName: '菜鸟', track17Names: ['Cainiao', 'Cainiao Super Economy'] },
  { erpName: 'DHL', track17Names: ['DHL', 'DHL Express', 'DHL eCommerce'] },
  { erpName: 'FedEx', track17Names: ['FedEx', 'FedEx Express', 'FedEx Ground'] },
  { erpName: 'UPS', track17Names: ['UPS', 'UPS Express', 'UPS Ground'] },
  { erpName: 'EMS', track17Names: ['EMS', 'China EMS'] },
  { erpName: 'ePacket', track17Names: ['ePacket', 'China Post ePacket'] },
  { erpName: '皇家物流', track17Names: ['PFC Express'] },
  { erpName: '飞特物流', track17Names: ['FlytExpress'] },
  { erpName: '中外运', track17Names: ['Sinotrans'] },
  { erpName: '纵腾集团', track17Names: ['Zongteng'] },
]

export function loadCarrierMappings(): CarrierMapping[] {
  try {
    const raw = localStorage.getItem(MAPPING_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...DEFAULT_MAPPINGS]
}

export function saveCarrierMappings(mappings: CarrierMapping[]): void {
  localStorage.setItem(MAPPING_KEY, JSON.stringify(mappings))
}

export function resolveCarrierName(carrierFrom17track: string): string {
  if (!carrierFrom17track) return ''
  const mappings = loadCarrierMappings()
  for (const m of mappings) {
    if (m.track17Names.some(t17 => t17.toLowerCase() === carrierFrom17track.toLowerCase())) {
      return m.erpName
    }
  }
  return carrierFrom17track
}

export function resolve17trackName(erpName: string): string[] {
  if (!erpName) return []
  const mappings = loadCarrierMappings()
  const m = mappings.find(m => m.erpName === erpName)
  return m?.track17Names || []
}

export interface LogisticsProvider {
  id: string
  name: string
}

export interface ChannelName {
  id: string
  name: string
  providerId: string
}

const PROVIDER_KEY = 'logistics_providers_v3'
const CHANNEL_KEY = 'channel_names_v3'

export function loadProviders(): LogisticsProvider[] {
  const mappings = loadCarrierMappings()
  return mappings.map((m, i) => ({ id: `lp_${i}`, name: m.erpName }))
}

export function loadChannels(): ChannelName[] {
  const mappings = loadCarrierMappings()
  const channels: ChannelName[] = []
  mappings.forEach((m, i) => {
    m.track17Names.forEach((t17, j) => {
      channels.push({ id: `ch_${i}_${j}`, name: t17, providerId: `lp_${i}` })
    })
  })
  return channels
}

export function getChannelsForProvider(providerId: string, channels?: ChannelName[]): ChannelName[] {
  const chList = channels || loadChannels()
  return chList.filter(c => c.providerId === providerId)
}
