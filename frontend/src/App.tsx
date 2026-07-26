import { Link, Route, Routes } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { DatasetDetail } from './pages/DatasetDetail'

function App() {
  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <span className="text-2xl">🛡️</span>
          <Link to="/" className="text-lg font-bold text-slate-800">
            Data Governance Dashboard
          </Link>
          <span className="ml-2 hidden text-sm text-slate-400 sm:inline">
            catalog · classification · quality · trust · value
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/datasets/:id" element={<DatasetDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
