import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LogisticsOrder, ExceptionInfo, OrderStatus, ExceptionCategory, ExceptionSubType, ErpInfo } from '@/types'
import { EXCEPTION_SUBTYPE_LABELS, CATEGORY_SUBTYPES, EXCEPTION_CATEGORY_LABELS } from '@/types'
import { getTrackInfo, testApiConnection } from '@/services/track17'
import { fetchErpOrders, mapErpOrderToInfo } from '@/services/erpApi'
import { convertTrackInfoToOrder, convertTrackListToOrders } from '@/utils/trackMapper'
import { fetchOrdersFromD1, upsertOrdersToD1, clearAllOrdersFromD1, getOrderCountFromD1 } from '@/services/d1Api'
import dayjs from 'dayjs'

interface FilterState {
  search: string
  carrier: string
  status: string
  destination: string
  dateRange: { start: string; end: string }
  exceptionType: string
  ticketStatus: string
}

interface SyncProgress {
  phase: 'idle' | 'listing' | 'fetching' | 'done'
  totalItems: number
  fetchedItems: number
  currentPage: number
  totalPages: number
}

interface Track17Config {
  apiKey: string
  connected: boolean
  lastSync: string | null
  syncing: boolean
  syncError: string | null
  syncProgress: SyncProgress
  autoSync: boolean
  autoSyncInterval: number
}

interface LogisticsStore {
  orders: LogisticsOrder[]
  filters: FilterState
  selectedOrderId: string | null
  initialized: boolean
  track17Config: Track17Config

  initialize: () => void
  loadFromD1: () => Promise<void>
  setOrders: (orders: LogisticsOrder[]) => void
  addOrders: (orders: LogisticsOrder[]) => void
  mergeOrders: (orders: LogisticsOrder[]) => void
  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  selectOrder: (orderId: string | null) => void
  updateExceptionTicket: (orderId: string, updates: Partial<ExceptionInfo>) => void
  setTrack17ApiKey: (key: string) => void
  testConnection: () => Promise<{ success: boolean; message: string }>
  syncFrom17Track: () => Promise<void>
  fetchTrackDetail: (number: string, carrier?: number) => Promise<void>
  syncErpOrders: () => Promise<void>
  setAutoSync: (enabled: boolean) => void
  startAutoSync: () => void
  stopAutoSync: () => void

  getFilteredOrders: () => LogisticsOrder[]
  getOrderById: (orderId: string) => LogisticsOrder | undefined
  getDeliveryAnalysis: () => {
    totalOrders: number
    deliveredCount: number
    deliveryRate: number
    byCarrier: Record<string, { total: number; delivered: number; rate: number }>
    byDestination: Record<string, { total: number; delivered: number; rate: number }>
    trend: Array<{ date: string; rate: number }>
  }
  getTimelinessAnalysis: () => {
    avgDays: number
    medianDays: number
    p90Days: number
    slaComplianceRate: number
    byPhase: Record<string, { avgHours: number; medianHours: number }>
    byCarrier: Record<string, { avgDays: number; slaRate: number }>
    distribution: Array<{ range: string; count: number }>
  }
  getExceptionSummary: () => { byCategory: Record<ExceptionCategory, number>; bySubType: Partial<Record<ExceptionSubType, number>> }
  getStatusDistribution: () => { byStatus: Record<string, number>; bySubStatus: Record<string, number>; total: number }
  getKPIs: () => {
    totalOrders: number
    deliveryRate: number
    avgDays: number
    exceptionCount: number
    slaComplianceRate: number
    inTransitCount: number
  }
}

const defaultFilters: FilterState = {
  search: '',
  carrier: '',
  status: '',
  destination: '',
  dateRange: { start: '', end: '' },
  exceptionType: '',
  ticketStatus: '',
}

const defaultSyncProgress: SyncProgress = {
  phase: 'idle',
  totalItems: 0,
  fetchedItems: 0,
  currentPage: 0,
  totalPages: 0,
}

let autoSyncTimer: ReturnType<typeof setInterval> | null = null

const RATE_LIMIT_MS = 400

export const useLogisticsStore = create<LogisticsStore>()(
  persist(
    (set, get) => ({
  orders: [],
  filters: { ...defaultFilters },
  selectedOrderId: null,
  initialized: false,
  track17Config: {
    apiKey: localStorage.getItem('17track_api_key') || '',
    connected: false,
    lastSync: localStorage.getItem('17track_last_sync') || null,
    syncing: false,
    syncError: null,
    syncProgress: { ...defaultSyncProgress },
    autoSync: localStorage.getItem('17track_auto_sync') === 'true',
    autoSyncInterval: 6 * 60 * 60 * 1000,
  },

  initialize: () => {
    if (get().initialized) return
    set({ initialized: true })
    get().loadFromD1()
    if (get().track17Config.autoSync && get().track17Config.apiKey) {
      get().startAutoSync()
    }
  },

  loadFromD1: async () => {
    try {
      const result = await fetchOrdersFromD1({ limit: 10000 })
      if (result.orders.length > 0) {
        set({ orders: result.orders })
      }
    } catch {
    }
  },

  setOrders: (orders) => set({ orders }),
  addOrders: (newOrders) => set((state) => {
    const existingIds = new Set(state.orders.map((o) => o.orderId))
    const unique = newOrders.filter((o) => !existingIds.has(o.orderId))
    return { orders: [...state.orders, ...unique] }
  }),

  mergeOrders: (incoming) => set((state) => {
    const incomingMap = new Map<string, LogisticsOrder>(incoming.map((o) => [o.orderId, o]))
    const merged = state.orders.map((o) => {
      const inc = incomingMap.get(o.orderId)
      if (inc) {
        incomingMap.delete(o.orderId)
        const incIsNewer = inc.syncMeta?.lastSyncAt && o.syncMeta?.lastSyncAt
          ? inc.syncMeta.lastSyncAt > o.syncMeta.lastSyncAt
          : !!inc.syncMeta?.lastSyncAt
        return incIsNewer ? { ...o, ...inc, orderId: o.orderId } : o
      }
      return o
    })
    const newOrders = [...incomingMap.values()]
    const allMerged = [...merged, ...newOrders]
    upsertOrdersToD1(incoming).catch(() => {})
    return { orders: allMerged }
  }),

  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
  selectOrder: (orderId) => set({ selectedOrderId: orderId }),

  updateExceptionTicket: (orderId, updates) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.orderId === orderId && o.exception
          ? { ...o, exception: { ...o.exception, ...updates } }
          : o
      ),
    })),

  setTrack17ApiKey: (key) => {
    localStorage.setItem('17track_api_key', key)
    set({ track17Config: { ...get().track17Config, apiKey: key, connected: false, syncError: null } })
  },

  testConnection: async () => {
    const { track17Config } = get()
    if (!track17Config.apiKey) {
      return { success: false, message: '请先配置API密钥' }
    }
    set({ track17Config: { ...track17Config, syncError: null } })
    const result = await testApiConnection(track17Config.apiKey)
    if (result.success) {
      set({ track17Config: { ...get().track17Config, connected: true, syncError: null } })
    } else {
      set({ track17Config: { ...get().track17Config, connected: false, syncError: result.message } })
    }
    return result
  },

  syncFrom17Track: async () => {
    const { track17Config } = get()
    if (!track17Config.apiKey) {
      set({ track17Config: { ...track17Config, syncError: '请先配置API密钥' } })
      return
    }
    const orderItems = get().orders
      .filter((o) => o.trackingNumber && o.trackingNumber.length >= 5)
      .map((o) => {
        const item: { number: string; carrier?: number } = { number: o.trackingNumber }
        if (o.syncMeta?.carrierCode) item.carrier = o.syncMeta.carrierCode
        return item
      })
    if (orderItems.length === 0) {
      set({ track17Config: { ...track17Config, syncError: '系统中暂无追踪号，请先输入追踪号拉取数据' } })
      return
    }
    set({
      track17Config: {
        ...track17Config,
        syncing: true,
        syncError: null,
        syncProgress: { ...defaultSyncProgress, phase: 'fetching', totalItems: orderItems.length, fetchedItems: 0 },
      },
    })
    try {
      const testResult = await testApiConnection(track17Config.apiKey)
      if (!testResult.success) {
        set({ track17Config: { ...get().track17Config, syncing: false, syncError: `连接测试失败: ${testResult.message}` } })
        return
      }
      const allOrders: LogisticsOrder[] = []
      const batchSize = 40
      for (let i = 0; i < orderItems.length; i += batchSize) {
        const batch = orderItems.slice(i, i + batchSize)
        try {
          const detailRes = await getTrackInfo(track17Config.apiKey, batch)
          if (detailRes.data.accepted?.length) {
            const orders = convertTrackListToOrders(detailRes.data.accepted)
            allOrders.push(...orders)
          }
        } catch {
          // skip failed batch
        }
        const fetched = Math.min(i + batchSize, orderItems.length)
        set({
          track17Config: {
            ...get().track17Config,
            syncProgress: { ...get().track17Config.syncProgress, fetchedItems: fetched },
          },
        })
        if (i + batchSize < orderItems.length) {
          await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
        }
      }
      if (allOrders.length > 0) {
        get().mergeOrders(allOrders)
      }
      const now = dayjs().format('YYYY-MM-DD HH:mm')
      localStorage.setItem('17track_last_sync', now)
      set({
        track17Config: {
          ...get().track17Config,
          syncing: false,
          connected: true,
          lastSync: now,
          syncError: allOrders.length === 0 ? '未查询到任何轨迹信息，请确认追踪号已在17track注册' : null,
          syncProgress: { ...defaultSyncProgress, phase: 'done', totalItems: orderItems.length, fetchedItems: allOrders.length },
        },
      })
    } catch (err: any) {
      set({ track17Config: { ...get().track17Config, syncing: false, syncError: err.message || '同步失败' } })
    }
  },

  fetchTrackDetail: async (number, carrier) => {
    const { track17Config } = get()
    if (!track17Config.apiKey) return
    try {
      const items: Array<{ number: string; carrier?: number }> = [{ number }]
      if (carrier) items[0].carrier = carrier
      const res = await getTrackInfo(track17Config.apiKey, items)
      if (res.data.accepted?.length) {
        const order = convertTrackInfoToOrder(res.data.accepted[0])
        let updated: LogisticsOrder | null = null
        set((state) => ({
          orders: state.orders.map((o) => {
            if (o.trackingNumber === number) {
              updated = { ...o, ...order, orderId: o.orderId }
              return updated
            }
            return o
          }),
        }))
        if (updated) upsertOrdersToD1([updated]).catch(() => {})
      }
    } catch {
    }
  },

  syncErpOrders: async () => {
    try {
      const result = await fetchErpOrders()
      if (!result.orders?.length) return
      const erpMap = new Map<string, ErpInfo>()
      for (const o of result.orders) {
        erpMap.set(o.trackingNumber, mapErpOrderToInfo(o))
      }
      set((state) => ({
        orders: state.orders.map((o) => {
          const erpInfo = erpMap.get(o.trackingNumber)
          if (!erpInfo) return o
          return {
            ...o,
            erpInfo,
            orderId: erpInfo.orderNo || o.orderId,
            shipDate: erpInfo.shippedAt || o.shipDate,
          }
        }),
      }))
    } catch {
      // ERP sync failure is non-critical
    }
  },

  setAutoSync: (enabled) => {
    localStorage.setItem('17track_auto_sync', String(enabled))
    set({ track17Config: { ...get().track17Config, autoSync: enabled } })
    if (enabled) {
      get().startAutoSync()
    } else {
      get().stopAutoSync()
    }
  },

  startAutoSync: () => {
    get().stopAutoSync()
    const interval = get().track17Config.autoSyncInterval
    autoSyncTimer = setInterval(() => {
      const { track17Config } = get()
      if (track17Config.apiKey && !track17Config.syncing) {
        get().syncFrom17Track()
      }
    }, interval)
  },

  stopAutoSync: () => {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer)
      autoSyncTimer = null
    }
  },

  getFilteredOrders: () => {
    const { orders, filters } = get()
    return orders.filter((o) => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (
          !o.orderId.toLowerCase().includes(s) &&
          !o.trackingNumber.toLowerCase().includes(s) &&
          !o.destination.toLowerCase().includes(s)
        )
          return false
      }
      if (filters.carrier && o.carrier !== filters.carrier) return false
      if (filters.status && o.status !== filters.status) return false
      if (filters.destination && !o.destinationCountry.includes(filters.destination)) return false
      if (filters.dateRange.start && dayjs(o.shipDate).isBefore(dayjs(filters.dateRange.start))) return false
      if (filters.dateRange.end && dayjs(o.shipDate).isAfter(dayjs(filters.dateRange.end))) return false
      if (filters.exceptionType && o.exception?.subType !== filters.exceptionType && o.exception?.category !== filters.exceptionType) return false
      if (filters.ticketStatus && o.exception?.ticketStatus !== filters.ticketStatus) return false
      return true
    })
  },

  getOrderById: (orderId) => get().orders.find((o) => o.orderId === orderId),

  getDeliveryAnalysis: () => {
    const orders = get().getFilteredOrders()
    const totalOrders = orders.length
    const deliveredCount = orders.filter((o) => o.status === 'delivered').length
    const deliveryRate = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 10000) / 100 : 0

    const byCarrier: Record<string, { total: number; delivered: number; rate: number }> = {}
    const byDestination: Record<string, { total: number; delivered: number; rate: number }> = {}

    orders.forEach((o) => {
      if (!byCarrier[o.carrier]) byCarrier[o.carrier] = { total: 0, delivered: 0, rate: 0 }
      byCarrier[o.carrier].total++
      if (o.status === 'delivered') byCarrier[o.carrier].delivered++

      if (!byDestination[o.destinationCountry]) byDestination[o.destinationCountry] = { total: 0, delivered: 0, rate: 0 }
      byDestination[o.destinationCountry].total++
      if (o.status === 'delivered') byDestination[o.destinationCountry].delivered++
    })

    Object.values(byCarrier).forEach((v) => {
      v.rate = v.total > 0 ? Math.round((v.delivered / v.total) * 10000) / 100 : 0
    })
    Object.values(byDestination).forEach((v) => {
      v.rate = v.total > 0 ? Math.round((v.delivered / v.total) * 10000) / 100 : 0
    })

    const trendMap: Record<string, { total: number; delivered: number }> = {}
    orders.forEach((o) => {
      const week = dayjs(o.shipDate).startOf('week').format('MM-DD')
      if (!trendMap[week]) trendMap[week] = { total: 0, delivered: 0 }
      trendMap[week].total++
      if (o.status === 'delivered') trendMap[week].delivered++
    })

    const trend = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        rate: v.total > 0 ? Math.round((v.delivered / v.total) * 10000) / 100 : 0,
      }))

    return { totalOrders, deliveredCount, deliveryRate, byCarrier, byDestination, trend }
  },

  getTimelinessAnalysis: () => {
    const orders = get().getFilteredOrders().filter((o) => o.actualDays !== undefined)
    const days = orders.map((o) => o.actualDays!).sort((a, b) => a - b)

    const avgDays = days.length > 0 ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : 0
    const medianDays = days.length > 0 ? days[Math.floor(days.length / 2)] : 0
    const p90Days = days.length > 0 ? days[Math.floor(days.length * 0.9)] : 0

    const allOrders = get().getFilteredOrders()
    const slaComplianceRate =
      allOrders.length > 0
        ? Math.round(
            (allOrders.filter((o) => o.actualDays !== undefined && o.actualDays <= o.slaDays).length /
              allOrders.filter((o) => o.actualDays !== undefined).length) *
              10000
          ) / 100
        : 0

    const byCarrier: Record<string, { avgDays: number; slaRate: number }> = {}
    const carrierGroups: Record<string, number[]> = {}
    const carrierSlaGroups: Record<string, { met: number; total: number }> = {}

    orders.forEach((o) => {
      if (!carrierGroups[o.carrier]) carrierGroups[o.carrier] = []
      carrierGroups[o.carrier].push(o.actualDays!)
      if (!carrierSlaGroups[o.carrier]) carrierSlaGroups[o.carrier] = { met: 0, total: 0 }
      carrierSlaGroups[o.carrier].total++
      if (o.actualDays! <= o.slaDays) carrierSlaGroups[o.carrier].met++
    })

    Object.entries(carrierGroups).forEach(([carrier, d]) => {
      byCarrier[carrier] = {
        avgDays: Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10,
        slaRate: carrierSlaGroups[carrier]
          ? Math.round((carrierSlaGroups[carrier].met / carrierSlaGroups[carrier].total) * 10000) / 100
          : 0,
      }
    })

    const distribution: Array<{ range: string; count: number }> = []
    const ranges = [
      { label: '0-5天', min: 0, max: 5 },
      { label: '6-10天', min: 6, max: 10 },
      { label: '11-15天', min: 11, max: 15 },
      { label: '16-20天', min: 16, max: 20 },
      { label: '21-30天', min: 21, max: 30 },
      { label: '30天+', min: 31, max: Infinity },
    ]
    ranges.forEach(({ label, min, max }) => {
      distribution.push({
        range: label,
        count: days.filter((d) => d >= min && d <= max).length,
      })
    })

    const phaseMap: Record<string, number[]> = {
      揽收: [],
      出境: [],
      清关: [],
      中转: [],
      派送: [],
    }
    orders.forEach((o) => {
      for (let i = 1; i < o.events.length; i++) {
        const prev = dayjs(o.events[i - 1].timestamp)
        const curr = dayjs(o.events[i].timestamp)
        const hours = curr.diff(prev, 'hour', true)
        const phaseLabel = o.events[i].phase === 'pickup' ? '揽收' : o.events[i].phase === 'export' ? '出境' : o.events[i].phase === 'customs' ? '清关' : o.events[i].phase === 'transit' ? '中转' : '派送'
        if (phaseMap[phaseLabel]) phaseMap[phaseLabel].push(hours)
      }
    })

    const byPhase: Record<string, { avgHours: number; medianHours: number }> = {}
    Object.entries(phaseMap).forEach(([phase, hours]) => {
      const sorted = [...hours].sort((a, b) => a - b)
      byPhase[phase] = {
        avgHours: hours.length > 0 ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : 0,
        medianHours: sorted.length > 0 ? Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10 : 0,
      }
    })

    return { avgDays, medianDays, p90Days, slaComplianceRate, byPhase, byCarrier, distribution }
  },

  getExceptionSummary: () => {
    const orders = get().getFilteredOrders().filter((o) => o.exception)
    const byCategory: Record<ExceptionCategory, number> = { expired: 0, delivery_failure: 0, exception: 0 }
    const bySubType: Partial<Record<ExceptionSubType, number>> = {}
    orders.forEach((o) => {
      if (o.exception) {
        byCategory[o.exception.category]++
        bySubType[o.exception.subType] = (bySubType[o.exception.subType] || 0) + 1
      }
    })
    return { byCategory, bySubType }
  },

  getStatusDistribution: () => {
    const orders = get().getFilteredOrders()
    const byStatus: Record<string, number> = {}
    const bySubStatus: Record<string, number> = {}
    orders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1
      const currentSub = o.events[0]?.subStatus
      if (currentSub) {
        bySubStatus[currentSub] = (bySubStatus[currentSub] || 0) + 1
      }
    })
    return { byStatus, bySubStatus, total: orders.length }
  },

  getKPIs: () => {
    const orders = get().getFilteredOrders()
    const totalOrders = orders.length
    const deliveredCount = orders.filter((o) => o.status === 'delivered').length
    const deliveryRate = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 10000) / 100 : 0
    const withActual = orders.filter((o) => o.actualDays !== undefined)
    const avgDays = withActual.length > 0 ? Math.round((withActual.reduce((a, o) => a + o.actualDays!, 0) / withActual.length) * 10) / 10 : 0
    const exceptionCount = orders.filter((o) => o.status === 'exception' || o.status === 'delivery_failure' || o.status === 'expired').length
    const slaMet = withActual.filter((o) => o.actualDays! <= o.slaDays).length
    const slaComplianceRate = withActual.length > 0 ? Math.round((slaMet / withActual.length) * 10000) / 100 : 0
    const inTransitCount = orders.filter((o) => ['in_transit', 'info_received', 'out_for_delivery', 'available_for_pickup'].includes(o.status)).length
    return { totalOrders, deliveryRate, avgDays, exceptionCount, slaComplianceRate, inTransitCount }
  },
    }),
    {
      name: 'logistics-store',
      partialize: (state) => ({
        track17Config: {
          apiKey: state.track17Config.apiKey,
          connected: state.track17Config.connected,
          lastSync: state.track17Config.lastSync,
          autoSync: state.track17Config.autoSync,
        },
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<LogisticsStore>
        if (!p.track17Config) return current
        return {
          ...current,
          track17Config: {
            ...current.track17Config,
            apiKey: p.track17Config.apiKey || '',
            connected: p.track17Config.connected || false,
            lastSync: p.track17Config.lastSync || null,
            autoSync: p.track17Config.autoSync || false,
          },
        }
      },
    }
  )
)
