import { X, ExternalLink, Copy, MapPin, Truck, Calendar, AlertTriangle, Clock } from 'lucide-react'
import type { LogisticsOrder } from '@/types'
import type { AlertDetail } from '@/services/d1Api'
import { getCountryName } from '@/utils/countryNames'
import StatusBadge from '@/components/StatusBadge'
import TrackingTimeline from '@/components/TrackingTimeline'

const ALERT_TYPE_LABELS: Record<string, string> = {
  not_shipped: '超时未出库',
  not_online: '超时未上网',
  not_delivered: '超时未妥投',
  keyword: '关键字异常',
}

const ALERT_TYPE_COLORS: Record<string, string> = {
  not_shipped: 'bg-orange-50 border-orange-200 text-orange-700',
  not_online: 'bg-blue-50 border-blue-200 text-blue-700',
  not_delivered: 'bg-amber-50 border-amber-200 text-amber-700',
  keyword: 'bg-red-50 border-red-200 text-red-700',
}

function formatDateTime(dt: string): string {
  if (!dt) return '-'
  return dt.replace('T', ' ').substring(0, 19)
}

function DetailRow({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  if (!value || value === '-') return null
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm text-slate-700 flex items-center gap-1.5 ${mono ? 'font-mono text-xs' : ''}`}>{icon}{value}</span>
    </div>
  )
}

interface OrderDetailModalProps {
  order: LogisticsOrder
  onClose: () => void
  alertDetails?: AlertDetail[]
}

export default function OrderDetailModal({ order, onClose, alertDetails }: OrderDetailModalProps) {
  const destination = order.destinationCountry
    ? getCountryName(order.destinationCountry)
    : order.destination || '-'
  const warehouse = order.erpInfo?.warehouse || order.erpInfo?.warehouseCode || '-'
  const logisticsProvider = order.erpInfo?.logisticsProviderDisplayName || order.erpInfo?.logisticsProvider || ''
  const carrierDisplay = order.carrier || logisticsProvider || '-'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-y-auto p-6 pointer-events-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">物流轨迹 - {order.trackingNumber}</h3>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
          </div>

          <div className="space-y-1 mb-4">
            {order.erpInfo?.orderNo && (
              <DetailRow label="履约单号" value={order.erpInfo.orderNo} />
            )}
            <DetailRow label="追踪号" value={order.trackingNumber} mono icon={
              <>
                <a href={`https://t.17track.net/en#nums=${order.trackingNumber}`} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded hover:bg-blue-50 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400 hover:text-blue-600" />
                </a>
                <button className="p-0.5 rounded hover:bg-slate-100 transition-colors" onClick={() => navigator.clipboard.writeText(order.trackingNumber)} title="复制">
                  <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              </>
            } />
            <DetailRow label="承运商" value={carrierDisplay} icon={<Truck className="w-3.5 h-3.5" />} />
            {logisticsProvider && logisticsProvider !== carrierDisplay && (
              <DetailRow label="物流服务商" value={logisticsProvider} />
            )}
            <DetailRow label="目的地" value={destination} icon={<MapPin className="w-3.5 h-3.5" />} />
            <DetailRow label="仓库" value={warehouse} />
            <DetailRow label="状态" value="" icon={<StatusBadge status={order.status} />} />
            {order.erpInfo?.currentChannel && (
              <DetailRow label="渠道" value={order.erpInfo.currentChannel} />
            )}
            {order.erpInfo?.platform && (
              <DetailRow label="平台" value={order.erpInfo.platform} />
            )}
            <DetailRow label="发货日期" value={order.shipDate || '-'} icon={<Calendar className="w-3.5 h-3.5" />} />
            {order.deliveryDate && <DetailRow label="妥投日期" value={order.deliveryDate} />}
            {order.erpInfo?.createdAt && <DetailRow label="创建时间" value={order.erpInfo.createdAt} />}
            {order.erpInfo?.checkoutTime && <DetailRow label="出库时间" value={order.erpInfo.checkoutTime} />}
            {order.erpInfo?.paymentTime && <DetailRow label="支付时间" value={order.erpInfo.paymentTime} />}
            {order.actualDays != null && <DetailRow label="实际时效" value={`${order.actualDays}天`} />}
          </div>

          {alertDetails && alertDetails.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-800">超时详情</span>
              </div>
              {alertDetails.map((d, i) => (
                <div key={i} className={`rounded-xl border p-3 ${ALERT_TYPE_COLORS[d.alertType] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">{ALERT_TYPE_LABELS[d.alertType] || d.alertType}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {d.alertType === 'not_shipped' && (
                      <>
                        <div className="flex justify-between"><span className="opacity-70">创建时间</span><span className="font-medium">{formatDateTime(order.erpInfo?.createdAt || '')}</span></div>
                        <div className="flex justify-between"><span className="opacity-70">规则阈值</span><span className="font-medium">{d.hoursThreshold}小时</span></div>
                        <div className="flex justify-between"><span className="opacity-70">已等待</span><span className="font-medium">{d.actualHours}小时</span></div>
                        <div className="flex justify-between"><span className="opacity-70">已超时</span><span className="font-bold">{d.overtimeHours}小时</span></div>
                      </>
                    )}
                    {d.alertType === 'not_online' && (
                      <>
                        <div className="flex justify-between"><span className="opacity-70">出库时间</span><span className="font-medium">{formatDateTime(d.checkoutTime)}</span></div>
                        <div className="flex justify-between"><span className="opacity-70">上网时间</span><span className="font-medium">{d.onlineTime || '未上网'}</span></div>
                        <div className="flex justify-between"><span className="opacity-70">规则阈值</span><span className="font-medium">{d.hoursThreshold}小时未上网</span></div>
                        <div className="flex justify-between"><span className="opacity-70">已等待</span><span className="font-medium">{d.actualHours}小时</span></div>
                        <div className="flex justify-between col-span-2"><span className="opacity-70">已超时</span><span className="font-bold">{d.overtimeHours}小时</span></div>
                      </>
                    )}
                    {d.alertType === 'not_delivered' && (
                      <>
                        <div className="flex justify-between"><span className="opacity-70">出库时间</span><span className="font-medium">{formatDateTime(d.checkoutTime)}</span></div>
                        <div className="flex justify-between"><span className="opacity-70">规则阈值</span><span className="font-medium">{d.hoursThreshold}小时未妥投</span></div>
                        <div className="flex justify-between"><span className="opacity-70">已等待</span><span className="font-medium">{d.actualHours}小时</span></div>
                        <div className="flex justify-between"><span className="opacity-70">已超时</span><span className="font-bold">{d.overtimeHours}小时</span></div>
                      </>
                    )}
                    {d.alertType === 'keyword' && (
                      <div className="col-span-2 text-xs opacity-80">轨迹中匹配到关键字</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <TrackingTimeline order={order} />
        </div>
      </div>
    </>
  )
}
