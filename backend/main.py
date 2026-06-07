"""
main.py
FastAPI application entry point.
All routes are defined here; core logic lives in backend/core/.
"""

import os
import anthropic
from pathlib import Path
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import Optional
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware

# Load env
load_dotenv()

from backend.core.repo_cloner import clone_repo, extract_structure
from backend.core.file_summarizer import summarize_all_files
from backend.core.embeddings import build_embeddings, search_codebase
from backend.core.dependency_graph import build_dependency_graph
from backend.core.architecture import generate_architecture_summary
from backend.core.qa_engine import answer_question, get_suggested_questions
from backend.utils.cache import clear_repo_cache

# ── Config ─────────────────────────────────────────────────────────────────
REPOS_DIR = os.getenv("REPOS_DIR", "./data/repos")
EMBEDDINGS_DIR = os.getenv("EMBEDDINGS_DIR", "./data/embeddings")
GRAPHS_DIR = os.getenv("GRAPHS_DIR", "./data/graphs")
MAX_FILES = int(os.getenv("MAX_FILES_TO_SUMMARIZE", "80"))
MAX_FILE_SIZE_KB = int(os.getenv("MAX_FILE_SIZE_KB", "50"))

# LLM client
# LLM client — supports Anthropic, Groq, OpenAI
def get_llm_client():
    provider = os.getenv("LLM_PROVIDER", "anthropic").lower()

    if provider == "groq":
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY not set in .env")
        return Groq(api_key=api_key)

    elif provider == "openai":
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set in .env")
        return OpenAI(api_key=api_key)

    else:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set in .env")
        return anthropic.Anthropic(api_key=api_key)

# ── Ensure data directories exist (important on Render /tmp) ────────────────
for _dir in [REPOS_DIR, EMBEDDINGS_DIR, GRAPHS_DIR]:
    os.makedirs(_dir, exist_ok=True)

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CodebaseGit API",
    description="AI-powered codebase understanding agent",
    version="1.0.0",
)

@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    from fastapi.responses import Response
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory progress tracking (production: use Redis)
_progress: dict = {}


# ── Request models ──────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    github_url: str
    force_refresh: bool = False


class QuestionRequest(BaseModel):
    repo_id: str
    question: str


# ── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "CodebaseGit API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze_repo(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Start full repo analysis pipeline (async background task).
    Returns repo_id immediately; poll /api/status/{repo_id} for progress.
    """
    from backend.core.repo_cloner import get_repo_id
    repo_id = get_repo_id(req.github_url)

    if req.force_refresh:
        clear_repo_cache(GRAPHS_DIR, repo_id)

    _progress[repo_id] = {"status": "queued", "step": "", "progress": 0}
    background_tasks.add_task(_run_analysis, req.github_url, repo_id)

    return {"repo_id": repo_id, "message": "Analysis started"}


async def _run_analysis(github_url: str, repo_id: str):
    """Full pipeline: clone → structure → summarize → embed → graph → architecture."""
    try:
        llm = get_llm_client()

        # Step 1: Clone
        _progress[repo_id] = {"status": "running", "step": "Cloning repository...", "progress": 5}
        repo_meta = clone_repo(github_url, REPOS_DIR)
        local_path = repo_meta["local_path"]

        # Step 2: Extract structure
        _progress[repo_id] = {"status": "running", "step": "Analyzing file structure...", "progress": 15}
        structure = extract_structure(local_path, MAX_FILE_SIZE_KB)
        code_files = structure["code_files"]

        if not code_files:
            _progress[repo_id] = {"status": "error", "step": "No code files found", "progress": 0}
            return

        # Step 3: Summarize files
        total = min(len(code_files), MAX_FILES)
        def on_progress(done, total, path):
            pct = 15 + int((done / total) * 45)
            _progress[repo_id] = {
                "status": "running",
                "step": f"Summarizing files... ({done}/{total})",
                "current_file": path,
                "progress": pct,
            }

        summaries = summarize_all_files(
            repo_id=repo_id,
            local_path=local_path,
            code_files=code_files,
            llm_client=llm,
            cache_dir=GRAPHS_DIR,
            max_files=MAX_FILES,
            progress_callback=on_progress,
        )

        # Step 4: Build embeddings
        _progress[repo_id] = {"status": "running", "step": "Building vector index...", "progress": 65}
        build_embeddings(repo_id, summaries, EMBEDDINGS_DIR, local_path)

        # Step 5: Dependency graph
        _progress[repo_id] = {"status": "running", "step": "Building dependency graph...", "progress": 75}
        graph = build_dependency_graph(repo_id, local_path, code_files, GRAPHS_DIR)

        # Step 6: Architecture summary
        _progress[repo_id] = {"status": "running", "step": "Generating architecture overview...", "progress": 88}
        arch = generate_architecture_summary(
            repo_id=repo_id,
            summaries=summaries,
            graph_data=graph,
            structure=structure,
            llm_client=llm,
            cache_dir=GRAPHS_DIR,
        )

        _progress[repo_id] = {
            "status": "complete",
            "step": "Analysis complete!",
            "progress": 100,
            "repo_id": repo_id,
            "repo_name": repo_meta["repo_name"],
            "stats": structure["stats"],
        }

    except Exception as e:
        _progress[repo_id] = {"status": "error", "step": str(e), "progress": 0}


@app.get("/api/status/{repo_id}")
def get_status(repo_id: str):
    """Poll analysis progress."""
    return _progress.get(repo_id, {"status": "not_found", "progress": 0})


@app.get("/api/structure/{repo_id}")
def get_structure(repo_id: str):
    """Return the file/folder tree for a repo."""
    from backend.core.repo_cloner import get_repo_id
    # Find local path from progress cache
    prog = _progress.get(repo_id, {})
    # Scan repos dir for matching folder
    for folder in Path(REPOS_DIR).iterdir():
        if folder.name.startswith(repo_id):
            structure = extract_structure(str(folder), MAX_FILE_SIZE_KB)
            return structure
    raise HTTPException(status_code=404, detail="Repo not found")


@app.get("/api/graph/{repo_id}")
def get_graph(repo_id: str):
    """Return dependency graph data (nodes + edges)."""
    from backend.utils.cache import load_cache
    data = load_cache(GRAPHS_DIR, f"graph_{repo_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Graph not built yet")
    return data


@app.get("/api/architecture/{repo_id}")
def get_architecture(repo_id: str):
    """Return the architecture summary."""
    from backend.utils.cache import load_cache
    data = load_cache(GRAPHS_DIR, f"architecture_{repo_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Architecture not analyzed yet")
    return data


@app.get("/api/summaries/{repo_id}")
def get_summaries(repo_id: str):
    """Return all file summaries."""
    from backend.utils.cache import load_cache
    data = load_cache(GRAPHS_DIR, f"summaries_{repo_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Summaries not ready")
    return {"summaries": data, "total": len(data)}


@app.post("/api/ask")
def ask_question(req: QuestionRequest):
    """Answer a developer question about the codebase."""
    llm = get_llm_client()

    # Load architecture for context
    from backend.utils.cache import load_cache
    arch = load_cache(GRAPHS_DIR, f"architecture_{req.repo_id}") or {}

    # Find local path
    local_path = None
    for folder in Path(REPOS_DIR).iterdir():
        if folder.name.startswith(req.repo_id):
            local_path = str(folder)
            break

    if not local_path:
        raise HTTPException(status_code=404, detail="Repo not found — analyze it first")

    result = answer_question(
        repo_id=req.repo_id,
        question=req.question,
        local_path=local_path,
        embeddings_dir=EMBEDDINGS_DIR,
        architecture=arch,
        llm_client=llm,
    )
    return result


@app.get("/api/suggested-questions/{repo_id}")
def suggested_questions(repo_id: str):
    """Return suggested questions based on the repo's architecture."""
    from backend.utils.cache import load_cache
    arch = load_cache(GRAPHS_DIR, f"architecture_{repo_id}") or {}
    questions = get_suggested_questions(arch)
    return {"questions": questions}


@app.delete("/api/repo/{repo_id}")
def delete_repo_data(repo_id: str):
    """Clean up all data for a repo (cache + embeddings)."""
    from backend.utils.cache import clear_repo_cache
    from backend.core.embeddings import delete_embeddings
    import shutil

    clear_repo_cache(GRAPHS_DIR, repo_id)
    delete_embeddings(repo_id, EMBEDDINGS_DIR)

    for folder in Path(REPOS_DIR).iterdir():
        if folder.name.startswith(repo_id):
            shutil.rmtree(folder)
            break

    if repo_id in _progress:
        del _progress[repo_id]

    return {"message": "Repo data deleted"}
