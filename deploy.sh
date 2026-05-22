#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_DIR="$PROJECT_DIR/worker"

check_prerequisites() {
  log "检查部署前提条件..."

  command -v node >/dev/null 2>&1 || err "需要 Node.js 18+"
  command -v npx >/dev/null 2>&1 || err "需要 npx"

  if ! npx wrangler --version >/dev/null 2>&1; then
    err "wrangler 未安装，请运行: cd worker && npm install"
  fi

  if [ ! -f "$WORKER_DIR/wrangler.toml" ]; then
    err "缺少 worker/wrangler.toml"
  fi

  if grep -q "YOUR_KV_NAMESPACE_ID" "$WORKER_DIR/wrangler.toml"; then
    warn "wrangler.toml 中的 KV Namespace ID 还是占位符"
    echo ""
    echo "  请先在 Cloudflare Dashboard 创建 KV Namespace，然后更新 wrangler.toml："
    echo "  https://dash.cloudflare.com → Workers & Pages → KV"
    echo ""
    read -rp "是否已完成 KV 配置？(y/N) " kv_done
    if [ "$kv_done" != "y" ] && [ "$kv_done" != "Y" ]; then
      err "请先配置 KV Namespace ID"
    fi
  fi

  ok "前提条件检查通过"
}

setup_secrets() {
  log "检查 Secrets 配置..."

  local has_api_key=false
  local has_webhook_secret=false

  if npx wrangler secret list 2>/dev/null | grep -q "TRACK17_API_KEY"; then
    has_api_key=true
  fi
  if npx wrangler secret list 2>/dev/null | grep -q "ERP_WEBHOOK_SECRET"; then
    has_webhook_secret=true
  fi

  if [ "$has_api_key" = false ]; then
    warn "TRACK17_API_KEY 尚未设置"
    read -rp "是否现在设置？(y/N) " set_key
    if [ "$set_key" = "y" ] || [ "$set_key" = "Y" ]; then
      npx wrangler secret put TRACK17_API_KEY
    fi
  fi

  if [ "$has_webhook_secret" = false ]; then
    warn "ERP_WEBHOOK_SECRET 尚未设置"
    read -rp "是否现在设置？(y/N) " set_secret
    if [ "$set_secret" = "y" ] || [ "$set_secret" = "Y" ]; then
      npx wrangler secret put ERP_WEBHOOK_SECRET
    fi
  fi

  ok "Secrets 检查完成"
}

deploy_worker() {
  log "部署 Cloudflare Worker..."

  cd "$WORKER_DIR"

  if [ ! -d "node_modules" ]; then
    log "安装 Worker 依赖..."
    npm install --production
  fi

  npx wrangler deploy
  ok "Worker 部署完成"
}

build_frontend() {
  log "构建前端..."

  cd "$PROJECT_DIR"

  if [ ! -d "node_modules" ]; then
    log "安装前端依赖..."
    npm install
  fi

  npm run build
  ok "前端构建完成 → dist/"
}

deploy_pages() {
  log "部署到 Cloudflare Pages..."

  cd "$PROJECT_DIR"

  local project_name="logistics-tracker"

  if [ -z "${CLOUDFLARE_PAGES_PROJECT:-}" ]; then
    CLOUDFLARE_PAGES_PROJECT="$project_name"
  fi

  npx wrangler pages deploy dist --project-name="$CLOUDFLARE_PAGES_PROJECT"
  ok "Pages 部署完成"
}

print_summary() {
  echo ""
  echo "=========================================="
  ok "部署完成！"
  echo "=========================================="
  echo ""
  echo "  🌐 前端地址:  https://logistics-tracker.pages.dev"
  echo "  🔌 API 地址:  https://logistics-tracker-api.workers.dev"
  echo "  📡 ERP Webhook: https://logistics-tracker-api.workers.dev/api/erp/orders"
  echo ""
  echo "  下一步："
  echo "  1. 在数据源管理页面填入 Worker 地址"
  echo "  2. 配置 ERP 推送到 Webhook 端点"
  echo "  3. 如需自定义域名，在 Cloudflare Dashboard 配置"
  echo ""
}

DEPLOY_WORKER=true
DEPLOY_PAGES=true
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --worker-only) DEPLOY_PAGES=false; shift ;;
    --pages-only) DEPLOY_WORKER=false; shift ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --help|-h)
      echo "用法: ./deploy.sh [选项]"
      echo ""
      echo "选项:"
      echo "  --worker-only   仅部署 Worker API"
      echo "  --pages-only    仅部署前端 Pages"
      echo "  --skip-build    跳过前端构建（使用已有 dist/）"
      echo "  -h, --help      显示帮助"
      exit 0
      ;;
    *) err "未知选项: $1" ;;
  esac
done

check_prerequisites

if [ "$DEPLOY_WORKER" = true ]; then
  cd "$WORKER_DIR"
  setup_secrets
  deploy_worker
fi

if [ "$DEPLOY_PAGES" = true ]; then
  if [ "$SKIP_BUILD" = false ]; then
    build_frontend
  fi
  deploy_pages
fi

print_summary
