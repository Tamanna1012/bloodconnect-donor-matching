import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listDonors } from '../api/donors'
import { BLOOD_GROUPS, formatBloodGroup } from '../utils/formatters'

function FindDonors() {
  const { token } = useAuth()
  const [donors, setDonors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ bloodGroup: '', city: '' })

  async function load(currentFilters) {
    setLoading(true)
    setError('')
    try {
      const data = await listDonors(
        Object.fromEntries(Object.entries(currentFilters).filter(([, v]) => v)),
        token,
      )
      setDonors(data.donors)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFilterChange(e) {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  function handleFilterSubmit(e) {
    e.preventDefault()
    load(filters)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Find Donors</h1>
      <p className="mt-1 text-sm text-gray-600">
        Browsing shows only what's needed to identify a donor — never their exact location.
      </p>

      <form onSubmit={handleFilterSubmit} className="mt-4 flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700">Blood group</label>
          <select
            name="bloodGroup"
            value={filters.bloodGroup}
            onChange={handleFilterChange}
            className="mt-1 border rounded px-3 py-2"
          >
            <option value="">Any</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {formatBloodGroup(bg)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input
            name="city"
            value={filters.city}
            onChange={handleFilterChange}
            className="mt-1 border rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700"
        >
          Filter
        </button>
      </form>

      {loading && <p className="mt-4 text-gray-500">Loading...</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {!loading && donors.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">No donors match these filters.</p>
      )}

      <ul className="mt-4 space-y-2">
        {donors.map((donor) => (
          <li
            key={donor.id}
            className="p-3 border rounded bg-white flex items-center justify-between flex-wrap gap-2"
          >
            <div>
              <span className="font-medium">{donor.donorName}</span>{' '}
              <span className="text-gray-600">
                · {formatBloodGroup(donor.bloodGroup)} · {donor.city}
              </span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                donor.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {donor.isAvailable ? 'Available' : 'Unavailable'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FindDonors
