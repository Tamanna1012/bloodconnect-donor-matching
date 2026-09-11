export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6
}

export const BLOOD_GROUPS = [
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
]

export const URGENCY_LEVELS = ['NORMAL', 'URGENT', 'EMERGENCY']

export function isValidBloodGroup(bloodGroup) {
  return BLOOD_GROUPS.includes(bloodGroup)
}

export function isValidUrgency(urgency) {
  return URGENCY_LEVELS.includes(urgency)
}

export function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

export function isValidLatitude(value) {
  return typeof value === 'number' && value >= -90 && value <= 90
}

export function isValidLongitude(value) {
  return typeof value === 'number' && value >= -180 && value <= 180
}
