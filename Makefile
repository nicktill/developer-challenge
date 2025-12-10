.PHONY: help compile deploy start-backend start-frontend stop clean test status rebuild

help:
	@echo "Available commands:"
	@echo "  compile        - Compile contracts"
	@echo "  deploy         - Deploy contracts to FireFly"
	@echo "  start-backend  - Start backend server"
	@echo "  start-frontend - Start frontend dev server"
	@echo "  stop           - Stop all processes"
	@echo "  clean          - Clean build artifacts"
	@echo "  test           - Quick API tests"
	@echo "  status         - Show config and process status"
	@echo "  rebuild        - Clean, compile, and deploy"

compile:
	@echo "🔨 Compiling contracts..."
	@cd solidity && npx hardhat compile

deploy:
	@echo "🏗️ Deploying contract(s) to FireFly..."
	@cd solidity && npx hardhat run scripts/deploy.ts --network firefly > /tmp/deploy_output.txt
	@cat /tmp/deploy_output.txt
	@echo ""
	@echo "⚠️ Update `backend/src/config.json` with addresses above and bump VERSION"

start-backend:
	@echo "Stopping existing backend on port 3001 (if any)..."
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@sleep 1
	@cd backend && npm start

start-frontend:
	@echo "Stopping existing frontend on port 4000 (if any)..."
	@lsof -ti:4000 | xargs kill -9 2>/dev/null || true
	@sleep 1
	@cd frontend && npm run start

stop:
	@echo "Stopping backend and frontend..."
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "Backend not running"
	@lsof -ti:4000 | xargs kill -9 2>/dev/null || echo "Frontend not running"

clean:
	@rm -rf solidity/artifacts solidity/cache backend/build frontend/dist

test:
	@echo "Testing user registration..."
	@curl -s -X POST http://localhost:3001/api/user/register \
		-H "Content-Type: application/json" \
		-d '{"userId": "member0", "name": "Peter", "email": "peter@test.com", "department": "Engineering"}' | jq '.'
	@sleep 1
	@echo "\nTesting asset creation..."
	@curl -s -X POST http://localhost:3001/api/asset/register \
		-H "Content-Type: application/json" \
		-d '{"userId": "member0", "description": "Test Laptop", "category": "Computer", "location": "Office"}' | jq '.'

status:
	@echo "Config:"
	@cat backend/src/config.json | grep -E 'VERSION|ASSET_LIBRARY_ADDRESS' | sed 's/^/  /'
	@echo "\nProcesses:"
	@lsof -ti:3001 >/dev/null 2>&1 && echo "  Backend: running" || echo "  Backend: not running"
	@lsof -ti:4000 >/dev/null 2>&1 && echo "  Frontend: running" || echo "  Frontend: not running"
	@echo "\nGit:"
	@git status --short | head -5

rebuild: clean compile deploy
	@echo "\n✅ Rebuild completed successfully! Update config.json and run: make start-backend"
