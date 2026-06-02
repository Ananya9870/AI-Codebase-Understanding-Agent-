import { useState } from 'react'
import HomePage from './pages/HomePage.jsx'
import AnalysisPage from './pages/AnalysisPage.jsx'

export default function App() {
  const [currentRepo, setCurrentRepo] = useState(null)

  return currentRepo
    ? <AnalysisPage repo={currentRepo} onBack={() => setCurrentRepo(null)} />
    : <HomePage onRepoReady={setCurrentRepo} />
}