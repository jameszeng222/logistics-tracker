import { useEffect, useState, useCallback } from 'react'
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Package, TrendingUp, Clock, AlertTriangle, ShieldCheck, Truck } from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'
import { getCountryName } from '@/utils/countryNames'
import {
  fetchKpi, fetchStatusDistribution, fetchByCarrier, fetchByCountry,
} from '@/services/d1Api'
import type { KpiResult, StatusDistributionResult, CarrierStatsItem, CountryStatsItem, StatsFilterParams } from '@/services/d1Api'

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EF4444', '#EC4899', '#14B8A6', '#8B5CF6', '#F97316', '#06B6D4']

const STATUS_COLOR_MAP: Record<string, string> = {
  in_transit: '#3B82F6',
  info_received: '#3B82F6',
  delivered: '#10B981',
  available_for_pickup: '#10B981',
  out_for_delivery: '#10B981',
  not_found: '#F59E0B',
  expired: '#F59E0B',
  exception: '#EF4444',
  delivery_failure: '#EF4444',
  return: '#A855F7',
}

function LightTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-lg">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold text-slate-700">{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</p>
      ))}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-slate-100" />
        <div className="h-3 w-12 bg-slate-100 rounded" />
      </div>
      <div className="h-7 w-20 bg-slate-100 rounded" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse">
      <div className="h-4 w-24 bg-slate-100 rounded mb-5" />
      <div className="flex items-center justify-center h-[260px]">
        <div className="w-32 h-32 rounded-full bg-slate-100" />
      </div>
    </div>
  )
}

function SkeletonBars() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse">
      <div className="h-4 w-32 bg-slate-100 rounded mb-5" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="flex-1 h-6 bg-slate-100 rounded-lg" />
            <div className="h-3 w-14 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [filters] = useState<StatsFilterParams>({})
  const [kpi, setKpi] = useState<KpiResult | null>(null)
  const [statusDist, setStatusDist] = useState<StatusDistributionResult | null>(null)
  const [carrierStats, setCarrierStats] = useState<CarrierStatsItem[]>([])
  const [countryStats, setCountryStats] = useState<CountryStatsItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiRes, statusRes, carrierRes, countryRes] = await Promise.all([
        fetchKpi(filters),
        fetchStatusDistribution(filters),
        fetchByCarrier(filters),
        fetchByCountry(filters),
      ])
      setKpi(kpiRes)
      setStatusDist(statusRes)
      setCarrierStats(carrierRes)
      setCountryStats(countryRes)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadAll() }, [loadAll])

  const kpis = kpi ? [
    { label: '有效订单', value: kpi.validOrders, icon: Package, bg: '#EFF6FF', color: '#3B82F6' },
    { label: '妥投率', value: `${(kpi.deliveryRate * 100).toFixed(1)}%`, icon: TrendingUp, bg: '#ECFDF5', color: '#10B981' },
    { label: '平均时效', value: `${kpi.avgTransitDays.toFixed(1)}天`, icon: Clock, bg: '#FFFBEB', color: '#F59E0B' },
    { label: '异常件数', value: kpi.exceptionOrders, icon: AlertTriangle, bg: '#FEF2F2', color: '#EF4444' },
    { label: 'SLA达标率', value: `${(kpi.slaComplianceRate * 100).toFixed(1)}%`, icon: ShieldCheck, bg: '#EEF2FF', color: '#6366F1' },
    { label: '在途件数', value: kpi.inTransitOrders, icon: Truck, bg: '#F0FDFA', color: '#14B8A6' },
  ] : []

  const statusDistribution = statusDist
    ? (Object.entries(statusDist.byStatus) as [string, number][])
        .filter(([s]) => s !== 'not_found')
        .map(([status, count]) => ({
          name: (STATUS_LABELS as Record<string, string>)[status] || status,
          value: count,
          fill: STATUS_COLOR_MAP[status] || (STATUS_COLORS as Record<string, { dot: string }>)[status]?.dot || '#94A3B8',
        }))
    : []

  const carrierPieData = [...carrierStats]
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ name: c.carrier, value: c.total }))

  const countryPieData = [...countryStats]
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ name: getCountryName(c.country), value: c.total }))

  const countryData = [...countryStats]
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ country: getCountryName(c.country), avg: c.avgDays, count: c.total }))

  const carrierData = [...carrierStats]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((c) => ({ carrier: c.carrier, rate: c.deliveryRate, total: c.total, delivered: c.delivered }))

  const slaCountryData = [...countryStats]
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ country: getCountryName(c.country), rate: c.slaRate, total: c.slaTotal, passed: c.slaPassed }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">数据总览</h1>
        <p className="text-sm text-slate-400 mt-1">
          物流运营关键指标 · 妥投率排除NotFound · 时效以ERP出库时间为起点 · SLA按目的地+渠道配置
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
          {kpis.map((cfg, i) => {
            const Icon = cfg.icon
            return (
              <div key={cfg.label} className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md transition-shadow animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <SkeletonChart /> : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-fade-in-up" style={{ animationDelay: '360ms' }}>
            <h3 className="text-sm font-semibold text-slate-800 mb-5">状态分布</h3>
            {statusDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-slate-300 text-sm">暂无数据</div>
            ) : (
              <div className="flex items-center gap-8">
                <ResponsiveContainer width="50%" height={240}>
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                      {statusDistribution.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<LightTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {statusDistribution.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-sm text-slate-600">{d.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? <SkeletonChart /> : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-fade-in-up" style={{ animationDelay: '420ms' }}>
            <h3 className="text-sm font-semibold text-slate-800 mb-5">物流渠道占比</h3>
            {carrierPieData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-slate-300 text-sm">暂无数据</div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={240}>
                  <PieChart>
                    <Pie data={carrierPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                      {carrierPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<LightTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5 max-h-[240px] overflow-y-auto">
                  {carrierPieData.map((d, i) => {
                    const total = carrierPieData.reduce((s, x) => s + x.value, 0)
                    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0'
                    return (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm text-slate-600 truncate max-w-[80px]">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{d.value}</span>
                          <span className="text-xs text-slate-400">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? <SkeletonChart /> : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-fade-in-up" style={{ animationDelay: '480ms' }}>
            <h3 className="text-sm font-semibold text-slate-800 mb-5">目的国家占比</h3>
            {countryPieData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-slate-300 text-sm">暂无数据</div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={240}>
                  <PieChart>
                    <Pie data={countryPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                      {countryPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<LightTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5 max-h-[240px] overflow-y-auto">
                  {countryPieData.map((d, i) => {
                    const total = countryPieData.reduce((s, x) => s + x.value, 0)
                    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0'
                    return (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm text-slate-600">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{d.value}</span>
                          <span className="text-xs text-slate-400">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? <SkeletonBars /> : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-fade-in-up" style={{ animationDelay: '540ms' }}>
            <h3 className="text-sm font-semibold text-slate-800 mb-5">各国家平均时效</h3>
            {countryData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-slate-300 text-sm">暂无数据</div>
            ) : (
              <div className="space-y-3">
                {countryData.map((d) => {
                  const maxAvg = Math.max(...countryData.map((x) => x.avg), 1)
                  const pct = Math.min((d.avg / maxAvg) * 100, 100)
                  return (
                    <div key={d.country} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-20 flex-shrink-0 truncate">{d.country}</span>
                      <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full rounded-lg transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: d.avg <= 7 ? '#3B82F6' : d.avg <= 14 ? '#F59E0B' : '#EF4444',
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 w-14 text-right">{d.avg.toFixed(1)}天</span>
                      <span className="text-[10px] text-slate-400 w-12 text-right">{d.count}单</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? <SkeletonBars /> : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
            <h3 className="text-sm font-semibold text-slate-800 mb-5">SLA达标率（按国家）</h3>
            {slaCountryData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-slate-300 text-sm">暂无数据</div>
            ) : (
              <div className="space-y-3">
                {slaCountryData.map((d) => (
                  <div key={d.country} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-20 flex-shrink-0">{d.country}</span>
                    <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-500"
                        style={{
                          width: `${d.rate * 100}%`,
                          backgroundColor: d.rate >= 0.9 ? '#6366F1' : d.rate >= 0.7 ? '#F59E0B' : '#EF4444',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-14 text-right">{(d.rate * 100).toFixed(1)}%</span>
                    <span className="text-[10px] text-slate-400 w-16 text-right">{d.passed}/{d.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? <SkeletonBars /> : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-fade-in-up" style={{ animationDelay: '660ms' }}>
            <h3 className="text-sm font-semibold text-slate-800 mb-5">承运商妥投率</h3>
            {carrierData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-slate-300 text-sm">暂无数据</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {carrierData.map((d) => (
                  <div key={d.carrier} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-24 truncate flex-shrink-0">{d.carrier}</span>
                    <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-500"
                        style={{
                          width: `${d.rate * 100}%`,
                          backgroundColor: d.rate >= 0.9 ? '#10B981' : d.rate >= 0.7 ? '#F59E0B' : '#EF4444',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-14 text-right">{(d.rate * 100).toFixed(1)}%</span>
                    <span className="text-[10px] text-slate-400 w-16 text-right">{d.delivered}/{d.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
