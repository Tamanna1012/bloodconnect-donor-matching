import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-red-600 text-white px-6 py-4 flex items-center gap-6">
        <Link to="/" className="font-bold text-lg">
          BloodConnect
        </Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </div>
  )
}

export default App
