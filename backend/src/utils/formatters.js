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

export function formatBloodGroup(code) {
  return BLOOD_GROUP_LABELS[code] ?? code
}

export function formatUrgency(urgency) {
  return urgency.charAt(0) + urgency.slice(1).toLowerCase()
}
