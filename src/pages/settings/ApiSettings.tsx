import { useState } from 'react'
import { Key, CheckCircle2, AlertCircle, ExternalLink, Zap, ShieldCheck, Loader2 } from 'lucide-react'
import { useLogisticsStore } from '@/store/logisticsStore'

export default function ApiSettings() {
  const store = useLogisticsStore()
  const track17Config = store.track17Config

  const [key, setKey] = useState(track17Config.apiKey)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSave = () => {
    store.setTrack17ApiKey(key)
    setTestResult(null)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await store.testConnection()
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">API 管理</h1>
        <p className="text-sm text-slate-400 mt-1">配置17track API密钥，连接物流数据源</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Zap className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">17track API 密钥</h3>
            <p className="text-xs text-slate-400">输入API密钥以连接17track数据源</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">API 密钥</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showKey ? 'text' : 'password'}
                  className="input-field w-full pl-9 pr-10"
                  placeholder="输入17track API密钥"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-blue-500"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
              <button className="btn-primary" onClick={handleSave}>保存</button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              访问 <a href="https://api.17track.net/admin/settings" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-0.5">api.17track.net <ExternalLink className="w-3 h-3" /></a> 获取密钥
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleTest}
              disabled={!track17Config.apiKey || testing}
            >
              {testing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              {testing ? '测试中...' : '测试连接'}
            </button>

            {testing ? null : testResult ? (
              <div className={`flex items-center gap-1.5 ${testResult.success ? 'text-emerald-600' : 'text-red-500'}`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="text-xs font-medium">{testResult.message}</span>
              </div>
            ) : track17Config.connected ? (
              <div className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">已连接</span>
                {track17Config.lastSync && (
                  <span className="text-xs text-slate-400 ml-2">上次拉取：{track17Config.lastSync}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">未连接</span>
                {!track17Config.apiKey && (
                  <span className="text-xs text-slate-400 ml-1">请先配置API密钥</span>
                )}
                {track17Config.apiKey && (
                  <span className="text-xs text-slate-400 ml-1">请点击测试连接</span>
                )}
              </div>
            )}
          </div>

          {track17Config.syncError && !testResult && (
            <div className="flex items-center gap-1.5 text-red-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">{track17Config.syncError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl bg-amber-50/50 !border-amber-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-amber-700">安全提示</h4>
            <p className="text-xs text-amber-600 mt-1">
              API密钥存储在浏览器本地（localStorage），仅当前设备可访问。生产环境建议通过后端代理调用17track API，避免密钥暴露在前端代码中。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
