"""
dependency_graph.py
Parses import/require statements to build a file dependency graph.
Supports Python (ast), JavaScript/TypeScript (regex), and others.
Uses NetworkX for the graph; outputs JSON for D3/pyvis visualization.
"""

import ast
import re
import json
import os
from pathlib import Path
from typing import Optional
import networkx as nx
from backend.utils.cache import load_cache, save_cache


# ── Language-specific parsers ──────────────────────────────────────────────

def extract_python_imports(content: str) -> list:
    """Use Python AST to extract all imports reliably."""
    imports = []
    try:
        tree = ast.parse(content)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module.split(".")[0])
                # Detect relative imports: from .auth import ...
                if node.level and node.level > 0:
                    imports.append(f"[relative] {node.module or ''}")
    except SyntaxError:
        pass
    return imports


def extract_js_imports(content: str) -> list:
    """Regex-based extraction for JS/TS import and require statements."""
    imports = []
    # ES6: import X from 'module' or import { X } from "module"
    es6 = re.findall(r"""import\s+.*?from\s+['"]([^'"]+)['"]""", content)
    # CommonJS: require('module')
    cjs = re.findall(r"""require\s*\(\s*['"]([^'"]+)['"]\s*\)""", content)
    imports.extend(es6 + cjs)
    return imports


def extract_java_imports(content: str) -> list:
    """Regex for Java import statements."""
    return re.findall(r"^import\s+([\w.]+);", content, re.MULTILINE)


def extract_go_imports(content: str) -> list:
    """Regex for Go import blocks."""
    single = re.findall(r'^import\s+"([^"]+)"', content, re.MULTILINE)
    block = re.findall(r'"([^"]+)"', content)
    return single + block


def get_imports(file_path: str, content: str) -> list:
    """Dispatch to the right parser based on file extension."""
    ext = Path(file_path).suffix.lower()
    if ext == ".py":
        return extract_python_imports(content)
    elif ext in {".js", ".jsx", ".ts", ".tsx", ".mjs"}:
        return extract_js_imports(content)
    elif ext == ".java":
        return extract_java_imports(content)
    elif ext == ".go":
        return extract_go_imports(content)
    else:
        return []


# ── Graph builder ──────────────────────────────────────────────────────────

def resolve_relative_import(from_file: str, import_str: str, all_files: set) -> Optional[str]:
    """
    Try to resolve a relative import like './utils/auth' to an actual file path.
    Returns matched path or None.
    """
    from_dir = str(Path(from_file).parent)
    candidates = [
        import_str,
        import_str + ".py",
        import_str + ".js",
        import_str + ".ts",
        os.path.join(from_dir, import_str),
        os.path.join(from_dir, import_str) + ".py",
        os.path.join(from_dir, import_str) + ".js",
    ]
    for c in candidates:
        normalized = c.replace("\\", "/").lstrip("./")
        for f in all_files:
            if f.replace("\\", "/").endswith(normalized):
                return f
    return None


def build_dependency_graph(
    repo_id: str,
    local_path: str,
    code_files: list,
    cache_dir: str,
) -> dict:
    """
    Build a dependency graph for the repo.
    Returns {nodes, edges, graph_json, stats} ready for serialization.
    """
    cache_key = f"graph_{repo_id}"
    cached = load_cache(cache_dir, cache_key)
    if cached:
        return cached

    G = nx.DiGraph()
    all_paths = {f["path"] for f in code_files}

    # Add all files as nodes
    for file_info in code_files:
        G.add_node(
            file_info["path"],
            language=file_info["language"],
            size_kb=file_info["size_kb"],
        )

    # Parse imports and add edges
    for file_info in code_files:
        rel_path = file_info["path"]
        full_path = Path(local_path) / rel_path
        try:
            content = full_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        imports = get_imports(rel_path, content)

        for imp in imports:
            # Try to resolve to an actual file in the repo
            resolved = resolve_relative_import(rel_path, imp, all_paths)
            if resolved and resolved != rel_path:
                G.add_edge(rel_path, resolved, import_name=imp)

    # Compute graph metrics
    nodes_data = []
    for node in G.nodes:
        attrs = G.nodes[node]
        nodes_data.append({
            "id": node,
            "language": attrs.get("language", ""),
            "size_kb": attrs.get("size_kb", 0),
            "in_degree": G.in_degree(node),   # how many files import this
            "out_degree": G.out_degree(node),  # how many files this imports
            # Nodes imported by many = likely core/shared modules
            "is_hub": G.in_degree(node) >= 3,
        })

    edges_data = [
        {"source": u, "target": v, "import": d.get("import_name", "")}
        for u, v, d in G.edges(data=True)
    ]

    # Find clusters (weakly connected components)
    components = list(nx.weakly_connected_components(G))

    result = {
        "nodes": nodes_data,
        "edges": edges_data,
        "stats": {
            "total_nodes": G.number_of_nodes(),
            "total_edges": G.number_of_edges(),
            "components": len(components),
            "most_imported": sorted(nodes_data, key=lambda x: x["in_degree"], reverse=True)[:5],
            "highest_coupling": sorted(nodes_data, key=lambda x: x["out_degree"], reverse=True)[:5],
        },
    }

    save_cache(cache_dir, f"graph_{repo_id}", result)
    return result