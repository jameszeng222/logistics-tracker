import { useState, useEffect, useMemo } from 'react'
import { Truck, Plus, Trash2, Search, Edit2, Save, X, ChevronDown, ChevronRight, Link2 } from 'lucide-react'
import {
  loadProviders,
  saveProviders,
  loadChannels,
  saveChannels,
  loadCarriers,
  saveCarriers,
  loadCarrierMappings,
  saveCarrierMappings,
  getChannelsForProvider,
  getCarriersForChannel,
} from '@/config/carrierConfig'
import type { LogisticsProvider, ChannelName, FinalCarrier, CarrierMapping } from '@/config/carrierConfig'
import { getCarrierData } from '@/data/carrierLoader'

export default function CarrierSettings() {
  const [providers, setProviders] = useState<LogisticsProvider[]>([])
  const [channels, setChannels] = useState<ChannelName[]>([])
  const [carriers, setCarriers] = useState<FinalCarrier[]>([])
  const [mappings, setMappings] = useState<CarrierMapping[]>([])
  const [officialData, setOfficialData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())

  const [newProviderName, setNewProviderName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const [newChannelNames, setNewChannelNames] = useState<Record<string, string>>({})
  const [newCarrierNames, setNewCarrierNames] = useState<Record<string, string>>({})

  const [mappingSearch, setMappingSearch] = useState('')
  const [showAddMapping, setShowAddMapping] = useState(false)
  const [addMappingSearch, setAddMappingSearch] = useState('')
  const [mappingEdits, setMappingEdits] = useState<Record<number, { level: 1 | 2 | 3; providerId: string; channelId: string; carrierId: string }>>({})

  useEffect(() => {
    setProviders(loadProviders())
    setChannels(loadChannels())
    setCarriers(loadCarriers())
    setMappings(loadCarrierMappings())
    getCarrierData().then((data) => {
      setOfficialData(data)
      setLoading(false)
    })
  }, [])

  const officialEntries = useMemo(() => {
    return Object.entries(officialData) as [string, string][]
  }, [officialData])

  const addMappingResults = useMemo(() => {
    if (!addMappingSearch.trim()) return []
    const q = addMappingSearch.toLowerCase().trim()
    const alreadyMapped = new Set(mappings.map((m) => m.track17Code))
    return officialEntries
      .filter(([code, name]) =>
        !alreadyMapped.has(Number(code)) &&
        (code.includes(q) || name.toLowerCase().includes(q))
      )
      .slice(0, 20)
  }, [addMappingSearch, officialEntries, mappings])

  const toggleProvider = (id: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleChannel = (id: string) => {
    setExpandedChannels((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addProvider = () => {
    if (!newProviderName.trim()) return
    const item: LogisticsProvider = { id: `lp_${Date.now()}`, name: newProviderName.trim() }
    const updated = [...providers, item]
    setProviders(updated)
    saveProviders(updated)
    setNewProviderName('')
  }

  const removeProvider = (id: string) => {
    const updatedProviders = providers.filter((p) => p.id !== id)
    setProviders(updatedProviders)
    saveProviders(updatedProviders)
    const channelIds = new Set(channels.filter((c) => c.providerId === id).map((c) => c.id))
    const updatedChannels = channels.filter((c) => c.providerId !== id)
    setChannels(updatedChannels)
    saveChannels(updatedChannels)
    const updatedCarriers = carriers.filter((c) => !channelIds.has(c.channelId))
    setCarriers(updatedCarriers)
    saveCarriers(updatedCarriers)
    const updatedMappings = mappings.filter((m) => m.providerId !== id)
    setMappings(updatedMappings)
    saveCarrierMappings(updatedMappings)
    setExpandedProviders((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  const addChannel = (providerId: string) => {
    const name = newChannelNames[providerId]?.trim()
    if (!name) return
    const item: ChannelName = { id: `ch_${Date.now()}`, name, providerId }
    const updated = [...channels, item]
    setChannels(updated)
    saveChannels(updated)
    setNewChannelNames((prev) => { const n = { ...prev }; delete n[providerId]; return n })
  }

  const removeChannel = (id: string) => {
    const updatedChannels = channels.filter((c) => c.id !== id)
    setChannels(updatedChannels)
    saveChannels(updatedChannels)
    const updatedCarriers = carriers.filter((c) => c.channelId !== id)
    setCarriers(updatedCarriers)
    saveCarriers(updatedCarriers)
    const updatedMappings = mappings.filter((m) => m.channelId !== id)
    setMappings(updatedMappings)
    saveCarrierMappings(updatedMappings)
    setExpandedChannels((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  const addCarrier = (channelId: string) => {
    const name = newCarrierNames[channelId]?.trim()
    if (!name) return
    const item: FinalCarrier = { id: `fc_${Date.now()}`, name, channelId }
    const updated = [...carriers, item]
    setCarriers(updated)
    saveCarriers(updated)
    setNewCarrierNames((prev) => { const n = { ...prev }; delete n[channelId]; return n })
  }

  const removeCarrier = (id: string) => {
    const updated = carriers.filter((c) => c.id !== id)
    setCarriers(updated)
    saveCarriers(updated)
    const updatedMappings = mappings.filter((m) => m.carrierId !== id)
    setMappings(updatedMappings)
    saveCarrierMappings(updatedMappings)
  }

  const startEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const saveEdit = (type: 'provider' | 'channel' | 'carrier', id: string) => {
    if (!editingName.trim()) return
    if (type === 'provider') {
      const updated = providers.map((p) => p.id === id ? { ...p, name: editingName.trim() } : p)
      setProviders(updated)
      saveProviders(updated)
    } else if (type === 'channel') {
      const updated = channels.map((c) => c.id === id ? { ...c, name: editingName.trim() } : c)
      setChannels(updated)
      saveChannels(updated)
    } else {
      const updated = carriers.map((c) => c.id === id ? { ...c, name: editingName.trim() } : c)
      setCarriers(updated)
      saveCarriers(updated)
    }
    setEditingId(null)
    setEditingName('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const getEditState = (code: number) => mappingEdits[code] || null

  const startEditMapping = (mapping: CarrierMapping) => {
    setMappingEdits((prev) => ({
      ...prev,
      [mapping.track17Code]: {
        level: mapping.level,
        providerId: mapping.providerId,
        channelId: mapping.channelId,
        carrierId: mapping.carrierId,
      },
    }))
  }

  const updateEditLevel = (code: number, level: 1 | 2 | 3) => {
    setMappingEdits((prev) => {
      const current = prev[code] || { level, providerId: '', channelId: '', carrierId: '' }
      return { ...prev, [code]: { ...current, level, channelId: '', carrierId: '' } }
    })
  }

  const updateEditProvider = (code: number, providerId: string) => {
    setMappingEdits((prev) => {
      const current = prev[code] || { level: 1 as const, providerId: '', channelId: '', carrierId: '' }
      return { ...prev, [code]: { ...current, providerId, channelId: '', carrierId: '' } }
    })
  }

  const updateEditChannel = (code: number, channelId: string) => {
    setMappingEdits((prev) => {
      const current = prev[code] || { level: 1 as const, providerId: '', channelId: '', carrierId: '' }
      return { ...prev, [code]: { ...current, channelId, carrierId: '' } }
    })
  }

  const updateEditCarrier = (code: number, carrierId: string) => {
    setMappingEdits((prev) => {
      const current = prev[code] || { level: 1 as const, providerId: '', channelId: '', carrierId: '' }
      return { ...prev, [code]: { ...current, carrierId } }
    })
  }

  const saveMapping = (code: number) => {
    const edit = getEditState(code)
    if (!edit || !edit.providerId) return
    const existing = mappings.find((m) => m.track17Code === code)
    const newMapping: CarrierMapping = {
      track17Code: code,
      track17Name: existing?.track17Name || '',
      level: edit.level,
      providerId: edit.providerId,
      channelId: edit.level >= 2 ? edit.channelId : '',
      carrierId: edit.level === 3 ? edit.carrierId : '',
    }
    let updated: CarrierMapping[]
    if (existing) {
      updated = mappings.map((m) => m.track17Code === code ? newMapping : m)
    } else {
      updated = [...mappings, newMapping]
    }
    setMappings(updated)
    saveCarrierMappings(updated)
    setMappingEdits((prev) => { const n = { ...prev }; delete n[code]; return n })
  }

  const removeMapping = (code: number) => {
    const updated = mappings.filter((m) => m.track17Code !== code)
    setMappings(updated)
    saveCarrierMappings(updated)
    setMappingEdits((prev) => { const n = { ...prev }; delete n[code]; return n })
  }

  const cancelEditMapping = (code: number) => {
    setMappingEdits((prev) => { const n = { ...prev }; delete n[code]; return n })
  }

  const addNewMappingEntry = (code: string, name: string) => {
    const numCode = Number(code)
    setMappingEdits((prev) => ({
      ...prev,
      [numCode]: { level: 1, providerId: '', channelId: '', carrierId: '' },
    }))
    const existing = mappings.find((m) => m.track17Code === numCode)
    if (!existing) {
      const newMapping: CarrierMapping = {
        track17Code: numCode,
        track17Name: name,
        level: 1,
        providerId: '',
        channelId: '',
        carrierId: '',
      }
      const updated = [...mappings, newMapping]
      setMappings(updated)
      saveCarrierMappings(updated)
    }
    setShowAddMapping(false)
    setAddMappingSearch('')
  }

  const filteredMappings = useMemo(() => {
    if (!mappingSearch.trim()) return mappings
    const q = mappingSearch.toLowerCase().trim()
    return mappings.filter(
      (m) =>
        String(m.track17Code).includes(q) ||
        m.track17Name.toLowerCase().includes(q) ||
        providers.find((p) => p.id === m.providerId)?.name.toLowerCase().includes(q) ||
        channels.find((ch) => ch.id === m.channelId)?.name.toLowerCase().includes(q) ||
        carriers.find((c) => c.id === m.carrierId)?.name.toLowerCase().includes(q)
    )
  }, [mappings, mappingSearch, providers, channels, carriers])

  const EditableName = ({ id, name, type, depth }: { id: string; name: string; type: 'provider' | 'channel' | 'carrier'; depth: number }) => {
    if (editingId === id) {
      return (
        <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
          <input
            className="input-field flex-1 text-sm"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(type, id)
              if (e.key === 'Escape') cancelEdit()
            }}
            autoFocus
          />
          <button className="text-green-500 hover:text-green-600 p-1" onClick={() => saveEdit(type, id)}>
            <Save className="w-3.5 h-3.5" />
          </button>
          <button className="text-slate-400 hover:text-slate-600 p-1" onClick={cancelEdit}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
    return (
      <span className={`text-sm font-medium flex-1 ${depth === 0 ? 'text-slate-700' : depth === 1 ? 'text-slate-600' : 'text-slate-500'}`}>
        {name}
      </span>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">运输商管理</h1>
        <p className="text-sm text-slate-400 mt-1">物流供应商 → 渠道名称 → 最终承运商 三级管理，17track运输商可映射到任意级别</p>
      </div>

      <div className="bg-white rounded-2xl border border-blue-100/60 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Truck className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">物流供应商与渠道管理</h3>
            <p className="text-xs text-slate-400">配置三级物流体系：供应商、渠道、承运商</p>
          </div>
        </div>

        <div className="space-y-1 mb-4">
          {providers.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">暂无供应商，请添加</p>
          )}
          {providers.map((provider) => {
            const isProviderExpanded = expandedProviders.has(provider.id)
            const providerChannels = getChannelsForProvider(provider.id, channels)
            return (
              <div key={provider.id} className="rounded-xl border border-blue-50 overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-blue-50/40 cursor-pointer hover:bg-blue-50/70 transition-colors"
                  onClick={() => toggleProvider(provider.id)}
                >
                  {isProviderExpanded ? (
                    <ChevronDown className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  )}
                  <EditableName id={provider.id} name={provider.name} type="provider" depth={0} />
                  {editingId !== provider.id && (
                    <>
                      <span className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                        {providerChannels.length} 个渠道
                      </span>
                      <button
                        className="text-slate-400 hover:text-blue-500 p-1 transition-colors"
                        onClick={(e) => { e.stopPropagation(); startEdit(provider.id, provider.name) }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                        onClick={(e) => { e.stopPropagation(); removeProvider(provider.id) }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

                {isProviderExpanded && (
                  <div className="pl-6 py-2 space-y-1 bg-white">
                    {providerChannels.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">暂无渠道</p>
                    )}
                    {providerChannels.map((channel) => {
                      const isChannelExpanded = expandedChannels.has(channel.id)
                      const channelCarriers = getCarriersForChannel(channel.id, carriers)
                      return (
                        <div key={channel.id} className="rounded-lg border border-blue-50/80 overflow-hidden">
                          <div
                            className="flex items-center gap-2 px-3 py-2 bg-slate-50/80 cursor-pointer hover:bg-slate-100/80 transition-colors"
                            onClick={() => toggleChannel(channel.id)}
                          >
                            {channelCarriers.length > 0 ? (
                              isChannelExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              )
                            ) : (
                              <span className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 text-[8px]">●</span>
                            )}
                            <EditableName id={channel.id} name={channel.name} type="channel" depth={1} />
                            {editingId !== channel.id && (
                              <>
                                {channelCarriers.length > 0 && (
                                  <span className="text-[10px] text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                    {channelCarriers.length} 个承运商
                                  </span>
                                )}
                                <button
                                  className="text-slate-300 hover:text-blue-500 p-1 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); startEdit(channel.id, channel.name) }}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  className="text-slate-300 hover:text-red-400 p-1 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); removeChannel(channel.id) }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>

                          {isChannelExpanded && channelCarriers.length > 0 && (
                            <div className="pl-8 py-2 space-y-1 bg-white">
                              {channelCarriers.map((carrier) => (
                                <div key={carrier.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-blue-50/40 group">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                                  <EditableName id={carrier.id} name={carrier.name} type="carrier" depth={2} />
                                  {editingId !== carrier.id && (
                                    <>
                                      <button
                                        className="text-slate-300 hover:text-blue-500 p-1 transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={() => startEdit(carrier.id, carrier.name)}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        className="text-slate-300 hover:text-red-400 p-1 transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={() => removeCarrier(carrier.id)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              ))}
                              <div className="flex gap-2 pt-1">
                                <input
                                  className="input-field flex-1 text-xs"
                                  placeholder="输入承运商名称"
                                  value={newCarrierNames[channel.id] || ''}
                                  onChange={(e) => setNewCarrierNames((prev) => ({ ...prev, [channel.id]: e.target.value }))}
                                  onKeyDown={(e) => e.key === 'Enter' && addCarrier(channel.id)}
                                />
                                <button
                                  className="btn-primary flex items-center gap-1 text-xs py-1"
                                  onClick={() => addCarrier(channel.id)}
                                  disabled={!newCarrierNames[channel.id]?.trim()}
                                >
                                  <Plus className="w-3 h-3" />添加
                                </button>
                              </div>
                            </div>
                          )}

                          {isChannelExpanded && channelCarriers.length === 0 && (
                            <div className="pl-8 py-2 bg-white">
                              <div className="flex gap-2">
                                <input
                                  className="input-field flex-1 text-xs"
                                  placeholder="输入承运商名称"
                                  value={newCarrierNames[channel.id] || ''}
                                  onChange={(e) => setNewCarrierNames((prev) => ({ ...prev, [channel.id]: e.target.value }))}
                                  onKeyDown={(e) => e.key === 'Enter' && addCarrier(channel.id)}
                                />
                                <button
                                  className="btn-primary flex items-center gap-1 text-xs py-1"
                                  onClick={() => addCarrier(channel.id)}
                                  disabled={!newCarrierNames[channel.id]?.trim()}
                                >
                                  <Plus className="w-3 h-3" />添加
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div className="flex gap-2 pt-2">
                      <input
                        className="input-field flex-1 text-xs"
                        placeholder="输入渠道名称"
                        value={newChannelNames[provider.id] || ''}
                        onChange={(e) => setNewChannelNames((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && addChannel(provider.id)}
                      />
                      <button
                        className="btn-primary flex items-center gap-1 text-xs py-1"
                        onClick={() => addChannel(provider.id)}
                        disabled={!newChannelNames[provider.id]?.trim()}
                      >
                        <Plus className="w-3 h-3" />添加渠道
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-3 pt-2 border-t border-blue-50">
          <input
            className="input-field flex-1 text-sm"
            placeholder="输入供应商名称"
            value={newProviderName}
            onChange={(e) => setNewProviderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addProvider()}
          />
          <button
            className="btn-primary flex items-center gap-1.5 text-sm"
            onClick={addProvider}
            disabled={!newProviderName.trim()}
          >
            <Plus className="w-4 h-4" />添加供应商
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-blue-100/60 p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">17track 运输商映射</h3>
              <p className="text-xs text-slate-400">将17track运输商映射到你的三级物流体系</p>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            已映射 <span className="font-medium text-blue-600">{mappings.filter((m) => m.providerId).length}</span> 个
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input-field w-full pl-9 text-sm"
                placeholder="搜索已映射的运输商..."
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
              />
            </div>
            <button
              className="btn-primary flex items-center gap-1.5 text-sm"
              onClick={() => setShowAddMapping(true)}
            >
              <Plus className="w-4 h-4" />添加映射
            </button>
          </div>

          {showAddMapping && (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-600">搜索17track运输商</span>
                <button
                  className="text-slate-400 hover:text-slate-600 p-1"
                  onClick={() => { setShowAddMapping(false); setAddMappingSearch('') }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="input-field w-full pl-9 text-sm"
                  placeholder="输入运输商代码或名称..."
                  value={addMappingSearch}
                  onChange={(e) => setAddMappingSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {addMappingSearch.trim() && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {addMappingResults.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-3">未找到匹配的运输商</p>
                  )}
                  {addMappingResults.map(([code, name]) => (
                    <button
                      key={code}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white transition-colors flex items-center gap-3"
                      onClick={() => addNewMappingEntry(code, name)}
                    >
                      <span className="font-mono text-xs text-slate-400 w-12">{code}</span>
                      <span className="text-slate-600">{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <span className="text-xs">加载运输商数据...</span>
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-slate-400">
                {mappings.length === 0
                  ? '暂无映射，点击"添加映射"开始关联17track运输商'
                  : '没有匹配的映射'}
              </p>
            </div>
          ) : (
            <div className="border border-blue-50 rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-blue-50/50">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-16">17track代码</th>
                    <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-36">17track名称</th>
                    <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-20">映射级别</th>
                    <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-28">物流供应商</th>
                    <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-28">渠道名称</th>
                    <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-28">最终承运商</th>
                    <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-16">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {filteredMappings.map((mapping) => {
                    const editState = getEditState(mapping.track17Code)
                    const isEditing = !!editState
                    const currentLevel = isEditing ? editState.level : mapping.level
                    const currentProviderId = isEditing ? editState.providerId : mapping.providerId
                    const currentChannelId = isEditing ? editState.channelId : mapping.channelId
                    const currentCarrierId = isEditing ? editState.carrierId : mapping.carrierId
                    const availableChannels = currentProviderId ? getChannelsForProvider(currentProviderId, channels) : []
                    const availableCarriers = currentChannelId ? getCarriersForChannel(currentChannelId, carriers) : []

                    return (
                      <tr key={mapping.track17Code} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-3 py-2 font-mono text-slate-500">{mapping.track17Code}</td>
                        <td className="px-3 py-2 text-slate-700">{mapping.track17Name}</td>
                        <td className="px-3 py-2">
                          <select
                            className={`w-full text-xs px-2 py-1 rounded-lg border ${isEditing ? 'border-blue-300 bg-white' : 'border-slate-200 bg-slate-50'}`}
                            value={currentLevel}
                            onChange={(e) => {
                              if (!isEditing) startEditMapping(mapping)
                              updateEditLevel(mapping.track17Code, Number(e.target.value) as 1 | 2 | 3)
                            }}
                          >
                            <option value={1}>1级-供应商</option>
                            <option value={2}>2级-渠道</option>
                            <option value={3}>3级-承运商</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className={`w-full text-xs px-2 py-1 rounded-lg border ${isEditing ? 'border-blue-300 bg-white' : 'border-slate-200 bg-slate-50'}`}
                            value={currentProviderId}
                            onChange={(e) => {
                              if (!isEditing) startEditMapping(mapping)
                              updateEditProvider(mapping.track17Code, e.target.value)
                            }}
                          >
                            <option value="">选择供应商</option>
                            {providers.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className={`w-full text-xs px-2 py-1 rounded-lg border ${isEditing ? 'border-blue-300 bg-white' : 'border-slate-200 bg-slate-50'} ${currentLevel < 2 ? 'opacity-40' : ''}`}
                            value={currentChannelId}
                            onChange={(e) => {
                              if (!isEditing) startEditMapping(mapping)
                              updateEditChannel(mapping.track17Code, e.target.value)
                            }}
                            disabled={currentLevel < 2 || !currentProviderId}
                          >
                            <option value="">{currentLevel < 2 ? '无需选择' : '选择渠道'}</option>
                            {availableChannels.map((ch) => (
                              <option key={ch.id} value={ch.id}>{ch.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className={`w-full text-xs px-2 py-1 rounded-lg border ${isEditing ? 'border-blue-300 bg-white' : 'border-slate-200 bg-slate-50'} ${currentLevel < 3 ? 'opacity-40' : ''}`}
                            value={currentCarrierId}
                            onChange={(e) => {
                              if (!isEditing) startEditMapping(mapping)
                              updateEditCarrier(mapping.track17Code, e.target.value)
                            }}
                            disabled={currentLevel < 3 || !currentChannelId}
                          >
                            <option value="">{currentLevel < 3 ? '无需选择' : '选择承运商'}</option>
                            {availableCarriers.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  className="text-green-500 hover:text-green-600 p-1 transition-colors"
                                  onClick={() => saveMapping(mapping.track17Code)}
                                  disabled={!editState?.providerId}
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                                  onClick={() => cancelEditMapping(mapping.track17Code)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                className="text-slate-300 hover:text-red-400 p-1 transition-colors"
                                onClick={() => removeMapping(mapping.track17Code)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
