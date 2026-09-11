const EARTH_RADIUS_KM = 6371

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

// Great-circle distance between two lat/lon points, in kilometers.
// This is standard geometry (not a database query, not AI) — it treats
// the Earth as a sphere, which is more than accurate enough for "how far
// is this donor from this request."
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/**
 * Proximity score (0-40) for how close a donor is to a request.
 * Uses precise Haversine distance when both sides have coordinates;
 * otherwise falls back to a same-city / different-city guess, since
 * requesting exact coordinates from every user isn't realistic.
 *
 * Donor coordinates are only ever used here, inside a score calculation —
 * they are never returned to the frontend, so a donor's exact location
 * is never exposed publicly (see README "Privacy" note).
 */
export function calculateProximityScore(request, donorProfile) {
  const hasCoordinates =
    request.latitude != null &&
    request.longitude != null &&
    donorProfile.latitude != null &&
    donorProfile.longitude != null

  if (hasCoordinates) {
    const distanceKm = haversineDistanceKm(
      request.latitude,
      request.longitude,
      donorProfile.latitude,
      donorProfile.longitude,
    )

    if (distanceKm <= 5) return 40
    if (distanceKm <= 20) return 30
    if (distanceKm <= 50) return 20
    if (distanceKm <= 100) return 10
    return 0
  }

  const sameCity = request.city?.trim().toLowerCase() === donorProfile.city?.trim().toLowerCase()
  return sameCity ? 25 : 5
}
