import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="max-w-md mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="mt-6 p-4 border rounded bg-white space-y-3">
        <div>
          <span className="text-xs text-gray-500">Name</span>
          <p className="font-medium">{user.name}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">Email</span>
          <p className="font-medium">{user.email}</p>
        </div>
        {user.city && (
          <div>
            <span className="text-xs text-gray-500">City</span>
            <p className="font-medium">{user.city}</p>
          </div>
        )}
        {user.phone && (
          <div>
            <span className="text-xs text-gray-500">Phone</span>
            <p className="font-medium">{user.phone}</p>
          </div>
        )}
      </div>

      <Link
        to="/donor-profile"
        className="mt-4 block text-red-600 text-sm font-medium hover:underline"
      >
        Manage donor profile →
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-6 w-full bg-gray-200 text-gray-700 py-2 rounded font-medium hover:bg-gray-300"
      >
        Logout
      </button>
    </div>
  )
}

export default Settings
