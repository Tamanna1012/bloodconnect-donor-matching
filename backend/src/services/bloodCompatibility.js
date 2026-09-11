// Deterministic ABO/Rh red-cell transfusion compatibility screening.
//
// IMPORTANT: This is a software screening rule based on the standard
// ABO/Rh compatibility model. It is NOT a substitute for medical
// verification. Actual transfusion eligibility must always be confirmed
// by a qualified blood bank / medical professional before any donation.

// Antigens each ABO type carries on its red blood cells.
// The rule "donor antigens must be a subset of recipient antigens" is
// what generates the entire standard ABO compatibility chart.
const ABO_ANTIGENS = {
  O: [],
  A: ['A'],
  B: ['B'],
  AB: ['A', 'B'],
}

// Our Prisma BloodGroup enum looks like "A_POS", "AB_NEG", "O_POS", ...
function parseBloodGroup(bloodGroup) {
  const [abo, rh] = bloodGroup.split('_')
  return { abo, rh: rh === 'POS' ? '+' : '-' }
}

function isSubset(subset, superset) {
  return subset.every((item) => superset.includes(item))
}

/**
 * Can `donorBloodGroup` safely donate red cells to `recipientBloodGroup`,
 * per the standard ABO/Rh model?
 *
 * Example: isCompatible('O_NEG', 'A_POS') === true (O- is a universal donor)
 */
export function isCompatible(donorBloodGroup, recipientBloodGroup) {
  const donor = parseBloodGroup(donorBloodGroup)
  const recipient = parseBloodGroup(recipientBloodGroup)

  const aboCompatible = isSubset(ABO_ANTIGENS[donor.abo], ABO_ANTIGENS[recipient.abo])

  // Rh- has no Rh antigen, so an Rh- donor is always fine.
  // Rh+ has the Rh antigen, so it can only go to an Rh+ recipient.
  const rhCompatible = donor.rh === '-' || recipient.rh === '+'

  return aboCompatible && rhCompatible
}
