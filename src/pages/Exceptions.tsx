import { useState, useMemo } from 'react'
import {
  Search, X, Truck, PackageCheck, Clock, Info,
  Package, AlertTriangle, HelpCircle,
  RotateCcw, PackageX, Download, Eye,
  FileSpreadsheet, Calendar,
  Warehouse, Users, Globe, Filter,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useLogisticsStore } from '@/store/logisticsStore'
import {
  STATUS_LABELS, STATUS_COLORS, STATUS_LEVEL, STATUS_DESCRIPTIONS,
  STATUS_SUB_STATUSES, SUB_STATUS_LABELS,
} from '@/types'
import type { OrderStatus, TrackSubStatus17, LogisticsOrder } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import TrackingTimeline from '@/components/TrackingTimeline'

const STATUS_ICONS: Record<string, React.ElementType> = {
  not_found: HelpCircle,
  info_received: Info,
  in_transit: Truck,
  expired: Clock,
  available_for_pickup: Package,
  out_for_delivery: Truck,
  delivery_failure: PackageX,
  delivered: PackageCheck,
  exception: AlertTriangle,
  returning: RotateCcw,
}

const ROW1: OrderStatus[] = ['not_found', 'info_received', 'in_transit', 'expired', 'available_for_pickup']
const ROW2: (OrderStatus | 'returning')[] = ['out_for_delivery', 'delivery_failure', 'delivered', 'exception', 'returning']

const ALL_STATUSES: OrderStatus[] = [
  'not_found', 'info_received', 'in_transit', 'expired',
  'available_for_pickup', 'out_for_delivery', 'delivery_failure',
  'delivered', 'exception',
]

const RETURNING_KEY = 'returning'

interface StatusItem {
  key: string
  label: string
  description: string
  icon: React.ElementType
  color: { bg: string; text: string; dot: string }
  level: 'normal' | 'transit' | 'warning' | 'danger' | 'special'
  subStatuses: string[]
  statusKey?: OrderStatus
}

function buildStatusItems(): StatusItem[] {
  const items: StatusItem[] = ALL_STATUSES.map((s) => ({
    key: s,
    label: STATUS_LABELS[s],
    description: STATUS_DESCRIPTIONS[s],
    icon: STATUS_ICONS[s] || HelpCircle,
    color: STATUS_COLORS[s],
    level: STATUS_LEVEL[s],
    subStatuses: STATUS_SUB_STATUSES[s],
    statusKey: s,
  }))
  items.push({
    key: RETURNING_KEY,
    label: '退件中',
    description: '包裹正在送回寄件人的途中',
    icon: RotateCcw,
    color: { bg: 'bg-purple-50', text: 'text-purple-600', dot: '#A855F7' },
    level: 'special',
    subStatuses: ['Exception_Returning'],
    statusKey: 'exception',
  })
  return items
}

const STATUS_ITEMS = buildStatusItems()

type TimeField = 'createdAt' | 'shippedAt' | 'shipDate'

const TIME_FIELD_OPTIONS: { value: TimeField; label: string }[] = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'shippedAt', label: '出库时间' },
  { value: 'shipDate', label: '提取时间' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

type ActiveSelection =
  | { type: 'status'; key: string }
  | { type: 'sub'; key: string }
  | null

// 获取订单指定时间字段的值
function getOrderTime(order: LogisticsOrder, field: TimeField): string {
  if (field === 'createdAt') return order.erpInfo?.createdAt || ''
  if (field === 'shippedAt') return order.erpInfo?.shippedAt || ''
  return order.shipDate || ''
}

function exportToCSV(orders: LogisticsOrder[], filename: string) {
  const BOM = '\uFEFF'
  const headers = ['订单号', '追踪号', '承运商', '始发地', '目的地', '目的国家', '主状态', '异常描述', '发货仓库', '发货团队', '最新轨迹时间', '最新轨迹描述']
  const rows = orders.map((o) => {
    const last = o.events[0]
    return [
      o.orderId,
      o.trackingNumber,
      o.carrier,
      o.origin,
      o.destination,
      o.destinationCountry,
      STATUS_LABELS[o.status],
      o.exception?.description || last?.description || '',
      o.erpInfo?.warehouse || '',
      o.erpInfo?.team || '',
      last?.timestamp || '',
      last?.description || '',
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

export default function Exceptions() {
  const store = useLogisticsStore()
  const allOrders = useMemo(() => store.getFilteredOrders(), [store.orders, store.filters])

  // 页面级筛选状态
  const [active, setActive] = useState<ActiveSelection>(null)
  const [searchText, setSearchText] = useState('')
  const [carrierFilter, setCarrierFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('US')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [timeField, setTimeField] = useState<TimeField>('shippedAt')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [trackingOrder, setTrackingOrder] = useState<LogisticsOrder | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(20)

  // 筛选下拉选项（基于 allOrders，不受页面筛选影响）
  const carriers = useMemo(() => {
    const set = new Set(allOrders.map((o) => o.carrier))
    return Array.from(set).sort()
  }, [allOrders])

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

  // 先按筛选条件过滤 allOrders 得到 filteredAllOrders
  const filteredAllOrders = useMemo(() => {
    let result = allOrders
    if (searchText) {
      const s = searchText.toLowerCase()
      result = result.filter((o) =>
        o.orderId.toLowerCase().includes(s) ||
        o.trackingNumber.toLowerCase().includes(s) ||
        o.destination.toLowerCase().includes(s) ||
        o.carrier.toLowerCase().includes(s)
      )
    }
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
    if (carrierFilter) {
      result = result.filter((o) => o.carrier === carrierFilter)
    }
    if (countryFilter) {
      result = result.filter((o) => o.destinationCountry === countryFilter)
    }
    if (warehouseFilter) {
      result = result.filter((o) => o.erpInfo?.warehouse === warehouseFilter)
    }
    if (teamFilter) {
      result = result.filter((o) => o.erpInfo?.team === teamFilter)
    }
    return result
  }, [allOrders, searchText, timeField, timeStart, timeEnd, carrierFilter, countryFilter, warehouseFilter, teamFilter])

  // 基于 filteredAllOrders 计算状态分布（卡片数量随筛选变化）
  const statusDistribution = useMemo(() => {
    const byStatus: Record<string, number> = {}
    const bySubStatus: Record<string, number> = {}
    filteredAllOrders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1
      const currentSub = o.events[0]?.subStatus
      if (currentSub) {
        bySubStatus[currentSub] = (bySubStatus[currentSub] || 0) + 1
      }
    })
    return { byStatus, bySubStatus, total: filteredAllOrders.length }
  }, [filteredAllOrders])

  // 退件中数量（基于 filteredAllOrders）
  const returningCount = useMemo(() => {
    return filteredAllOrders.filter((o) =>
      o.events[0]?.subStatus === 'Exception_Returning'
    ).length
  }, [filteredAllOrders])

  const getCount = (key: string): number => {
    if (key === RETURNING_KEY) return returningCount
    return statusDistribution.byStatus[key] || 0
  }

  const getSubCount = (sub: string): number => {
    if (sub === 'Exception_Returning') return returningCount
    return statusDistribution.bySubStatus[sub] || 0
  }

  // 应用主状态/子状态选择到 filteredAllOrders，得到 displayOrders
  const displayOrders = useMemo(() => {
    if (!active) return filteredAllOrders
    if (active.type === 'status') {
      if (active.key === RETURNING_KEY) {
        return filteredAllOrders.filter((o) =>
          o.events[0]?.subStatus === 'Exception_Returning'
        )
      }
      return filteredAllOrders.filter((o) => o.status === active.key)
    }
    return filteredAllOrders.filter((o) =>
      o.events[0]?.subStatus === active.key
    )
  }, [filteredAllOrders, active])

  const totalPages = Math.max(1, Math.ceil(displayOrders.length / pageSize))
  const pagedOrders = displayOrders.slice((page - 1) * pageSize, page * pageSize)

  // 是否有任意筛选条件激活
  const hasAnyFilter = !!(carrierFilter || countryFilter || warehouseFilter || teamFilter || timeStart || timeEnd || searchText || active)

  const clearAllFilters = () => {
    setCarrierFilter('')
    setCountryFilter('US')
    setWarehouseFilter('')
    setTeamFilter('')
    setTimeStart('')
    setTimeEnd('')
    setSearchText('')
    setActive(null)
    setPage(1)
  }

  const handleStatusClick = (key: string) => {
    if (active?.type === 'status' && active.key === key) {
      setActive(null)
    } else {
      setActive({ type: 'status', key })
    }
    setPage(1)
  }

  const handleSubClick = (sub: string) => {
    if (active?.type === 'sub' && active.key === sub) {
      setActive(null)
    } else {
      setActive({ type: 'sub', key: sub })
    }
    setPage(1)
  }

  const activeLabel = useMemo(() => {
    if (!active) return '全部订单'
    if (active.type === 'status') {
      const item = STATUS_ITEMS.find((i) => i.key === active.key)
      return item?.label || active.key
    }
    return SUB_STATUS_LABELS[active.key as TrackSubStatus17] || active.key
  }, [active])

  const renderItem = (key: string) => {
    const item = STATUS_ITEMS.find((i) => i.key === key)!
    const Icon = item.icon
    const count = getCount(key)
    const isStatusActive = active?.type === 'status' && active.key === key
    const isSubActive = active?.type === 'sub' && item.subStatuses.includes(active.key)

    return (
      <div
        key={key}
        className={`group relative rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
          isStatusActive
            ? 'border-blue-300 shadow-lg shadow-blue-100/50 ring-1 ring-blue-200'
            : isSubActive
              ? 'border-blue-200 shadow-md ring-1 ring-blue-100'
              : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'
        } bg-white`}
        onClick={() => handleStatusClick(key)}
      >
        <div className="p-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl ${item.color.bg} flex items-center justify-center transition-transform group-hover:scale-105`}>
                <Icon className={`w-4.5 h-4.5 ${item.color.text}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-tight whitespace-nowrap">{item.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.description}</p>
              </div>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${
              count > 0 ? 'text-slate-900' : 'text-slate-300'
            }`}>{count}</span>
          </div>

          <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
            {item.subStatuses.map((sub) => {
              const subCount = getSubCount(sub)
              const isThisSubActive = active?.type === 'sub' && active.key === sub
              return (
                <button
                  key={sub}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                    isThisSubActive
                      ? 'bg-blue-500 text-white shadow-sm'
                      : subCount > 0
                        ? `${item.color.bg} ${item.color.text} hover:shadow-sm`
                        : 'bg-slate-50 text-slate-300'
                  }`}
                  onClick={() => handleSubClick(sub)}
                >
                  <span>{SUB_STATUS_LABELS[sub as TrackSubStatus17]}</span>
                  {subCount > 0 && <span className="font-bold ml-0.5">{subCount}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* 颜色条在卡片最下方 */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: item.color.dot }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 whitespace-nowrap">异常处理</h1>
          <p className="text-sm text-slate-400 mt-1">基于 17track 9 种主状态 / 30 种子状态的物流监控</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />运输中</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />正常</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />警告</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />异常</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" />退件</span>
        </div>
      </div>

      {/* 顶部筛选区（页面最顶部，始终显示） */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Filter className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">筛选条件</h3>
            <p className="text-[11px] text-slate-400">{filteredAllOrders.length} / {allOrders.length} 条订单</p>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50/30 space-y-3">
          {/* 第一行：搜索框 + 时间筛选 */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="搜索订单号、追踪号、承运商、目的地..."
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none transition-all"
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(1) }}
              />
              {searchText && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
                  onClick={() => setSearchText('')}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                value={timeField}
                onChange={(e) => setTimeField(e.target.value as TimeField)}
              >
                {TIME_FIELD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="date"
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                value={timeStart}
                onChange={(e) => { setTimeStart(e.target.value); setPage(1) }}
              />
              <span className="text-xs text-slate-400">至</span>
              <input
                type="date"
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                value={timeEnd}
                onChange={(e) => { setTimeEnd(e.target.value); setPage(1) }}
              />
            </div>
          </div>

          {/* 第二行：国家 + 承运商 + 仓库 + 团队 */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <select
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[100px]"
                value={countryFilter}
                onChange={(e) => { setCountryFilter(e.target.value); setPage(1) }}
              >
                <option value="">全部国家</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <select
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[100px]"
                value={carrierFilter}
                onChange={(e) => { setCarrierFilter(e.target.value); setPage(1) }}
              >
                <option value="">全部承运商</option>
                {carriers.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Warehouse className="w-3.5 h-3.5 text-slate-400" />
              <select
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[100px]"
                value={warehouseFilter}
                onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1) }}
              >
                <option value="">全部仓库</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[100px]"
                value={teamFilter}
                onChange={(e) => { setTeamFilter(e.target.value); setPage(1) }}
              >
                <option value="">全部团队</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 已选筛选条件标签 */}
          {hasAnyFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400">已选筛选：</span>
              {active && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  {activeLabel}
                  <button onClick={() => setActive(null)}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {searchText && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  搜索: {searchText}
                  <button onClick={() => setSearchText('')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {(timeStart || timeEnd) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  {TIME_FIELD_OPTIONS.find((o) => o.value === timeField)?.label}: {timeStart || '...'} ~ {timeEnd || '...'}
                  <button onClick={() => { setTimeStart(''); setTimeEnd('') }}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {countryFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  国家: {countryFilter}
                  <button onClick={() => setCountryFilter('')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {carrierFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  承运商: {carrierFilter}
                  <button onClick={() => setCarrierFilter('')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {warehouseFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  仓库: {warehouseFilter}
                  <button onClick={() => setWarehouseFilter('')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {teamFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  团队: {teamFilter}
                  <button onClick={() => setTeamFilter('')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              <button
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors"
                onClick={clearAllFilters}
              >
                <X className="w-2.5 h-2.5" />
                清除全部
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 主状态卡片（2排，9+1个） */}
      <div className="grid grid-cols-5 gap-3">
        {ROW1.map((key) => renderItem(key))}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {ROW2.map((key) => renderItem(key))}
      </div>

      {/* 订单列表（始终显示） */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Filter className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{activeLabel}</h3>
              <p className="text-[11px] text-slate-400">{displayOrders.length} 条记录</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-sm"
              onClick={() => exportToCSV(displayOrders, `${activeLabel}_订单列表`)}
              disabled={displayOrders.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              导出 CSV
            </button>
          </div>
        </div>

        {displayOrders.length === 0 ? (
          <div className="py-16 text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">暂无匹配的订单</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">订单号</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">追踪号</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">承运商</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">国家</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">发货仓</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">团队</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">主状态</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">异常描述</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">最新轨迹</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((o) => {
                  const lastEvent = o.events[0]
                  return (
                    <tr key={o.orderId} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                      <td className="py-4 px-5 font-medium text-slate-900 whitespace-nowrap">{o.orderId}</td>
                      <td className="py-4 px-5">
                        <button
                          className="text-blue-500 hover:text-blue-700 font-mono text-sm hover:underline transition-colors"
                          onClick={() => setTrackingOrder(o)}
                        >
                          {o.trackingNumber}
                        </button>
                      </td>
                      <td className="py-4 px-5 text-slate-600 whitespace-nowrap">{o.carrier}</td>
                      <td className="py-4 px-5 text-slate-600">{o.destinationCountry}</td>
                      <td className="py-4 px-5 text-slate-500">{o.erpInfo?.warehouse || '-'}</td>
                      <td className="py-4 px-5 text-slate-500">{o.erpInfo?.team || '-'}</td>
                      <td className="py-4 px-5"><StatusBadge status={o.status} /></td>
                      <td className="py-4 px-5 text-slate-500 max-w-[360px] truncate">
                        {o.exception?.description || lastEvent?.description || '-'}
                      </td>
                      <td className="py-4 px-5 text-sm text-slate-400 max-w-[420px] truncate">
                        {lastEvent ? `${lastEvent.timestamp} ${lastEvent.description}` : '-'}
                      </td>
                      <td className="py-4 px-5">
                        <button
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                          onClick={() => setTrackingOrder(o)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          查看轨迹
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {displayOrders.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                共 <span className="font-medium text-slate-600">{displayOrders.length}</span> 条
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">每页</span>
                <select
                  className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
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
        )}
      </div>

      {/* 查看轨迹模态框 */}
      {trackingOrder && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">物流轨迹 - {trackingOrder.trackingNumber}</h3>
              <button onClick={() => setTrackingOrder(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">订单号：</span>
                  <span className="text-slate-900 font-medium">{trackingOrder.orderId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">追踪号：</span>
                  <span className="text-slate-900 font-mono text-xs">{trackingOrder.trackingNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">承运商：</span>
                  <span className="text-slate-700">{trackingOrder.carrier}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">目的地：</span>
                  <span className="text-slate-700">{trackingOrder.destination}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">状态：</span>
                  <StatusBadge status={trackingOrder.status} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">国家：</span>
                  <span className="text-slate-700">{trackingOrder.destinationCountry}</span>
                </div>
              </div>
            </div>
            <TrackingTimeline order={trackingOrder} />
          </div>
        </div>
      )}
    </div>
  )
}
