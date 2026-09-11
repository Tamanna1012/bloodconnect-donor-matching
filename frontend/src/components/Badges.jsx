import { formatStatus, formatUrgency, URGENCY_STYLES } from '../utils/formatters'

export function UrgencyBadge({ urgency }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${URGENCY_STYLES[urgency] || URGENCY_STYLES.NORMAL}`}
    >
      {formatUrgency(urgency)}
    </span>
  )
}

export function StatusBadge({ status }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
      {formatStatus(status)}
    </span>
  )
}
