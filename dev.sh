#!/bin/bash
# Start both PocketBase and Next.js dev server
# Usage: ./dev.sh

trap 'kill 0' EXIT

echo "Starting PocketBase on :8090..."
cd backend && ./pocketbase serve &

echo "Starting Vite on :3000..."
cd frontend && npm run dev &

wait
