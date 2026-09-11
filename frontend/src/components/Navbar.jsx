import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <nav className="bg-red-600 text-white px-6 py-4 flex items-center justify-between flex-wrap gap-3">
      <Link to="/" className="font-bold text-lg">
        BloodConnect
      </Link>

      <div className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            <Link to="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link to="/requests" className="hover:underline">
              My Requests
            </Link>
            <Link to="/donors" className="hover:underline">
              Find Donors
            </Link>
            <Link to="/notifications" className="hover:underline">
              Notifications
            </Link>
            <Link to="/settings" className="hover:underline">
              Settings
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="bg-white text-red-600 px-3 py-1 rounded font-medium hover:bg-red-50"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:underline">
              Login
            </Link>
            <Link
              to="/register"
              className="bg-white text-red-600 px-3 py-1 rounded font-medium hover:bg-red-50"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar
