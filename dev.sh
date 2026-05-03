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

echo "Starting PocketBase on :8090..."
(cd backend && ./pocketbase serve) &

echo "Starting Vite on :3000..."
(cd frontend && npm run dev) &

wait
