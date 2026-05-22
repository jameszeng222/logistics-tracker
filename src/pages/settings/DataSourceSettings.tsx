import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Download, Search, Info, Clock, ToggleLeft, ToggleRight, Webhook, Copy, FileDown, Link } from 'lucide-react'
import { useLogisticsStore } from '@/store/logisticsStore'
import { getTrackInfo } from '@/services/track17'
import { convertTrackListToOrders } from '@/utils/trackMapper'
import { pushErpOrders } from '@/services/erpApi'

export default function DataSourceSettings() {
  const store = useLogisticsStore()
  const track17Config = store.track17Config
  const { syncProgress } = track17Config

  const [trackInput, setTrackInput] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 })
  const [fetchResult, setFetchResult] = useState<{
    total: number
    found: number
    notFound: number
    withEvents: number
    details: string[]
    rawSample: string
  } | null>(null)

  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('erp_webhook_url') || '')
  const [webhookSecret, setWebhookSecret] = useState(localStorage.getItem('erp_webhook_secret') || '')
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const handleFetchByNumbers = async () => {
    const lines = trackInput
      .split(/[\n;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const items: Array<{ number: string; carrier?: number }> = []
    for (const line of lines) {
      const parts = line.split(/[,，\t]+/).map((s) => s.trim())
      const number = parts[0]
      if (number.length < 5) continue
      const item: { number: string; carrier?: number } = { number }
      if (parts[1] && /^\d+$/.test(parts[1])) {
        item.carrier = parseInt(parts[1], 10)
      }
      items.push(item)
    }

    if (items.length === 0) return

    setFetching(true)
    setFetchResult(null)
    setFetchProgress({ current: 0, total: items.length })
    let found = 0
    let notFound = 0
    let withEvents = 0
    const details: string[] = []
    let rawSample = ''
    const batchSize = 40

    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)

        try {
          const res = await getTrackInfo(track17Config.apiKey, batch)

          if (!rawSample && res.data.accepted?.[0]) {
            rawSample = JSON.stringify(res.data.accepted[0], null, 2)
          }

          if (res.data.accepted?.length) {
            const orders = convertTrackListToOrders(res.data.accepted)
            store.mergeOrders(orders)
            found += res.data.accepted.length

            const eventCount = res.data.accepted.filter((item: any) => {
              const providers = item?.track_info?.tracking?.providers || item?.tracking?.providers
              return Array.isArray(providers) && providers.some((p: any) => Array.isArray(p?.events) && p.events.length > 0)
            }).length
            withEvents += eventCount

            const statusSummary: Record<string, number> = {}
            res.data.accepted.forEach((item: any) => {
              const s = item?.track_info?.latest_status?.status || item?.latest_status?.status || 'Unknown'
              statusSummary[s] = (statusSummary[s] || 0) + 1
            })
            const statusStr = Object.entries(statusSummary)
              .map(([s, c]) => `${s}: ${c}`)
              .join(', ')
            details.push(`获取 ${res.data.accepted.length} 条（${eventCount} 条含详细轨迹）[${statusStr}]`)
          }

          if (res.data.rejected?.length) {
            notFound += res.data.rejected.length
            const msgs = res.data.rejected.slice(0, 3).map((r: any) => `${r.number}: ${r.error?.message || '未知'}`).join('; ')
            details.push(`${res.data.rejected.length} 个被拒: ${msgs}`)
          }
        } catch (err: any) {
          details.push(`查询失败: ${err.message}`)
        }

        setFetchProgress({ current: Math.min(i + batchSize, items.length), total: items.length })

        if (i + batchSize < items.length) {
          await new Promise((r) => setTimeout(r, 400))
        }
      }

      setFetchResult({ total: items.length, found, notFound, withEvents, details, rawSample })
      if (found > 0) {
        setTrackInput('')
      }
    } catch (err: any) {
      setFetchResult({ total: items.length, found: 0, notFound: items.length, withEvents: 0, details: [err.message], rawSample: '' })
    } finally {
      setFetching(false)
    }
  }

  const handleSync = async () => {
    await store.syncFrom17Track()
  }

  const handleSyncErp = async () => {
    setPushing(true)
    setPushResult(null)
    try {
      await store.syncErpOrders()
      setPushResult({ success: true, message: 'ERP数据同步成功' })
    } catch (err: any) {
      setPushResult({ success: false, message: err.message })
    }
    setPushing(false)
  }

  const handleSaveWebhookConfig = () => {
    localStorage.setItem('erp_webhook_url', webhookUrl)
    localStorage.setItem('erp_webhook_secret', webhookSecret)
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleDownloadCsvTemplate = () => {
    const BOM = '\uFEFF'
    const headers = '履约单号,追踪号,承运商代码,创建时间,出库时间,发货仓库,发货团队'
    const example1 = 'ORD-20260518-001,SPXATL079802219254,190844,2026-05-18 10:30:00,2026-05-19 14:00:00,深圳仓,华南发货组'
    const example2 = 'ORD-20260518-002,1Z999AA10123456784,,2026-05-18 11:00:00,2026-05-19 09:00:00,义乌仓,华东发货组'
    const csv = BOM + [headers, example1, example2].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ERP导入模板.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const syncProgressPercent = syncProgress.totalItems > 0
    ? Math.round((syncProgress.fetchedItems / syncProgress.totalItems) * 100)
    : 0

  const fetchProgressPercent = fetchProgress.total > 0
    ? Math.round((fetchProgress.current / fetchProgress.total) * 100)
    : 0

  const webhookEndpoint = webhookUrl
    ? `${webhookUrl.replace(/\/$/, '')}/api/erp/orders`
    : 'https://your-worker.workers.dev/api/erp/orders'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">数据源管理</h1>
        <p className="text-sm text-slate-400 mt-1">拉取物流追踪数据，对接ERP系统</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <Webhook className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">ERP 对接</h3>
            <p className="text-xs text-slate-400">通过 Webhook 接收 ERP 订单数据，或手动同步</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">Worker 部署地址</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="https://your-worker.workers.dev"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <button className="btn-primary" onClick={handleSaveWebhookConfig}>保存</button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">部署 Cloudflare Worker 后填入地址</p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">Webhook 密钥</label>
            <div className="flex gap-2">
              <input
                type="password"
                className="input-field flex-1"
                placeholder="ERP_WEBHOOK_SECRET"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <button className="btn-primary" onClick={handleSaveWebhookConfig}>保存</button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">通过 <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">wrangler secret put ERP_WEBHOOK_SECRET</code> 设置</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Link className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-600">Webhook 端点</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex-1 break-all">
                {webhookEndpoint}
              </code>
              <button
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                onClick={() => handleCopy(webhookEndpoint, 'endpoint')}
              >
                {copied === 'endpoint' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-[11px] text-slate-500">ERP 推送示例：</p>
              <pre className="text-[10px] font-mono text-slate-600 bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto">
{`POST ${webhookEndpoint}
Authorization: Bearer <your_secret>

{
  "orders": [{
    "orderNo": "ORD-001",
    "trackingNumber": "SPXATL079802219254",
    "carrierCode": 190844,
    "createdAt": "2026-05-18 10:30:00",
    "shippedAt": "2026-05-19 14:00:00",
    "warehouse": "深圳仓",
    "team": "华南发货组"
  }]
}`}
              </pre>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="btn-primary flex items-center gap-2 flex-1 justify-center"
              onClick={handleSyncErp}
              disabled={pushing}
            >
              {pushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {pushing ? '同步中...' : '同步 ERP 数据'}
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={handleDownloadCsvTemplate}
            >
              <FileDown className="w-4 h-4" />
              CSV 模板
            </button>
          </div>

          {pushResult && (
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${pushResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              {pushResult.success
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <AlertCircle className="w-4 h-4 text-red-500" />}
              <span className={`text-xs ${pushResult.success ? 'text-emerald-600' : 'text-red-500'}`}>{pushResult.message}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Search className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">拉取追踪数据</h3>
            <p className="text-xs text-slate-400">输入已在17track注册的追踪号，拉取状态和轨迹</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">追踪号</label>
            <textarea
              className="input-field w-full min-h-[120px] resize-y font-mono text-xs"
              placeholder={"每行一个追踪号，例如：\n1Z999AA10123456784\nSPXATL079802219254,190844\nRR123456789CN,3011"}
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1.5">每行一个追踪号，可附带运输商代码（格式：追踪号,运输商代码），每批最多40个</p>
          </div>

          <button
            className="btn-primary flex items-center gap-2 w-full justify-center"
            onClick={handleFetchByNumbers}
            disabled={!track17Config.apiKey || fetching || !trackInput.trim()}
          >
            {fetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {fetching ? '拉取中...' : '拉取数据'}
          </button>

          {fetching && fetchProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">拉取中 {fetchProgress.current}/{fetchProgress.total}</span>
                <span className="text-blue-500 font-medium">{fetchProgressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${fetchProgressPercent}%` }} />
              </div>
            </div>
          )}

          {fetchResult && (
            <div className={`p-4 rounded-xl border ${fetchResult.found > 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100'}`}>
              <div className="flex items-center gap-4 text-xs flex-wrap mb-2">
                {fetchResult.found > 0 && (
                  <span className="text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                    获取 {fetchResult.found} 条数据
                  </span>
                )}
                {fetchResult.withEvents > 0 && (
                  <span className="text-blue-600 font-medium">
                    {fetchResult.withEvents} 条含详细轨迹
                  </span>
                )}
                {fetchResult.found - fetchResult.withEvents > 0 && (
                  <span className="text-amber-600 font-medium">
                    {fetchResult.found - fetchResult.withEvents} 条仅状态信息
                  </span>
                )}
                {fetchResult.notFound > 0 && (
                  <span className="text-red-500 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                    {fetchResult.notFound} 个未找到
                  </span>
                )}
              </div>
              {fetchResult.details.length > 0 && (
                <div className="space-y-0.5 mt-2 pt-2 border-t border-slate-200/50">
                  {fetchResult.details.map((d, i) => (
                    <p key={i} className="text-xs text-slate-500">{d}</p>
                  ))}
                </div>
              )}
              {fetchResult.found - fetchResult.withEvents > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/50">
                  <div className="flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600">
                      部分单号仅有状态信息无详细轨迹，可能原因：运输商尚未返回轨迹数据、单号刚注册17track还在获取中。
                    </p>
                  </div>
                </div>
              )}
              {fetchResult.rawSample && (
                <details className="mt-2 pt-2 border-t border-slate-200/50">
                  <summary className="text-xs text-blue-500 cursor-pointer hover:text-blue-600">查看原始API响应（调试用）</summary>
                  <pre className="mt-1 text-[10px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-100 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
                    {fetchResult.rawSample}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">更新已有数据</h3>
            <p className="text-xs text-slate-400">重新拉取系统中已有追踪号的最新状态</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            系统中共有 <span className="font-medium text-slate-700">{store.orders.length}</span> 个订单
          </p>

          <button
            className="btn-primary flex items-center gap-2 w-full justify-center"
            onClick={handleSync}
            disabled={!track17Config.apiKey || track17Config.syncing || store.orders.length === 0}
          >
            {track17Config.syncing
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            {track17Config.syncing ? '更新中...' : '更新全部'}
          </button>

          {track17Config.syncing && syncProgress.phase !== 'idle' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">拉取中 {syncProgress.fetchedItems}/{syncProgress.totalItems}</span>
                <span className="text-blue-500 font-medium">{syncProgressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${syncProgressPercent}%` }} />
              </div>
            </div>
          )}

          {!track17Config.syncing && syncProgress.phase === 'done' && syncProgress.totalItems > 0 && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-emerald-600">已更新 {syncProgress.fetchedItems} / {syncProgress.totalItems} 条</span>
            </div>
          )}

          {track17Config.syncError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{track17Config.syncError}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">自动更新</h3>
            <p className="text-xs text-slate-400">每6小时自动更新已有追踪号的状态</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-slate-700">自动更新</p>
            <p className="text-xs text-slate-400">
              {track17Config.autoSync ? '已开启 · 每6小时自动同步' : '已关闭'}
            </p>
          </div>
          <button
            className="flex items-center"
            onClick={() => store.setAutoSync(!track17Config.autoSync)}
            disabled={!track17Config.apiKey}
          >
            {track17Config.autoSync
              ? <ToggleRight className="w-10 h-10 text-blue-500" />
              : <ToggleLeft className="w-10 h-10 text-slate-300" />}
          </button>
        </div>
      </div>
    </div>
  )
}
