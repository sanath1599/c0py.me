#!/bin/bash

# ShareDrop Deployment Script for c0py.me
# Usage: ./deploy-c0py.sh setup|update|restart|status

REPO_URL="https://github.com/sanath1599/sharedrop"
APP_DIR="/opt/sharedrop"
FRONTEND_DIR="$APP_DIR/apps/web"
BACKEND_DIR="$APP_DIR/apps/api"
FRONTEND_DEPLOY_DIR="/var/www/c0py.me"
BACKEND_PORT=3001

set -e

function log() { echo -e "\033[1;32m[INFO]\033[0m $1"; }
function warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
function err() { echo -e "\033[1;31m[ERROR]\033[0m $1"; }

function ensure_pnpm() {
  if ! command -v pnpm &> /dev/null; then
    log "Installing pnpm..."
    sudo npm install -g pnpm
  fi
}

function clone_repo() {
  if [ -f "$APP_DIR/package.json" ]; then
    warn "App already present. Skipping clone."
  else
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
  fi
}

function setup_envs() {
  # Backend .env
  if [ ! -f "$BACKEND_DIR/.env.prod" ]; then
    if [ -f "$BACKEND_DIR/.env.prod.example" ]; then
      cp "$BACKEND_DIR/.env.prod.example" "$BACKEND_DIR/.env.prod"
      log "Copied backend .env.prod from example. Please review secrets."
    else
      err "Missing $BACKEND_DIR/.env.prod.example"
      exit 1
    fi
  fi
  # Frontend .env
  mkdir -p "$FRONTEND_DIR"
  cat <<EOF > "$FRONTEND_DIR/.env"
REACT_APP_SIGNALING_SERVER=https://backend.c0py.me
EOF
}

function build_frontend() {
  log "Building frontend..."
  cd "$FRONTEND_DIR"
  pnpm install
  GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true pnpm build
  sudo mkdir -p "$FRONTEND_DEPLOY_DIR"
  sudo rm -rf "$FRONTEND_DEPLOY_DIR"/*
  sudo cp -r build/* "$FRONTEND_DEPLOY_DIR/"
  cd "$APP_DIR"
  log "Frontend deployed to $FRONTEND_DEPLOY_DIR"
}

function start_backend() {
  log "Installing backend dependencies..."
  cd "$BACKEND_DIR"
  pnpm install
  log "Starting backend with pm2 on port $BACKEND_PORT..."
  pm2 delete sharedrop-api || true
  pm2 start index.js --name sharedrop-api --env production -- --port $BACKEND_PORT
  pm2 save
  cd "$APP_DIR"
}

function setup() {
  log "=== Initial ShareDrop Setup ==="
  ensure_pnpm
  clone_repo
  setup_envs
  cd "$APP_DIR"
  pnpm install
  build_frontend
  start_backend
  log "=== Setup Complete ==="
  log "Frontend: https://c0py.me"
  log "Backend: https://backend.c0py.me"
  log "Check backend logs: pm2 logs sharedrop-api"
}

function update() {
  log "=== Updating ShareDrop ==="
  cd "$APP_DIR"
  git pull
  pnpm install
  build_frontend
  start_backend
  log "=== Update Complete ==="
}

function restart() {
  log "Restarting backend with pm2..."
  pm2 restart sharedrop-api || pm2 restart all
}

function status() {
  pm2 status
}

case "$1" in
  setup) setup ;;
  update) update ;;
  restart) restart ;;
  status) status ;;
  *)
    echo "Usage: $0 {setup|update|restart|status}"
    exit 1
    ;;
esac