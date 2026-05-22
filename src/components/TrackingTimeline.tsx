import type { LogisticsOrder } from '@/types'
import { PHASE_LABELS } from '@/types'
import { Check, MapPin, FileText, LogOut } from 'lucide-react'

interface TrackingTimelineProps {
  order: LogisticsOrder
}

interface SystemEvent {
  timestamp: string
  label: string
  description: string
  icon: React.ElementType
  color: { dot: string; bg: string; text: string }
}

function getSystemEvents(order: LogisticsOrder): SystemEvent[] {
  const events: SystemEvent[] = []
  if (order.erpInfo?.createdAt) {
    events.push({
      timestamp: order.erpInfo.createdAt,
      label: '创建订单',
      description: '订单已在ERP系统创建',
      icon: FileText,
      color: { dot: '#6366F1', bg: 'bg-indigo-50', text: 'text-indigo-600' },
    })
  }
  if (order.erpInfo?.checkoutTime || order.erpInfo?.shippedAt) {
    events.push({
      timestamp: order.erpInfo.checkoutTime || order.erpInfo.shippedAt || '',
      label: '出库签出',
      description: '包裹已从仓库签出',
      icon: LogOut,
      color: { dot: '#8B5CF6', bg: 'bg-violet-50', text: 'text-violet-600' },
    })
  }
  return events
}

export default function TrackingTimeline({ order }: TrackingTimelineProps) {
  const systemEvents = getSystemEvents(order)
  const allItems = [
    ...systemEvents.map((se) => ({ type: 'system' as const, data: se })),
    ...order.events.map((event, idx) => ({ type: 'track' as const, data: event, idx })),
  ]

  return (
    <div className="relative pl-8">
      {allItems.map((item, i) => {
        const isLast = i === allItems.length - 1
        if (item.type === 'system') {
          const se = item.data
          const Icon = se.icon
          return (
            <div key={`sys-${i}`} className="relative pb-6 last:pb-0 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
              {!isLast && (
                <div className="absolute left-[-20px] top-[28px] w-[2px] h-[calc(100%-28px)] bg-slate-100" />
              )}
              <div className={`absolute left-[-24px] top-[4px] w-[10px] h-[10px] rounded-full border-2 bg-white`} style={{ borderColor: se.color.dot }}>
                <Icon className="absolute top-[-4px] left-[-4px] w-[18px] h-[18px]" style={{ color: se.color.dot }} />
              </div>
              <div className={`${se.color.bg} rounded-xl p-3 border border-dashed`} style={{ borderColor: se.color.dot + '40' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${se.color.text}`}>
                    {se.label}
                  </span>
                  <span className="text-[10px] text-slate-400">{se.timestamp}</span>
                </div>
                <p className="text-sm text-slate-700">{se.description}</p>
              </div>
            </div>
          )
        }

        const event = item.data
        const isCurrent = isLast && order.status === 'in_transit'
        return (
          <div key={`evt-${i}`} className="relative pb-6 last:pb-0 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
            {!isLast && (
              <div className="absolute left-[-20px] top-[28px] w-[2px] h-[calc(100%-28px)] bg-slate-100" />
            )}
            <div
              className={`absolute left-[-24px] top-[4px] w-[10px] h-[10px] rounded-full border-2 ${
                isCurrent
                  ? 'border-blue-500 bg-blue-100 animate-pulse-glow'
                  : event.phase === 'delivered'
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {event.phase === 'delivered' && (
                <Check className="absolute top-[-3px] left-[-3px] w-4 h-4 text-white" />
              )}
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-blue-600">
                  {PHASE_LABELS[event.phase]}
                </span>
                <span className="text-[10px] text-slate-400">{event.timestamp}</span>
              </div>
              <p className="text-sm text-slate-700">{event.description}</p>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-500">{event.location}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
