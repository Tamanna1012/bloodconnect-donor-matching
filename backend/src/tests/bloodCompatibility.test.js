import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCompatible } from '../services/bloodCompatibility.js'

const ALL_GROUPS = ['O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS']

// The standard, well-known ABO/Rh compatibility chart: for each donor
// blood group, the list of recipient blood groups they can safely give
// red cells to. This is the ground truth we check our function against —
// not something we invented.
const REFERENCE_CHART = {
  O_NEG: ['O_NEG', 'O_POS', 'A_NEG', 'A_POS', 'B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'],
  O_POS: ['O_POS', 'A_POS', 'B_POS', 'AB_POS'],
  A_NEG: ['A_NEG', 'A_POS', 'AB_NEG', 'AB_POS'],
  A_POS: ['A_POS', 'AB_POS'],
  B_NEG: ['B_NEG', 'B_POS', 'AB_NEG', 'AB_POS'],
  B_POS: ['B_POS', 'AB_POS'],
  AB_NEG: ['AB_NEG', 'AB_POS'],
  AB_POS: ['AB_POS'],
}

test('isCompatible matches the standard ABO/Rh chart for all 64 donor/recipient pairs', () => {
  for (const donor of ALL_GROUPS) {
    for (const recipient of ALL_GROUPS) {
      const expected = REFERENCE_CHART[donor].includes(recipient)
      const actual = isCompatible(donor, recipient)
      assert.equal(
        actual,
        expected,
        `isCompatible(${donor}, ${recipient}) should be ${expected}`,
      )
    }
  }
})

test('O_NEG is the universal donor', () => {
  for (const recipient of ALL_GROUPS) {
    assert.equal(isCompatible('O_NEG', recipient), true)
  }
})

test('AB_POS is the universal recipient', () => {
  for (const donor of ALL_GROUPS) {
    assert.equal(isCompatible(donor, 'AB_POS'), true)
  }
})

test('AB_POS can only donate to AB_POS', () => {
  const compatibleRecipients = ALL_GROUPS.filter((r) => isCompatible('AB_POS', r))
  assert.deepEqual(compatibleRecipients, ['AB_POS'])
})

test('O_NEG can only receive from O_NEG', () => {
  const compatibleDonors = ALL_GROUPS.filter((d) => isCompatible(d, 'O_NEG'))
  assert.deepEqual(compatibleDonors, ['O_NEG'])
})

test('a same-type donor and recipient are always compatible', () => {
  for (const group of ALL_GROUPS) {
    assert.equal(isCompatible(group, group), true)
  }
})

test('an incompatible ABO pair is correctly rejected', () => {
  // A carries the A antigen, which a B recipient's body treats as foreign.
  assert.equal(isCompatible('A_POS', 'B_POS'), false)
})

test('Rh+ donor cannot give to an Rh- recipient of the same ABO type', () => {
  assert.equal(isCompatible('A_POS', 'A_NEG'), false)
})
