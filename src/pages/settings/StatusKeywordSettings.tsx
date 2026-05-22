import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Save, RotateCcw, ToggleLeft, ToggleRight, Tag, Search } from 'lucide-react'
import { loadStatusKeywordRules, saveStatusKeywordRules, DEFAULT_STATUS_KEYWORD_RULES, STATUS_KEYS } from '@/config/statusKeywords'
import type { StatusKeywordRule, StatusKeyDef } from '@/config/statusKeywords'

const STATUS_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  online: { bg: 'bg-blue-50', text: 'text-blue-600' },
  customs_in: { bg: 'bg-orange-50', text: 'text-orange-600' },
  customs_out: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  delivery: { bg: 'bg-purple-50', text: 'text-purple-600' },
  delivered: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  returning: { bg: 'bg-red-50', text: 'text-red-600' },
}

export default function StatusKeywordSettings() {
  const [rules, setRules] = useState<StatusKeywordRule[]>([])
  const [saved, setSaved] = useState(false)
  const [keywordInputs, setKeywordInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    setRules(loadStatusKeywordRules())
  }, [])

  const statusOptions = useMemo(() => {
    return STATUS_KEYS.map((sk: StatusKeyDef) => ({ value: sk.key, label: sk.label }))
  }, [])

  const handleSave = () => {
    saveStatusKeywordRules(rules)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setRules([...DEFAULT_STATUS_KEYWORD_RULES])
    saveStatusKeywordRules([...DEFAULT_STATUS_KEYWORD_RULES])
  }

  const addRule = () => {
    const newRule: StatusKeywordRule = {
      id: `skr_${Date.now()}`,
      name: '新规则',
      statusKey: 'online',
      keywords: [],
      enabled: true,
    }
    setRules([...rules, newRule])
  }

  const removeRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id))
  }

  const updateRule = (id: string, updates: Partial<StatusKeywordRule>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  const toggleEnabled = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }

  const addKeyword = (ruleId: string) => {
    const input = (keywordInputs[ruleId] || '').trim()
    if (!input) return
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule) return
    if (rule.keywords.includes(input)) {
      setKeywordInputs((prev) => ({ ...prev, [ruleId]: '' }))
      return
    }
    updateRule(ruleId, { keywords: [...rule.keywords, input] })
    setKeywordInputs((prev) => ({ ...prev, [ruleId]: '' }))
  }

  const removeKeyword = (ruleId: string, keyword: string) => {
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule) return
    updateRule(ruleId, { keywords: rule.keywords.filter((k) => k !== keyword) })
  }

  const handleKeywordKeyDown = (ruleId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword(ruleId)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">状态关键字配置</h1>
          <p className="text-sm text-slate-400 mt-1">
            自定义物流轨迹关键字的含义，系统将根据关键字识别订单状态
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

      <div className="bg-white rounded-2xl border border-slate-200/80 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-700">状态关键字说明</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {STATUS_KEYS.map((sk: StatusKeyDef) => {
            const color = STATUS_COLOR_MAP[sk.key] || { bg: 'bg-slate-50', text: 'text-slate-600' }
            return (
              <div key={sk.key} className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${color.bg} ${color.text}`}>
                  {sk.label}
                </span>
                <span className="text-xs text-slate-400">{sk.description}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
          <span className="text-[11px] text-slate-400 font-medium flex-1 min-w-[120px]">规则名称</span>
          <span className="text-[11px] text-slate-400 font-medium w-[130px]">状态类型</span>
          <span className="text-[11px] text-slate-400 font-medium flex-1 min-w-[200px]">关键字</span>
          <span className="text-[11px] text-slate-400 font-medium w-16 text-center">状态</span>
          <span className="text-[11px] text-slate-400 font-medium w-10 text-center">操作</span>
        </div>

        {rules.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">暂无规则，点击下方按钮添加</p>
          </div>
        ) : (
          <div>
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`px-5 py-3 flex items-center gap-4 border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-50/50 ${
                  !rule.enabled ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1 min-w-[120px]">
                  <input
                    type="text"
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                    value={rule.name}
                    onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                  />
                </div>

                <div className="w-[130px]">
                  <select
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                    value={rule.statusKey}
                    onChange={(e) => updateRule(rule.id, { statusKey: e.target.value })}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rule.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 rounded-lg px-2 py-0.5 text-xs"
                      >
                        {kw}
                        <button
                          className="text-blue-400 hover:text-blue-600 transition-colors"
                          onClick={() => removeKeyword(rule.id, kw)}
                        >
                          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3l6 6M9 3l-6 6" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-100 outline-none"
                        placeholder="添加关键字"
                        value={keywordInputs[rule.id] || ''}
                        onChange={(e) => setKeywordInputs((prev) => ({ ...prev, [rule.id]: e.target.value }))}
                        onKeyDown={(e) => handleKeywordKeyDown(rule.id, e)}
                      />
                      <button
                        className="p-1 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        onClick={() => addKeyword(rule.id)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
    </div>
  )
}
