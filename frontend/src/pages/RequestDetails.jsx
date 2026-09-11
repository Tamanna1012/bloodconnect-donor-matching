import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getRequest,
  getMatchesForRequest,
  transitionRequestStatus,
  cancelRequest,
} from '../api/requests'
import { formatBloodGroup } from '../utils/formatters'
import { UrgencyBadge, StatusBadge } from '../components/Badges'

const CANCELLABLE_STATUSES = ['OPEN', 'MATCHING', 'DONOR_CONTACTED', 'ACCEPTED']

function RequestDetails() {
  const { id } = useParams()
  const { user, token } = useAuth()

  const [request, setRequest] = useState(null)
  const [matches, setMatches] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [findingMatches, setFindingMatches] = useState(false)

  useEffect(() => {
    getRequest(id, token)
      .then((data) => setRequest(data.request))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, token])

  const isOwner = request && user.id === request.requesterId

  async function handleFindMatches() {
    setActionError('')
    setFindingMatches(true)
    try {
      const data = await getMatchesForRequest(id, token)
      setMatches(data.matches)
      const refreshed = await getRequest(id, token)
      setRequest(refreshed.request)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setFindingMatches(false)
    }
  }

  async function handleCancel() {
    setActionError('')
    try {
      const data = await cancelRequest(id, token)
      setRequest(data.request)
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleMarkFulfilled() {
    setActionError('')
    try {
      const data = await transitionRequestStatus(id, 'FULFILLED', token)
      setRequest(data.request)
    } catch (err) {
      setActionError(err.message)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!request) return null

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link to="/requests" className="text-sm text-red-600 hover:underline">
        ← Back to My Requests
      </Link>

      <div className="mt-4 p-5 border rounded bg-white">
        <div className="flex items-center gap-2 flex-wrap">
          <UrgencyBadge urgency={request.urgency} />
          <StatusBadge status={request.status} />
        </div>
        <h1 className="mt-2 text-xl font-bold text-gray-900">
          {formatBloodGroup(request.bloodGroup)} · {request.units} unit(s)
        </h1>
        <p className="text-gray-600">{request.city}</p>
        {request.description && <p className="mt-2 text-sm text-gray-700">{request.description}</p>}
        {request.requiredBy && (
          <p className="mt-1 text-sm text-gray-500">
            Required by {new Date(request.requiredBy).toLocaleString()}
          </p>
        )}
      </div>

      {actionError && (
        <div className="mt-4 bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{actionError}</div>
      )}

      {isOwner && (
        <div className="mt-4 flex flex-wrap gap-2">
          {['OPEN', 'MATCHING'].includes(request.status) && (
            <button
              type="button"
              onClick={handleFindMatches}
              disabled={findingMatches}
              className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {findingMatches ? 'Searching...' : 'Find Matching Donors'}
            </button>
          )}
          {request.status === 'ACCEPTED' && (
            <button
              type="button"
              onClick={handleMarkFulfilled}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700"
            >
              Mark as Fulfilled
            </button>
          )}
          {CANCELLABLE_STATUSES.includes(request.status) && (
            <button
              type="button"
              onClick={handleCancel}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300"
            >
              Cancel Request
            </button>
          )}
        </div>
      )}

      {isOwner && matches && (
        <div className="mt-6">
          <h2 className="font-semibold text-gray-900">Matching donors ({matches.length})</h2>
          {matches.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">No eligible donors found yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {matches.map((match) => (
                <li key={match.id} className="p-3 border rounded bg-white flex items-center justify-between">
                  <span>
                    {formatBloodGroup(match.donorProfile.bloodGroup)} · {match.donorProfile.city} ·{' '}
                    score {match.score}
                  </span>
                  <StatusBadge status={match.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default RequestDetails
