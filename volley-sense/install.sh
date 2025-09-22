#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WEB_DIR="$ROOT_DIR/apps/web"
API_DIR="$ROOT_DIR/apps/api"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '\033[36m[INFO]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[WARN]\033[0m %s\n' "$1"; }
error() { printf '\033[31m[ERROR]\033[0m %s\n' "$1"; }

ask_yes_no() {
  local prompt="$1"
  local default="$2"
  local reply
  while true; do
    read -rp "$prompt [y/n] (default: $default): " reply
    reply=${reply:-$default}
    case "$reply" in
      [Yy]) return 0 ;;
      [Nn]) return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

ensure_command() {
  local cmd="$1"
  local install_hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    warn "Missing dependency: $cmd"
    if ask_yes_no "Attempt to install $cmd now?" "y"; then
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y $install_hint
      else
        error "Automatic install not supported on this distro. Install $cmd manually and re-run."
        exit 1
      fi
    else
      error "$cmd is required. Install it manually and re-run this installer."
      exit 1
    fi
  fi
}

bold "VolleySense automated setup"
info "Project root: $ROOT_DIR"

ensure_command docker docker.io
if ! docker info >/dev/null 2>&1; then
  warn "Docker daemon not running. Start Docker Desktop or the docker service."
fi

if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  warn "docker-compose plugin not detected."
  if ask_yes_no "Install docker-compose plugin?" "y"; then
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update
      sudo apt-get install -y docker-compose-plugin
    else
      error "Unable to install docker-compose automatically."
    fi
  fi
fi

ensure_command node nodejs
ensure_command npm npm
ensure_command python3 python3
ensure_command pip3 python3-pip

if ask_yes_no "Install front-end dependencies with npm install?" "y"; then
  info "Installing web dependencies..."
  (cd "$WEB_DIR" && npm install)
fi

if ask_yes_no "Create Python virtual environment for the API?" "y"; then
  python3 -m venv "$API_DIR/.venv"
  # shellcheck source=/dev/null
  source "$API_DIR/.venv/bin/activate"
  pip install --upgrade pip
  pip install -e "$API_DIR"[dev]
else
  pip3 install -e "$API_DIR"[dev]
fi

if ask_yes_no "Run unit tests now?" "y"; then
  info "Running web unit tests via vitest"
  (cd "$WEB_DIR" && npm run test -- --run)
  info "Running API tests via pytest"
  (cd "$API_DIR" && pytest)
fi

if ask_yes_no "Generate optimized web build?" "n"; then
  (cd "$WEB_DIR" && npm run build)
fi

if ask_yes_no "Build and launch with docker-compose up --build?" "n"; then
  (cd "$ROOT_DIR" && docker-compose up --build)
fi

bold "Setup complete"
info "To start manually:"
printf '  1. Start API: cd %s && source .venv/bin/activate && uvicorn app.main:app --reload\n' "$API_DIR"
printf '  2. Start web: cd %s && npm run dev\n' "$WEB_DIR"
printf '  3. Or use docker-compose up --build from %s\n' "$ROOT_DIR"

info "Troubleshooting tips:"
printf '  - If docker build fails, ensure Docker daemon is running and you have permissions (try sudo usermod -aG docker $USER).\n'
printf '  - Node install errors? Clear npm cache (npm cache clean --force) and delete node_modules before retrying.\n'
printf '  - Python install issues? Remove %s/.venv and rerun the installer.\n' "$API_DIR"
