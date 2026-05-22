const BASE_URL = '/api/17track/track/v2.4'

export interface TrackRegisterItem {
  number: string
  carrier?: number
  param?: {
    destination?: string
    postcode?: string
    phone?: string
    ship_date?: string
    city?: string
  }
  lang?: string
}

export interface TrackRegisterResponse {
  code: number
  data: {
    accepted?: Array<{ origin: number; number: string; carrier: number }>
    rejected?: Array<{ number: string; error: { code: number; message: string } }>
    errors?: Array<{ code: number; message: string }>
  }
}

export interface TrackEvent17 {
  time: string
  time_raw: number
  status: string
  sub_status: string
  location: string
  description: string
  map?: { lat: number; lng: number }
}

export interface TrackProvider {
  provider_key: number
  provider_name: string
  provider_phone?: string
  provider_tips?: string
  events: TrackEvent17[]
}

export interface TrackInfoItem {
  number: string
  carrier: number
  param?: any
  tag?: string
  track_info?: {
    shipping_info?: {
      shipper_address?: { country?: string; state?: string; city?: string; postal_code?: string }
      recipient_address?: { country?: string; state?: string; city?: string; postal_code?: string }
    }
    latest_status?: { status: string; sub_status: string }
    latest_event?: TrackEvent17
    tracking?: { providers: TrackProvider[] }
    pickup_time?: string
    destination_country?: string
    origin_country?: string
  }
  latest_status?: { status: string; sub_status: string }
  latest_event?: TrackEvent17
  tracking?: { providers: TrackProvider[] }
  pickup_time?: string
}

export interface TrackInfoResponse {
  code: number
  data: {
    accepted?: TrackInfoItem[]
    rejected?: Array<{ number: string; error: { code: number; message: string } }>
    errors?: Array<{ code: number; message: string }>
  }
}

export interface TrackListItem {
  number: string
  carrier: number
  sync_status: string
  latest_status: { status: string; sub_status: string }
  latest_event?: TrackEvent17
  pickup_time?: string
}

export interface TrackListResponse {
  code: number
  data: {
    accepted?: TrackListItem[]
    rejected?: Array<{ number: string; error: { code: number; message: string } }>
    errors?: Array<{ code: number; message: string }>
  }
}

export interface TrackRealtimeResponse {
  code: number
  data: {
    accepted?: TrackInfoItem[]
    rejected?: Array<{ number: string; error: { code: number; message: string } }>
    errors?: Array<{ code: number; message: string }>
  }
}

export type TrackStatus17 =
  | 'NotFound'
  | 'InfoReceived'
  | 'InTransit'
  | 'Expired'
  | 'AvailableForPickup'
  | 'OutForDelivery'
  | 'DeliveryFailure'
  | 'Delivered'
  | 'Exception'

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

export const STATUS_17_TO_INTERNAL: Record<TrackStatus17, string> = {
  NotFound: 'not_found',
  InfoReceived: 'info_received',
  InTransit: 'in_transit',
  Expired: 'expired',
  AvailableForPickup: 'available_for_pickup',
  OutForDelivery: 'out_for_delivery',
  DeliveryFailure: 'delivery_failure',
  Delivered: 'delivered',
  Exception: 'exception',
}

export const STATUS_17_LABELS: Record<TrackStatus17, string> = {
  NotFound: '查询不到',
  InfoReceived: '收到信息',
  InTransit: '运输途中',
  Expired: '运输过久',
  AvailableForPickup: '到达待取',
  OutForDelivery: '派送途中',
  DeliveryFailure: '投递失败',
  Delivered: '成功签收',
  Exception: '可能异常',
}

export const SUB_STATUS_17_LABELS: Record<string, string> = {
  NotFound_Other: '运输商没有返回信息',
  NotFound_InvalidCode: '物流单号无效',
  InfoReceived: '收到信息',
  InTransit_PickedUp: '已揽收',
  InTransit_Other: '运输途中',
  InTransit_Departure: '已离港',
  InTransit_Arrival: '已到港',
  InTransit_CustomsProcessing: '清关中',
  InTransit_CustomsReleased: '清关完成',
  InTransit_CustomsRequiringInformation: '需要资料',
  Expired_Other: '运输过久',
  AvailableForPickup_Other: '到达待取',
  OutForDelivery_Other: '派送途中',
  DeliveryFailure_Other: '投递失败',
  DeliveryFailure_NoBody: '找不到收件人',
  DeliveryFailure_Security: '安全原因',
  DeliveryFailure_Rejected: '拒收',
  DeliveryFailure_InvalidAddress: '地址错误',
  Delivered_Other: '成功签收',
  Exception_Other: '异常',
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

export const SUB_STATUS_TO_EXCEPTION_TYPE: Record<string, 'timeout' | 'customs' | 'address' | 'return' | 'lost' | 'damaged' | 'security' | 'destroyed' | 'cancelled' | 'delayed'> = {
  Exception_Returning: 'return',
  Exception_Returned: 'return',
  Exception_NoBody: 'address',
  Exception_Security: 'security',
  Exception_Damage: 'damaged',
  Exception_Rejected: 'return',
  Exception_Delayed: 'delayed',
  Exception_Lost: 'lost',
  Exception_Destroyed: 'destroyed',
  Exception_Cancel: 'cancelled',
  DeliveryFailure_NoBody: 'address',
  DeliveryFailure_Security: 'security',
  DeliveryFailure_Rejected: 'return',
  DeliveryFailure_InvalidAddress: 'address',
  Expired_Other: 'timeout',
}

async function apiRequest<T>(token: string, endpoint: string, body: unknown[]): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', '17token': token }
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (res.status === 401) throw new Error('API密钥无效或未授权')
  if (res.status === 429) throw new Error('请求频率超限，请稍后重试')
  if (res.status === 500) throw new Error('17track服务器错误')
  if (res.status === 503) throw new Error('17track服务暂不可用')
  if (!res.ok) throw new Error(`请求失败: HTTP ${res.status}`)
  const data = await res.json()
  if (data.code !== undefined && data.code !== 0 && data.data?.errors?.length) {
    const errMsg = data.data.errors.map((e: any) => `${e.code}: ${e.message}`).join('; ')
    throw new Error(`API错误: ${errMsg}`)
  }
  return data as T
}

async function apiRequestRaw(token: string, endpoint: string, body: unknown[]): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', '17token': token }
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { status: res.status, body: data }
}

export async function testApiConnection(token: string): Promise<{ success: boolean; message: string; raw?: any }> {
  try {
    const res = await fetch('/api/17track/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', '17token': token },
    })
    const data = await res.json()
    return { success: data.success, message: data.message, raw: data }
  } catch (err: any) {
    return { success: false, message: err.message }
  }
}

export async function getTrackInfo(token: string, items: Array<{ number: string; carrier?: number }>): Promise<TrackInfoResponse> {
  return apiRequest<TrackInfoResponse>(token, 'gettrackinfo', items)
}

export async function getRealTimeTrackInfo(token: string, items: Array<{ number: string; carrier?: number }>): Promise<TrackRealtimeResponse> {
  return apiRequest<TrackRealtimeResponse>(token, 'getrealtimetrackinfo', items)
}

export async function getTrackList(token: string, pageNo = 1, perPage = 40): Promise<TrackListResponse> {
  throw new Error('gettracklist接口暂不可用，请使用"输入追踪号拉取"功能')
}

export async function stopTrack(token: string, items: Array<{ number: string; carrier?: number }>): Promise<TrackRegisterResponse> {
  return apiRequest<TrackRegisterResponse>(token, 'stop', items)
}

export async function deleteTrack(token: string, items: Array<{ number: string; carrier?: number }>): Promise<TrackRegisterResponse> {
  return apiRequest<TrackRegisterResponse>(token, 'delete', items)
}

export async function retryTrack(token: string, items: Array<{ number: string; carrier?: number }>): Promise<TrackRegisterResponse> {
  return apiRequest<TrackRegisterResponse>(token, 'retrack', items)
}
