import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listRequests } from '../api/requests'
import { formatBloodGroup } from '../utils/formatters'
import { UrgencyBadge, StatusBadge } from '../components/Badges'

function MyRequests() {
  const { user, token } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listRequests(token)
      .then((data) => setRequests(data.requests.filter((r) => r.requesterId === user.id)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token, user.id])

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
        <Link
          to="/requests/new"
          className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-red-700"
        >
          + New Request
        </Link>
      </div>

      {loading && <p className="mt-4 text-gray-500">Loading...</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}

      {!loading && requests.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">You haven't created any requests yet.</p>
      )}

      <ul className="mt-4 space-y-2">
        {requests.map((request) => (
          <li
            key={request.id}
            className={`p-4 border rounded bg-white flex items-center justify-between flex-wrap gap-2 ${
              request.urgency === 'EMERGENCY' ? 'border-red-400' : ''
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
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
    </div>
  )
}

export default MyRequests
