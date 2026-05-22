import { useState, useEffect, useCallback } from 'react'
import {
  Download, X, PackageCheck, TrendingUp,
  Clock, ShieldCheck, CheckCircle2, Globe, Truck,
  Calendar, Filter, BarChart3, Target,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from 'recharts'
import {
  fetchKpi, fetchByCarrier, fetchByCountry,
  fetchP90Matrix, fetchTransitDistribution,
  fetchSlaTrend, fetchCarrierP90, fetchFilterOptions,
} from '@/services/d1Api'
import { getCountryName } from '@/utils/countryNames'
import type {
  KpiResult, CarrierStatsItem, CountryStatsItem,
  P90MatrixResult, TransitDistributionItem,
  SlaTrendItem, CarrierP90Item, FilterOptions,
  StatsFilterParams,
} from '@/services/d1Api'

function exportStatsCSV(headers: string[], rows: string[][], filename: string) {
  const BOM = '\uFEFF'
  const csvRows = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = BOM + [headers.join(','), ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type TabKey = 'country' | 'carrier'

const BUCKET_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#F97316', '#EF4444', '#8B5CF6']
const BUCKET_KEYS = ['le2', 'd3', 'd4_5', 'd6_7', 'd8_10', 'gt10'] as const
const BUCKET_LABELS = ['≤2天', '3天', '5天', '7天', '8-10天', '>10天']

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className || ''}`} />
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
      <div className="flex items-center gap-3 mb-4">
        <SkeletonBlock className="w-9 h-9 rounded-xl" />
        <SkeletonBlock className="w-16 h-3" />
      </div>
      <SkeletonBlock className="w-20 h-7" />
    </div>
  )
}

function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )
}

export default function DeliveryDashboard() {
  const [carrierFilter, setCarrierFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('US')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [tab, setTab] = useState<TabKey>('country')
  const [sortKey, setSortKey] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [kpiData, setKpiData] = useState<KpiResult | null>(null)
  const [countryStats, setCountryStats] = useState<CountryStatsItem[]>([])
  const [carrierStats, setCarrierStats] = useState<CarrierStatsItem[]>([])
  const [p90Matrix, setP90Matrix] = useState<P90MatrixResult | null>(null)
  const [transitDist, setTransitDist] = useState<TransitDistributionItem[]>([])
  const [slaTrend, setSlaTrend] = useState<SlaTrendItem[]>([])
  const [carrierP90, setCarrierP90] = useState<CarrierP90Item[]>([])

  const [loading, setLoading] = useState(true)

  const buildParams = useCallback((): StatsFilterParams => {
    const p: StatsFilterParams = {}
    if (countryFilter) p.country = countryFilter
    if (carrierFilter) p.carrier = carrierFilter
    if (timeStart || timeEnd) {
      p.timeField = 'shippedAt'
      if (timeStart) p.timeStart = timeStart
      if (timeEnd) p.timeEnd = timeEnd
    }
    return p
  }, [countryFilter, carrierFilter, timeStart, timeEnd])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = buildParams()
    Promise.all([
      fetchKpi(params),
      fetchByCountry(params),
      fetchByCarrier(params),
      fetchP90Matrix(params),
      fetchTransitDistribution(params),
      fetchSlaTrend(params),
      fetchCarrierP90(params),
    ])
      .then(([kpi, country, carrier, p90, transit, sla, cp90]) => {
        if (cancelled) return
        setKpiData(kpi)
        setCountryStats(country)
        setCarrierStats(carrier)
        setP90Matrix(p90)
        setTransitDist(transit)
        setSlaTrend(sla)
        setCarrierP90(cp90)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [buildParams])

  useEffect(() => {
    fetchFilterOptions()
      .then(setFilterOptions)
      .catch(() => {})
  }, [])

  const countries = filterOptions?.countries || []
  const carriers = filterOptions?.carriers || []

  function sortFn(a: Record<string, any>, b: Record<string, any>): number {
    if (!sortKey) return (b.total || 0) - (a.total || 0)
    const va = a[sortKey] ?? 0
    const vb = b[sortKey] ?? 0
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va
    }
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ field }: { field: string }) {
    if (sortKey !== field) return <span className="text-slate-300 ml-0.5">↕</span>
    return <span className="text-blue-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function rateColor(rate: number): string {
    if (rate >= 0.9) return '#10B981'
    if (rate >= 0.7) return '#F59E0B'
    return '#EF4444'
  }

  const isSingleCountry = !!countryFilter && countryFilter !== '*'

  const singleCountryData = (() => {
    if (!isSingleCountry || !p90Matrix) return []
    return p90Matrix.carrierList
      .map((carrier) => {
        const cell = p90Matrix.matrix[carrier]?.[countryFilter]
        if (!cell || cell.count === 0) return null
        return {
          channel: carrier,
          p90: Number(cell.p90.toFixed(1)),
          slaDays: cell.slaDays,
        }
      })
      .filter((d): d is { channel: string; p90: number; slaDays: number | null } => d !== null)
      .sort((a, b) => b.p90 - a.p90)
  })()

  const transitBucketData = transitDist.map((item) => ({
    country: getCountryName(item.country),
    le2: item.le2.pct,
    d3: item.d3.pct,
    d4_5: item.d4_5.pct,
    d6_7: item.d6_7.pct,
    d8_10: item.d8_10.pct,
    gt10: item.gt10.pct,
  }))

  const carrierCompareData = carrierStats
    .filter((s) => s.avgDays > 0)
    .map((s) => ({
      carrier: s.carrier,
      avgDays: Number(s.avgDays.toFixed(1)),
      p90: (() => {
        const cp = carrierP90.find((c) => c.carrier === s.carrier)
        return cp ? Number(cp.p90.toFixed(1)) : 0
      })(),
    }))

  const carrierP90Progress = carrierP90
    .filter((s) => s.p90 > 0)
    .map((s) => {
      const ratio = s.slaDays && s.slaDays > 0 ? s.p90 / s.slaDays : 0
      const passed = !!(s.slaDays && s.slaDays > 0 && s.p90 <= s.slaDays)
      return {
        carrier: s.carrier,
        p90: s.p90,
        slaDays: s.slaDays || 0,
        ratio: Math.min(ratio, 2),
        passed,
      }
    })
    .sort((a, b) => a.ratio - b.ratio)

  const sortedCountryStats = [...countryStats].sort(sortFn)
  const sortedCarrierStats = [...carrierStats].sort(sortFn)

  const kpis = kpiData ? [
    { label: '已签收数', value: kpiData.deliveredOrders, icon: PackageCheck, bg: '#EFF6FF', color: '#3B82F6' },
    { label: '妥投率', value: `${(kpiData.deliveryRate * 100).toFixed(1)}%`, icon: TrendingUp, bg: '#ECFDF5', color: '#10B981' },
    { label: '平均时效', value: `${kpiData.avgTransitDays.toFixed(1)}天`, icon: Clock, bg: '#FFFBEB', color: '#F59E0B' },
    { label: 'SLA达标率', value: `${(kpiData.slaComplianceRate * 100).toFixed(1)}%`, icon: ShieldCheck, bg: '#EEF2FF', color: '#6366F1' },
    { label: 'SLA达标数', value: `${kpiData.slaPassed}/${kpiData.slaTotal}`, icon: CheckCircle2, bg: '#F0FDF4', color: '#22C55E' },
  ] : []

  const hasAnyFilter = !!(timeStart || timeEnd || countryFilter || carrierFilter)

  const clearAllFilters = () => {
    setTimeStart('')
    setTimeEnd('')
    setCountryFilter('US')
    setCarrierFilter('')
  }

  function renderRateBar(rate: number, colorFn?: (r: number) => string) {
    const color = colorFn ? colorFn(rate) : rate >= 0.9 ? '#6366F1' : rate >= 0.7 ? '#F59E0B' : '#EF4444'
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-4 bg-slate-50 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${rate * 100}%`, backgroundColor: color }} />
        </div>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>{(rate * 100).toFixed(1)}%</span>
      </div>
    )
  }

  function handleExportCSV() {
    if (tab === 'country') {
      const headers = ['国家', '有效订单', '已签收', '妥投率', '平均时效', 'SLA达标率']
      const rows = sortedCountryStats.map((r) => [
        getCountryName(r.country),
        String(r.total),
        String(r.delivered),
        (r.deliveryRate * 100).toFixed(1) + '%',
        r.avgDays > 0 ? r.avgDays + '天' : '-',
        r.slaTotal > 0 ? (r.slaRate * 100).toFixed(1) + '%' : '-',
      ])
      exportStatsCSV(headers, rows, '时效看板_按国家统计')
    } else {
      const headers = ['渠道', '有效订单', '已签收', '妥投率', '平均时效', 'SLA达标率']
      const rows = sortedCarrierStats.map((r) => [
        r.carrier,
        String(r.total),
        String(r.delivered),
        (r.deliveryRate * 100).toFixed(1) + '%',
        r.avgDays > 0 ? r.avgDays + '天' : '-',
        r.slaTotal > 0 ? (r.slaRate * 100).toFixed(1) + '%' : '-',
      ])
      exportStatsCSV(headers, rows, '时效看板_按渠道统计')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">时效看板</h1>
        <p className="text-sm text-slate-400 mt-1">按渠道和国家分析物流时效与SLA达标情况</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Filter className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">筛选条件</h3>
            <p className="text-[11px] text-slate-400">服务端聚合统计</p>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50/30 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <select
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[100px]"
                value={carrierFilter}
                onChange={(e) => setCarrierFilter(e.target.value)}
              >
                <option value="">全部承运商</option>
                {carriers.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <select
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none min-w-[100px]"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              >
                <option value="">全部国家</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{getCountryName(c)}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500">出库时间</span>
              <input
                type="date"
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
              />
              <span className="text-xs text-slate-400">至</span>
              <input
                type="date"
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
              />
            </div>
          </div>

          {hasAnyFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400">已选筛选：</span>
              {carrierFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  承运商: {carrierFilter}
                  <button onClick={() => setCarrierFilter('')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {countryFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  国家: {getCountryName(countryFilter)}
                  <button onClick={() => setCountryFilter('')}><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {(timeStart || timeEnd) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600">
                  出库时间: {timeStart || '...'} ~ {timeEnd || '...'}
                  <button onClick={() => { setTimeStart(''); setTimeEnd('') }}><X className="w-2.5 h-2.5" /></button>
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

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {kpis.map((cfg) => {
            const Icon = cfg.icon
            return (
              <div key={cfg.label} className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{cfg.label}</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-slate-900">{cfg.value}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">渠道×国家 90%达标时效</h3>
            <p className="text-[11px] text-slate-400">单元格显示P90时效（90%订单在X天内签收），绿色=达标，红色=未达标</p>
          </div>
        </div>
        {loading ? (
          <SkeletonChart height={200} />
        ) : !p90Matrix || p90Matrix.carrierList.length === 0 || (isSingleCountry ? singleCountryData.length === 0 : p90Matrix.countryList.length === 0) ? (
          <div className="py-16 text-center">
            <ShieldCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">暂无数据</p>
          </div>
        ) : isSingleCountry ? (
          <div className="px-4 py-4">
            <ResponsiveContainer width="100%" height={singleCountryData.length * 45 + 40}>
              <BarChart data={singleCountryData} layout="vertical" margin={{ left: 80, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" unit="天" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="channel" tick={{ fontSize: 12 }} width={75} />
                <Tooltip />
                {[...new Set(singleCountryData.map(d => d.slaDays).filter((v): v is number => v !== null))].map(sla => (
                  <ReferenceLine key={sla} x={sla} stroke="#EF4444" strokeDasharray="3 3" label={{ value: `SLA ${sla}天`, position: 'top', fill: '#EF4444', fontSize: 10 }} />
                ))}
                <Bar dataKey="p90" name="P90达标时效" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20}
                  label={{ position: 'right', fill: '#3B82F6', fontSize: 11, fontWeight: 600, formatter: (v: number) => `${v}天` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-5 sticky left-0 bg-slate-50/80 z-10">渠道</th>
                  {p90Matrix.countryList.map((country) => (
                    <th key={country} className="text-center text-[11px] text-slate-500 font-medium py-3 px-3 whitespace-nowrap">{getCountryName(country)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p90Matrix.carrierList.map((carrier) => (
                  <tr key={carrier} className="border-t border-slate-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-5 font-medium text-slate-900 whitespace-nowrap sticky left-0 bg-white z-10">{carrier}</td>
                    {p90Matrix.countryList.map((country) => {
                      const cell = p90Matrix.matrix[carrier]?.[country]
                      if (!cell || cell.count === 0) {
                        return (
                          <td key={country} className="py-3 px-3 text-center">
                            <span className="text-xs text-slate-300">-</span>
                          </td>
                        )
                      }
                      const isPassed = cell.passed
                      const bgColor = isPassed === true ? '#ECFDF5' : isPassed === false ? '#FEF2F2' : '#F8FAFC'
                      const textColor = isPassed === true ? '#059669' : isPassed === false ? '#DC2626' : '#475569'
                      return (
                        <td key={country} className="py-3 px-3 text-center" style={{ backgroundColor: bgColor }}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-bold tabular-nums" style={{ color: textColor }}>
                              {cell.p90.toFixed(1)}天
                            </span>
                            {cell.slaDays !== null && (
                              <span className="text-[9px] text-slate-400">
                                SLA{cell.slaDays}天 {isPassed ? '✓' : '✗'}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === 'country'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              onClick={() => { setTab('country'); setSortKey('') }}
            >
              <Globe className="w-3.5 h-3.5" />
              按国家
            </button>
            <button
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === 'carrier'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              onClick={() => { setTab('carrier'); setSortKey('') }}
            >
              <Truck className="w-3.5 h-3.5" />
              按渠道
            </button>
          </div>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-sm"
            onClick={handleExportCSV}
          >
            <Download className="w-3.5 h-3.5" />
            导出 CSV
          </button>
        </div>

        {tab === 'country' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-5 cursor-pointer select-none" onClick={() => toggleSort('country')}>国家 <SortIcon field="country" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('total')}>有效订单 <SortIcon field="total" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('delivered')}>已签收 <SortIcon field="delivered" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('deliveryRate')}>妥投率 <SortIcon field="deliveryRate" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('avgDays')}>平均时效 <SortIcon field="avgDays" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('slaRate')}>SLA达标率 <SortIcon field="slaRate" /></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" /></td></tr>
                ) : sortedCountryStats.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm">暂无数据</td></tr>
                ) : sortedCountryStats.map((r) => (
                  <tr key={r.country} className="border-t border-slate-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-5 font-medium text-slate-900 whitespace-nowrap">{getCountryName(r.country)}</td>
                    <td className="py-3 px-4 text-slate-600 tabular-nums">{r.total}</td>
                    <td className="py-3 px-4 text-slate-600 tabular-nums">{r.delivered}</td>
                    <td className="py-3 px-4">{renderRateBar(r.deliveryRate, rateColor)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold ${r.avgDays > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                        {r.avgDays > 0 ? `${r.avgDays}天` : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{r.slaTotal > 0 ? renderRateBar(r.slaRate) : <span className="text-xs text-slate-300">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'carrier' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-5 cursor-pointer select-none" onClick={() => toggleSort('carrier')}>渠道 <SortIcon field="carrier" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('total')}>有效订单 <SortIcon field="total" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('delivered')}>已签收 <SortIcon field="delivered" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('deliveryRate')}>妥投率 <SortIcon field="deliveryRate" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('avgDays')}>平均时效 <SortIcon field="avgDays" /></th>
                  <th className="text-left text-[11px] text-slate-500 font-medium py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('slaRate')}>SLA达标率 <SortIcon field="slaRate" /></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" /></td></tr>
                ) : sortedCarrierStats.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm">暂无数据</td></tr>
                ) : sortedCarrierStats.map((r) => (
                  <tr key={r.carrier} className="border-t border-slate-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-5 font-medium text-slate-900 whitespace-nowrap">{r.carrier}</td>
                    <td className="py-3 px-4 text-slate-600 tabular-nums">{r.total}</td>
                    <td className="py-3 px-4 text-slate-600 tabular-nums">{r.delivered}</td>
                    <td className="py-3 px-4">{renderRateBar(r.deliveryRate, rateColor)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold ${r.avgDays > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                        {r.avgDays > 0 ? `${r.avgDays}天` : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{r.slaTotal > 0 ? renderRateBar(r.slaRate) : <span className="text-xs text-slate-300">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">时效分布</h3>
              <p className="text-[11px] text-slate-400">各国家不同时效区间的订单分布</p>
            </div>
          </div>
          <div className="px-4 py-4">
            {loading ? (
              <SkeletonChart height={320} />
            ) : transitBucketData.length === 0 ? (
              <div className="py-12 text-center">
                <BarChart3 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">暂无数据</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={transitBucketData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="country" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(value: number, name: string) => [`${value}%`, BUCKET_LABELS[BUCKET_KEYS.indexOf(name as typeof BUCKET_KEYS[number])] || name]}
                  />
                  <Legend formatter={(value: string) => BUCKET_LABELS[BUCKET_KEYS.indexOf(value as typeof BUCKET_KEYS[number])] || value} />
                  {BUCKET_KEYS.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="a" fill={BUCKET_COLORS[i]} radius={i === BUCKET_KEYS.length - 1 ? [4, 4, 0, 0] : undefined} label={{ position: 'center', fill: '#fff', fontSize: 10, fontWeight: 600, formatter: (v: number) => v > 5 ? `${v}%` : '' }} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Target className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">渠道时效对比</h3>
              <p className="text-[11px] text-slate-400">各渠道平均时效与P90时效对比</p>
            </div>
          </div>
          <div className="px-4 py-4">
            {loading ? (
              <SkeletonChart height={320} />
            ) : carrierCompareData.length === 0 ? (
              <div className="py-12 text-center">
                <Target className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">暂无数据</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={carrierCompareData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="carrier" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="avgDays" name="平均时效" fill="#3B82F6" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#3B82F6', fontSize: 11, fontWeight: 600 }} />
                  <Bar dataKey="p90" name="P90时效" fill="#F59E0B" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#F97316', fontSize: 11, fontWeight: 600 }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">SLA达标趋势</h3>
              <p className="text-[11px] text-slate-400">按出库月份分组的SLA达标率变化</p>
            </div>
          </div>
          <div className="px-4 py-4">
            {loading ? (
              <SkeletonChart height={280} />
            ) : slaTrend.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">暂无数据</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={slaTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} domain={[0, 100]} unit="%" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} formatter={(v: number) => [`${v}%`, 'SLA达标率']} />
                  <Line type="monotone" dataKey="rate" name="SLA达标率" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366F1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">各渠道P90达标率</h3>
              <p className="text-[11px] text-slate-400">P90时效与SLA天数对比，进度条越短越达标</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            {loading ? (
              <SkeletonChart height={200} />
            ) : carrierP90Progress.length === 0 ? (
              <div className="py-12 text-center">
                <ShieldCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">暂无数据</p>
              </div>
            ) : carrierP90Progress.map((item) => {
              const barWidth = Math.min((item.ratio / 2) * 100, 100)
              return (
                <div key={item.carrier} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">{item.carrier}</span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-slate-500">P90 <span className="font-semibold text-slate-700">{item.p90.toFixed(1)}天</span></span>
                      <span className="text-slate-400">SLA <span className="font-semibold text-slate-600">{item.slaDays}天</span></span>
                      <span className={`font-semibold ${item.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                        {item.passed ? '达标' : '未达标'}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-5 bg-slate-50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: item.passed ? '#10B981' : '#EF4444',
                        opacity: 0.7,
                      }}
                    />
                    {item.slaDays > 0 && (
                      <div
                        className="absolute top-0 h-full w-0.5 bg-slate-900"
                        style={{ left: `${Math.min((item.slaDays / (item.slaDays * 2)) * 100, 100)}%` }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
