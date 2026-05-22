import { useState } from 'react'
import { Upload, X, FileDown, CheckCircle, AlertCircle } from 'lucide-react'

export interface ParsedFulfillmentRow {
  orderNo: string
  warehouseCode: string
  platform: string
  shippingQty: number
  destinationCountry: string
  paymentTime: string
  createdAt: string
  packingTime: string
  checkoutTime: string
  logisticsProvider: string
  logisticsProviderDisplayName: string
  currentChannel: string
  trackingNumber: string
}

interface FulfillmentImporterProps {
  open: boolean
  onClose: () => void
  onImport: (rows: ParsedFulfillmentRow[]) => void
}

const CSV_HEADERS = [
  '履约单号', '仓库代码', '平台', '发货数量', '目的国家',
  '支付时间', '创建时间', '打包时间', '签出时间',
  '物流服务商', 'C端显示物流服务商名称', '当前渠道', '快递单号',
]

const HEADER_MAP: Record<string, keyof ParsedFulfillmentRow> = {
  '履约单号': 'orderNo',
  '仓库代码': 'warehouseCode',
  '平台': 'platform',
  '发货数量': 'shippingQty',
  '目的国家': 'destinationCountry',
  '支付时间': 'paymentTime',
  '创建时间': 'createdAt',
  '打包时间': 'packingTime',
  '签出时间': 'checkoutTime',
  '物流服务商': 'logisticsProvider',
  'C端显示物流服务商名称': 'logisticsProviderDisplayName',
  '当前渠道': 'currentChannel',
  '快递单号': 'trackingNumber',
}

function normalizeDate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withSpace = trimmed.replace(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/, '$1-$2-$3 $4')
  const slashToDash = withSpace.replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/, '$1-$2-$3')
  return slashToDash
}

function parseCSV(text: string): {
  rows: ParsedFulfillmentRow[]
  errors: { row: number; reason: string }[]
} {
  const lines = text.split(/\r?\n/)
  if (lines.length === 0) return { rows: [], errors: [] }

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^\uFEFF/, ''))
  const requiredHeaders = ['履约单号', '快递单号']
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    return { rows: [], errors: [{ row: 1, reason: `缺少必填列头: ${missingHeaders.join(', ')}` }] }
  }

  const rows: ParsedFulfillmentRow[] = []
  const errors: { row: number; reason: string }[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(',')
    const record: Record<string, string> = {}
    headers.forEach((h, idx) => {
      record[h] = (values[idx] || '').trim()
    })

    const orderNo = record['履约单号']
    const trackingNumber = record['快递单号']

    if (!orderNo || !trackingNumber) {
      errors.push({ row: i + 1, reason: `履约单号或快递单号为空` })
      continue
    }

    const shippingQtyRaw = record['发货数量']
    const shippingQty = Number(shippingQtyRaw)
    const isValidQty = !isNaN(shippingQty) && shippingQtyRaw.trim() !== ''

    const row: ParsedFulfillmentRow = {
      orderNo,
      warehouseCode: record['仓库代码'] || '',
      platform: record['平台'] || '',
      shippingQty: isValidQty ? shippingQty : 0,
      destinationCountry: record['目的国家'] || '',
      paymentTime: normalizeDate(record['支付时间'] || ''),
      createdAt: normalizeDate(record['创建时间'] || ''),
      packingTime: normalizeDate(record['打包时间'] || ''),
      checkoutTime: normalizeDate(record['签出时间'] || ''),
      logisticsProvider: record['物流服务商'] || '',
      logisticsProviderDisplayName: record['C端显示物流服务商名称'] || '',
      currentChannel: record['当前渠道'] || '',
      trackingNumber,
    }

    rows.push(row)
  }

  return { rows, errors }
}

export default function FulfillmentImporter({ open, onClose, onImport }: FulfillmentImporterProps) {
  const [dragActive, setDragActive] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedFulfillmentRow[]>([])
  const [parseErrors, setParseErrors] = useState<{ row: number; reason: string }[]>([])
  const [fileName, setFileName] = useState('')

  if (!open) return null

  const reset = () => {
    setParsedRows([])
    setParseErrors([])
    setFileName('')
    setDragActive(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const downloadTemplate = () => {
    const bom = '\uFEFF'
    const csv = bom + CSV_HEADERS.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '履约单导入模板.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const processFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { rows, errors } = parseCSV(text)
      setParsedRows(rows)
      setParseErrors(errors)
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleConfirm = () => {
    if (parsedRows.length > 0) {
      onImport(parsedRows)
      handleClose()
    }
  }

  const previewRows = parsedRows.slice(0, 5)
  const displayHeaders = ['履约单号', '仓库代码', '平台', '发货数量', '目的国家', '快递单号']
  const displayKeys: (keyof ParsedFulfillmentRow)[] = ['orderNo', 'warehouseCode', 'platform', 'shippingQty', 'destinationCountry', 'trackingNumber']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">导入履约单</h2>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">上传CSV文件导入履约单数据</p>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              下载导入模板
            </button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
              dragActive
                ? 'border-blue-400 bg-blue-50/50'
                : 'border-slate-200 hover:border-blue-300 bg-slate-50/30'
            }`}
          >
            <Upload className={`w-8 h-8 mx-auto mb-3 ${dragActive ? 'text-blue-500' : 'text-slate-300'}`} />
            <p className="text-sm text-slate-600 mb-1">拖拽CSV文件到此处，或点击选择</p>
            <p className="text-xs text-slate-400 mb-4">仅支持 CSV 格式</p>
            <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
              选择文件
              <input type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
            </label>
          </div>

          {fileName && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <span className="truncate">{fileName}</span>
              <button onClick={reset} className="text-slate-400 hover:text-slate-600 ml-auto">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {(parsedRows.length > 0 || parseErrors.length > 0) && (
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5" />
                成功 {parsedRows.length} 条
              </span>
              {parseErrors.length > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  失败 {parseErrors.length} 条
                </span>
              )}
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 max-h-24 overflow-y-auto">
              {parseErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-500">第 {err.row} 行: {err.reason}</p>
              ))}
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {displayHeaders.map((h) => (
                      <th key={h} className="text-left py-2 px-2 font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {displayKeys.map((key) => (
                        <td key={key} className="py-1.5 px-2 text-slate-700 whitespace-nowrap max-w-[160px] truncate">{String(row[key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 5 && (
                <p className="text-xs text-slate-400 mt-2">仅显示前 5 行，共 {parsedRows.length} 行</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={parsedRows.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  )
}
