import type { TrackStatus17 } from '@/services/track17'
import { STATUS_17_TO_INTERNAL, STATUS_17_LABELS, SUB_STATUS_17_LABELS } from '@/services/track17'
import type { LogisticsOrder, OrderStatus, TrackingEvent, EventPhase, ExceptionInfo, ExceptionCategory, ExceptionSubType, SyncMeta } from '@/types'
import { EXCEPTION_SUBTYPE_CATEGORY, EXCEPTION_SUBTYPE_LABELS } from '@/types'
import dayjs from 'dayjs'
import { getCachedCarrierData, getCarrierData } from '@/data/carrierLoader'
import { resolveCarrierName } from '@/config/carrierConfig'

const SUB_STATUS_TO_PHASE: Record<string, EventPhase> = {
  InfoReceived: 'info',
  InTransit_PickedUp: 'pickup',
  InTransit_Departure: 'export',
  InTransit_Arrival: 'arrival',
  InTransit_CustomsProcessing: 'customs',
  InTransit_CustomsReleased: 'customs',
  InTransit_CustomsRequiringInformation: 'customs',
  InTransit_Other: 'transit',
  OutForDelivery_Other: 'delivery',
  AvailableForPickup_Other: 'pickup_point',
  Delivered_Other: 'delivered',
}

function mapPhase(mainStatus: string, subStatus: string): EventPhase {
  if (SUB_STATUS_TO_PHASE[subStatus]) return SUB_STATUS_TO_PHASE[subStatus]
  if (mainStatus === 'InTransit') return 'transit'
  if (mainStatus === 'OutForDelivery') return 'delivery'
  if (mainStatus === 'AvailableForPickup') return 'pickup_point'
  if (mainStatus === 'Delivered') return 'delivered'
  if (mainStatus === 'InfoReceived') return 'info'
  return 'transit'
}

function mapStatus(status: TrackStatus17): OrderStatus {
  return (STATUS_17_TO_INTERNAL[status] || 'in_transit') as OrderStatus
}

function getNestedValue(obj: any, ...paths: string[]): any {
  for (const path of paths) {
    const keys = path.split('.')
    let val = obj
    for (const key of keys) {
      if (val == null) break
      val = val[key]
    }
    if (val != null) return val
  }
  return null
}

function parseEventTime(ev: any): string {
  if (ev.time_raw && ev.time_raw > 0) {
    return dayjs(ev.time_raw * 1000).format('YYYY-MM-DD HH:mm')
  }
  if (ev.time_iso) {
    return dayjs(ev.time_iso).format('YYYY-MM-DD HH:mm')
  }
  if (ev.time) {
    const d = dayjs(ev.time)
    if (d.isValid()) return d.format('YYYY-MM-DD HH:mm')
  }
  return ''
}

function extractEvents(item: any): TrackingEvent[] {
  const rawEvents: any[] = []

  const providersPaths = [
    'track_info.tracking.providers',
    'tracking.providers',
  ]

  let providers: any = null
  for (const p of providersPaths) {
    providers = getNestedValue(item, p)
    if (Array.isArray(providers) && providers.length > 0) break
  }

  if (Array.isArray(providers)) {
    for (const p of providers) {
      if (Array.isArray(p?.events)) {
        rawEvents.push(...p.events)
      }
    }
  }

  if (rawEvents.length === 0 && Array.isArray(item?.events)) {
    rawEvents.push(...item.events)
  }

  if (rawEvents.length === 0) {
    return []
  }

  const mainStatus = getNestedValue(item, 'track_info.latest_status.status', 'latest_status.status') || ''

  return rawEvents.map((ev) => ({
    timestamp: parseEventTime(ev),
    location: ev.location || '',
    status: ev.status || '',
    subStatus: ev.sub_status || '',
    description: ev.description || SUB_STATUS_17_LABELS[ev.sub_status] || STATUS_17_LABELS[ev.status as TrackStatus17] || ev.status || '',
    phase: mapPhase(mainStatus, ev.sub_status || ''),
  }))
}

function generateSyntheticEvent(item: any): TrackingEvent {
  const mainStatus = (getNestedValue(item, 'track_info.latest_status.status', 'latest_status.status') || 'NotFound') as TrackStatus17
  const subStatus = getNestedValue(item, 'track_info.latest_status.sub_status', 'latest_status.sub_status') || ''
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const latestEvent = getNestedValue(item, 'track_info.latest_event', 'latest_event')
  const latestEventTime = latestEvent ? parseEventTime(latestEvent) : now

  return {
    timestamp: latestEventTime || now,
    location: latestEvent?.location || '',
    status: mainStatus,
    subStatus: subStatus,
    description: SUB_STATUS_17_LABELS[subStatus] || STATUS_17_LABELS[mainStatus] || '暂无轨迹',
    phase: mapPhase(mainStatus, subStatus),
  }
}

const STATUS_TO_CATEGORY: Record<string, ExceptionCategory> = {
  Expired: 'expired',
  DeliveryFailure: 'delivery_failure',
  Exception: 'exception',
}

function buildException(status: TrackStatus17, subStatus: string, item: any): ExceptionInfo | undefined {
  const category = STATUS_TO_CATEGORY[status]
  if (!category) return undefined

  let subType: ExceptionSubType
  if (subStatus && subStatus in EXCEPTION_SUBTYPE_CATEGORY) {
    subType = subStatus as ExceptionSubType
  } else {
    const fallback: Record<string, ExceptionSubType> = {
      Expired: 'Expired_Other',
      DeliveryFailure: 'DeliveryFailure_Other',
      Exception: 'Exception_Other',
    }
    subType = fallback[status] || 'Exception_Other'
  }

  const providers = getNestedValue(item, 'track_info.tracking.providers', 'tracking.providers')
  const providerTip = Array.isArray(providers) ? providers[0]?.provider_tips : undefined

  return {
    category,
    subType,
    description: providerTip || SUB_STATUS_17_LABELS[subStatus] || EXCEPTION_SUBTYPE_LABELS[subType] || STATUS_17_LABELS[status],
    createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    ticketStatus: 'pending',
  }
}

export function mapCarrier(carrierCode: number): string {
  const customMap = CarrierMapStore.get()
  if (customMap[carrierCode]) return resolveCarrierName(customMap[carrierCode])
  const official = getCachedCarrierData()
  const officialName = official?.[String(carrierCode)]
  if (officialName) return resolveCarrierName(officialName)
  return `承运商${carrierCode}`
}

export async function preloadCarriers(): Promise<void> {
  await getCarrierData()
}

export const CarrierMapStore = {
  STORAGE_KEY: 'carrier_map',
  _cache: null as Record<number, string> | null,
  get(): Record<number, string> {
    if (this._cache) return this._cache
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY)
      this._cache = raw ? JSON.parse(raw) : {}
    } catch {
      this._cache = {}
    }
    return this._cache!
  },
  set(map: Record<number, string>) {
    this._cache = map
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(map))
  },
  add(code: number, name: string) {
    const map = this.get()
    map[code] = name
    this.set(map)
  },
  remove(code: number) {
    const map = this.get()
    delete map[code]
    this.set(map)
  },
}

export function convertTrackInfoToOrder(item: any): LogisticsOrder {
  const mainStatus = (getNestedValue(item, 'track_info.latest_status.status', 'latest_status.status') || 'NotFound') as TrackStatus17
  const subStatus = getNestedValue(item, 'track_info.latest_status.sub_status', 'latest_status.sub_status') || ''
  const status = mapStatus(mainStatus)
  let events = extractEvents(item)

  if (events.length === 0) {
    events = [generateSyntheticEvent(item)]
  }

  const deliveredEvent = events.find((e) => e.phase === 'delivered' || e.status === 'Delivered')
  const deliveryDate = deliveredEvent?.timestamp?.split(' ')[0]
  const pickupEvent = events.find((e) => e.phase === 'pickup')
  const pickupTime = getNestedValue(item, 'track_info.pickup_time', 'pickup_time')
  const shipDate = pickupEvent?.timestamp?.split(' ')[0] || (pickupTime ? dayjs(pickupTime).format('YYYY-MM-DD') : '')

  let actualDays: number | undefined
  if (deliveryDate && shipDate) {
    actualDays = Math.round(dayjs(deliveryDate).diff(dayjs(shipDate), 'day', true) * 10) / 10
  } else if (status === 'delivered') {
    const latestEvent = getNestedValue(item, 'track_info.latest_event', 'latest_event')
    if (latestEvent) {
      const deliveredTimeStr = parseEventTime(latestEvent)
      if (deliveredTimeStr) {
        const deliveredTime = dayjs(deliveredTimeStr)
        const pt = pickupTime ? dayjs(pickupTime) : (shipDate ? dayjs(shipDate) : null)
        if (pt && deliveredTime.isAfter(pt)) {
          actualDays = Math.round(deliveredTime.diff(pt, 'day', true) * 10) / 10
        }
      }
    }
  }

  const carrier = mapCarrier(item.carrier)
  const syncMeta: SyncMeta = {
    source: '17track',
    lastSyncAt: dayjs().format('YYYY-MM-DD HH:mm'),
    syncVersion: 1,
    carrierCode: item.carrier,
  }

  const destination = getNestedValue(item,
    'track_info.shipping_info.recipient_address.country',
    'track_info.destination_country',
    'destination_country',
    'destination'
  ) || ''
  const origin = getNestedValue(item,
    'track_info.shipping_info.shipper_address.country',
    'track_info.origin_country',
    'origin_country',
    'origin'
  ) || ''

  const latestEvent = getNestedValue(item, 'track_info.latest_event', 'latest_event')

  return {
    orderId: `TN-${item.number}`,
    trackingNumber: item.number,
    carrier,
    origin,
    destination,
    destinationCountry: destination,
    status,
    shipDate,
    deliveryDate,
    slaDays: 20,
    actualDays,
    weight: 0,
    currentLocation: latestEvent?.location || (events.length > 0 ? events[0].location : ''),
    events,
    exception: buildException(mainStatus, subStatus, item),
    syncMeta,
  }
}

export function convertTrackListToOrders(items: any[]): LogisticsOrder[] {
  return items.map(convertTrackInfoToOrder)
}
