# CodebaseGit

AI-powered codebase understanding tool. Paste a GitHub URL — it clones the repo, summarizes every file using an LLM, builds a semantic search index, maps dependencies, and lets you ask questions about the code in plain English.

---

## What it actually does

1. **Clones** the GitHub repo (shallow clone, depth=1) into `data/repos/`
2. **Walks** the file tree, skips `node_modules`, `.git`, `__pycache__`, build folders, binaries, and anything over 50KB
3. **Summarizes** each code file via LLM — extracts purpose, key components, design patterns, dependencies, and domain (auth/api/database/ui/etc.)
4. **Embeds** those summaries into a ChromaDB vector store using `all-MiniLM-L6-v2` (sentence-transformers)
5. **Parses imports** — Python via AST, JS/TS/Java/Go via regex — and builds a NetworkX directed graph of file dependencies
6. **Generates** a high-level architecture summary: project type, layers, modules, tech stack, data flow — all via LLM
7. **Answers questions** using RAG: your question → embed → ChromaDB search → top-6 relevant files → LLM answer with file citations

Everything (summaries, graph, architecture) is cached to disk as JSON so re-opening the same repo doesn't re-call the LLM.

---

## Stack

| Layer | What's used |
|---|---|
| Backend | FastAPI + uvicorn |
| LLM | Anthropic Claude (default), Groq, or OpenAI — switchable via `.env` |
| Embeddings | `sentence-transformers` — `all-MiniLM-L6-v2` model |
| Vector DB | ChromaDB (persistent, local) |
| Dependency graph | NetworkX DiGraph |
| Git cloning | GitPython |
| Frontend | React 18 + Vite |
| Graph visualization | D3.js force-directed layout |
| Cache | Plain JSON files in `data/graphs/` |

---

## Project layout

```
codebasegit/
├── backend/
│   ├── __init__.py
│   ├── main.py                 # All FastAPI routes + background pipeline
│   ├── core/
│   │   ├── __init__.py
│   │   ├── architecture.py     # generate_architecture_summary()
│   │   ├── dependency_graph.py # build_dependency_graph() — AST + regex parsers
│   │   ├── embeddings.py       # build_embeddings(), search_codebase()
│   │   ├── file_summarizer.py  # summarize_all_files(), call_llm()
│   │   ├── qa_engine.py        # answer_question() — RAG pipeline
│   │   └── repo_cloner.py      # clone_repo(), extract_structure()
│   └── utils/
│       ├── __init__.py
│       ├── cache.py            # load_cache(), save_cache() — JSON files
│       └── file_utils.py       # extension→language map, is_code_file()
│
├── data/                       # created at runtime, gitignored
│   ├── embeddings/             # ChromaDB stores: {repo_id}/
│   ├── graphs/                 # JSON cache files
│   └── repos/                  # cloned repos: {repo_id}_{name}/
│
├── frontend/
│   └── src/
│       ├── App.jsx             # useState(currentRepo) — shows Home or Analysis
│       ├── index.css           # CSS variables design system
│       ├── main.jsx            # ReactDOM.createRoot entry point
│       ├── components/
│       │   ├── ArchitectureView.jsx
│       │   ├── FileSummaries.jsx  # search + domain filter
│       │   ├── GraphView.jsx      # D3 force graph — zoom, drag, click
│       │   └── QAChat.jsx         # chat UI, suggested questions
│       ├── pages/
│       │   ├── AnalysisPage.jsx   # 4-tab view, loads all data on mount
│       │   └── HomePage.jsx       # URL input, polls /api/status every 1.5s
│       └── utils/
│           └── api.js             # all fetch() calls in one place
│
├── .env
├── .env.example
├── .gitignore
├── .python-version
├── requirements.txt
├── runtime.txt                 # python-3.11.10
└── start.sh
```

---

## Setup

**Requirements:** Python 3.11+, Node.js 18+, Git in PATH, one LLM API key

### 1. Install Python deps

```bash
pip install -r requirements.txt
```

First run will also download the `all-MiniLM-L6-v2` model (~80MB) automatically via sentence-transformers.

### 2. Install frontend deps

```bash
cd frontend
npm install
```

### 3. Configure `.env`

```bash
cp .env.example .env
```

```env
# Pick ONE provider
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Or Groq (faster, cheaper)
# LLM_PROVIDER=groq
# GROQ_API_KEY=gsk_...

# Or OpenAI
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...

# Tune these if repos are too large/slow
MAX_FILES_TO_SUMMARIZE=80
MAX_FILE_SIZE_KB=50
```

### 4. Create data dirs

```bash
mkdir -p data/repos data/embeddings data/graphs
```

### 5. Start

**Terminal 1 — backend:**
```bash
uvicorn backend.main:app --reload --port 8000
```

Wait for `Application startup complete.` before proceeding — sentence-transformers takes ~8–10s to load on first run.

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173

> **Windows note:** If you get `ECONNREFUSED` in the Vite console, check `frontend/vite.config.js` — the proxy target must be `http://127.0.0.1:8000`, not `http://localhost:8000`. On Windows, `localhost` sometimes resolves to IPv6 (`::1`) while uvicorn binds to IPv4 (`127.0.0.1`).

Or use `start.sh` on Linux/macOS to start both in one command.

---

## How the analysis pipeline runs

`POST /api/analyze` kicks off a FastAPI `BackgroundTask`. Progress is tracked in an in-memory dict `_progress` and polled by the frontend every 1.5 seconds via `GET /api/status/{repo_id}`.

```
Step 1  — clone_repo()              →  5%
Step 2  — extract_structure()       → 15%
Step 3  — summarize_all_files()     → 15–60%   (one LLM call per file)
Step 4  — build_embeddings()        → 65%
Step 5  — build_dependency_graph()  → 75%
Step 6  — generate_architecture_summary() → 88%
Done                                → 100%
```

Each step's output is cached to disk. If you re-submit the same GitHub URL, steps 3/5/6 are skipped entirely (served from cache). The repo itself is also reused if already cloned.

To force a full re-analysis:

```json
POST /api/analyze
{ "github_url": "...", "force_refresh": true }
```

---

## API endpoints

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/analyze` | Start pipeline, returns `repo_id` immediately |
| `GET` | `/api/status/{repo_id}` | Poll progress — `{status, step, progress, current_file}` |
| `GET` | `/api/architecture/{repo_id}` | Architecture JSON from cache |
| `GET` | `/api/graph/{repo_id}` | Dependency graph `{nodes, edges, stats}` |
| `GET` | `/api/summaries/{repo_id}` | All file summaries |
| `GET` | `/api/structure/{repo_id}` | Raw file tree |
| `GET` | `/api/suggested-questions/{repo_id}` | LLM-generated starter Q&A prompts |
| `POST` | `/api/ask` | RAG answer — `{repo_id, question}` → `{answer, sources, confidence}` |
| `DELETE` | `/api/repo/{repo_id}` | Wipe cache + embeddings + cloned repo |

Full Swagger UI at http://localhost:8000/docs

---

## LLM provider details

The provider is selected at startup from `LLM_PROVIDER` in `.env`. The client is created fresh per request in `get_llm_client()` — no global singleton.

| Provider | Model used | Notes |
|---|---|---|
| `anthropic` | `claude-sonnet-4-20250514` | Default. Best summary quality. |
| `groq` | `llama-3.3-70b-versatile` | Much faster for bulk file summarization. |
| `openai` | `gpt-4o-mini` | Good fallback. |

All three share the same `call_llm()` interface in `file_summarizer.py`. Anthropic uses `client.messages.create()`; Groq and OpenAI use the shared `client.chat.completions.create()` interface.

---

## Caching details

| Data | Cache location | Key format |
|---|---|---|
| File summaries | `data/graphs/summaries_{repo_id}.json` | Built in step 3 |
| Dependency graph | `data/graphs/graph_{repo_id}.json` | Built in step 5 |
| Architecture | `data/graphs/architecture_{repo_id}.json` | Built in step 6 |
| Vector embeddings | `data/embeddings/{repo_id}/` | ChromaDB PersistentClient |
| Cloned repo | `data/repos/{repo_id}_{repo_name}/` | Reused if folder exists |

`repo_id` = first 10 chars of `md5(github_url)`. Same URL always maps to the same ID.

`clear_repo_cache()` in `cache.py` deletes the three JSON files. `DELETE /api/repo/{repo_id}` also wipes the ChromaDB store and the cloned repo folder.

---

## Import parsing — what works and what doesn't

The dependency graph only shows edges when an import can be resolved to an actual file in the repo. External packages (`import fastapi`, `import numpy`) are parsed but not linked — they won't appear as nodes in the graph.

| Language | Method | Relative imports |
|---|---|---|
| Python | `ast.parse()` — reliable, handles edge cases | `from .module import x` detected |
| JavaScript / TypeScript | Regex on `import ... from '...'` and `require(...)` | Resolved via path candidates |
| Java | Regex on `import com.example...;` | Not resolved (package-based) |
| Go | Regex on import blocks | Not resolved |

Files not in the above list are summarized by the LLM but have no edges in the graph.

---

## Known limitations

- **Progress tracking is in-memory.** Restarting the backend while an analysis is running loses the progress state. The cache files are still written though — re-submitting the URL will pick up from where it left off (cached steps are skipped).
- **No auth, no multi-user isolation.** All repos and caches are shared on the same filesystem. Not suitable for production multi-tenant use as-is.
- **Private repos not supported.** `git.Repo.clone_from()` has no auth token support wired up. Only public GitHub repos work.
- **Max 80 files by default.** Larger repos are silently truncated. Change `MAX_FILES_TO_SUMMARIZE` in `.env`.
- **Sentence-transformers model downloads on first run.** Requires internet access on startup if model isn't cached locally.

---

## Troubleshooting

**Backend starts but frontend gets ECONNREFUSED**
→ Wait for `Application startup complete.` — TF/sentence-transformers slow down startup.
→ On Windows: use `127.0.0.1` not `localhost` in `vite.config.js` proxy target.

**`No code files found` error**
→ The repo might only have files that exceed `MAX_FILE_SIZE_KB` or use unlisted extensions. Check your `.env`.

**Analysis is slow (taking 5+ minutes)**
→ Switch to `LLM_PROVIDER=groq` — Llama 3.3 70B on Groq is significantly faster for bulk summarization than Claude.
→ Or lower `MAX_FILES_TO_SUMMARIZE=30` in `.env`.

**ChromaDB crashes on Windows**
→ Upgrade: `pip install chromadb --upgrade`. Python 3.11+ required.

**`ANTHROPIC_API_KEY not set` error**
→ `.env` must be in the project root (same folder as `backend/`), not inside `backend/`.
