import type { OrderStatus } from '@/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'

interface StatusBadgeProps {
  status: OrderStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] || { bg: 'bg-slate-50', text: 'text-slate-500' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
