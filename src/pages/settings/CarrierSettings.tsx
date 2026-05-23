import { useState, useEffect, useMemo } from 'react'
import { Truck, Plus, Trash2, Search, Edit2, Save, X, Link2, ArrowRight, RefreshCw } from 'lucide-react'
import { loadCarrierMappings, saveCarrierMappings, DEFAULT_MAPPINGS, type CarrierMapping } from '@/config/carrierConfig'

export default function CarrierSettings() {
  const [mappings, setMappings] = useState<CarrierMapping[]>([])
  const [search, setSearch] = useState('')
  const [editingErp, setEditingErp] = useState<string | null>(null)
  const [editTrack17, setEditTrack17] = useState('')
  const [newErpName, setNewErpName] = useState('')
  const [newTrack17Names, setNewTrack17Names] = useState('')
  const [addingNew, setAddingNew] = useState(false)

  useEffect(() => {
    setMappings(loadCarrierMappings())
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return mappings
    const q = search.toLowerCase().trim()
    return mappings.filter(m =>
      m.erpName.toLowerCase().includes(q) ||
      m.track17Names.some(t => t.toLowerCase().includes(q))
    )
  }, [mappings, search])

  const addMapping = () => {
    if (!newErpName.trim()) return
    const track17List = newTrack17Names.split(',').map(s => s.trim()).filter(Boolean)
    const existing = mappings.find(m => m.erpName === newErpName.trim())
    let updated: CarrierMapping[]
    if (existing) {
      updated = mappings.map(m =>
        m.erpName === newErpName.trim()
          ? { ...m, track17Names: [...new Set([...m.track17Names, ...track17List])] }
          : m
      )
    } else {
      updated = [...mappings, { erpName: newErpName.trim(), track17Names: track17List }]
    }
    setMappings(updated)
    saveCarrierMappings(updated)
    setNewErpName('')
    setNewTrack17Names('')
    setAddingNew(false)
  }

  const removeMapping = (erpName: string) => {
    const updated = mappings.filter(m => m.erpName !== erpName)
    setMappings(updated)
    saveCarrierMappings(updated)
  }

  const removeTrack17Name = (erpName: string, track17Name: string) => {
    const updated = mappings.map(m =>
      m.erpName === erpName
        ? { ...m, track17Names: m.track17Names.filter(t => t !== track17Name) }
        : m
    )
    setMappings(updated)
    saveCarrierMappings(updated)
  }

  const addTrack17ToMapping = (erpName: string) => {
    if (!editTrack17.trim() || editingErp !== erpName) return
    const updated = mappings.map(m =>
      m.erpName === erpName
        ? { ...m, track17Names: [...new Set([...m.track17Names, editTrack17.trim()])] }
        : m
    )
    setMappings(updated)
    saveCarrierMappings(updated)
    setEditTrack17('')
    setEditingErp(null)
  }

  const resetToDefault = () => {
    setMappings([...DEFAULT_MAPPINGS])
    saveCarrierMappings([...DEFAULT_MAPPINGS])
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">运输商管理</h1>
        <p className="text-sm text-slate-400 mt-1">配置 C端物流商 与 17track承运商 的映射关系，系统会自动将17track承运商名转换为C端物流商名</p>
      </div>

      <div className="bg-white rounded-2xl border border-blue-100/60 p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">物流商映射配置</h3>
              <p className="text-xs text-slate-400">左侧为C端物流商名，右侧为17track承运商名（可多个）</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              共 <span className="font-medium text-blue-600">{mappings.length}</span> 条映射
            </span>
            <button
              className="text-xs text-slate-400 hover:text-blue-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              onClick={resetToDefault}
            >
              <RefreshCw className="w-3 h-3" />恢复默认
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input-field w-full pl-9 text-sm"
                placeholder="搜索物流商或承运商..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className="btn-primary flex items-center gap-1.5 text-sm"
              onClick={() => setAddingNew(true)}
            >
              <Plus className="w-4 h-4" />添加映射
            </button>
          </div>

          {addingNew && (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">添加新映射</span>
                <button className="text-slate-400 hover:text-slate-600 p-1" onClick={() => { setAddingNew(false); setNewErpName(''); setNewTrack17Names('') }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <input
                  className="input-field text-sm"
                  placeholder="C端物流商名称"
                  value={newErpName}
                  onChange={(e) => setNewErpName(e.target.value)}
                  autoFocus
                />
                <ArrowRight className="w-4 h-4 text-slate-300" />
                <input
                  className="input-field text-sm"
                  placeholder="17track承运商名（多个用逗号分隔）"
                  value={newTrack17Names}
                  onChange={(e) => setNewTrack17Names(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMapping()}
                />
              </div>
              <div className="flex justify-end">
                <button
                  className="btn-primary flex items-center gap-1.5 text-sm"
                  onClick={addMapping}
                  disabled={!newErpName.trim()}
                >
                  <Save className="w-3.5 h-3.5" />保存
                </button>
              </div>
            </div>
          )}

          <div className="border border-blue-50 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_40px_1fr_48px] gap-0 bg-blue-50/50 px-4 py-2.5">
              <span className="text-xs font-medium text-slate-500">C端物流商</span>
              <span />
              <span className="text-xs font-medium text-slate-500">17track承运商</span>
              <span />
            </div>
            <div className="divide-y divide-blue-50/80">
              {filtered.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-400">{mappings.length === 0 ? '暂无映射，点击"添加映射"开始' : '没有匹配的映射'}</p>
                </div>
              )}
              {filtered.map((mapping) => (
                <div key={mapping.erpName} className="grid grid-cols-[1fr_40px_1fr_48px] gap-0 px-4 py-3 hover:bg-blue-50/20 transition-colors items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-800">{mapping.erpName}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <div className="flex flex-wrap gap-1.5">
                    {mapping.track17Names.map((t17) => (
                      <span key={t17} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-600 group">
                        {t17}
                        <button
                          className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeTrack17Name(mapping.erpName, t17)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {editingErp === mapping.erpName ? (
                      <div className="flex items-center gap-1">
                        <input
                          className="input-field text-xs w-28 py-0.5"
                          placeholder="承运商名"
                          value={editTrack17}
                          onChange={(e) => setEditTrack17(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addTrack17ToMapping(mapping.erpName)
                            if (e.key === 'Escape') { setEditingErp(null); setEditTrack17('') }
                          }}
                          autoFocus
                        />
                        <button className="text-green-500 p-0.5" onClick={() => addTrack17ToMapping(mapping.erpName)}>
                          <Save className="w-3 h-3" />
                        </button>
                        <button className="text-slate-400 p-0.5" onClick={() => { setEditingErp(null); setEditTrack17('') }}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-dashed border-slate-200 text-xs text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-colors"
                        onClick={() => { setEditingErp(mapping.erpName); setEditTrack17('') }}
                      >
                        <Plus className="w-3 h-3" />添加
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-center">
                    <button
                      className="text-slate-300 hover:text-red-400 p-1 transition-colors"
                      onClick={() => removeMapping(mapping.erpName)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 space-y-1.5">
            <p className="font-medium text-slate-600">使用说明</p>
            <p>• 当17track查询返回承运商名时，系统会自动查找映射表，将英文名转换为C端物流商名</p>
            <p>• 一个C端物流商可以映射多个17track承运商名（如 DHL → DHL, DHL Express, DHL eCommerce）</p>
            <p>• 未映射的承运商名会保持原样显示</p>
            <p>• 映射配置保存在浏览器本地，更换浏览器需重新配置</p>
          </div>
        </div>
      </div>
    </div>
  )
}
