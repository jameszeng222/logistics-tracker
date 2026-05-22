import dayjs from 'dayjs'
import type { LogisticsOrder, TrackingEvent, ExceptionInfo, OrderStatus, EventPhase, ExceptionCategory, ExceptionSubType } from '@/types'
import { CARRIERS } from '@/types'

const DESTINATIONS = [
  { country: '美国', city: '洛杉矶' },
  { country: '英国', city: '伦敦' },
  { country: '德国', city: '柏林' },
  { country: '法国', city: '巴黎' },
  { country: '日本', city: '东京' },
  { country: '澳大利亚', city: '悉尼' },
  { country: '加拿大', city: '多伦多' },
  { country: '巴西', city: '圣保罗' },
]

const ORIGINS = ['深圳', '广州', '上海', '义乌', '杭州']

const PHASE_SEQUENCE: EventPhase[] = ['pickup', 'export', 'customs', 'transit', 'delivery', 'delivered']

const PHASE_LOCATIONS: Record<EventPhase, string[]> = {
  pickup: ['深圳转运中心', '广州分拨中心', '上海集散中心', '义乌仓储中心'],
  export: ['深圳海关', '上海浦东机场', '广州白云机场', '杭州萧山机场'],
  customs: ['目的地海关', '入境口岸海关', '转关口岸'],
  transit: ['国际中转枢纽', '区域分拨中心', '目的地国家分拣中心'],
  arrival: ['目的国港口', '目的国机场'],
  delivery: ['本地配送站', '末端配送网点'],
  delivered: ['收件人地址', '代收点', '快递柜'],
  pickup_point: ['自提点', '代收网点'],
}

const PHASE_DESCRIPTIONS: Record<EventPhase, string[]> = {
  pickup: ['包裹已揽收', '已收入分拨中心', '包裹已入库'],
  export: ['已出口互换局', '已发往目的地', '航班已起飞'],
  customs: ['海关放行', '清关完成', '海关查验中'],
  transit: ['到达中转站', '正在运输中', '到达目的国'],
  arrival: ['已到达目的国', '到达目的港'],
  delivery: ['派送中', '安排投递', '快递员取件'],
  delivered: ['已签收', '已妥投', '代收已签收'],
  pickup_point: ['已到达自提点', '待取件'],
}

const EXCEPTION_DESCRIPTIONS: Record<ExceptionSubType, string[]> = {
  Expired_Other: ['超出承诺时效未妥投', '物流信息超过7天未更新'],
  DeliveryFailure_Other: ['投递失败', '其他原因投递失败'],
  DeliveryFailure_NoBody: ['无法联系收件人', '收件人不在家'],
  DeliveryFailure_Security: ['安全原因投递失败', '关税未缴纳'],
  DeliveryFailure_Rejected: ['收件人拒收', '收件人拒绝接收'],
  DeliveryFailure_InvalidAddress: ['收件地址不完整', '地址错误需更正'],
  Exception_Other: ['物流异常', '其他异常情况'],
  Exception_Returning: ['无法投递退回', '超期未取退回'],
  Exception_Returned: ['退件已签收', '退件完成'],
  Exception_NoBody: ['无法联系收件人', '收件人信息异常'],
  Exception_Security: ['安全原因被扣留', '包含违禁物品', '海关扣留查验'],
  Exception_Damage: ['包裹破损', '外包装严重变形', '内件损坏'],
  Exception_Rejected: ['收件人拒收', '派送前拒收'],
  Exception_Delayed: ['运输延误', '超出预计时效'],
  Exception_Lost: ['物流信息异常，疑似丢失', '包裹在运输途中丢失'],
  Exception_Destroyed: ['包裹已销毁', '无法交付已销毁'],
  Exception_Cancel: ['订单已取消', '物流订单取消'],
}

function randomItem<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateTrackingNumber(carrier: string): string {
  const prefixes: Record<string, string> = {
    DHL: 'DHL',
    FedEx: 'FX',
    UPS: '1Z',
    EMS: 'EM',
    '云途': 'YT',
    '递四方': '4PX',
  }
  const prefix = prefixes[carrier] || 'XX'
  return `${prefix}${Date.now().toString(36).toUpperCase()}${randomInt(1000, 9999)}`
}

function generateOrderId(): string {
  return `CB${dayjs().format('YYYYMMDD')}${randomInt(100000, 999999)}`
}

function generateEvents(
  shipDate: dayjs.Dayjs,
  status: OrderStatus,
  destCountry: string,
  destCity: string
): TrackingEvent[] {
  const events: TrackingEvent[] = []
  let currentTime = shipDate

  const endPhase = status === 'delivered' ? 6 : status === 'exception' ? randomInt(2, 4) : randomInt(1, 5)

  for (let i = 0; i < Math.min(endPhase, PHASE_SEQUENCE.length); i++) {
    const phase = PHASE_SEQUENCE[i]
    const hoursToAdd = phase === 'pickup' ? randomInt(1, 8) : phase === 'export' ? randomInt(4, 24) : phase === 'customs' ? randomInt(12, 72) : phase === 'transit' ? randomInt(24, 96) : phase === 'delivery' ? randomInt(4, 24) : randomInt(1, 12)
    currentTime = currentTime.add(hoursToAdd, 'hour')

    const location = i >= 2 && phase !== 'pickup'
      ? `${destCity}${randomItem(PHASE_LOCATIONS[phase])}`
      : randomItem(PHASE_LOCATIONS[phase])

    events.push({
      timestamp: currentTime.format('YYYY-MM-DD HH:mm'),
      location,
      status: phase,
      subStatus: phase,
      description: randomItem(PHASE_DESCRIPTIONS[phase]),
      phase,
    })
  }

  return events
}

function generateException(status: OrderStatus, orderId: string): ExceptionInfo | undefined {
  if (status !== 'exception' && status !== 'delivery_failure' && status !== 'expired') return undefined

  const categoryMap: Record<string, ExceptionCategory> = {
    expired: 'expired',
    delivery_failure: 'delivery_failure',
    exception: 'exception',
  }
  const category = categoryMap[status] || 'exception'

  const subTypeMap: Record<string, ExceptionSubType[]> = {
    expired: ['Expired_Other'],
    delivery_failure: ['DeliveryFailure_NoBody', 'DeliveryFailure_Security', 'DeliveryFailure_Rejected', 'DeliveryFailure_InvalidAddress', 'DeliveryFailure_Other'],
    exception: ['Exception_Returning', 'Exception_Security', 'Exception_Damage', 'Exception_Rejected', 'Exception_Delayed', 'Exception_Lost', 'Exception_Cancel', 'Exception_Other'],
  }
  const subType = randomItem(subTypeMap[status] || ['Exception_Other']) as ExceptionSubType

  return {
    category,
    subType,
    description: randomItem(EXCEPTION_DESCRIPTIONS[subType]),
    createdAt: dayjs().subtract(randomInt(1, 10), 'day').format('YYYY-MM-DD HH:mm'),
    ticketId: Math.random() > 0.5 ? `TK${randomInt(10000, 99999)}` : undefined,
    ticketStatus: Math.random() > 0.3 ? (Math.random() > 0.5 ? 'processing' : 'resolved') : 'pending',
    resolution: Math.random() > 0.6 ? '已联系承运商处理' : undefined,
  }
}

export function generateMockOrders(count: number = 250): LogisticsOrder[] {
  const orders: LogisticsOrder[] = []

  for (let i = 0; i < count; i++) {
    const carrier = randomItem(CARRIERS)
    const dest = randomItem(DESTINATIONS)
    const origin = randomItem(ORIGINS)
    const shipDate = dayjs().subtract(randomInt(1, 45), 'day')

    const rand = Math.random()
    const status: OrderStatus = rand < 0.55 ? 'delivered' : rand < 0.70 ? 'in_transit' : rand < 0.78 ? 'out_for_delivery' : rand < 0.85 ? 'available_for_pickup' : rand < 0.92 ? 'exception' : rand < 0.96 ? 'delivery_failure' : 'expired'

    const slaDays = carrier === 'DHL' || carrier === 'FedEx' ? randomInt(5, 10) : carrier === 'UPS' ? randomInt(7, 12) : randomInt(10, 25)

    const events = generateEvents(shipDate, status, dest.country, dest.city)

    const lastEvent = events[events.length - 1]
    const deliveryDate = status === 'delivered' && lastEvent?.phase === 'delivered'
      ? lastEvent.timestamp
      : undefined

    const actualDays = deliveryDate
      ? dayjs(deliveryDate).diff(dayjs(shipDate), 'day', true)
      : undefined

    const currentLocation = lastEvent?.location || origin

    orders.push({
      orderId: generateOrderId(),
      trackingNumber: generateTrackingNumber(carrier),
      carrier,
      origin,
      destination: `${dest.country} ${dest.city}`,
      destinationCountry: dest.country,
      status,
      shipDate: shipDate.format('YYYY-MM-DD'),
      deliveryDate: deliveryDate ? dayjs(deliveryDate).format('YYYY-MM-DD') : undefined,
      slaDays,
      actualDays: actualDays ? Math.round(actualDays * 10) / 10 : undefined,
      weight: Math.round((randomInt(50, 5000) / 1000) * 100) / 100,
      currentLocation,
      events,
      exception: generateException(status, generateOrderId()),
      syncMeta: { source: 'mock', lastSyncAt: null, syncVersion: 0 },
    })
  }

  return orders
}
