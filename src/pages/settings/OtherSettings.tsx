import { useState, useEffect } from 'react'
import { Trash2, AlertTriangle, Info, Ship, CheckCircle2, AlertCircle, Loader2, Copy } from 'lucide-react'
import { getOrderCountFromD1, clearAllOrdersFromD1 } from '@/services/d1Api'

export default function OtherSettings() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [orderCount, setOrderCount] = useState(0)
  const [clearing, setClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{ success: boolean; message: string } | null>(null)
  const [deduping, setDeduping] = useState(false)
  const [dedupResult, setDedupResult] = useState<{ success: boolean; message: string } | null>(null)

  const refreshCount = () => {
    getOrderCountFromD1().then(setOrderCount)
  }

  useEffect(() => {
    refreshCount()
  }, [])

  const handleClearAll = async () => {
    setClearing(true)
    setClearResult(null)
    try {
      const result = await clearAllOrdersFromD1()
      setShowConfirm(false)
      if (result.remaining > 0) {
        setClearResult({ success: false, message: `清空不完整，已删除 ${result.deleted} 条，剩余 ${result.remaining} 条` })
      } else {
        setOrderCount(0)
        setClearResult({ success: true, message: `已成功清空 ${result.deleted} 条订单数据` })
      }
      refreshCount()
    } catch (err: any) {
      setClearResult({ success: false, message: err.message || '清空失败' })
      refreshCount()
    } finally {
      setClearing(false)
    }
  }

  const handleDedup = async () => {
    setDeduping(true)
    setDedupResult(null)
    try {
      const res = await fetch('/api/orders/dedup', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        const parts = []
        if (data.deletedOldFormat > 0) parts.push(`删除旧格式重复 ${data.deletedOldFormat} 条`)
        if (data.deletedDuplicates > 0) parts.push(`合并同号重复 ${data.deletedDuplicates} 条`)
        if (parts.length === 0) parts.push('未发现重复数据')
        setDedupResult({ success: true, message: `${parts.join('，')}，当前共 ${data.totalInDb} 条` })
      } else {
        setDedupResult({ success: false, message: data.error || '去重失败' })
      }
      refreshCount()
    } catch (err: any) {
      setDedupResult({ success: false, message: err.message || '去重失败' })
    } finally {
      setDeduping(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">其他设置</h1>
        <p className="text-sm text-slate-400 mt-1">数据管理与系统信息</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">清空数据</h3>
            <p className="text-xs text-slate-400">删除系统中所有订单数据</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-1.5 p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600">
              此操作将清空所有订单数据，且不可恢复。请确认后再操作。
            </p>
          </div>

          <p className="text-xs text-slate-500">
            当前共有 <span className="font-medium text-slate-700">{orderCount}</span> 条订单数据
          </p>

          {clearResult && (
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${clearResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              {clearResult.success
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <AlertCircle className="w-4 h-4 text-red-500" />}
              <span className={`text-xs ${clearResult.success ? 'text-emerald-600' : 'text-red-500'}`}>{clearResult.message}</span>
            </div>
          )}

          {!showConfirm ? (
            <button
              className="btn-secondary flex items-center gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
              onClick={() => setShowConfirm(true)}
              disabled={orderCount === 0 || clearing}
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {clearing ? '清空中...' : '清空所有数据'}
            </button>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700">确认清空？</p>
                <p className="text-xs text-red-500 mt-0.5">此操作不可撤销，所有订单数据将被永久删除</p>
              </div>
              <button
                className="btn-primary !bg-red-500 hover:!bg-red-600 flex items-center gap-1.5"
                onClick={handleClearAll}
                disabled={clearing}
              >
                {clearing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                确认清空
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowConfirm(false)}
                disabled={clearing}
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Copy className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">数据去重</h3>
            <p className="text-xs text-slate-400">清理旧格式重复数据，合并同一快递单号的多条记录</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            当前共有 <span className="font-medium text-slate-700">{orderCount}</span> 条订单数据
          </p>

          {dedupResult && (
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${dedupResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              {dedupResult.success
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <AlertCircle className="w-4 h-4 text-red-500" />}
              <span className={`text-xs ${dedupResult.success ? 'text-emerald-600' : 'text-red-500'}`}>{dedupResult.message}</span>
            </div>
          )}

          <button
            className="btn-secondary flex items-center gap-2 text-blue-500 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
            onClick={handleDedup}
            disabled={deduping}
          >
            {deduping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            {deduping ? '去重中...' : '执行去重'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
            <Info className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">关于</h3>
            <p className="text-xs text-slate-400">系统信息</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Ship className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">跨境物流追踪系统</p>
              <p className="text-xs text-slate-400">Logistics Tracker</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">版本</span>
              <span className="text-slate-600 font-mono">2.0.0</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">技术栈</span>
              <span className="text-slate-600">React 18 + TypeScript + TailwindCSS</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">数据源</span>
              <span className="text-slate-600">17track API v2.4</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">架构</span>
              <span className="text-slate-600">D1 SQL 服务端聚合</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
