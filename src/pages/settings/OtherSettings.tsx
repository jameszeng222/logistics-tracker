import { useState } from 'react'
import { Trash2, AlertTriangle, Info, Ship, Tag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLogisticsStore } from '@/store/logisticsStore'

export default function OtherSettings() {
  const store = useLogisticsStore()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleClearAll = () => {
    store.setOrders([])
    setShowConfirm(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">其他设置</h1>
        <p className="text-sm text-slate-400 mt-1">数据管理与系统信息</p>
      </div>

      <Link to="/settings/status-keywords" className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl flex items-center gap-3 hover:border-indigo-200 transition-colors">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Tag className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <p className="font-medium text-slate-700">状态关键字</p>
          <p className="text-xs text-slate-400">自定义物流轨迹关键字的状态含义</p>
        </div>
      </Link>

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
            当前共有 <span className="font-medium text-slate-700">{store.orders.length}</span> 条订单数据
          </p>

          {!showConfirm ? (
            <button
              className="btn-secondary flex items-center gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
              onClick={() => setShowConfirm(true)}
              disabled={store.orders.length === 0}
            >
              <Trash2 className="w-4 h-4" />
              清空所有数据
            </button>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700">确认清空？</p>
                <p className="text-xs text-red-500 mt-0.5">此操作不可撤销，所有订单数据将被永久删除</p>
              </div>
              <button
                className="btn-primary !bg-red-500 hover:!bg-red-600"
                onClick={handleClearAll}
              >
                确认清空
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
            </div>
          )}
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
              <span className="text-slate-600 font-mono">1.0.0</span>
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
              <span className="text-slate-400">状态管理</span>
              <span className="text-slate-600">Zustand</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
