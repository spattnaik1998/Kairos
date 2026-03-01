.PHONY: dev backend frontend install docker-up docker-down help

help:
	@echo ""
	@echo "  Kairos — Macro-Aware Probabilistic Portfolio Intelligence"
	@echo ""
	@echo "  make install     Install all dependencies (backend + frontend)"
	@echo "  make backend     Run FastAPI backend (port 8000)"
	@echo "  make frontend    Run Next.js frontend (port 3000)"
	@echo "  make dev         Run both in parallel"
	@echo "  make docker-up   Launch via Docker Compose"
	@echo "  make docker-down Stop Docker containers"
	@echo ""

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting Kairos backend + frontend..."
	@make -j2 backend frontend

docker-up:
	docker compose up --build -d
	@echo "Kairos running at http://localhost:3000"

docker-down:
	docker compose down
