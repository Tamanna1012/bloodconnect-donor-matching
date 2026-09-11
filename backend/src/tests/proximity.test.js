import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineDistanceKm, calculateProximityScore } from '../services/proximity.js'

test('haversineDistanceKm returns 0 for the same point', () => {
  assert.equal(haversineDistanceKm(13.08, 80.27, 13.08, 80.27), 0)
})

test('haversineDistanceKm matches a well-known real-world distance (London-Paris ~344km)', () => {
  const distance = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522)
  assert.ok(distance > 340 && distance < 350, `expected ~344km, got ${distance}`)
})

// 1 degree of latitude is ~111.32km at any longitude, so varying only
// latitude (same longitude) gives predictable distances for bucket tests.
const BASE_LAT = 13.0
const LON = 80.0

function pointAtKmNorth(km) {
  return { latitude: BASE_LAT + km / 111.32, longitude: LON }
}

test('calculateProximityScore: <=5km scores 40', () => {
  const request = { latitude: BASE_LAT, longitude: LON, city: 'Chennai' }
  const donor = { ...pointAtKmNorth(3), city: 'Chennai' }
  assert.equal(calculateProximityScore(request, donor), 40)
})

test('calculateProximityScore: <=20km scores 30', () => {
  const request = { latitude: BASE_LAT, longitude: LON, city: 'Chennai' }
  const donor = { ...pointAtKmNorth(11), city: 'Chennai' }
  assert.equal(calculateProximityScore(request, donor), 30)
})

test('calculateProximityScore: <=50km scores 20', () => {
  const request = { latitude: BASE_LAT, longitude: LON, city: 'Chennai' }
  const donor = { ...pointAtKmNorth(33), city: 'Chennai' }
  assert.equal(calculateProximityScore(request, donor), 20)
})

test('calculateProximityScore: <=100km scores 10', () => {
  const request = { latitude: BASE_LAT, longitude: LON, city: 'Chennai' }
  const donor = { ...pointAtKmNorth(88), city: 'Chennai' }
  assert.equal(calculateProximityScore(request, donor), 10)
})

test('calculateProximityScore: >100km scores 0', () => {
  const request = { latitude: BASE_LAT, longitude: LON, city: 'Chennai' }
  const donor = { ...pointAtKmNorth(222), city: 'Chennai' }
  assert.equal(calculateProximityScore(request, donor), 0)
})

test('calculateProximityScore falls back to same-city match when coordinates are missing', () => {
  const request = { latitude: null, longitude: null, city: 'Chennai' }
  const donor = { latitude: null, longitude: null, city: 'chennai' } // case-insensitive
  assert.equal(calculateProximityScore(request, donor), 25)
})

test('calculateProximityScore falls back to a low score for a different city with no coordinates', () => {
  const request = { latitude: null, longitude: null, city: 'Chennai' }
  const donor = { latitude: null, longitude: null, city: 'Mumbai' }
  assert.equal(calculateProximityScore(request, donor), 5)
})
