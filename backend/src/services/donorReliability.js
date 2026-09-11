/**
 * Simple, rule-based donor reliability score (0-30). No machine learning —
 * just arithmetic over the donor's own history, tracked on DonorProfile:
 * requestsReceived, requestsAccepted, requestsDeclined, donationsCompleted.
 *
 * - acceptanceRate rewards donors who say yes when contacted.
 * - donationsCompleted rewards donors who actually follow through, not
 *   just donors who click "accept" (capped so a long history can't
 *   dominate the score unfairly against a newer, equally reliable donor).
 * - A brand-new donor with zero history gets a neutral 0.5 acceptance
 *   rate rather than 0, so new donors aren't unfairly ranked last just
 *   for being new.
 */
export function calculateReliabilityScore(donorProfile) {
  const { requestsReceived, requestsAccepted, donationsCompleted } = donorProfile

  const acceptanceRate = requestsReceived > 0 ? requestsAccepted / requestsReceived : 0.5

  const acceptanceScore = acceptanceRate * 20
  const completionBonus = Math.min(donationsCompleted, 5) * 2

  return Math.round(acceptanceScore + completionBonus)
}
