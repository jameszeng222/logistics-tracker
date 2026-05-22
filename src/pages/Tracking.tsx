import { useState, useEffect, useCallback } from 'react'
import {
  Search, RotateCcw, Eye, X, ChevronLeft, ChevronRight,
  MapPin, AlertTriangle, Calendar, Truck, RefreshCw, Download,
  FileDown, Upload, Copy, ExternalLink, Loader2, Plus,
} from 'lucide-react'
import FulfillmentImporter, { type ParsedFulfillmentRow } from '@/components/FulfillmentImporter'
import dayjs from 'dayjs'
import { useLogisticsStore } from '@/store/logisticsStore'
import { STATUS_LABELS, EXCEPTION_SUBTYPE_LABELS, EXCEPTION_CATEGORY_LABELS } from '@/types'
import type { OrderStatus, LogisticsOrder } from '@/types'
import { matchSlaRule } from '@/config/slaConfig'
import type { SlaTimeBase } from '@/config/slaConfig'
import { getOnlineTime } from '@/config/statusKeywords'
import StatusBadge from '@/components/StatusBadge'
import TrackingTimeline from '@/components/TrackingTimeline'
import { fetchOrdersFromD1, fetchFilterOptions } from '@/services/d1Api'
import type { FilterOptions } from '@/services/d1Api'

type TimeField = 'createdAt' | 'shippedAt' | 'shipDate'

const TIME_FIELD_OPTIONS: { value: TimeField; label: string }[] = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'shippedAt', label: '出库时间' },
  { value: 'shipDate', label: '提取时间' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 50

function getActualDaysByBase(order: LogisticsOrder, timeBase: SlaTimeBase): number | null {
  const deliveryDate = order.deliveryDate || (order.status === 'delivered' ? order.events?.[0]?.timestamp : null)
  if (!deliveryDate) return null

  let startTime: string | null = null
  if (timeBase === 'created_to_delivered') {
    startTime = order.erpInfo?.createdAt || ''
  } else if (timeBase === 'shipped_to_delivered') {
    startTime = order.erpInfo?.shippedAt || order.shipDate || ''
  } else if (timeBase === 'online_to_delivered') {
    startTime = getOnlineTime(order.events)
  }

  if (!startTime) return null
  return Math.round((new Date(deliveryDate).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60 * 24) * 10) / 10
}

function getActualDays(order: LogisticsOrder): number | null {
  const matched = matchSlaRule(order.destinationCountry, order.carrier)
  const timeBase = matched?.timeBase || 'shipped_to_delivered'
  return getActualDaysByBase(order, timeBase)
}

function getSlaDays(order: LogisticsOrder): number {
  const matched = matchSlaRule(order.destinationCountry, order.carrier)
  return matched ? matched.slaDays : order.slaDays
}

function exportToCSV(orders: LogisticsOrder[], filename: string) {
  const BOM = '\uFEFF'
  const headers = [
    '订单号', '追踪号', '承运商', '物流服务商', '渠道', '目的地', '目的国家',
    '主状态', '发货仓库', '发货团队',
    'ERP出库时间', '签收时间', '实际时效(天)', '达标时效(天)',
  ]
  const rows = orders.map((o) => {
    const actual = getActualDays(o)
    const sla = getSlaDays(o)
    return [
      o.orderId,
      o.trackingNumber,
      o.carrier,
      o.erpInfo?.logisticsProviderDisplayName || '',
      o.erpInfo?.currentChannel || '',
      o.destination,
      o.destinationCountry,
      STATUS_LABELS[o.status],
      o.erpInfo?.warehouse || '',
      o.erpInfo?.team || '',
      o.erpInfo?.shippedAt || o.shipDate || '',
      o.deliveryDate || '',
      actual !== null ? String(actual) : '-',
      `${sla}天`,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`)
  })
  const csv = BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function parseBatchSearch(text: string): string[] {
  return text
    .split(/[\n,;，；]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function Tracking() {
  const store = useLogisticsStore()

  const [batchText, setBatchText] = useState('')
  const [carrierFilter, setCarrierFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('US')
  const [timeField, setTimeField] = useState<TimeField>('shippedAt')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  const [orders, setOrders] = useState<LogisticsOrder[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    countries: [],
    carriers: [],
    warehouses: [],
    teams: [],
    statuses: [],
  })

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [importerOpen, setImporterOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const result = await fetchOrdersFromD1({
          status: statusFilter || undefined,
          country: countryFilter || undefined,
          carrier: carrierFilter || undefined,
          warehouse: warehouseFilter || undefined,
          team: teamFilter || undefined,
          search: batchText.trim() || undefined,
          timeField,
          timeStart: timeStart || undefined,
          timeEnd: timeEnd || undefined,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        })
        if (!cancelled) {
          setOrders(result.orders)
          setTotalCount(result.total)
        }
      } catch {
        if (!cancelled) {
          setOrders([])
          setTotalCount(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [batchText, carrierFilter, countryFilter, timeField, timeStart, timeEnd, warehouseFilter, teamFilter, statusFilter, page, pageSize, refreshKey])

  useEffect(() => {
    fetchFilterOptions().then(setFilterOptions).catch(() => {})
  }, [refreshKey])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const selectedOrder = selectedOrderId ? orders.find((o) => o.orderId === selectedOrderId) : undefined

  const hasActiveFilter = batchText.trim() || carrierFilter || countryFilter || timeStart || timeEnd || warehouseFilter || teamFilter || statusFilter

  const handleFulfillmentImport = useCallback(async (rows: ParsedFulfillmentRow[]) => {
    const newOrders: LogisticsOrder[] = rows.map((row) => ({
      orderId: `ERP-${row.orderNo}`,
      trackingNumber: row.trackingNumber,
      carrier: row.logisticsProvider || row.logisticsProviderDisplayName || '未知',
      origin: '',
      destination: '',
      destinationCountry: row.destinationCountry || '',
      status: 'not_found' as const,
      shipDate: row.checkoutTime || '',
      deliveryDate: '',
      slaDays: 20,
      actualDays: undefined,
      weight: 0,
      currentLocation: '',
      events: [],
      erpInfo: {
        orderNo: row.orderNo,
        warehouseCode: row.warehouseCode,
        platform: row.platform,
        shippingQty: row.shippingQty,
        destinationCountry: row.destinationCountry,
        paymentTime: row.paymentTime,
        createdAt: row.createdAt,
        packingTime: row.packingTime,
        checkoutTime: row.checkoutTime,
        logisticsProvider: row.logisticsProvider,
        logisticsProviderDisplayName: row.logisticsProviderDisplayName,
        currentChannel: row.currentChannel,
        trackingNumber: row.trackingNumber,
        shippedAt: row.checkoutTime || '',
        warehouse: row.warehouseCode || '',
      },
      syncMeta: {
        source: 'csv_import' as const,
        lastSyncAt: '',
        syncVersion: 1,
      },
    }))
    try {
      const count = await store.mergeOrders(newOrders)
      alert(`成功导入 ${count} 条履约单`)
    } catch (err: any) {
      alert(`导入失败: ${err?.message || '未知错误'}`)
    }
    setImporterOpen(false)
    setRefreshKey((k) => k + 1)
  }, [store])

  const handleAddTrackingNumbers = useCallback(async () => {
    const numbers = parseBatchSearch(batchText)
    if (numbers.length === 0) return
    const newOrders: LogisticsOrder[] = numbers.map((num) => ({
      orderId: `MANUAL-${num}`,
      trackingNumber: num,
      carrier: '未知',
      origin: '',
      destination: '',
      destinationCountry: '',
      status: 'not_found' as const,
      shipDate: '',
      deliveryDate: undefined,
      slaDays: 20,
      actualDays: undefined,
      weight: 0,
      currentLocation: '',
      events: [],
      syncMeta: {
        source: 'csv_import' as const,
        lastSyncAt: new Date().toISOString(),
        syncVersion: 1,
      },
    }))
    await store.mergeOrders(newOrders)
    setBatchText('')
    setRefreshKey((k) => k + 1)
  }, [batchText, store])

  const resetFilters = useCallback(() => {
    setBatchText('')
    setCarrierFilter('')
    setCountryFilter('US')
    setTimeField('shippedAt')
    setTimeStart('')
    setTimeEnd('')
    setWarehouseFilter('')
    setTeamFilter('')
    setStatusFilter('')
    setPage(1)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setPage(1)
  }, [])

  return (
    <div className="flex h-full relative animate-fade-in-up">
      <div className={`flex-1 min-w-0 transition-all duration-300 ${selectedOrder ? 'lg:mr-[440px]' : ''}`}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">订单追踪</h1>
            <p className="text-sm text-slate-400 mt-1">实时追踪物流订单状态与轨迹</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-sm transition-all"
              onClick={() => setImporterOpen(true)}
            >
              <Upload className="w-4 h-4" />导入履约单
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all"
              onClick={() => exportToCSV(orders, `订单追踪_${dayjs().format('YYYYMMDDHHmm')}`)}
              disabled={orders.length === 0}
            >
              <FileDown className="w-4 h-4" />导出CSV
            </button>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => store.syncFrom17Track()}
              disabled={!store.track17Config.apiKey || store.track17Config.syncing || totalCount === 0}
              title={!store.track17Config.apiKey ? '请先在数据源设置中配置密钥' : '从17track更新所有订单数据'}
            >
              {store.track17Config.syncing
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              {store.track17Config.syncing
                ? `${store.track17Config.syncProgress.fetchedItems}/${store.track17Config.syncProgress.totalItems}`
                : '更新数据'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5 p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Search className="w-4 h-4 text-blue-400" />
                <span>批量搜索</span>
              </div>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleAddTrackingNumbers}
                disabled={!batchText.trim()}
              >
                <Plus className="w-3.5 h-3.5" />添加追踪号
              </button>
            </div>
            <textarea
              className="mt-2.5 w-full h-24 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none transition-all"
              placeholder="输入多个追踪号或订单号，每行一个或逗号分隔..."
              value={batchText}
              onChange={(e) => { setBatchText(e.target.value); setPage(1) }}
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 min-w-[120px] transition-all"
              value={carrierFilter}
              onChange={(e) => { setCarrierFilter(e.target.value); setPage(1) }}
            >
              <option value="">全部承运商</option>
              {filterOptions.carriers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 min-w-[120px] transition-all"
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value); setPage(1) }}
            >
              <option value="">全部国家</option>
              {filterOptions.countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 min-w-[110px] transition-all"
              value={timeField}
              onChange={(e) => setTimeField(e.target.value as TimeField)}
            >
              {TIME_FIELD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>

            <input
              type="date"
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
              value={timeStart}
              onChange={(e) => { setTimeStart(e.target.value); setPage(1) }}
            />
            <span className="text-xs text-slate-300">~</span>
            <input
              type="date"
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
              value={timeEnd}
              onChange={(e) => { setTimeEnd(e.target.value); setPage(1) }}
            />

            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 min-w-[120px] transition-all"
              value={warehouseFilter}
              onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1) }}
            >
              <option value="">全部仓库</option>
              {filterOptions.warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>

            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 min-w-[120px] transition-all"
              value={teamFilter}
              onChange={(e) => { setTeamFilter(e.target.value); setPage(1) }}
            >
              <option value="">全部团队</option>
              {filterOptions.teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 min-w-[120px] transition-all"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            >
              <option value="">全部状态</option>
              {(Object.entries(STATUS_LABELS) as [OrderStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {hasActiveFilter && (
              <button
                className="h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                onClick={resetFilters}
              >
                <RotateCcw className="w-3.5 h-3.5" />重置
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5 font-medium">订单号</th>
                  <th className="text-left px-5 py-3.5 font-medium">追踪号</th>
                  <th className="text-left px-5 py-3.5 font-medium">承运商</th>
                  <th className="text-left px-5 py-3.5 font-medium">物流服务商</th>
                  <th className="text-left px-5 py-3.5 font-medium">目的地</th>
                  <th className="text-left px-5 py-3.5 font-medium">状态</th>
                  <th className="text-left px-5 py-3.5 font-medium">出库时间</th>
                  <th className="text-left px-5 py-3.5 font-medium">渠道</th>
                  <th className="text-left px-5 py-3.5 font-medium">实际时效</th>
                  <th className="text-left px-5 py-3.5 font-medium">达标时效</th>
                  <th className="text-center px-5 py-3.5 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="text-center py-20 text-slate-300">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                        <span>加载中...</span>
                      </div>
                    </td>
                  </tr>
                ) : orders.map((o) => {
                  const actual = getActualDays(o)
                  const sla = getSlaDays(o)
                  const isSlaOk = actual !== null && actual <= sla
                  return (
                    <tr
                      key={o.orderId}
                      className={`border-b border-slate-50 cursor-pointer transition-colors hover:bg-blue-50/30 ${selectedOrderId === o.orderId ? 'bg-blue-50/50' : ''}`}
                      onClick={() => setSelectedOrderId(o.orderId)}
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-800">{o.orderId}</td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">{o.trackingNumber}</td>
                      <td className="px-5 py-3.5 text-slate-500">{o.carrier}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{o.erpInfo?.logisticsProviderDisplayName || o.erpInfo?.logisticsProvider || '-'}</td>
                      <td className="px-5 py-3.5 text-slate-500">{o.destination}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={o.status} /></td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">{o.erpInfo?.shippedAt || o.shipDate || '-'}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{o.erpInfo?.currentChannel || '-'}</td>
                      <td className="px-5 py-3.5">
                        {actual !== null ? (
                          <span className={`font-medium ${isSlaOk ? 'text-emerald-500' : 'text-red-500'}`} title={`创建→签收: ${getActualDaysByBase(o, 'created_to_delivered') ?? '-'}天 | 出库→签收: ${getActualDaysByBase(o, 'shipped_to_delivered') ?? '-'}天 | 上网→签收: ${getActualDaysByBase(o, 'online_to_delivered') ?? '-'}天`}>
                            {actual}天
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-slate-500">{sla}天</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setSelectedOrderId(o.orderId) }}
                        >
                          <Eye className="w-3 h-3" />查看
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-20 text-slate-300">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-8 h-8 text-slate-200" />
                        <span>暂无匹配订单</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                共 <span className="font-medium text-slate-600">{totalCount}</span> 条
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">每页</span>
                <select
                  className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="text-xs text-slate-400">条</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                第 {page}/{totalPages} 页
              </span>
              <button
                className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedOrder && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30" onClick={() => setSelectedOrderId(null)} />
          <div className="fixed right-0 top-0 h-full w-[440px] bg-white border-l border-slate-100 z-40 flex flex-col shadow-2xl animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
              <h2 className="text-base font-semibold text-slate-900">订单详情</h2>
              <button
                className="text-slate-300 hover:text-slate-500 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
                onClick={() => setSelectedOrderId(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-3">
                {selectedOrder.erpInfo?.orderNo && <DetailRow label="履约单号" value={selectedOrder.erpInfo.orderNo} />}
                <DetailRow label="订单号" value={selectedOrder.orderId} />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-slate-400">追踪号</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 font-mono text-xs">{selectedOrder.trackingNumber}</span>
                    <button
                      className="p-1 rounded hover:bg-slate-100 transition-colors"
                      onClick={() => { navigator.clipboard.writeText(selectedOrder.trackingNumber) }}
                      title="复制追踪号"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                    </button>
                    <a
                      href={`https://t.17track.net/en#nums=${selectedOrder.trackingNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-blue-50 transition-colors"
                      title="在17track中查询"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-400 hover:text-blue-600" />
                    </a>
                  </div>
                </div>
                <DetailRow label="承运商" value={selectedOrder.carrier} icon={<Truck className="w-3.5 h-3.5" />} />
                <DetailRow label="始发地" value={selectedOrder.origin} />
                <DetailRow label="目的地" value={selectedOrder.destination} icon={<MapPin className="w-3.5 h-3.5" />} />
                <DetailRow label="目的国家" value={selectedOrder.destinationCountry} />
                <DetailRow label="发货日期" value={selectedOrder.shipDate} icon={<Calendar className="w-3.5 h-3.5" />} />
                {selectedOrder.deliveryDate && <DetailRow label="妥投日期" value={selectedOrder.deliveryDate} />}
                <DetailRow label="重量" value={`${selectedOrder.weight}kg`} />
                {selectedOrder.erpInfo?.warehouseCode && <DetailRow label="仓库代码" value={selectedOrder.erpInfo.warehouseCode} />}
                {selectedOrder.erpInfo?.warehouse && <DetailRow label="发货仓库" value={selectedOrder.erpInfo.warehouse} />}
                {selectedOrder.erpInfo?.team && <DetailRow label="团队" value={selectedOrder.erpInfo.team} />}
                {selectedOrder.erpInfo?.platform && <DetailRow label="平台" value={selectedOrder.erpInfo.platform} />}
                {selectedOrder.erpInfo?.shippingQty !== undefined && <DetailRow label="发货数量" value={String(selectedOrder.erpInfo.shippingQty)} />}
                {selectedOrder.erpInfo?.logisticsProvider && <DetailRow label="物流服务商" value={selectedOrder.erpInfo.logisticsProvider} />}
                {selectedOrder.erpInfo?.logisticsProviderDisplayName && <DetailRow label="C端物流商" value={selectedOrder.erpInfo.logisticsProviderDisplayName} />}
                {selectedOrder.erpInfo?.currentChannel && <DetailRow label="当前渠道" value={selectedOrder.erpInfo.currentChannel} />}
                {selectedOrder.erpInfo?.createdAt && <DetailRow label="创建时间" value={selectedOrder.erpInfo.createdAt} />}
                {selectedOrder.erpInfo?.paymentTime && <DetailRow label="支付时间" value={selectedOrder.erpInfo.paymentTime} />}
                {selectedOrder.erpInfo?.packingTime && <DetailRow label="打包时间" value={selectedOrder.erpInfo.packingTime} />}
                {selectedOrder.erpInfo?.checkoutTime && <DetailRow label="签出时间" value={selectedOrder.erpInfo.checkoutTime} />}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-slate-400">状态</span>
                  <StatusBadge status={selectedOrder.status} />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-slate-400">实际时效</span>
                  {(() => {
                    const actual = getActualDays(selectedOrder)
                    const sla = getSlaDays(selectedOrder)
                    const isSlaOk = actual !== null && actual <= sla
                    return actual !== null
                      ? <span className={`text-sm font-medium ${isSlaOk ? 'text-emerald-500' : 'text-red-500'}`}>{actual}天</span>
                      : <span className="text-sm text-slate-300">-</span>
                  })()}
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-slate-400">达标时效</span>
                  <span className="text-sm text-slate-600">{getSlaDays(selectedOrder)}天</span>
                </div>

                <DetailRow label="当前位置" value={selectedOrder.currentLocation} icon={<MapPin className="w-3.5 h-3.5" />} />
                {selectedOrder.syncMeta?.lastSyncAt && (
                  <DetailRow label="最后同步" value={selectedOrder.syncMeta.lastSyncAt} />
                )}
              </div>

              {selectedOrder.exception && (
                <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-red-500 text-sm font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    {EXCEPTION_CATEGORY_LABELS[selectedOrder.exception.category]} - {EXCEPTION_SUBTYPE_LABELS[selectedOrder.exception.subType]}
                  </div>
                  <p className="text-xs text-slate-500">{selectedOrder.exception.description}</p>
                  <p className="text-xs text-slate-400">发生时间：{selectedOrder.exception.createdAt}</p>
                  {selectedOrder.exception.ticketId && (
                    <p className="text-xs text-slate-400">
                      工单：{selectedOrder.exception.ticketId}
                      {selectedOrder.exception.ticketStatus && ` (${selectedOrder.exception.ticketStatus === 'pending' ? '待处理' : selectedOrder.exception.ticketStatus === 'processing' ? '处理中' : '已解决'})`}
                    </p>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">物流轨迹</h3>
                <TrackingTimeline order={selectedOrder} />
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.25s ease-out; }
      `}</style>

      <FulfillmentImporter
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        onImport={handleFulfillmentImport}
      />
    </div>
  )
}

function DetailRow({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm text-slate-700 flex items-center gap-1.5 ${mono ? 'font-mono text-xs' : ''}`}>{icon}{value}</span>
    </div>
  )
}
