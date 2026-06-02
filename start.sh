#!/bin/bash
# start.sh — Start both backend and frontend

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "🧠 CodebaseGit — Starting up..."
echo "================================"

# Check .env
if [ ! -f ".env" ]; then
  echo "⚠  .env not found — copying from .env.example"
  cp .env.example .env
  echo "📝 Edit .env and add your ANTHROPIC_API_KEY, then re-run this script."
  exit 1
fi

# Check Python deps
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "📦 Installing Python dependencies..."
  pip install -r requirements.txt
fi

# Create data dirs
mkdir -p data/repos data/embeddings data/graphs

# Start backend
echo ""
echo "🚀 Starting FastAPI backend on http://localhost:8000"
cd "$ROOT"
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "⚡ Starting React frontend on http://localhost:5173"
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "📦 Installing Node dependencies..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait