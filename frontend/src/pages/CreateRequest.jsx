import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createRequest } from '../api/requests'
import { BLOOD_GROUPS, formatBloodGroup } from '../utils/formatters'

const URGENCY_LEVELS = ['NORMAL', 'URGENT', 'EMERGENCY']

function CreateRequest() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    bloodGroup: '',
    units: 1,
    city: '',
    urgency: 'NORMAL',
    description: '',
    requiredBy: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm({ ...form, [name]: name === 'units' ? Number(value) : value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await createRequest(
        { ...form, requiredBy: form.requiredBy || undefined },
        token,
      )
      navigate(`/requests/${data.request.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Create Blood Request</h1>
      <p className="mt-1 text-sm text-gray-600">
        This connects you with matching donors. Final compatibility must still be verified by
        a medical professional.
      </p>

      {error && (
        <div className="mt-4 bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Blood group needed</label>
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
          <label className="block text-sm font-medium text-gray-700">Units needed</label>
          <input
            type="number"
            name="units"
            min={1}
            value={form.units}
            onChange={handleChange}
            required
            className="mt-1 w-full border rounded px-3 py-2"
          />
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

        <div>
          <label className="block text-sm font-medium text-gray-700">Urgency</label>
          <select
            name="urgency"
            value={form.urgency}
            onChange={handleChange}
            className="mt-1 w-full border rounded px-3 py-2"
          >
            {URGENCY_LEVELS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Required by <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="datetime-local"
            name="requiredBy"
            value={form.requiredBy}
            onChange={handleChange}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-red-600 text-white py-2 rounded font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Request'}
        </button>
      </form>
    </div>
  )
}

export default CreateRequest
