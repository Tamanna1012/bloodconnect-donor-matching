const BLOOD_GROUP_LABELS = {
  A_POS: 'A+',
  A_NEG: 'A-',
  B_POS: 'B+',
  B_NEG: 'B-',
  AB_POS: 'AB+',
  AB_NEG: 'AB-',
  O_POS: 'O+',
  O_NEG: 'O-',
}

export const BLOOD_GROUPS = Object.keys(BLOOD_GROUP_LABELS)

export function formatBloodGroup(code) {
  return BLOOD_GROUP_LABELS[code] ?? code
}

export function formatUrgency(urgency) {
  if (!urgency) return ''
  return urgency.charAt(0) + urgency.slice(1).toLowerCase()
}

export function formatStatus(status) {
  if (!status) return ''
  return status
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

export const URGENCY_STYLES = {
  NORMAL: 'bg-gray-100 text-gray-700',
  URGENT: 'bg-amber-100 text-amber-800',
  EMERGENCY: 'bg-red-100 text-red-700',
}
