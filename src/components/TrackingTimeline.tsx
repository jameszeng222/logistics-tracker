import type { LogisticsOrder } from '@/types'
import { PHASE_LABELS } from '@/types'
import { Check, MapPin } from 'lucide-react'

interface TrackingTimelineProps {
  order: LogisticsOrder
}

export default function TrackingTimeline({ order }: TrackingTimelineProps) {
  return (
    <div className="relative pl-8">
      {order.events.map((event, idx) => {
        const isLast = idx === order.events.length - 1
        const isCurrent = isLast && order.status === 'in_transit'
        return (
          <div key={idx} className="relative pb-6 last:pb-0 animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
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
