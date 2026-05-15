@echo off
cd K:\Projects\DOTSLASH_9
git add .gitignore README.md
git commit -m "chore: add project setup files"
git add backend/
git commit -m "feat(backend): add Express server with WebSocket support"
git add frontend/
git commit -m "feat(frontend): add Next.js React frontend"
git add tests/
git commit -m "test: add test suites for rules, parser, and ML"
git add cli/
git commit -m "feat(cli): add pre-commit CLI tool"
git add docs/
git commit -m "docs: add comprehensive documentation"
git add docker-compose.yml
git commit -m "chore: add Docker Compose configuration"