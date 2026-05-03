#!/bin/bash
# Start both PocketBase and Vite dev server.
# Usage: ./dev.sh
#
# Loads backend/.env (if present) so secrets like GEMINI_API_KEY reach the
# pocketbase JS hook runtime via $os.getenv(...). See backend/.env.example.

trap 'kill 0' EXIT

if [ -f backend/.env ]; then
  echo "Loading backend/.env"
  set -a
  # shellcheck disable=SC1091
  . backend/.env
  set +a
fi

# Best-effort Ollama health check. The lecture-pipeline LLM calls go to
# http://localhost:11434/v1 by default; failing fast with a clear hint here
# beats a confusing UI error after the user records their first lecture.
OLLAMA_URL="${OLLAMA_HOST:-http://localhost:11434}"
if ! curl -fsS -m 2 "$OLLAMA_URL/api/version" >/dev/null 2>&1; then
  echo
  echo "WARNING: Ollama is not reachable at $OLLAMA_URL."
  echo "  - Lecture transcript cleanup, notes, flashcards, and quiz generation will fail."
  echo "  - Install: https://ollama.com/download   then start: ollama serve"
  echo "  - Or run ./setup.sh for a full prerequisite check."
  echo
fi

echo "Starting PocketBase on :8090..."
(cd backend && ./pocketbase serve) &

echo "Starting Vite on :3000..."
(cd frontend && npm run dev) &

wait
