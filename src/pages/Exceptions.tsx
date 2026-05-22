import { useState, useEffect, useMemo } from 'react'
import {
  Search, X, Truck, PackageCheck, Clock, Info,
  Package, AlertTriangle, HelpCircle,
  RotateCcw, PackageX,
  Calendar,
  Warehouse, Users, Globe, Filter,
  ChevronLeft, ChevronRight, ExternalLink, Loader2,
} from 'lucide-react'
import {
  fetchStatusDistribution, fetchOrdersFromD1, fetchFilterOptions,
} from '@/services/d1Api'
import type { StatsFilterParams, FetchOrdersParams, FilterOptions, StatusDistributionResult } from '@/services/d1Api'
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

export default function Exceptions() {
  const [active, setActive] = useState<ActiveSelection>(null)
  const [searchText, setSearchText] = useState('')
  const [carrierFilter, setCarrierFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('US')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [timeField, setTimeField] = useState<TimeField>('shippedAt')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [trackingOrder, setTrackingOrder] = useState<LogisticsOrder | null>(null)

  const [statusDist, setStatusDist] = useState<StatusDistributionResult>({ byStatus: {}, bySubStatus: {}, total: 0 })
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ countries: [], carriers: [], warehouses: [], teams: [], statuses: [] })
  const [orders, setOrders] = useState<LogisticsOrder[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [distLoading, setDistLoading] = useState(true)

  const statsParams = useMemo((): StatsFilterParams => {
    const params: StatsFilterParams = {}
    if (countryFilter) params.country = countryFilter
    if (carrierFilter) params.carrier = carrierFilter
    if (warehouseFilter) params.warehouse = warehouseFilter
    if (teamFilter) params.team = teamFilter
    if (timeField) params.timeField = timeField
    if (timeStart) params.timeStart = timeStart
    if (timeEnd) params.timeEnd = timeEnd
    return params
  }, [countryFilter, carrierFilter, warehouseFilter, teamFilter, timeField, timeStart, timeEnd])

  useEffect(() => {
    setDistLoading(true)
    fetchStatusDistribution(statsParams)
      .then(setStatusDist)
      .catch(console.error)
      .finally(() => setDistLoading(false))
  }, [statsParams])

  useEffect(() => {
    fetchFilterOptions()
      .then(setFilterOpts)
      .catch(console.error)
  }, [])

  useEffect(() => {
    const params: FetchOrdersParams = {
      ...statsParams,
      search: searchText || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }
    if (active) {
      if (active.type === 'status') {
        if (active.key === RETURNING_KEY) {
          params.status = 'exception'
          params.subStatus = 'Exception_Returning'
        } else {
          params.status = active.key
        }
      } else {
        params.subStatus = active.key
      }
    }
    setLoading(true)
    fetchOrdersFromD1(params)
      .then((result) => {
        setOrders(result.orders)
        setOrdersTotal(result.total)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [statsParams, searchText, active, page, pageSize])

  const getCount = (key: string): number => {
    if (key === RETURNING_KEY) return statusDist.bySubStatus['Exception_Returning'] || 0
    return statusDist.byStatus[key] || 0
  }

  const getSubCount = (sub: string): number => {
    return statusDist.bySubStatus[sub] || 0
  }

  const totalPages = Math.max(1, Math.ceil(ordersTotal / pageSize))

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
            {distLoading ? (
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            ) : (
              <span className={`text-2xl font-bold tabular-nums ${
                count > 0 ? 'text-slate-900' : 'text-slate-300'
              }`}>{count}</span>
            )}
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

        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: item.color.dot }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
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

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Filter className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">筛选条件</h3>
            <p className="text-[11px] text-slate-400">{statusDist.total} 条订单</p>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50/30 space-y-3">
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

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <select
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[100px]"
                value={countryFilter}
                onChange={(e) => { setCountryFilter(e.target.value); setPage(1) }}
              >
                <option value="">全部国家</option>
                {filterOpts.countries.map((c) => (
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
                {filterOpts.carriers.map((c) => (
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
                {filterOpts.warehouses.map((w) => (
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
                {filterOpts.teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {hasAnyFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400">已选筛选：</span>
              {active && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  {activeLabel}
                  <button onClick={() => { setActive(null); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {searchText && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  搜索: {searchText}
                  <button onClick={() => { setSearchText(''); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {(timeStart || timeEnd) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  {TIME_FIELD_OPTIONS.find((o) => o.value === timeField)?.label}: {timeStart || '...'} ~ {timeEnd || '...'}
                  <button onClick={() => { setTimeStart(''); setTimeEnd(''); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {countryFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  国家: {countryFilter}
                  <button onClick={() => { setCountryFilter(''); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {carrierFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  承运商: {carrierFilter}
                  <button onClick={() => { setCarrierFilter(''); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {warehouseFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  仓库: {warehouseFilter}
                  <button onClick={() => { setWarehouseFilter(''); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {teamFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  团队: {teamFilter}
                  <button onClick={() => { setTeamFilter(''); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
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

      <div className="grid grid-cols-5 gap-3">
        {ROW1.map((key) => renderItem(key))}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {ROW2.map((key) => renderItem(key))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Filter className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{activeLabel}</h3>
              <p className="text-[11px] text-slate-400">{ordersTotal} 条记录</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-slate-400">加载中...</p>
          </div>
        ) : ordersTotal === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">暂无匹配的订单</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5 whitespace-nowrap">追踪号</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5 whitespace-nowrap">承运商</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5 whitespace-nowrap">目的国家</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5 whitespace-nowrap">发货仓</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5 whitespace-nowrap">主状态</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5 whitespace-nowrap">子状态</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5 whitespace-nowrap">发货日期</th>
                  <th className="text-left text-xs text-slate-500 font-medium py-4 px-5 whitespace-nowrap">实际天数</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const subStatus = o.events[0]?.subStatus
                  return (
                    <tr key={o.orderId} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            className="text-blue-500 hover:text-blue-700 font-mono text-sm hover:underline transition-colors"
                            onClick={() => setTrackingOrder(o)}
                          >
                            {o.trackingNumber}
                          </button>
                          <a
                            href={`https://t.17track.net/en#nums=${o.trackingNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-0.5 rounded hover:bg-blue-50 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3 text-blue-400 hover:text-blue-600" />
                          </a>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-slate-600 whitespace-nowrap">{o.carrier}</td>
                      <td className="py-4 px-5 text-slate-600">{o.destinationCountry}</td>
                      <td className="py-4 px-5 text-slate-500">{o.erpInfo?.warehouse || '-'}</td>
                      <td className="py-4 px-5 whitespace-nowrap"><StatusBadge status={o.status} /></td>
                      <td className="py-4 px-5 text-slate-500 whitespace-nowrap">
                        {subStatus ? (SUB_STATUS_LABELS[subStatus as TrackSubStatus17] || subStatus) : '-'}
                      </td>
                      <td className="py-4 px-5 text-slate-500 whitespace-nowrap">{o.shipDate || '-'}</td>
                      <td className="py-4 px-5 text-slate-500 whitespace-nowrap">{o.actualDays != null ? o.actualDays : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && ordersTotal > 0 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                共 <span className="font-medium text-slate-600">{ordersTotal}</span> 条
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

      {trackingOrder && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setTrackingOrder(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-y-auto p-6 pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">物流轨迹 - {trackingOrder.trackingNumber}</h3>
                <button onClick={() => setTrackingOrder(null)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {trackingOrder.erpInfo?.orderNo && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">履约单号：</span>
                      <span className="text-slate-900 font-medium">{trackingOrder.erpInfo.orderNo}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">订单号：</span>
                    <span className="text-slate-900 font-medium">{trackingOrder.orderId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">追踪号：</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 font-mono text-xs">{trackingOrder.trackingNumber}</span>
                      <a
                        href={`https://t.17track.net/en#nums=${trackingOrder.trackingNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-400 hover:text-blue-600" />
                      </a>
                    </div>
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
                    <span className="text-slate-400">国家：</span>
                    <span className="text-slate-700">{trackingOrder.destinationCountry}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">状态：</span>
                    <StatusBadge status={trackingOrder.status} />
                  </div>
                  {trackingOrder.erpInfo?.warehouseCode && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">仓库代码：</span>
                      <span className="text-slate-700">{trackingOrder.erpInfo.warehouseCode}</span>
                    </div>
                  )}
                  {trackingOrder.erpInfo?.warehouse && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">发货仓库：</span>
                      <span className="text-slate-700">{trackingOrder.erpInfo.warehouse}</span>
                    </div>
                  )}
                  {trackingOrder.erpInfo?.platform && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">平台：</span>
                      <span className="text-slate-700">{trackingOrder.erpInfo.platform}</span>
                    </div>
                  )}
                  {trackingOrder.erpInfo?.logisticsProvider && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">物流服务商：</span>
                      <span className="text-slate-700">{trackingOrder.erpInfo.logisticsProvider}</span>
                    </div>
                  )}
                  {trackingOrder.erpInfo?.currentChannel && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">渠道：</span>
                      <span className="text-slate-700">{trackingOrder.erpInfo.currentChannel}</span>
                    </div>
                  )}
                  {trackingOrder.erpInfo?.createdAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">创建时间：</span>
                      <span className="text-slate-700">{trackingOrder.erpInfo.createdAt}</span>
                    </div>
                  )}
                  {trackingOrder.erpInfo?.checkoutTime && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">签出时间：</span>
                      <span className="text-slate-700">{trackingOrder.erpInfo.checkoutTime}</span>
                    </div>
                  )}
                  {trackingOrder.erpInfo?.paymentTime && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">支付时间：</span>
                      <span className="text-slate-700">{trackingOrder.erpInfo.paymentTime}</span>
                    </div>
                  )}
                </div>
              </div>
              <TrackingTimeline order={trackingOrder} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
