import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listNotifications, markNotificationRead } from '../api/notifications'

// Notifications don't store a link back to the specific request/match
// (see README "Limitations" -- a deliberate scope decision), so clicking
// one routes generically by type: donor-facing types go to the
// Dashboard's "incoming requests" list, recipient-facing types go to
// My Requests.
const DONOR_FACING_TYPES = ['MATCH_FOUND', 'REQUEST_FULFILLED']

function Notifications() {
  const { token } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listNotifications(token)
      .then((data) => setNotifications(data.notifications))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id, token)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    } catch {
      // silently ignore -- not critical if marking-read fails
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>

      {loading && <p className="mt-4 text-gray-500">Loading...</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {!loading && notifications.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">No notifications yet.</p>
      )}

      <ul className="mt-4 space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`p-4 border rounded flex items-start justify-between gap-3 ${
              n.isRead ? 'bg-white' : 'bg-red-50 border-red-200'
            }`}
          >
            <div>
              <p className="text-sm text-gray-900">{n.message}</p>
              <p className="mt-1 text-xs text-gray-500">
                {new Date(n.createdAt).toLocaleString()}
              </p>
              <Link
                to={DONOR_FACING_TYPES.includes(n.type) ? '/dashboard' : '/requests'}
                className="mt-1 inline-block text-xs text-red-600 hover:underline"
              >
                View →
              </Link>
            </div>
            {!n.isRead && (
              <button
                type="button"
                onClick={() => handleMarkRead(n.id)}
                className="text-xs text-gray-500 hover:text-gray-800 whitespace-nowrap"
              >
                Mark read
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Notifications
