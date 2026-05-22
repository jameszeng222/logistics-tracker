import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, RotateCcw, Save, ToggleLeft, ToggleRight } from 'lucide-react'
import type { SlaRule } from '@/config/slaConfig'
import { loadSlaRules, saveSlaRules, DEFAULT_SLA_RULES } from '@/config/slaConfig'
import { loadProviders, loadChannels, getChannelsForProvider } from '@/config/carrierConfig'
import { COUNTRY_NAMES } from '@/utils/countryNames'

export default function SlaSettings() {
  const [rules, setRules] = useState<SlaRule[]>([])
  const [saved, setSaved] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const primaryCarriers = useMemo(() => loadProviders(), [])
  const secondaryChannels = useMemo(() => loadChannels(), [])

  const countryOptions = useMemo(() => {
    const entries = Object.entries(COUNTRY_NAMES)
      .filter(([code]) => code !== 'unknown')
      .sort(([, a], [, b]) => a.localeCompare(b, 'zh-Hans-CN'))
      .map(([code, name]) => ({ value: code, label: name }))
    return [{ value: '*', label: '全部国家' }, ...entries]
  }, [])

  useEffect(() => {
    setRules(loadSlaRules())
  }, [])

  const handleSave = () => {
    saveSlaRules(rules)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setRules([...DEFAULT_SLA_RULES])
    saveSlaRules([...DEFAULT_SLA_RULES])
  }

  const addRule = () => {
    const newRule: SlaRule = {
      id: `r_${Date.now()}`,
      name: '新规则',
      country: '*',
      primaryCarrierId: '*',
      secondaryChannelId: '*',
      slaDays: 15,
      enabled: true,
    }
    setRules([...rules, newRule])
    setEditingId(newRule.id)
  }

  const removeRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id))
  }

  const updateRule = (id: string, updates: Partial<SlaRule>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  const toggleEnabled = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }

  const moveRule = (index: number, direction: 'up' | 'down') => {
    const newRules = [...rules]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newRules.length) return
    ;[newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]]
    setRules(newRules)
  }

  const handlePrimaryCarrierChange = (ruleId: string, carrierId: string) => {
    if (carrierId === '*') {
      updateRule(ruleId, { primaryCarrierId: '*', secondaryChannelId: '*' })
    } else {
      updateRule(ruleId, { primaryCarrierId: carrierId, secondaryChannelId: '*' })
    }
  }

  const getAvailableChannels = (primaryCarrierId: string) => {
    if (primaryCarrierId === '*') return [{ id: '*', name: '全部渠道' }]
    const channels = getChannelsForProvider(primaryCarrierId, secondaryChannels)
    return [{ id: '*', name: '全部渠道' }, ...channels]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SLA 配置</h1>
          <p className="text-sm text-slate-400 mt-1">
            按国家 + 一级运输商 + 二级物流渠道配置 SLA 时效标准，规则从上到下依次匹配
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
            onClick={handleReset}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            恢复默认
          </button>
          <button
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white shadow-sm transition-all ${
              saved ? 'bg-emerald-500' : 'bg-blue-500 hover:bg-blue-600'
            }`}
            onClick={handleSave}
          >
            <Save className="w-3.5 h-3.5" />
            {saved ? '已保存' : '保存配置'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
          <span className="text-[11px] text-slate-400 font-medium w-8" />
          <span className="text-[11px] text-slate-400 font-medium flex-1 min-w-[120px]">规则名称</span>
          <span className="text-[11px] text-slate-400 font-medium w-[140px]">国家</span>
          <span className="text-[11px] text-slate-400 font-medium w-[130px]">一级运输商</span>
          <span className="text-[11px] text-slate-400 font-medium w-[140px]">二级物流渠道</span>
          <span className="text-[11px] text-slate-400 font-medium w-[90px]">SLA 天数</span>
          <span className="text-[11px] text-slate-400 font-medium w-16 text-center">状态</span>
          <span className="text-[11px] text-slate-400 font-medium w-10 text-center">操作</span>
        </div>

        {rules.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">暂无规则，点击下方按钮添加</p>
          </div>
        ) : (
          <div>
            {rules.map((rule, index) => (
              <div
                key={rule.id}
                className={`px-5 py-3 flex items-center gap-4 border-b border-slate-100 last:border-b-0 transition-colors ${
                  editingId === rule.id ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'
                } ${!rule.enabled ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-col gap-0.5 w-8">
                  <button
                    className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30"
                    onClick={() => moveRule(index, 'up')}
                    disabled={index === 0}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 2l4 5H2z" />
                    </svg>
                  </button>
                  <button
                    className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30"
                    onClick={() => moveRule(index, 'down')}
                    disabled={index === rules.length - 1}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 10l4-5H2z" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 min-w-[120px]">
                  {editingId === rule.id ? (
                    <input
                      type="text"
                      className="w-full px-2 py-1 rounded-lg border border-blue-300 text-xs bg-white focus:ring-1 focus:ring-blue-100 outline-none"
                      value={rule.name}
                      onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="text-sm font-medium text-slate-800 cursor-pointer hover:text-blue-600"
                      onClick={() => setEditingId(rule.id)}
                    >
                      {rule.name}
                    </span>
                  )}
                </div>

                <div className="w-[140px]">
                  <select
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                    value={rule.country}
                    onChange={(e) => updateRule(rule.id, { country: e.target.value })}
                  >
                    {countryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-[130px]">
                  <select
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                    value={rule.primaryCarrierId}
                    onChange={(e) => handlePrimaryCarrierChange(rule.id, e.target.value)}
                  >
                    <option value="*">全部运输商</option>
                    {primaryCarriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-[140px]">
                  <select
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                    value={rule.secondaryChannelId}
                    onChange={(e) => updateRule(rule.id, { secondaryChannelId: e.target.value })}
                    disabled={rule.primaryCarrierId === '*'}
                  >
                    {getAvailableChannels(rule.primaryCarrierId).map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-[90px]">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-center outline-none focus:border-blue-300"
                      value={rule.slaDays}
                      onChange={(e) => updateRule(rule.id, { slaDays: Number(e.target.value) || 1 })}
                    />
                    <span className="text-[10px] text-slate-400">天</span>
                  </div>
                </div>

                <div className="w-16 text-center">
                  <button
                    className="inline-flex items-center justify-center"
                    onClick={() => toggleEnabled(rule.id)}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-300" />
                    )}
                  </button>
                </div>

                <div className="w-10 text-center">
                  <button
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    onClick={() => removeRule(rule.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
        onClick={addRule}
      >
        <Plus className="w-3.5 h-3.5" />
        添加规则
      </button>

      <div className="bg-slate-50/60 rounded-2xl border border-slate-200/60 px-5 py-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">配置说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-500">
          <div>
            <p className="font-medium text-slate-600 mb-1">匹配规则</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>规则从上到下依次匹配，第一条命中的规则生效</li>
              <li>国家匹配订单目的地国家代码</li>
              <li>一级运输商匹配物流承运商分类</li>
              <li>二级物流渠道联动一级运输商，选择具体渠道</li>
              <li>
                <code className="bg-slate-100 px-1 rounded">*</code> 表示匹配所有
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-slate-600 mb-1">计算公式</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>妥投率 = 已签收 / (全部 - NotFound)</li>
              <li>平均时效 = Σ(签收时间 - ERP出库时间) / 已签收数</li>
              <li>SLA达标率 = 实际时效 ≤ SLA天数 / 已签收数</li>
              <li>优先级：具体渠道规则应排在通配规则之前</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
