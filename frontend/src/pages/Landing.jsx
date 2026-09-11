import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Landing() {
  const { user } = useAuth()

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-center">
      <h1 className="text-4xl font-bold text-gray-900">BloodConnect</h1>
      <p className="mt-3 text-lg text-gray-600">
        Blood Donor–Recipient Matching &amp; Emergency Alert System
      </p>

      <p className="mt-6 text-gray-700 leading-relaxed">
        BloodConnect helps people who need blood find suitable donors quickly —
        matched by blood-group compatibility, availability, location, and
        urgency. It's a discovery-and-coordination tool: it does not replace
        a hospital or blood bank, and every match must still be verified by
        qualified medical professionals before any real donation.
      </p>

      <div className="mt-8 flex items-center justify-center gap-4">
        {user ? (
          <Link
            to="/dashboard"
            className="bg-red-600 text-white px-6 py-3 rounded font-medium hover:bg-red-700"
          >
            Go to Dashboard
          </Link>
        ) : (
          <>
            <Link
              to="/register"
              className="bg-red-600 text-white px-6 py-3 rounded font-medium hover:bg-red-700"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="border border-red-600 text-red-600 px-6 py-3 rounded font-medium hover:bg-red-50"
            >
              Login
            </Link>
          </>
        )}
      </div>

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
        <div className="p-4 border rounded">
          <h2 className="font-semibold text-gray-900">Deterministic matching</h2>
          <p className="mt-1 text-sm text-gray-600">
            Blood-group compatibility and donor availability are hard filters —
            no AI, no guessing, just the standard ABO/Rh rules.
          </p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold text-gray-900">Ranked by relevance</h2>
          <p className="mt-1 text-sm text-gray-600">
            Eligible donors are ranked by proximity, request urgency, and their
            own donation reliability history.
          </p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold text-gray-900">In-app notifications</h2>
          <p className="mt-1 text-sm text-gray-600">
            Donors and recipients stay updated at every step — matched,
            contacted, accepted, declined, fulfilled.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Landing
