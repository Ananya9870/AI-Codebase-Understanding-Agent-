"""
repo_cloner.py
Handles cloning a GitHub repo and extracting its file/folder structure.
"""

import os
import shutil
import hashlib
from pathlib import Path
from typing import Optional
import git
from backend.utils.file_utils import is_code_file, get_language, get_file_size_kb

# Folders/files we always skip
IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", ".nuxt", "coverage", ".pytest_cache",
    ".mypy_cache", ".tox", "vendor", "target", ".idea", ".vscode",
}

IGNORE_EXTENSIONS = {".pyc", ".pyo", ".class", ".o", ".so", ".dll",
                     ".exe", ".bin", ".jpg", ".jpeg", ".png", ".gif",
                     ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot",
                     ".mp4", ".mp3", ".zip", ".tar", ".gz", ".lock"}


def get_repo_id(github_url: str) -> str:
    """Generate a stable short ID from the GitHub URL."""
    return hashlib.md5(github_url.encode()).hexdigest()[:10]


def clone_repo(github_url: str, repos_dir: str) -> dict:
    """
    Clone a GitHub repository into repos_dir.
    Returns metadata dict with local path and basic info.
    """
    repo_id = get_repo_id(github_url)
    repo_name = github_url.rstrip("/").split("/")[-1].replace(".git", "")
    local_path = Path(repos_dir) / f"{repo_id}_{repo_name}"

    # Already cloned? Just use existing
    if local_path.exists():
        return {
            "repo_id": repo_id,
            "repo_name": repo_name,
            "local_path": str(local_path),
            "github_url": github_url,
            "already_cached": True,
        }

    # Clone
    os.makedirs(repos_dir, exist_ok=True)
    try:
        git.Repo.clone_from(github_url, str(local_path), depth=1)
    except git.exc.GitCommandError as e:
        raise ValueError(f"Failed to clone repo: {e}")

    return {
        "repo_id": repo_id,
        "repo_name": repo_name,
        "local_path": str(local_path),
        "github_url": github_url,
        "already_cached": False,
    }


def extract_structure(local_path: str, max_file_size_kb: int = 50) -> dict:
    """
    Walk the repo and build a structured representation:
    - Folder hierarchy
    - List of parseable code files with metadata
    Returns a dict ready for JSON serialization.
    """
    root = Path(local_path)
    tree = {}
    files = []

    for dirpath, dirnames, filenames in os.walk(root):
        # Prune ignored directories in-place (affects os.walk traversal)
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith(".")]

        rel_dir = Path(dirpath).relative_to(root)
        folder_key = str(rel_dir) if str(rel_dir) != "." else "/"

        folder_files = []
        for fname in filenames:
            fpath = Path(dirpath) / fname
            ext = fpath.suffix.lower()

            if ext in IGNORE_EXTENSIONS:
                continue

            rel_file_path = str(fpath.relative_to(root))
            size_kb = get_file_size_kb(str(fpath))

            file_entry = {
                "path": rel_file_path,
                "name": fname,
                "extension": ext,
                "language": get_language(fname),
                "size_kb": round(size_kb, 2),
                "is_code": is_code_file(fname),
                "skipped": size_kb > max_file_size_kb,
            }
            folder_files.append(fname)
            files.append(file_entry)

        tree[folder_key] = folder_files

    # Stats
    code_files = [f for f in files if f["is_code"] and not f["skipped"]]
    languages = {}
    for f in code_files:
        lang = f["language"]
        languages[lang] = languages.get(lang, 0) + 1

    return {
        "tree": tree,
        "files": files,
        "code_files": code_files,
        "stats": {
            "total_files": len(files),
            "code_files": len(code_files),
            "languages": languages,
        },
    }


def read_file_content(local_path: str, relative_path: str) -> Optional[str]:
    """Read a file's content safely, returning None on error."""
    full_path = Path(local_path) / relative_path
    try:
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        return None


def delete_repo(local_path: str):
    """Remove a cloned repo to free disk space."""
    if Path(local_path).exists():
        shutil.rmtree(local_path)