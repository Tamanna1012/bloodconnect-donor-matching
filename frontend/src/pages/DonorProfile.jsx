import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getMyDonorProfile, upsertDonorProfile } from '../api/donors'
import { BLOOD_GROUPS, formatBloodGroup } from '../utils/formatters'

function DonorProfile() {
  const { token } = useAuth()

  const [form, setForm] = useState({ bloodGroup: '', city: '', latitude: '', longitude: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getMyDonorProfile(token)
      .then((data) => {
        if (data.donorProfile) {
          setForm({
            bloodGroup: data.donorProfile.bloodGroup,
            city: data.donorProfile.city,
            latitude: data.donorProfile.latitude ?? '',
            longitude: data.donorProfile.longitude ?? '',
          })
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      await upsertDonorProfile(
        {
          bloodGroup: form.bloodGroup,
          city: form.city,
          latitude: form.latitude === '' ? null : Number(form.latitude),
          longitude: form.longitude === '' ? null : Number(form.longitude),
        },
        token,
      )
      setSuccess('Donor profile saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Donor Profile</h1>
      <p className="mt-1 text-sm text-gray-600">
        Set your blood group and location so recipients can find you.
      </p>

      {error && (
        <div className="mt-4 bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{error}</div>
      )}
      {success && (
        <div className="mt-4 bg-green-50 text-green-700 text-sm px-3 py-2 rounded">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Blood group</label>
          <select
            name="bloodGroup"
            value={form.bloodGroup}
            onChange={handleChange}
            required
            className="mt-1 w-full border rounded px-3 py-2"
          >
            <option value="" disabled>
              Select blood group
            </option>
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
            value={form.city}
            onChange={handleChange}
            required
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Latitude <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="number"
              step="any"
              name="latitude"
              value={form.latitude}
              onChange={handleChange}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Longitude <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="number"
              step="any"
              name="longitude"
              value={form.longitude}
              onChange={handleChange}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Coordinates improve matching accuracy but are never shown publicly — only used
          internally to calculate distance.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-red-600 text-white py-2 rounded font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  )
}

export default DonorProfile
