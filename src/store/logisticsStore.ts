import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LogisticsOrder, ErpInfo } from '@/types'
import { getTrackInfo, testApiConnection } from '@/services/track17'
import { convertTrackInfoToOrder, convertTrackListToOrders } from '@/utils/trackMapper'
import { upsertOrdersToD1, fetchTrackingList, lookupOrders } from '@/services/d1Api'
import dayjs from 'dayjs'

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
  initialized: boolean
  track17Config: Track17Config

  initialize: () => void
  setTrack17ApiKey: (key: string) => void
  testConnection: () => Promise<{ success: boolean; message: string }>
  syncFrom17Track: () => Promise<void>
  fetchTrackDetail: (number: string, carrier?: number) => Promise<void>
  mergeOrders: (orders: LogisticsOrder[]) => Promise<void>
  setAutoSync: (enabled: boolean) => void
  startAutoSync: () => void
  stopAutoSync: () => void
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
        if (get().track17Config.autoSync && get().track17Config.apiKey) {
          get().startAutoSync()
        }
      },

      mergeOrders: async (incoming) => {
        const trackingNumbers = incoming.map((o) => o.trackingNumber).filter(Boolean)
        const orderNos = incoming.map((o) => o.erpInfo?.orderNo).filter(Boolean) as string[]

        let existingOrders: LogisticsOrder[] = []
        if (trackingNumbers.length > 0 || orderNos.length > 0) {
          try {
            existingOrders = await lookupOrders({ trackingNumbers, orderNos })
          } catch {}
        }

        const existingByTracking = new Map<string, LogisticsOrder>()
        existingOrders.forEach((o) => {
          if (o.trackingNumber) existingByTracking.set(o.trackingNumber, o)
        })
        const existingByOrderNo = new Map<string, LogisticsOrder>()
        existingOrders.forEach((o) => {
          if (o.erpInfo?.orderNo) existingByOrderNo.set(o.erpInfo.orderNo, o)
        })

        const toUpsert: LogisticsOrder[] = []
        const updatedIds = new Set<string>()

        for (const inc of incoming) {
          const byTracking = inc.trackingNumber ? existingByTracking.get(inc.trackingNumber) : null
          const byOrderNo = inc.erpInfo?.orderNo ? existingByOrderNo.get(inc.erpInfo.orderNo) : null
          const existing = byTracking || byOrderNo

          if (existing) {
            if (!updatedIds.has(existing.orderId)) {
              const incIsNewer = inc.syncMeta?.lastSyncAt && existing.syncMeta?.lastSyncAt
                ? inc.syncMeta.lastSyncAt > existing.syncMeta.lastSyncAt
                : !!inc.syncMeta?.lastSyncAt
              let merged: LogisticsOrder
              if (incIsNewer) {
                merged = {
                  ...existing,
                  ...inc,
                  orderId: existing.orderId,
                  erpInfo: { ...existing.erpInfo, ...inc.erpInfo },
                }
              } else {
                merged = {
                  ...existing,
                  erpInfo: { ...inc.erpInfo, ...existing.erpInfo },
                }
              }
              toUpsert.push(merged)
              updatedIds.add(existing.orderId)
            }
          } else {
            toUpsert.push(inc)
          }
        }

        if (toUpsert.length > 0) {
          await upsertOrdersToD1(toUpsert)
        }
      },

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

        let orderItems: { number: string; carrier?: number }[] = []
        try {
          const trackingList = await fetchTrackingList()
          orderItems = trackingList
            .filter((t) => t.trackingNumber && t.trackingNumber.length >= 5)
            .map((t) => {
              const item: { number: string; carrier?: number } = { number: t.trackingNumber }
              if (t.carrierCode) item.carrier = t.carrierCode
              return item
            })
        } catch {
          set({ track17Config: { ...track17Config, syncError: '获取追踪号列表失败' } })
          return
        }

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
            } catch {}
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
            await get().mergeOrders(allOrders)
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
            await upsertOrdersToD1([order])
          }
        } catch {}
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
        return {
          ...current,
          track17Config: {
            ...current.track17Config,
            apiKey: p.track17Config?.apiKey || '',
            connected: p.track17Config?.connected || false,
            lastSync: p.track17Config?.lastSync || null,
            autoSync: p.track17Config?.autoSync || false,
          },
        }
      },
    }
  )
)
