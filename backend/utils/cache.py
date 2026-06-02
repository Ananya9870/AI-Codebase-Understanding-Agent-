"""
cache.py
Simple JSON file cache to avoid re-running expensive LLM calls.
Cache lives in /data/graphs/ (or any specified dir) as JSON files.
"""

import json
import os
from pathlib import Path
from typing import Optional, Any


def _cache_path(cache_dir: str, key: str) -> Path:
    safe_key = key.replace("/", "_").replace("\\", "_")
    return Path(cache_dir) / f"{safe_key}.json"


def load_cache(cache_dir: str, key: str) -> Optional[Any]:
    """Load cached data, return None if not found."""
    path = _cache_path(cache_dir, key)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def save_cache(cache_dir: str, key: str, data: Any):
    """Persist data to cache."""
    os.makedirs(cache_dir, exist_ok=True)
    path = _cache_path(cache_dir, key)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def delete_cache(cache_dir: str, key: str):
    """Remove a cached entry."""
    path = _cache_path(cache_dir, key)
    if path.exists():
        os.remove(path)


def clear_repo_cache(cache_dir: str, repo_id: str):
    """Remove all cached data for a specific repo."""
    for prefix in ["summaries_", "graph_", "architecture_"]:
        delete_cache(cache_dir, f"{prefix}{repo_id}")