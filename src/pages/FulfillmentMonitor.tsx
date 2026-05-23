import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Clock, AlertTriangle, Search, Eye, X, Plus, Trash2, Save,
  ToggleLeft, ToggleRight, Shield, FileWarning, RotateCcw,
  Filter, Globe, Truck, Warehouse, Users, Calendar, Copy,
  Loader2,
} from 'lucide-react'
import {
  loadMonitoringRules, saveMonitoringRules, DEFAULT_MONITORING_RULES,
} from '@/config/monitoringConfig'
import type { MonitoringRule } from '@/config/monitoringConfig'
import { loadProviders, loadChannels, getChannelsForProvider } from '@/config/carrierConfig'
import { loadStatusKeywordRules, saveStatusKeywordRules, DEFAULT_STATUS_KEYWORD_RULES, STATUS_KEYS } from '@/config/statusKeywords'
import type { StatusKeywordRule } from '@/config/statusKeywords'
import { COUNTRY_NAMES, getCountryName } from '@/utils/countryNames'
import { STATUS_LABELS } from '@/types'
import type { OrderStatus, LogisticsOrder } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import OrderDetailModal from '@/components/OrderDetailModal'
import {
  fetchMonitoringAlerts, fetchFilterOptions, lookupOrders,
} from '@/services/d1Api'
import type { MonitoringAlertItem, FilterOptions, MonitoringAlertsResult } from '@/services/d1Api'

type TimeField = 'createdAt' | 'shippedAt'

const TIME_FIELD_OPTIONS: { value: TimeField; label: string }[] = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'shippedAt', label: '出库时间' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

const ALERT_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  not_shipped: { label: '超时未出库', bg: 'bg-orange-50', text: 'text-orange-600' },
  not_online: { label: '超时未上网', bg: 'bg-blue-50', text: 'text-blue-600' },
  not_delivered: { label: '超时未妥投', bg: 'bg-amber-50', text: 'text-amber-600' },
  keyword: { label: '关键字异常', bg: 'bg-red-50', text: 'text-red-600' },
}

const RULE_TYPE_OPTIONS: { value: MonitoringRule['type']; label: string }[] = [
  { value: 'not_shipped', label: '超时未出库' },
  { value: 'not_online', label: '超时未上网' },
  { value: 'not_delivered', label: '超时未妥投' },
  { value: 'keyword', label: '轨迹关键字' },
]

const MATCH_MODE_OPTIONS: { value: MonitoringRule['matchMode']; label: string }[] = [
  { value: 'any', label: '任意匹配' },
  { value: 'all', label: '全部匹配' },
]

function KeywordInput({ onAdd }: { onAdd: (value: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="text"
        className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none w-28"
        placeholder="添加关键字"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onAdd(value)
            setValue('')
          }
        }}
      />
      <button
        className="p-1 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
        onClick={() => {
          onAdd(value)
          setValue('')
        }}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function FulfillmentMonitor() {
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'keywords'>('overview')
  const [rules, setRules] = useState<MonitoringRule[]>([])
  const [keywordRules, setKeywordRules] = useState<StatusKeywordRule[]>(loadStatusKeywordRules())
  const [carrierFilter, setCarrierFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [timeField, setTimeField] = useState<TimeField>('shippedAt')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [trackingOrder, setTrackingOrder] = useState<LogisticsOrder | null>(null)
  const [loadingTracking, setLoadingTracking] = useState(false)

  const [alerts, setAlerts] = useState<MonitoringAlertItem[]>([])
  const [totalAlerts, setTotalAlerts] = useState(0)
  const [counts, setCounts] = useState<MonitoringAlertsResult['counts']>({ not_shipped: 0, not_online: 0, not_delivered: 0, keyword: 0 })
  const [loading, setLoading] = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ countries: [], carriers: [], warehouses: [], teams: [], statuses: [] })

  const [rulesVersion, setRulesVersion] = useState(0)

  useEffect(() => {
    setRules(loadMonitoringRules())
  }, [])

  useEffect(() => {
    fetchFilterOptions().then(setFilterOptions).catch(() => {})
  }, [])

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }
      if (countryFilter) params.country = countryFilter
      if (carrierFilter) params.carrier = carrierFilter
      if (timeField) params.timeField = timeField
      if (timeStart) params.timeStart = timeStart
      if (timeEnd) params.timeEnd = timeEnd

      const result = await fetchMonitoringAlerts(params, rules.filter((r) => r.enabled), keywordRules.filter((r) => r.enabled))
      setAlerts(result.alerts)
      setTotalAlerts(result.total)
      setCounts(result.counts)
    } catch {
      setAlerts([])
      setTotalAlerts(0)
      setCounts({ not_shipped: 0, not_online: 0, not_delivered: 0, keyword: 0 })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, countryFilter, carrierFilter, timeField, timeStart, timeEnd, rules, keywordRules, rulesVersion])

  useEffect(() => {
    if (activeTab === 'overview') {
      loadAlerts()
    }
  }, [activeTab, loadAlerts])

  const primaryCarriers = useMemo(() => loadProviders(), [])
  const secondaryChannels = useMemo(() => loadChannels(), [])

  const totalPages = Math.max(1, Math.ceil(totalAlerts / pageSize))

  const updateRule = (id: string, updates: Partial<MonitoringRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  const addRule = () => {
    const newRule: MonitoringRule = {
      id: `mr_${Date.now()}`,
      name: '新规则',
      type: 'not_online',
      enabled: true,
      country: '*',
      primaryCarrierId: '*',
      secondaryChannelId: '*',
      hoursThreshold: 120,
      timeBase: 'shippedAt',
      keywords: [],
      matchMode: 'any',
    }
    setRules((prev) => [...prev, newRule])
  }

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  const restoreDefaults = () => {
    setRules([...DEFAULT_MONITORING_RULES])
  }

  const handleSave = () => {
    saveMonitoringRules(rules)
    setRulesVersion((v) => v + 1)
  }

  const handleSaveKeywords = () => {
    saveStatusKeywordRules(keywordRules)
    setRulesVersion((v) => v + 1)
  }

  const handleViewTracking = async (alert: MonitoringAlertItem) => {
    setLoadingTracking(true)
    try {
      const orders = await lookupOrders({ trackingNumbers: [alert.trackingNumber] })
      if (orders.length > 0) {
        setTrackingOrder(orders[0])
      }
    } catch {
    } finally {
      setLoadingTracking(false)
    }
  }

  const hasAnyFilter = !!(carrierFilter || countryFilter || timeStart || timeEnd)

  const clearAllFilters = () => {
    setCarrierFilter('')
    setCountryFilter('')
    setTimeStart('')
    setTimeEnd('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">履约监控</h1>
          <p className="text-sm text-slate-400 mt-1">基于规则的物流履约告警与监控</p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          <span className="inline-flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            监控概览
          </span>
        </button>
        <button
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'rules'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('rules')}
        >
          <span className="inline-flex items-center gap-1.5">
            <FileWarning className="w-4 h-4" />
            监控规则
          </span>
        </button>
        <button
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'keywords'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('keywords')}
        >
          <span className="inline-flex items-center gap-1.5">
            <Search className="w-4 h-4" />
            状态关键字
          </span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium">超时未出库</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1 tabular-nums">{counts.not_shipped}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Warehouse className="w-5 h-5 text-orange-500" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium">超时未上网</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1 tabular-nums">{counts.not_online}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium">超时未妥投</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1 tabular-nums">{counts.not_delivered}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium">关键字异常</p>
                  <p className="text-3xl font-bold text-red-600 mt-1 tabular-nums">{counts.keyword}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <FileWarning className="w-5 h-5 text-red-500" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium">总告警数</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{totalAlerts}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-slate-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Filter className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">筛选条件</h3>
                <p className="text-[11px] text-slate-400">{totalAlerts} 条告警</p>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50/30 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[100px]"
                    value={countryFilter}
                    onChange={(e) => { setCountryFilter(e.target.value); setPage(1) }}
                  >
                    <option value="">全部国家</option>
                    {filterOptions.countries.map((c) => (
                      <option key={c} value={c}>{getCountryName(c)}</option>
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
                    {filterOptions.carriers.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
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

              {hasAnyFilter && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-400">已选筛选：</span>
                  {countryFilter && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                      国家: {getCountryName(countryFilter)}
                      <button onClick={() => { setCountryFilter(''); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  )}
                  {carrierFilter && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                      承运商: {carrierFilter}
                      <button onClick={() => { setCarrierFilter(''); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  )}
                  {(timeStart || timeEnd) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                      {TIME_FIELD_OPTIONS.find((o) => o.value === timeField)?.label}: {timeStart || '...'} ~ {timeEnd || '...'}
                      <button onClick={() => { setTimeStart(''); setTimeEnd(''); setPage(1) }}><X className="w-2.5 h-2.5" /></button>
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

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">告警订单</h3>
                  <p className="text-[11px] text-slate-400">{totalAlerts} 条记录</p>
                </div>
              </div>
              {loading && (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              )}
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
                <p className="text-sm text-slate-400">正在加载告警数据...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-16 text-center">
                <Shield className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">暂无触发的监控告警</p>
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
                      <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">仓库</th>
                      <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">团队</th>
                      <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">触发规则</th>
                      <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">告警类型</th>
                      <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">状态</th>
                      <th className="text-left text-xs text-slate-500 font-medium py-4 px-5">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.orderId} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                        <td className="py-4 px-5 font-medium text-slate-900 whitespace-nowrap">{a.orderId}</td>
                        <td className="py-4 px-5 text-slate-500 font-mono text-sm">{a.trackingNumber}</td>
                        <td className="py-4 px-5 text-slate-600 whitespace-nowrap">{a.carrier}</td>
                        <td className="py-4 px-5 text-slate-600">{getCountryName(a.destinationCountry)}</td>
                        <td className="py-4 px-5 text-slate-500">{a.warehouse}</td>
                        <td className="py-4 px-5 text-slate-500">{a.team}</td>
                        <td className="py-4 px-5 text-slate-600 max-w-[200px] truncate">{a.ruleNames.join(', ')}</td>
                        <td className="py-4 px-5">
                          <div className="flex flex-wrap gap-1">
                            {a.alertTypes.map((t) => {
                              const cfg = ALERT_TYPE_CONFIG[t]
                              return cfg ? (
                                <span key={t} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                                  {cfg.label}
                                </span>
                              ) : null
                            })}
                          </div>
                        </td>
                        <td className="py-4 px-5"><StatusBadge status={a.status as OrderStatus} /></td>
                        <td className="py-4 px-5">
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            disabled={loadingTracking}
                            onClick={() => handleViewTracking(a)}
                          >
                            {loadingTracking ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            查看轨迹
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalAlerts > 0 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-50">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    共 <span className="font-medium text-slate-600">{totalAlerts}</span> 条
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
                  <span className="text-xs text-slate-400">第 {page}/{totalPages} 页</span>
                  <button
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>
                  <button
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'rules' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileWarning className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">监控规则</h3>
              <p className="text-[11px] text-slate-400">{rules.length} 条规则，{rules.filter((r) => r.enabled).length} 条已启用</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {rules.map((rule) => {
              const channels = rule.primaryCarrierId === '*'
                ? []
                : getChannelsForProvider(rule.primaryCarrierId, secondaryChannels)
              return (
                <div key={rule.id} className="px-5 py-4 hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <input
                          type="text"
                          className="text-sm font-medium text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none w-36"
                          value={rule.name}
                          onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                        />

                        <select
                          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                          value={rule.type}
                          onChange={(e) => updateRule(rule.id, { type: e.target.value as MonitoringRule['type'] })}
                        >
                          {RULE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>

                        <select
                          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[90px]"
                          value={rule.country}
                          onChange={(e) => updateRule(rule.id, { country: e.target.value })}
                        >
                          <option value="*">全部国家</option>
                          {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                            <option key={code} value={code}>{name}</option>
                          ))}
                        </select>

                        <select
                          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[90px]"
                          value={rule.primaryCarrierId}
                          onChange={(e) => updateRule(rule.id, { primaryCarrierId: e.target.value, secondaryChannelId: '*' })}
                        >
                          <option value="*">全部运输商</option>
                          {primaryCarriers.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>

                        {rule.primaryCarrierId !== '*' && channels.length > 0 && (
                          <select
                            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[90px]"
                            value={rule.secondaryChannelId}
                            onChange={(e) => updateRule(rule.id, { secondaryChannelId: e.target.value })}
                          >
                            <option value="*">全部渠道</option>
                            {channels.map((ch) => (
                              <option key={ch.id} value={ch.id}>{ch.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {rule.type === 'not_shipped' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">创建到出库超过</span>
                            <input
                              type="number"
                              min={1}
                              className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none text-center"
                              value={rule.hoursThreshold}
                              onChange={(e) => updateRule(rule.id, { hoursThreshold: Number(e.target.value) })}
                            />
                            <span className="text-xs text-slate-400">小时</span>
                          </div>
                        )}
                        {rule.type === 'not_online' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">出库到上网超过</span>
                            <input
                              type="number"
                              min={1}
                              className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none text-center"
                              value={rule.hoursThreshold}
                              onChange={(e) => updateRule(rule.id, { hoursThreshold: Number(e.target.value) })}
                            />
                            <span className="text-xs text-slate-400">小时</span>
                          </div>
                        )}
                        {rule.type === 'not_delivered' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">出库到签收超过</span>
                            <input
                              type="number"
                              min={1}
                              className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none text-center"
                              value={rule.hoursThreshold}
                              onChange={(e) => updateRule(rule.id, { hoursThreshold: Number(e.target.value) })}
                            />
                            <span className="text-xs text-slate-400">小时</span>
                          </div>
                        )}
                        {rule.type === 'keyword' && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400">关键字</span>
                              <input
                                type="text"
                                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none w-64"
                                placeholder="逗号分隔，如：扣留,海关"
                                value={rule.keywords.join(',')}
                                onChange={(e) => {
                                  const val = e.target.value
                                  const kws = val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []
                                  updateRule(rule.id, { keywords: kws })
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400">匹配模式</span>
                              <select
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                                value={rule.matchMode}
                                onChange={(e) => updateRule(rule.id, { matchMode: e.target.value as 'any' | 'all' })}
                              >
                                {MATCH_MODE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                      >
                        {rule.enabled ? (
                          <ToggleRight className="w-7 h-7 text-blue-500" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-slate-300" />
                        )}
                      </button>
                      <button
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              onClick={addRule}
            >
              <Plus className="w-3.5 h-3.5" />
              添加规则
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
              onClick={restoreDefaults}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              恢复默认
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-sm"
              onClick={handleSave}
            >
              <Save className="w-3.5 h-3.5" />
              保存
            </button>
          </div>
        </div>
      )}

      {activeTab === 'keywords' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Search className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">状态关键字说明</h3>
                <p className="text-[11px] text-slate-400">系统通过关键字匹配物流轨迹事件来判断包裹状态</p>
              </div>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              {STATUS_KEYS.map((sk) => {
                const colorMap: Record<string, string> = {
                  online: 'bg-blue-50 text-blue-600',
                  customs_in: 'bg-orange-50 text-orange-600',
                  customs_out: 'bg-green-50 text-green-600',
                  delivery: 'bg-purple-50 text-purple-600',
                  delivered: 'bg-green-50 text-green-600',
                  returning: 'bg-red-50 text-red-600',
                }
                return (
                  <div key={sk.key} className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${colorMap[sk.key] || 'bg-slate-50 text-slate-600'}`}>
                      {sk.label}
                    </span>
                    <span className="text-xs text-slate-500">{sk.description}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Search className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">状态关键字规则</h3>
                <p className="text-[11px] text-slate-400">{keywordRules.length} 条规则，{keywordRules.filter((r) => r.enabled).length} 条已启用</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {keywordRules.map((rule) => (
                <div key={rule.id} className="px-5 py-4 hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <input
                          type="text"
                          className="text-sm font-medium text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none w-36"
                          value={rule.name}
                          onChange={(e) =>
                            setKeywordRules((prev) =>
                              prev.map((r) => (r.id === rule.id ? { ...r, name: e.target.value } : r))
                            )
                          }
                        />
                        <select
                          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                          value={rule.statusKey}
                          onChange={(e) =>
                            setKeywordRules((prev) =>
                              prev.map((r) => (r.id === rule.id ? { ...r, statusKey: e.target.value } : r))
                            )
                          }
                        >
                          {STATUS_KEYS.map((sk) => (
                            <option key={sk.key} value={sk.key}>{sk.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {rule.keywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 rounded-lg px-2 py-0.5 text-xs"
                          >
                            {kw}
                            <button
                              className="hover:text-blue-800 transition-colors"
                              onClick={() =>
                                setKeywordRules((prev) =>
                                  prev.map((r) =>
                                    r.id === rule.id
                                      ? { ...r, keywords: r.keywords.filter((_, i) => i !== idx) }
                                      : r
                                  )
                                )
                              }
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <KeywordInput
                          onAdd={(kw) => {
                            if (!kw.trim()) return
                            setKeywordRules((prev) =>
                              prev.map((r) =>
                                r.id === rule.id && !r.keywords.includes(kw.trim())
                                  ? { ...r, keywords: [...r.keywords, kw.trim()] }
                                  : r
                              )
                            )
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        onClick={() =>
                          setKeywordRules((prev) =>
                            prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
                          )
                        }
                      >
                        {rule.enabled ? (
                          <ToggleRight className="w-7 h-7 text-blue-500" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-slate-300" />
                        )}
                      </button>
                      <button
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => setKeywordRules((prev) => prev.filter((r) => r.id !== rule.id))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                onClick={() => {
                  const newRule: StatusKeywordRule = {
                    id: `skr_${Date.now()}`,
                    name: '新规则',
                    statusKey: 'online',
                    keywords: [],
                    enabled: true,
                  }
                  setKeywordRules((prev) => [...prev, newRule])
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                添加规则
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
                onClick={() => setKeywordRules([...DEFAULT_STATUS_KEYWORD_RULES])}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                恢复默认
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-sm"
                onClick={handleSaveKeywords}
              >
                <Save className="w-3.5 h-3.5" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {trackingOrder && (
        <OrderDetailModal order={trackingOrder} onClose={() => setTrackingOrder(null)} />
      )}
    </div>
  )
}
