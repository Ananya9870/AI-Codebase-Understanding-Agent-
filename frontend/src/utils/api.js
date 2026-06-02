// api.js — centralized API calls to the FastAPI backend

const BASE = '/api'

export async function analyzeRepo(githubUrl, forceRefresh = false) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_url: githubUrl, force_refresh: forceRefresh }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function pollStatus(repoId) {
  const res = await fetch(`${BASE}/status/${repoId}`)
  return res.json()
}

export async function getStructure(repoId) {
  const res = await fetch(`${BASE}/structure/${repoId}`)
  if (!res.ok) throw new Error('Structure not available')
  return res.json()
}

export async function getGraph(repoId) {
  const res = await fetch(`${BASE}/graph/${repoId}`)
  if (!res.ok) throw new Error('Graph not available')
  return res.json()
}

export async function getArchitecture(repoId) {
  const res = await fetch(`${BASE}/architecture/${repoId}`)
  if (!res.ok) throw new Error('Architecture not ready')
  return res.json()
}

export async function getSummaries(repoId) {
  const res = await fetch(`${BASE}/summaries/${repoId}`)
  if (!res.ok) throw new Error('Summaries not ready')
  return res.json()
}

export async function askQuestion(repoId, question) {
  const res = await fetch(`${BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_id: repoId, question }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getSuggestedQuestions(repoId) {
  const res = await fetch(`${BASE}/suggested-questions/${repoId}`)
  if (!res.ok) return { questions: [] }
  return res.json()
}

export async function deleteRepo(repoId) {
  const res = await fetch(`${BASE}/repo/${repoId}`, { method: 'DELETE' })
  return res.json()
}