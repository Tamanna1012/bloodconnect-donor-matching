import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function Home() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => setStatus(data.message))
      .catch(() => setStatus('backend not reachable'))
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800">
        BloodConnect
      </h1>
      <p className="text-gray-600 mt-2">
        Blood Donor–Recipient Matching &amp; Emergency Alert System
      </p>

      <div className="mt-6 p-4 border rounded bg-white shadow-sm inline-block">
        <span className="text-sm text-gray-500">Backend status: </span>
        <span className="font-mono text-sm">{status}</span>
      </div>
    </div>
  )
}

export default Home
