import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyDonorProfile, setAvailability } from '../api/donors'
import { listRequests } from '../api/requests'
import { listMyMatches, acceptMatch, declineMatch } from '../api/matches'
import { formatBloodGroup } from '../utils/formatters'
import { UrgencyBadge, StatusBadge } from '../components/Badges'

function Dashboard() {
  const { user, token } = useAuth()

  const [donorProfile, setDonorProfile] = useState(null)
  const [pendingMatches, setPendingMatches] = useState([])
  const [acceptedMatches, setAcceptedMatches] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  async function loadDashboard() {
    setLoading(true)
    setError('')
    try {
      const [profileData, pendingData, acceptedData, requestsData] = await Promise.all([
        getMyDonorProfile(token),
        listMyMatches('PENDING', token),
        listMyMatches('ACCEPTED', token),
        listRequests(token),
      ])
      setDonorProfile(profileData.donorProfile)
      setPendingMatches(pendingData.matches)
      setAcceptedMatches(acceptedData.matches)
      setMyRequests(requestsData.requests.filter((r) => r.requesterId === user.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleToggleAvailability() {
    try {
      const data = await setAvailability(!donorProfile.isAvailable, token)
      setDonorProfile(data.donorProfile)
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleAccept(matchId) {
    setActionError('')
    try {
      await acceptMatch(matchId, token)
      await loadDashboard()
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleDecline(matchId) {
    setActionError('')
    try {
      await declineMatch(matchId, token)
      await loadDashboard()
    } catch (err) {
      setActionError(err.message)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading dashboard...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.name}</h1>

      {actionError && (
        <div className="mt-4 bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{actionError}</div>
      )}

      {/* Donor section */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Donor status</h2>

        {!donorProfile ? (
          <div className="mt-2 p-4 border rounded bg-white">
            <p className="text-sm text-gray-600">
              You haven't set up a donor profile yet.
            </p>
            <Link
              to="/donor-profile"
              className="mt-2 inline-block text-red-600 text-sm font-medium hover:underline"
            >
              Set up your donor profile →
            </Link>
          </div>
        ) : (
          <div className="mt-2 p-4 border rounded bg-white flex flex-wrap items-center gap-6">
            <div>
              <span className="text-xs text-gray-500">Blood group</span>
              <p className="font-semibold">{formatBloodGroup(donorProfile.bloodGroup)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">City</span>
              <p className="font-semibold">{donorProfile.city}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Reliability score</span>
              <p className="font-semibold">{donorProfile.reliabilityScore} / 30</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Donations completed</span>
              <p className="font-semibold">{donorProfile.donationsCompleted}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-1">Availability</span>
              <button
                type="button"
                onClick={handleToggleAvailability}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  donorProfile.isAvailable
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {donorProfile.isAvailable ? 'Available' : 'Unavailable'}
              </button>
            </div>
          </div>
        )}

        {donorProfile && (
          <>
            <h3 className="mt-6 font-medium text-gray-800">
              Incoming requests ({pendingMatches.length})
            </h3>
            {pendingMatches.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">No pending requests right now.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {pendingMatches.map((match) => (
                  <li
                    key={match.id}
                    className="p-3 border rounded bg-white flex items-center justify-between flex-wrap gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <UrgencyBadge urgency={match.request.urgency} />
                      <span className="font-medium">
                        {formatBloodGroup(match.request.bloodGroup)} · {match.request.units} unit(s) ·{' '}
                        {match.request.city}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAccept(match.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(match.id)}
                        className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-6 font-medium text-gray-800">
              Accepted requests ({acceptedMatches.length})
            </h3>
            {acceptedMatches.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">None yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {acceptedMatches.map((match) => (
                  <li key={match.id} className="p-3 border rounded bg-white">
                    {formatBloodGroup(match.request.bloodGroup)} · {match.request.city} ·{' '}
                    <StatusBadge status={match.request.status} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Recipient section */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Your blood requests</h2>
          <Link
            to="/requests/new"
            className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-red-700"
          >
            + New Request
          </Link>
        </div>

        {myRequests.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">You haven't created any requests yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {myRequests.map((request) => (
              <li
                key={request.id}
                className={`p-3 border rounded bg-white flex items-center justify-between flex-wrap gap-2 ${
                  request.urgency === 'EMERGENCY' ? 'border-red-400' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <UrgencyBadge urgency={request.urgency} />
                  <span className="font-medium">
                    {formatBloodGroup(request.bloodGroup)} · {request.units} unit(s) · {request.city}
                  </span>
                  <StatusBadge status={request.status} />
                </div>
                <Link
                  to={`/requests/${request.id}`}
                  className="text-red-600 text-sm font-medium hover:underline"
                >
                  View details →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default Dashboard
