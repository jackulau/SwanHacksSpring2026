.PHONY: dev backend frontend setup

dev: backend frontend

backend:
	cd backend && ./pocketbase serve &

frontend:
	cd frontend && npm run dev

setup:
	cd frontend && npm install
