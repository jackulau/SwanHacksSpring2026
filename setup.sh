#!/bin/bash
# One-shot dev environment check.
#   ./setup.sh           verify everything is ready
#   ./setup.sh --pull    additionally pull the default Ollama model if missing
#
# Validates: frontend deps, backend env, Ollama running, default LLM model.
# Doesn't try to install anything that wasn't installed by the user — surfaces
# clear "do this next" guidance instead.

set -e

OK="\033[32m✓\033[0m"
WARN="\033[33m!\033[0m"
ERR="\033[31m✗\033[0m"

echo "Checking dev prerequisites…"

# 1. Node deps for the Vite frontend.
if [ ! -d frontend/node_modules ]; then
  echo -e "$ERR frontend deps missing — run: cd frontend && npm install"
  exit 1
fi
echo -e "$OK frontend/node_modules"

# 2. backend/.env (gemini-vision proxy + future secrets).
if [ ! -f backend/.env ]; then
  echo -e "$WARN backend/.env missing — copy from backend/.env.example and fill in keys"
  echo "    (the ASL Gemini Vision feature will return 503 until GEMINI_API_KEY is set)"
else
  echo -e "$OK backend/.env"
fi

# 3. Ollama daemon reachable. We don't auto-launch — on Windows the installer
# registers a tray service; on Mac/Linux the user runs `ollama serve` themselves.
OLLAMA_URL="${OLLAMA_HOST:-http://localhost:11434}"
if curl -fsS -m 2 "$OLLAMA_URL/api/version" >/dev/null 2>&1; then
  VER=$(curl -fsS "$OLLAMA_URL/api/version" | grep -oE '"version":"[^"]+"' | cut -d'"' -f4)
  echo -e "$OK Ollama reachable at $OLLAMA_URL (v$VER)"
else
  echo -e "$ERR Ollama not reachable at $OLLAMA_URL"
  echo "    Install: https://ollama.com/download   then run: ollama serve"
  echo "    (Windows: the installer registers a tray service that auto-starts.)"
  exit 1
fi

# 4. Default model present. The frontend defaults to `llama3.2` (3B) for the
# transcript-cleanup → notes/flashcards/quiz pipeline.
MODEL="${OLLAMA_MODEL:-llama3.2}"
if curl -fsS "$OLLAMA_URL/api/tags" | grep -q "\"$MODEL"; then
  echo -e "$OK model $MODEL pulled"
else
  echo -e "$WARN model $MODEL not pulled"
  if [ "$1" = "--pull" ]; then
    echo "    pulling now (this is ~2GB and will take a few minutes)…"
    ollama pull "$MODEL"
  else
    echo "    pull it with: ollama pull $MODEL   (or re-run: ./setup.sh --pull)"
    exit 1
  fi
fi

echo
echo "All set. Start the stack: ./dev.sh"
