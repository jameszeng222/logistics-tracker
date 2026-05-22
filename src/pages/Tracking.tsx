import { useState, useMemo, useCallback } from 'react'
import {
  Search, RotateCcw, Eye, X, ChevronLeft, ChevronRight,
  MapPin, AlertTriangle, Calendar, Truck, RefreshCw, Download,
  FileDown, ChevronDown, Upload, Copy,
} from 'lucide-react'
import FulfillmentImporter, { type ParsedFulfillmentRow } from '@/components/FulfillmentImporter'
import dayjs from 'dayjs'
import { useLogisticsStore } from '@/store/logisticsStore'
import { CARRIERS, STATUS_LABELS, STATUS_COLORS, EXCEPTION_SUBTYPE_LABELS, EXCEPTION_CATEGORY_LABELS } from '@/types'
import type { OrderStatus, LogisticsOrder } from '@/types'
import { matchSlaRule } from '@/config/slaConfig'
import StatusBadge from '@/components/StatusBadge'
import TrackingTimeline from '@/components/TrackingTimeline'

/* ========== 时间维度类型 ========== */
type TimeField = 'createdAt' | 'shippedAt' | 'shipDate'

const TIME_FIELD_OPTIONS: { value: TimeField; label: string }[] = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'shippedAt', label: '出库时间' },
  { value: 'shipDate', label: '提取时间' },
]

/* ========== 每页条数选项 ========== */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 20

/* ========== 获取订单指定时间字段的值 ========== */
function getOrderTime(order: LogisticsOrder, field: TimeField): string {
  if (field === 'createdAt') return order.erpInfo?.createdAt || ''
  if (field === 'shippedAt') return order.erpInfo?.shippedAt || ''
  return order.shipDate || ''
}

/* ========== 计算实际时效（天） ========== */
function getActualDays(order: LogisticsOrder): number | null {
  const shipDate = order.erpInfo?.shippedAt || order.shipDate
  const deliveryDate = order.deliveryDate || (order.status === 'delivered' ? order.events?.[0]?.timestamp : null)
  if (!shipDate || !deliveryDate) return null
  return Math.round((new Date(deliveryDate).getTime() - new Date(shipDate).getTime()) / (1000 * 60 * 60 * 24) * 10) / 10
}

/* ========== 获取达标时效天数 ========== */
function getSlaDays(order: LogisticsOrder): number {
  const matched = matchSlaRule(order.destinationCountry, order.carrier)
  return matched ? matched.slaDays : order.slaDays
}

/* ========== 导出CSV ========== */
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

/* ========== 解析批量搜索文本为号码列表 ========== */
function parseBatchSearch(text: string): string[] {
  return text
    .split(/[\n,;，；]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/* ========== 主组件 ========== */
export default function Tracking() {
  const store = useLogisticsStore()

  /* --- 页面级筛选状态（不修改store.filters） --- */
  const [batchText, setBatchText] = useState('')
  const [carrierFilter, setCarrierFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('US')
  const [timeField, setTimeField] = useState<TimeField>('shippedAt')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  /* --- 分页状态 --- */
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  /* --- 批量搜索框展开状态 --- */
  const [batchExpanded, setBatchExpanded] = useState(true)
  const [importerOpen, setImporterOpen] = useState(false)

  /* --- 从store获取全量订单（受store.filters影响） --- */
  const allOrders = useMemo(() => store.getFilteredOrders(), [store.orders, store.filters])

  /* --- 筛选下拉选项（基于allOrders，不受页面筛选影响） --- */
  const countries = useMemo(() => {
    const set = new Set(allOrders.map((o) => o.destinationCountry).filter(Boolean))
    return Array.from(set).sort()
  }, [allOrders])

  const warehouses = useMemo(() => {
    const set = new Set(allOrders.map((o) => o.erpInfo?.warehouse).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [allOrders])

  const teams = useMemo(() => {
    const set = new Set(allOrders.map((o) => o.erpInfo?.team).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [allOrders])

  /* --- 应用页面级筛选 --- */
  const filteredOrders = useMemo(() => {
    let result = allOrders

    /* 批量搜索：按号码列表过滤 */
    if (batchText.trim()) {
      const keywords = parseBatchSearch(batchText)
      if (keywords.length > 0) {
        result = result.filter((o) =>
          keywords.some(
            (kw) =>
              o.orderId.toLowerCase().includes(kw.toLowerCase()) ||
              o.trackingNumber.toLowerCase().includes(kw.toLowerCase())
          )
        )
      }
    }

    /* 承运商筛选 */
    if (carrierFilter) {
      result = result.filter((o) => o.carrier === carrierFilter)
    }

    /* 目的国家筛选 */
    if (countryFilter) {
      result = result.filter((o) => o.destinationCountry === countryFilter)
    }

    /* 时间维度+日期范围筛选 */
    if (timeStart) {
      result = result.filter((o) => {
        const t = getOrderTime(o, timeField)
        return t ? dayjs(t).isAfter(dayjs(timeStart).subtract(1, 'day')) : false
      })
    }
    if (timeEnd) {
      result = result.filter((o) => {
        const t = getOrderTime(o, timeField)
        return t ? dayjs(t).isBefore(dayjs(timeEnd).add(1, 'day')) : false
      })
    }

    /* 发货仓库筛选 */
    if (warehouseFilter) {
      result = result.filter((o) => o.erpInfo?.warehouse === warehouseFilter)
    }

    /* 发货团队筛选 */
    if (teamFilter) {
      result = result.filter((o) => o.erpInfo?.team === teamFilter)
    }

    /* 主状态筛选 */
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter)
    }

    return result
  }, [allOrders, batchText, carrierFilter, countryFilter, timeField, timeStart, timeEnd, warehouseFilter, teamFilter, statusFilter])

  /* --- 分页计算 --- */
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const paged = filteredOrders.slice((page - 1) * pageSize, page * pageSize)

  /* --- 选中订单详情 --- */
  const selectedOrder = store.selectedOrderId ? store.getOrderById(store.selectedOrderId) : undefined

  /* --- 导入履约单回调 --- */
  const handleFulfillmentImport = useCallback((rows: ParsedFulfillmentRow[]) => {
    const store = useLogisticsStore.getState()
    const existingOrders = store.orders

    const newOrUpdatedOrders = rows.map((row) => {
      const existing = existingOrders.find(
        (o) => o.trackingNumber === row.trackingNumber || o.erpInfo?.orderNo === row.orderNo
      )

      if (existing) {
        return {
          ...existing,
          erpInfo: {
            ...existing.erpInfo,
            orderNo: row.orderNo,
            warehouseCode: row.warehouseCode,
            platform: row.platform,
            shippingQty: row.shippingQty,
            destinationCountry: row.destinationCountry,
            paymentTime: row.paymentTime,
            createdAt: row.createdAt || existing.erpInfo?.createdAt,
            packingTime: row.packingTime,
            checkoutTime: row.checkoutTime,
            logisticsProvider: row.logisticsProvider,
            logisticsProviderDisplayName: row.logisticsProviderDisplayName,
            currentChannel: row.currentChannel,
            trackingNumber: row.trackingNumber,
            warehouse: existing.erpInfo?.warehouse || row.warehouseCode,
          },
          destinationCountry: row.destinationCountry || existing.destinationCountry,
        }
      }

      return {
        orderId: `ERP-${row.orderNo}`,
        trackingNumber: row.trackingNumber,
        carrier: row.logisticsProvider || row.logisticsProviderDisplayName || '未知',
        origin: '',
        destination: '',
        destinationCountry: row.destinationCountry || '',
        status: 'not_found' as const,
        shipDate: row.checkoutTime || '',
        deliveryDate: undefined,
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
          lastSyncAt: new Date().toISOString(),
          syncVersion: 1,
        },
      }
    })

    store.mergeOrders(newOrUpdatedOrders)
    setImporterOpen(false)
  }, [])

  /* --- 重置所有页面筛选 --- */
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

  /* --- 切换每页条数 --- */
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setPage(1)
  }, [])

  /* --- 是否有筛选条件激活 --- */
  const hasActiveFilter = batchText.trim() || carrierFilter || countryFilter || timeStart || timeEnd || warehouseFilter || teamFilter || statusFilter

  return (
    <div className="flex h-full relative animate-fade-in-up">
      <div className={`flex-1 min-w-0 transition-all duration-300 ${selectedOrder ? 'lg:mr-[440px]' : ''}`}>
        {/* ===== 页头 ===== */}
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
              onClick={() => exportToCSV(filteredOrders, `订单追踪_${dayjs().format('YYYYMMDDHHmm')}`)}
              disabled={filteredOrders.length === 0}
            >
              <FileDown className="w-4 h-4" />导出CSV
            </button>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => store.syncFrom17Track()}
              disabled={!store.track17Config.apiKey || store.track17Config.syncing || store.orders.length === 0}
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

        {/* ===== 筛选区域 ===== */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5 p-5">
          {/* 批量搜索框 */}
          <div className="mb-4">
            <div
              className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              onClick={() => setBatchExpanded((v) => !v)}
            >
              <Search className="w-4 h-4 text-blue-400" />
              <span>批量搜索</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${batchExpanded ? 'rotate-180' : ''}`} />
            </div>
            {batchExpanded && (
              <textarea
                className="mt-2.5 w-full h-24 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none transition-all"
                placeholder="输入多个追踪号或订单号，每行一个或逗号分隔..."
                value={batchText}
                onChange={(e) => { setBatchText(e.target.value); setPage(1) }}
              />
            )}
          </div>

          {/* 多维筛选行 */}
          <div className="flex flex-wrap items-end gap-3">
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 min-w-[120px] transition-all"
              value={carrierFilter}
              onChange={(e) => { setCarrierFilter(e.target.value); setPage(1) }}
            >
              <option value="">全部承运商</option>
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 min-w-[120px] transition-all"
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value); setPage(1) }}
            >
              <option value="">全部国家</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
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
              {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>

            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 min-w-[120px] transition-all"
              value={teamFilter}
              onChange={(e) => { setTeamFilter(e.target.value); setPage(1) }}
            >
              <option value="">全部团队</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
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

        {/* ===== 数据表格 ===== */}
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
                {paged.map((o) => {
                  const actual = getActualDays(o)
                  const sla = getSlaDays(o)
                  const isSlaOk = actual !== null && actual <= sla
                  return (
                    <tr
                      key={o.orderId}
                      className={`border-b border-slate-50 cursor-pointer transition-colors hover:bg-blue-50/30 ${store.selectedOrderId === o.orderId ? 'bg-blue-50/50' : ''}`}
                      onClick={() => store.selectOrder(o.orderId)}
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
                          <span className={`font-medium ${isSlaOk ? 'text-emerald-500' : 'text-red-500'}`}>{actual}天</span>
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
                          onClick={(e) => { e.stopPropagation(); store.selectOrder(o.orderId) }}
                        >
                          <Eye className="w-3 h-3" />查看
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
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

          {/* ===== 分页栏 ===== */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                共 <span className="font-medium text-slate-600">{filteredOrders.length}</span> 条
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

      {/* ===== 侧边栏：订单详情 ===== */}
      {selectedOrder && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30" onClick={() => store.selectOrder(null)} />
          <div className="fixed right-0 top-0 h-full w-[440px] bg-white border-l border-slate-100 z-40 flex flex-col shadow-2xl animate-slide-in">
            {/* 侧边栏头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
              <h2 className="text-base font-semibold text-slate-900">订单详情</h2>
              <button
                className="text-slate-300 hover:text-slate-500 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
                onClick={() => store.selectOrder(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 侧边栏内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 基本信息 */}
              <div className="space-y-3">
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
                  </div>
                </div>
                <DetailRow label="承运商" value={selectedOrder.carrier} icon={<Truck className="w-3.5 h-3.5" />} />
                <DetailRow label="始发地" value={selectedOrder.origin} />
                <DetailRow label="目的地" value={selectedOrder.destination} icon={<MapPin className="w-3.5 h-3.5" />} />
                <DetailRow label="发货日期" value={selectedOrder.shipDate} icon={<Calendar className="w-3.5 h-3.5" />} />
                {selectedOrder.deliveryDate && <DetailRow label="妥投日期" value={selectedOrder.deliveryDate} />}
                <DetailRow label="重量" value={`${selectedOrder.weight}kg`} />
                {selectedOrder.erpInfo?.warehouse && <DetailRow label="仓库" value={selectedOrder.erpInfo.warehouse} />}
                {selectedOrder.erpInfo?.team && <DetailRow label="团队" value={selectedOrder.erpInfo.team} />}
                {selectedOrder.erpInfo?.logisticsProvider && <DetailRow label="物流服务商" value={selectedOrder.erpInfo.logisticsProvider} />}
                {selectedOrder.erpInfo?.logisticsProviderDisplayName && <DetailRow label="C端物流商" value={selectedOrder.erpInfo.logisticsProviderDisplayName} />}
                {selectedOrder.erpInfo?.currentChannel && <DetailRow label="当前渠道" value={selectedOrder.erpInfo.currentChannel} />}
                {selectedOrder.erpInfo?.platform && <DetailRow label="平台" value={selectedOrder.erpInfo.platform} />}
                {selectedOrder.erpInfo?.shippingQty !== undefined && <DetailRow label="发货数量" value={String(selectedOrder.erpInfo.shippingQty)} />}
                {selectedOrder.erpInfo?.paymentTime && <DetailRow label="支付时间" value={selectedOrder.erpInfo.paymentTime} />}
                {selectedOrder.erpInfo?.packingTime && <DetailRow label="打包时间" value={selectedOrder.erpInfo.packingTime} />}
                {selectedOrder.erpInfo?.checkoutTime && <DetailRow label="签出时间" value={selectedOrder.erpInfo.checkoutTime} />}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-slate-400">状态</span>
                  <StatusBadge status={selectedOrder.status} />
                </div>

                {/* 时效信息 */}
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

              {/* 异常信息 */}
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

              {/* 物流轨迹 */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">物流轨迹</h3>
                <TrackingTimeline order={selectedOrder} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== 侧边栏滑入动画 ===== */}
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

/* ========== 详情行组件 ========== */
function DetailRow({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm text-slate-700 flex items-center gap-1.5 ${mono ? 'font-mono text-xs' : ''}`}>{icon}{value}</span>
    </div>
  )
}
