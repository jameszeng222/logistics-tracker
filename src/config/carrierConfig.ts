export interface LogisticsProvider {
  id: string
  name: string
}

export interface ChannelName {
  id: string
  name: string
  providerId: string
}

export interface FinalCarrier {
  id: string
  name: string
  channelId: string
}

export interface CarrierMapping {
  track17Code: number
  track17Name: string
  level: 1 | 2 | 3
  providerId: string
  channelId: string
  carrierId: string
}

const PROVIDER_KEY = 'logistics_providers'
const CHANNEL_KEY = 'channel_names'
const CARRIER_KEY = 'final_carriers'
const MAPPING_KEY = 'carrier_mappings_v2'

export const DEFAULT_PROVIDERS: LogisticsProvider[] = [
  { id: 'lp_1', name: '万邑通' },
  { id: 'lp_2', name: '云途物流' },
  { id: 'lp_3', name: '递四方' },
  { id: 'lp_4', name: 'DHL' },
  { id: 'lp_5', name: 'FedEx' },
  { id: 'lp_6', name: 'UPS' },
  { id: 'lp_7', name: 'EMS' },
]

export const DEFAULT_CHANNELS: ChannelName[] = [
  { id: 'ch_1', name: '五日达', providerId: 'lp_1' },
  { id: 'ch_2', name: '十日达', providerId: 'lp_1' },
  { id: 'ch_3', name: '云途特快', providerId: 'lp_2' },
  { id: 'ch_4', name: '云途标准', providerId: 'lp_2' },
  { id: 'ch_5', name: '递四方标准', providerId: 'lp_3' },
  { id: 'ch_6', name: '递四方快捷', providerId: 'lp_3' },
  { id: 'ch_7', name: 'DHL Express', providerId: 'lp_4' },
  { id: 'ch_8', name: 'DHL Economy', providerId: 'lp_4' },
  { id: 'ch_9', name: 'FedEx International', providerId: 'lp_5' },
  { id: 'ch_10', name: 'FedEx Economy', providerId: 'lp_5' },
  { id: 'ch_11', name: 'UPS Express', providerId: 'lp_6' },
  { id: 'ch_12', name: 'UPS Standard', providerId: 'lp_6' },
  { id: 'ch_13', name: 'EMS标准', providerId: 'lp_7' },
]

export const DEFAULT_CARRIERS: FinalCarrier[] = [
  { id: 'fc_1', name: 'gofo', channelId: 'ch_1' },
  { id: 'fc_2', name: 'yanwen', channelId: 'ch_3' },
]

export function loadProviders(): LogisticsProvider[] {
  try {
    const raw = localStorage.getItem(PROVIDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...DEFAULT_PROVIDERS]
}

export function saveProviders(providers: LogisticsProvider[]): void {
  localStorage.setItem(PROVIDER_KEY, JSON.stringify(providers))
}

export function loadChannels(): ChannelName[] {
  try {
    const raw = localStorage.getItem(CHANNEL_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...DEFAULT_CHANNELS]
}

export function saveChannels(channels: ChannelName[]): void {
  localStorage.setItem(CHANNEL_KEY, JSON.stringify(channels))
}

export function loadCarriers(): FinalCarrier[] {
  try {
    const raw = localStorage.getItem(CARRIER_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...DEFAULT_CARRIERS]
}

export function saveCarriers(carriers: FinalCarrier[]): void {
  localStorage.setItem(CARRIER_KEY, JSON.stringify(carriers))
}

export function loadCarrierMappings(): CarrierMapping[] {
  try {
    const raw = localStorage.getItem(MAPPING_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export function saveCarrierMappings(mappings: CarrierMapping[]): void {
  localStorage.setItem(MAPPING_KEY, JSON.stringify(mappings))
}

export function getChannelsForProvider(providerId: string, channels?: ChannelName[]): ChannelName[] {
  const chList = channels || loadChannels()
  return chList.filter((c) => c.providerId === providerId)
}

export function getCarriersForChannel(channelId: string, carriers?: FinalCarrier[]): FinalCarrier[] {
  const cList = carriers || loadCarriers()
  return cList.filter((c) => c.channelId === channelId)
}

export function resolveMapping(
  track17Code: number,
  providers?: LogisticsProvider[],
  channels?: ChannelName[],
  carriers?: FinalCarrier[],
  mappings?: CarrierMapping[],
): { provider: LogisticsProvider | null; channel: ChannelName | null; carrier: FinalCarrier | null } {
  const mList = mappings || loadCarrierMappings()
  const pList = providers || loadProviders()
  const chList = channels || loadChannels()
  const cList = carriers || loadCarriers()
  const mapping = mList.find((m) => m.track17Code === track17Code)
  if (!mapping) return { provider: null, channel: null, carrier: null }
  const provider = pList.find((p) => p.id === mapping.providerId) || null
  const channel = chList.find((c) => c.id === mapping.channelId) || null
  const carrier = cList.find((c) => c.id === mapping.carrierId) || null
  return { provider, channel, carrier }
}

export function getFullCarrierName(
  providerId: string,
  channelId: string,
  carrierId: string,
  providers?: LogisticsProvider[],
  channels?: ChannelName[],
  carriers?: FinalCarrier[],
): string {
  const pList = providers || loadProviders()
  const chList = channels || loadChannels()
  const cList = carriers || loadCarriers()
  const parts: string[] = []
  const provider = pList.find((p) => p.id === providerId)
  if (provider) parts.push(provider.name)
  const channel = chList.find((c) => c.id === channelId)
  if (channel) parts.push(channel.name)
  const carrier = cList.find((c) => c.id === carrierId)
  if (carrier) parts.push(carrier.name)
  return parts.join(' - ') || '未映射'
}
