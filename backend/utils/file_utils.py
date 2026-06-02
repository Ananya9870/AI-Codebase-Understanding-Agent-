"""
file_utils.py
Helpers for file type detection, language mapping, and size checks.
"""

import os

# Map file extensions → language name
EXTENSION_LANGUAGE_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".jsx": "JavaScript (React)",
    ".tsx": "TypeScript (React)",
    ".java": "Java",
    ".kt": "Kotlin",
    ".go": "Go",
    ".rs": "Rust",
    ".cpp": "C++",
    ".cc": "C++",
    ".c": "C",
    ".h": "C/C++ Header",
    ".cs": "C#",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".scala": "Scala",
    ".r": "R",
    ".sh": "Shell",
    ".bash": "Shell",
    ".zsh": "Shell",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".json": "JSON",
    ".toml": "TOML",
    ".xml": "XML",
    ".html": "HTML",
    ".htm": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SASS",
    ".md": "Markdown",
    ".mdx": "MDX",
    ".sql": "SQL",
    ".graphql": "GraphQL",
    ".gql": "GraphQL",
    ".proto": "Protobuf",
    ".tf": "Terraform",
    ".dockerfile": "Docker",
}

CODE_EXTENSIONS = set(EXTENSION_LANGUAGE_MAP.keys())

# Files named exactly this are code/config even without extension
CODE_FILENAMES = {
    "Dockerfile", "Makefile", "Jenkinsfile", "Vagrantfile",
    ".env.example", "requirements.txt", "Pipfile", "Cargo.toml",
    "package.json", "tsconfig.json", "pyproject.toml",
}


def get_language(filename: str) -> str:
    """Return the programming language for a file."""
    name = os.path.basename(filename)
    if name in CODE_FILENAMES:
        return name
    ext = os.path.splitext(name)[1].lower()
    return EXTENSION_LANGUAGE_MAP.get(ext, "Unknown")


def is_code_file(filename: str) -> bool:
    """Return True if this file is parseable source code or config."""
    name = os.path.basename(filename)
    if name in CODE_FILENAMES:
        return True
    ext = os.path.splitext(name)[1].lower()
    return ext in CODE_EXTENSIONS


def get_file_size_kb(filepath: str) -> float:
    """Return file size in KB."""
    try:
        return os.path.getsize(filepath) / 1024
    except OSError:
        return 0.0


def truncate_content(content: str, max_chars: int = 4000) -> str:
    """Truncate file content for LLM summarization (stay within token limits)."""
    if len(content) <= max_chars:
        return content
    half = max_chars // 2
    return content[:half] + "\n\n... [TRUNCATED] ...\n\n" + content[-half:]