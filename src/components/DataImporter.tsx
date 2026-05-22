import { useCallback, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { LogisticsOrder, OrderStatus, EventPhase, ExceptionCategory, ExceptionSubType } from '@/types'
import { Upload, FileSpreadsheet, X, CheckCircle2, Download } from 'lucide-react'
import { useLogisticsStore } from '@/store/logisticsStore'

export default function DataImporter() {
  const mergeOrders = useLogisticsStore((s) => s.mergeOrders)
  const [dragActive, setDragActive] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; count: number; errors: string[] } | null>(null)

  const downloadTemplate = () => {
    const headers = ['订单号', '追踪号', '承运商', '发件地', '目的地', '目的国', '状态', '发货日期', '妥投日期', 'SLA天数', '重量(kg)']
    const sampleRow = ['CB20260519001', 'DHL123456789', 'DHL', '深圳', '美国 洛杉矶', '美国', 'delivered', '2026-04-01', '2026-04-08', '10', '1.25']
    const csv = Papa.unparse({ fields: headers, data: [sampleRow] })
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '物流数据导入模板.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const processFile = useCallback(
    (file: File) => {
      setImporting(true)
      setResult(null)
      const ext = file.name.split('.').pop()?.toLowerCase()

      const parseAndImport = (rows: Record<string, string>[]) => {
        const orders: LogisticsOrder[] = []
        const errors: string[] = []
        rows.forEach((row, idx) => {
          try {
            const orderId = row['订单号'] || row['orderId'] || `IMP${Date.now()}${idx}`
            const trackingNumber = row['追踪号'] || row['trackingNumber'] || `TK${Date.now()}${idx}`
            const carrier = row['承运商'] || row['carrier'] || '未知'
            const origin = row['发件地'] || row['origin'] || '深圳'
            const destination = row['目的地'] || row['destination'] || '未知'
            const destinationCountry = row['目的国'] || row['destinationCountry'] || destination.split(' ')[0] || '未知'
            const statusStr = row['状态'] || row['status'] || 'in_transit'
            const status = (['in_transit', 'delivered', 'exception', 'returned'].includes(statusStr) ? statusStr : 'in_transit') as OrderStatus
            const shipDate = row['发货日期'] || row['shipDate'] || new Date().toISOString().split('T')[0]
            const deliveryDate = row['妥投日期'] || row['deliveryDate'] || undefined
            const slaDays = parseInt(row['SLA天数'] || row['slaDays'] || '15')
            const actualDays = deliveryDate ? Math.round((new Date(deliveryDate).getTime() - new Date(shipDate).getTime()) / (1000 * 60 * 60 * 24) * 10) / 10 : undefined
            const weight = parseFloat(row['重量(kg)'] || row['weight'] || '0.5')
            orders.push({
              orderId, trackingNumber, carrier, origin, destination, destinationCountry, status, shipDate, deliveryDate, slaDays, actualDays, weight,
              currentLocation: destination,
              events: [{ timestamp: `${shipDate} 10:00`, location: origin, status: 'pickup', subStatus: 'pickup', description: '包裹已揽收', phase: 'pickup' as EventPhase }],
              exception: status === 'exception' ? { category: 'exception' as ExceptionCategory, subType: 'Exception_Other' as ExceptionSubType, description: '导入数据标记异常', createdAt: new Date().toISOString().split('T')[0], ticketStatus: 'pending' } : undefined,
            })
          } catch { errors.push(`第 ${idx + 2} 行数据解析失败`) }
        })
        mergeOrders(orders)
        setResult({ success: true, count: orders.length, errors })
        setImporting(false)
      }

      if (ext === 'csv') {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => { parseAndImport(results.data as Record<string, string>[]) }, error: () => { setResult({ success: false, count: 0, errors: ['CSV文件解析失败'] }); setImporting(false) } })
      } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader()
        reader.onload = (e) => { try { const wb = XLSX.read(e.target?.result, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; parseAndImport(XLSX.utils.sheet_to_json<Record<string, string>>(ws)) } catch { setResult({ success: false, count: 0, errors: ['Excel文件解析失败'] }); setImporting(false) } }
        reader.readAsArrayBuffer(file)
      } else { setResult({ success: false, count: 0, errors: ['不支持的文件格式'] }); setImporting(false) }
    },
    [mergeOrders]
  )

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragActive(false); const file = e.dataTransfer.files[0]; if (file) processFile(file) }, [processFile])
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) processFile(file) }, [processFile])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-800">数据导入</h3>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-1.5 !text-xs !py-1.5 !px-3">
          <Download className="w-3.5 h-3.5" />下载模板
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
          dragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
        }`}
      >
        <Upload className={`w-8 h-8 mx-auto mb-3 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
        <p className="text-sm text-slate-600 mb-1">拖拽文件到此处，或点击上传</p>
        <p className="text-xs text-slate-400 mb-4">支持 CSV、Excel (.xlsx/.xls) 格式</p>
        <label className="btn-primary cursor-pointer inline-block">
          {importing ? '导入中...' : '选择文件'}
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileInput} className="hidden" />
        </label>
      </div>

      {result && (
        <div className={`mt-4 p-3 rounded-xl ${result.success ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
          <div className="flex items-center gap-2">
            {result.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-red-500" />}
            <span className={`text-sm ${result.success ? 'text-emerald-700' : 'text-red-600'}`}>
              {result.success ? `成功导入 ${result.count} 条订单` : '导入失败'}
            </span>
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-xs text-amber-600 space-y-1">
              {result.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 p-3 bg-slate-50 rounded-xl">
        <p className="text-xs font-medium text-slate-600 mb-2">CSV模板表头说明</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-slate-500"><span className="text-blue-600 font-medium">订单号</span> — 唯一订单标识</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">追踪号</span> — 物流追踪号</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">承运商</span> — DHL/FedEx/UPS等</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">发件地</span> — 发货城市</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">目的地</span> — 国家+城市</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">目的国</span> — 目的国家</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">状态</span> — delivered/in_transit/exception/returned</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">发货日期</span> — YYYY-MM-DD</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">妥投日期</span> — YYYY-MM-DD（可空）</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">SLA天数</span> — 承诺时效</div>
          <div className="text-slate-500"><span className="text-blue-600 font-medium">重量(kg)</span> — 包裹重量</div>
        </div>
      </div>
    </div>
  )
}
