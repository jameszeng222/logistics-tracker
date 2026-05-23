export type OrderStatus =
  | 'not_found'
  | 'info_received'
  | 'in_transit'
  | 'expired'
  | 'available_for_pickup'
  | 'out_for_delivery'
  | 'delivery_failure'
  | 'delivered'
  | 'exception'

export type TrackSubStatus17 =
  | 'NotFound_Other'
  | 'NotFound_InvalidCode'
  | 'InfoReceived'
  | 'InTransit_PickedUp'
  | 'InTransit_Other'
  | 'InTransit_Departure'
  | 'InTransit_Arrival'
  | 'InTransit_CustomsProcessing'
  | 'InTransit_CustomsReleased'
  | 'InTransit_CustomsRequiringInformation'
  | 'Expired_Other'
  | 'AvailableForPickup_Other'
  | 'OutForDelivery_Other'
  | 'DeliveryFailure_Other'
  | 'DeliveryFailure_NoBody'
  | 'DeliveryFailure_Security'
  | 'DeliveryFailure_Rejected'
  | 'DeliveryFailure_InvalidAddress'
  | 'Delivered_Other'
  | 'Exception_Other'
  | 'Exception_Returning'
  | 'Exception_Returned'
  | 'Exception_NoBody'
  | 'Exception_Security'
  | 'Exception_Damage'
  | 'Exception_Rejected'
  | 'Exception_Delayed'
  | 'Exception_Lost'
  | 'Exception_Destroyed'
  | 'Exception_Cancel'

export type EventPhase =
  | 'info'
  | 'pickup'
  | 'export'
  | 'customs'
  | 'transit'
  | 'arrival'
  | 'delivery'
  | 'delivered'
  | 'pickup_point'

export type ExceptionCategory = 'expired' | 'delivery_failure' | 'exception'

export type ExceptionSubType =
  | 'Expired_Other'
  | 'DeliveryFailure_Other'
  | 'DeliveryFailure_NoBody'
  | 'DeliveryFailure_Security'
  | 'DeliveryFailure_Rejected'
  | 'DeliveryFailure_InvalidAddress'
  | 'Exception_Other'
  | 'Exception_Returning'
  | 'Exception_Returned'
  | 'Exception_NoBody'
  | 'Exception_Security'
  | 'Exception_Damage'
  | 'Exception_Rejected'
  | 'Exception_Delayed'
  | 'Exception_Lost'
  | 'Exception_Destroyed'
  | 'Exception_Cancel'

export type TicketStatus = 'pending' | 'processing' | 'resolved'

export interface TrackingEvent {
  timestamp: string
  location: string
  status: string
  subStatus: string
  description: string
  phase: EventPhase
}

export interface ExceptionInfo {
  category: ExceptionCategory
  subType: ExceptionSubType
  description: string
  createdAt: string
  ticketId?: string
  ticketStatus?: TicketStatus
  resolution?: string
}

export interface ErpInfo {
  orderNo: string
  createdAt?: string
  shippedAt?: string
  warehouse?: string
  team?: string
  warehouseCode?: string
  platform?: string
  shippingQty?: number
  destinationCountry?: string
  paymentTime?: string
  packingTime?: string
  checkoutTime?: string
  logisticsProvider?: string
  logisticsProviderDisplayName?: string
  currentChannel?: string
  trackingNumber?: string
}

export interface SyncMeta {
  source: 'mock' | '17track' | 'csv_import' | 'excel_import' | 'erp_webhook'
  lastSyncAt: string | null
  syncVersion: number
  carrierCode?: number
}

export interface LogisticsOrder {
  orderId: string
  trackingNumber: string
  carrier: string
  origin: string
  destination: string
  destinationCountry: string
  status: OrderStatus
  shipDate: string
  deliveryDate?: string
  slaDays: number
  actualDays?: number
  weight: number
  currentLocation: string
  events: TrackingEvent[]
  exception?: ExceptionInfo
  erpInfo?: ErpInfo
  syncMeta?: SyncMeta
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  not_found: '查询不到',
  info_received: '收到信息',
  in_transit: '运输途中',
  expired: '运输过久',
  available_for_pickup: '到达待取',
  out_for_delivery: '派送途中',
  delivery_failure: '投递失败',
  delivered: '已签收',
  exception: '可能异常',
}

export const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; dot: string }> = {
  not_found: { bg: 'bg-amber-50', text: 'text-amber-600', dot: '#F59E0B' },
  info_received: { bg: 'bg-blue-50', text: 'text-blue-600', dot: '#3B82F6' },
  in_transit: { bg: 'bg-blue-50', text: 'text-blue-600', dot: '#3B82F6' },
  expired: { bg: 'bg-amber-50', text: 'text-amber-600', dot: '#F59E0B' },
  available_for_pickup: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: '#10B981' },
  out_for_delivery: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: '#10B981' },
  delivery_failure: { bg: 'bg-red-50', text: 'text-red-600', dot: '#EF4444' },
  delivered: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: '#10B981' },
  exception: { bg: 'bg-red-50', text: 'text-red-600', dot: '#EF4444' },
}

export const LEVEL_COLORS: Record<'normal' | 'warning' | 'danger' | 'special' | 'transit', { bg: string; text: string; dot: string }> = {
  normal: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: '#10B981' },
  transit: { bg: 'bg-blue-50', text: 'text-blue-600', dot: '#3B82F6' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-600', dot: '#F59E0B' },
  danger: { bg: 'bg-red-50', text: 'text-red-600', dot: '#EF4444' },
  special: { bg: 'bg-purple-50', text: 'text-purple-600', dot: '#A855F7' },
}

export const STATUS_LEVEL: Record<OrderStatus, 'normal' | 'transit' | 'warning' | 'danger'> = {
  not_found: 'warning',
  info_received: 'transit',
  in_transit: 'transit',
  expired: 'warning',
  available_for_pickup: 'normal',
  out_for_delivery: 'normal',
  delivery_failure: 'danger',
  delivered: 'normal',
  exception: 'danger',
}

export const STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  not_found: '查询操作但没有得到结果',
  info_received: '运输商收到下单信息，等待取件',
  in_transit: '包裹正在运输途中',
  expired: '包裹运输很长时间仍未投递成功',
  available_for_pickup: '包裹已到达目的地投递点，需自取',
  out_for_delivery: '包裹正在投递过程中',
  delivery_failure: '包裹尝试派送但未能成功交付',
  delivered: '包裹已妥投签收',
  exception: '包裹可能被退回、扣留、损坏、丢失等',
}

export const STATUS_SUB_STATUSES: Record<OrderStatus, TrackSubStatus17[]> = {
  not_found: ['NotFound_Other', 'NotFound_InvalidCode'],
  info_received: ['InfoReceived'],
  in_transit: [
    'InTransit_PickedUp', 'InTransit_Other', 'InTransit_Departure',
    'InTransit_Arrival', 'InTransit_CustomsProcessing',
    'InTransit_CustomsReleased', 'InTransit_CustomsRequiringInformation',
  ],
  expired: ['Expired_Other'],
  available_for_pickup: ['AvailableForPickup_Other'],
  out_for_delivery: ['OutForDelivery_Other'],
  delivery_failure: [
    'DeliveryFailure_Other', 'DeliveryFailure_NoBody',
    'DeliveryFailure_Security', 'DeliveryFailure_Rejected',
    'DeliveryFailure_InvalidAddress',
  ],
  delivered: ['Delivered_Other'],
  exception: [
    'Exception_Other', 'Exception_Returning', 'Exception_Returned',
    'Exception_NoBody', 'Exception_Security', 'Exception_Damage',
    'Exception_Rejected', 'Exception_Delayed', 'Exception_Lost',
    'Exception_Destroyed', 'Exception_Cancel',
  ],
}

export const SUB_STATUS_LABELS: Record<TrackSubStatus17, string> = {
  NotFound_Other: '运输商没有返回信息',
  NotFound_InvalidCode: '物流单号无效',
  InfoReceived: '收到信息',
  InTransit_PickedUp: '已揽收',
  InTransit_Other: '运输途中-其他',
  InTransit_Departure: '已离港',
  InTransit_Arrival: '已到港',
  InTransit_CustomsProcessing: '清关中',
  InTransit_CustomsReleased: '清关完成',
  InTransit_CustomsRequiringInformation: '需要资料',
  Expired_Other: '运输过久',
  AvailableForPickup_Other: '到达待取',
  OutForDelivery_Other: '派送途中',
  DeliveryFailure_Other: '投递失败-其他',
  DeliveryFailure_NoBody: '找不到收件人',
  DeliveryFailure_Security: '安全原因',
  DeliveryFailure_Rejected: '拒收',
  DeliveryFailure_InvalidAddress: '地址错误',
  Delivered_Other: '成功签收',
  Exception_Other: '异常-其他',
  Exception_Returning: '退件中',
  Exception_Returned: '退件签收',
  Exception_NoBody: '找不到收件人',
  Exception_Security: '安全/扣留',
  Exception_Damage: '损坏',
  Exception_Rejected: '拒收',
  Exception_Delayed: '延误',
  Exception_Lost: '丢失',
  Exception_Destroyed: '销毁',
  Exception_Cancel: '取消',
}

export const EXCEPTION_CATEGORY_LABELS: Record<ExceptionCategory, string> = {
  expired: '运输过久',
  delivery_failure: '投递失败',
  exception: '可能异常',
}

export const EXCEPTION_CATEGORY_COLORS: Record<ExceptionCategory, { bg: string; text: string; dot: string }> = {
  expired: { bg: 'bg-amber-50', text: 'text-amber-600', dot: '#F59E0B' },
  delivery_failure: { bg: 'bg-orange-50', text: 'text-orange-600', dot: '#F97316' },
  exception: { bg: 'bg-red-50', text: 'text-red-600', dot: '#EF4444' },
}

export const EXCEPTION_SUBTYPE_LABELS: Record<ExceptionSubType, string> = {
  Expired_Other: '运输过久',
  DeliveryFailure_Other: '投递失败-其他',
  DeliveryFailure_NoBody: '投递失败-找不到收件人',
  DeliveryFailure_Security: '投递失败-安全原因',
  DeliveryFailure_Rejected: '投递失败-拒收',
  DeliveryFailure_InvalidAddress: '投递失败-地址错误',
  Exception_Other: '异常-其他',
  Exception_Returning: '退件中',
  Exception_Returned: '退件签收',
  Exception_NoBody: '异常-找不到收件人',
  Exception_Security: '安全/扣留',
  Exception_Damage: '损坏',
  Exception_Rejected: '拒收',
  Exception_Delayed: '延误',
  Exception_Lost: '丢失',
  Exception_Destroyed: '销毁',
  Exception_Cancel: '取消',
}

export const EXCEPTION_SUBTYPE_CATEGORY: Record<ExceptionSubType, ExceptionCategory> = {
  Expired_Other: 'expired',
  DeliveryFailure_Other: 'delivery_failure',
  DeliveryFailure_NoBody: 'delivery_failure',
  DeliveryFailure_Security: 'delivery_failure',
  DeliveryFailure_Rejected: 'delivery_failure',
  DeliveryFailure_InvalidAddress: 'delivery_failure',
  Exception_Other: 'exception',
  Exception_Returning: 'exception',
  Exception_Returned: 'exception',
  Exception_NoBody: 'exception',
  Exception_Security: 'exception',
  Exception_Damage: 'exception',
  Exception_Rejected: 'exception',
  Exception_Delayed: 'exception',
  Exception_Lost: 'exception',
  Exception_Destroyed: 'exception',
  Exception_Cancel: 'exception',
}

export const CATEGORY_SUBTYPES: Record<ExceptionCategory, ExceptionSubType[]> = {
  expired: ['Expired_Other'],
  delivery_failure: [
    'DeliveryFailure_Other',
    'DeliveryFailure_NoBody',
    'DeliveryFailure_Security',
    'DeliveryFailure_Rejected',
    'DeliveryFailure_InvalidAddress',
  ],
  exception: [
    'Exception_Other',
    'Exception_Returning',
    'Exception_Returned',
    'Exception_NoBody',
    'Exception_Security',
    'Exception_Damage',
    'Exception_Rejected',
    'Exception_Delayed',
    'Exception_Lost',
    'Exception_Destroyed',
    'Exception_Cancel',
  ],
}

export const CARRIERS = ['DHL', 'FedEx', 'UPS', 'EMS', '云途', '递四方'] as const

export const PHASE_LABELS: Record<EventPhase, string> = {
  info: '收到信息',
  pickup: '揽收',
  export: '出境',
  customs: '清关',
  transit: '中转',
  arrival: '到港',
  delivery: '派送',
  delivered: '签收',
  pickup_point: '待取',
}
