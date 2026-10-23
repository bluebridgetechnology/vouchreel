#!/usr/bin/env bash
#
# Vouchreel one-shot VPS installer.
#
# Two ways to run it:
#
#   1. From your own computer, which packages this checkout, uploads it and installs it on the server:
#        bash deploy/install.sh root@203.0.113.10
#        (extra ssh options: SSH_OPTS="-p 2222 -i ~/.ssh/key" bash deploy/install.sh user@host)
#
#   2. On the server itself (a fresh Ubuntu 22.04+ or Debian 12+ box, as root or with sudo):
#        sudo bash deploy/install.sh
#
# It asks for one thing, the domain name, and sets up the rest: Docker, firewall, fail2ban, automatic security
# updates, swap, the database, storage (MinIO), the app and its workers, HTTPS (Caddy + Let's Encrypt), generated
# secrets in .env.production, daily database backups and a `vouchreel` command for day-to-day use.
#
# Before running it, point the domain's DNS (an A record) at the server's IP address. Safe to run again: it keeps
# the existing secrets and rebuilds and restarts with the new code, so it doubles as the update command.
#
# Non-interactive: DOMAIN=app.example.com bash deploy/install.sh [user@host]
set -Eeuo pipefail

INSTALL_DIR=/opt/vouchreel
PROJECT=vouchreel
MIN_COMPOSE=2.24.0

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=''; DIM=''; RED=''; GREEN=''; YELLOW=''; RESET=''
fi
step() { printf '\n%s==>%s %s%s%s\n' "$GREEN" "$RESET" "$BOLD" "$*" "$RESET"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '%s    ! %s%s\n' "$YELLOW" "$*" "$RESET" >&2; }
die() { printf '\n%sError:%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }
trap 'die "stopped at line $LINENO. Fix the problem above and run the script again (it is safe to re-run)."' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(dirname "$SCRIPT_DIR")"

ask_domain() {
  local answer
  while true; do
    read -r -p "Domain name for Vouchreel (for example app.example.com): " answer </dev/tty
    answer="$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#/.*$##; s/[[:space:]]//g')"
    if valid_domain "$answer"; then DOMAIN="$answer"; return; fi
    warn "\"$answer\" does not look like a domain name. Use something like app.example.com (no https://, no path)."
  done
}

valid_domain() {
  [[ "$1" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$ ]]
}

# ---------------------------------------------------------------------------------------------------------------------
# Mode 1: run from a computer, package the project and install it over ssh
# ---------------------------------------------------------------------------------------------------------------------
if [ "${1:-}" != "" ] && [ "${1:-}" != "--from-package" ]; then
  TARGET="$1"
  [[ "$TARGET" == *@* ]] || die "expected user@host, got \"$TARGET\". Run on the server with no argument to install locally."
  command -v ssh >/dev/null && command -v scp >/dev/null && command -v tar >/dev/null || die "ssh, scp and tar are needed on this computer."

  DOMAIN="${DOMAIN:-}"
  if [ -z "$DOMAIN" ]; then ask_domain; fi
  valid_domain "$DOMAIN" || die "\"$DOMAIN\" is not a valid domain name."

  step "Packaging the project"
  PACKAGE="$(mktemp -t vouchreel-XXXXXX).tgz"
  tar czf "$PACKAGE" -C "$SOURCE_DIR" \
    --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='.turbo' --exclude='dist' \
    --exclude='.env' --exclude='.env.local' --exclude='.env.*.local' --exclude='.env.production' \
    --exclude='test-results' --exclude='playwright-report' --exclude='.claude' --exclude='brand_logo' --exclude='*.log' \
    .
  info "$(du -h "$PACKAGE" | cut -f1) package"

  # shellcheck disable=SC2086  # SSH_OPTS is meant to split into separate options
  SSH=(ssh ${SSH_OPTS:-})
  SCP_OPTS=${SSH_OPTS:-}
  # scp wants -P for the port where ssh wants -p
  SCP_OPTS="${SCP_OPTS//-p /-P }"

  step "Uploading to $TARGET"
  # shellcheck disable=SC2086
  scp $SCP_OPTS "$PACKAGE" "$TARGET:/tmp/vouchreel-package.tgz"
  rm -f "$PACKAGE"

  step "Installing on the server (the first build takes 5 to 15 minutes)"
  "${SSH[@]}" -t "$TARGET" "S=''; [ \"\$(id -u)\" = 0 ] || S=sudo; \
    \$S mkdir -p $INSTALL_DIR && \$S tar xzf /tmp/vouchreel-package.tgz -C $INSTALL_DIR && rm -f /tmp/vouchreel-package.tgz && \
    \$S env DOMAIN='$DOMAIN' bash $INSTALL_DIR/deploy/install.sh --from-package"
  exit 0
fi

# ---------------------------------------------------------------------------------------------------------------------
# Mode 2: run on the server
# ---------------------------------------------------------------------------------------------------------------------
[ "$(id -u)" = 0 ] || die "run as root: sudo bash deploy/install.sh"
[ "$(uname -s)" = Linux ] || die "this installer is for a Linux server (Ubuntu or Debian)."
command -v apt-get >/dev/null || die "this installer supports Ubuntu and Debian (apt). On another system, follow docs/deployment.md."

ENV_FILE="$INSTALL_DIR/.env.production"
EXISTING_DOMAIN=''
if [ -f "$ENV_FILE" ]; then
  EXISTING_DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | head -n1 | cut -d= -f2- || true)"
fi

DOMAIN="${DOMAIN:-$EXISTING_DOMAIN}"
if [ -z "$DOMAIN" ]; then
  [ -r /dev/tty ] || die "no terminal to ask for the domain. Run with DOMAIN=app.example.com in front of the command."
  ask_domain
fi
valid_domain "$DOMAIN" || die "\"$DOMAIN\" is not a valid domain name."
if [ -n "$EXISTING_DOMAIN" ] && [ "$DOMAIN" != "$EXISTING_DOMAIN" ]; then
  die "this server is already installed for $EXISTING_DOMAIN. Changing the domain means changing the public address stored in the app's bundle and files; edit $ENV_FILE and rebuild, or install on a fresh server."
fi
printf '\n%sInstalling Vouchreel for https://%s%s\n' "$BOLD" "$DOMAIN" "$RESET"

# --- 1. Server checks -----------------------------------------------------------------------------------------------
step "Checking the server"
. /etc/os-release
info "OS: ${PRETTY_NAME:-unknown}"
MEM_MB=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
DISK_GB=$(df -BG --output=avail / | tail -n1 | tr -dc '0-9')
info "Memory: ${MEM_MB} MB, free disk: ${DISK_GB} GB"
[ "$MEM_MB" -ge 1500 ] || warn "Under 2 GB of memory. The build may run out of memory even with swap; 4 GB is comfortable."
[ "$DISK_GB" -ge 15 ] || warn "Under 15 GB of free disk. Docker images and video processing need room; 40 GB or more is better."

PUBLIC_IP="$(curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 8 https://ifconfig.me 2>/dev/null || true)"
DNS_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)"
info "Server address: ${PUBLIC_IP:-unknown}; $DOMAIN points to: ${DNS_IP:-nothing yet}"
if [ -n "$PUBLIC_IP" ] && [ "$DNS_IP" != "$PUBLIC_IP" ]; then
  warn "$DOMAIN does not point at this server yet. HTTPS certificates cannot be issued until it does."
  warn "Create an A record  $DOMAIN -> $PUBLIC_IP  (if you use Cloudflare, keep the proxy off until the certificate is issued)."
  if [ "${FORCE:-}" != 1 ]; then
    if [ -r /dev/tty ]; then
      read -r -p "    Continue anyway? Caddy keeps retrying and the site comes up once DNS is right. [y/N] " go </dev/tty
      [[ "$go" =~ ^[Yy] ]] || die "set the DNS record, wait a few minutes, and run the script again."
    else
      die "DNS check failed. Fix the record or run with FORCE=1."
    fi
  fi
fi

# --- 2. Code in place -----------------------------------------------------------------------------------------------
if [ "$(cd "$SOURCE_DIR" && pwd)" != "$INSTALL_DIR" ]; then
  step "Copying the project to $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  tar -C "$SOURCE_DIR" \
    --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='.turbo' --exclude='dist' \
    --exclude='.env' --exclude='.env.local' --exclude='.env.*.local' --exclude='.env.production' \
    --exclude='test-results' --exclude='playwright-report' --exclude='.claude' --exclude='brand_logo' --exclude='backups' \
    -cf - . | tar -C "$INSTALL_DIR" -xf -
fi
cd "$INSTALL_DIR"
[ -f docker-compose.yml ] && [ -f docker-compose.production.yml ] && [ -f deploy/docker-compose.vps.yml ] \
  || die "project files are missing in $INSTALL_DIR."

# --- 3. System packages and hardening -------------------------------------------------------------------------------
step "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg openssl ufw fail2ban unattended-upgrades cron >/dev/null

step "Installing Docker"
need_docker=1
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  have="$(docker compose version --short | sed 's/^v//')"
  if [ "$(printf '%s\n%s\n' "$MIN_COMPOSE" "$have" | sort -V | head -n1)" = "$MIN_COMPOSE" ]; then need_docker=0; fi
fi
if [ "$need_docker" = 1 ]; then
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
info "Docker $(docker --version | awk '{print $3}' | tr -d ,), Compose $(docker compose version --short)"

if [ ! -f /etc/docker/daemon.json ]; then
  # Container logs grow without bound by default and fill small disks
  cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
JSON
  systemctl restart docker
fi

step "Configuring swap, firewall, fail2ban and automatic updates"
if [ "$(swapon --show --noheadings | wc -l)" = 0 ]; then
  fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  info "Added 4 GB swap (the production build needs the headroom)"
fi

SSH_PORT="$(printf '%s' "${SSH_CONNECTION:-}" | awk '{print $4}')"
SSH_PORT="${SSH_PORT:-$(awk '/^Port /{print $2; exit}' /etc/ssh/sshd_config 2>/dev/null || true)}"
SSH_PORT="${SSH_PORT:-22}"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow "$SSH_PORT/tcp" >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
info "Firewall: only ssh ($SSH_PORT), 80 and 443 are open"

systemctl enable --now fail2ban >/dev/null 2>&1 || true
echo 'APT::Periodic::Update-Package-Lists "1"; APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades
info "fail2ban on; security updates install automatically"

# --- 4. Configuration and secrets -----------------------------------------------------------------------------------
step "Writing configuration"
rand_hex() { openssl rand -hex "$1"; }
rand_alnum() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

if [ -f "$ENV_FILE" ]; then
  info "Keeping the existing $ENV_FILE (secrets unchanged)"
else
  umask 077
  cat > "$ENV_FILE" <<EOF
# Generated by deploy/install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Keep this file private; it holds every secret.
# Edit a value, then apply it with:  vouchreel restart   (changes to NEXT_PUBLIC_* need:  vouchreel update)
DOMAIN=$DOMAIN

# --- Database ---
POSTGRES_USER=vouchreel
POSTGRES_PASSWORD=$(rand_alnum 32)
POSTGRES_DB=vouchreel

# --- Auth and encryption ---
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(rand_hex 32)
BETTER_AUTH_URL=https://$DOMAIN
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_BUSINESS_CLIENT_ID=
GOOGLE_BUSINESS_CLIENT_SECRET=

# --- Storage: the bundled MinIO, served from https://$DOMAIN/<bucket>/ ---
STORAGE_PROVIDER=s3
STORAGE_KEY=vouchreel$(rand_alnum 8)
STORAGE_SECRET=$(rand_alnum 40)
STORAGE_BUCKET=vouchreel-media
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=https://$DOMAIN

# --- Payments (add when you are ready to charge) ---
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
DODO_API_KEY=
DODO_WEBHOOK_SECRET=

# --- App (NEXT_PUBLIC_* values are baked into the build) ---
NEXT_PUBLIC_APP_URL=https://$DOMAIN
NEXT_PUBLIC_WIDGET_URL=

# --- Email: password reset, invites and notifications need one of these. Fill in, then: vouchreel restart ---
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
RESEND_API_KEY=
EMAIL_FROM=Vouchreel <no-reply@$DOMAIN>

# --- Scheduled jobs, proxy and rate limits ---
CRON_SECRET=$(rand_hex 32)
TRUSTED_PROXY_HOPS=1
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ALLOW_PRIVATE_WEBHOOK_TARGETS=false

# --- Observability (optional) ---
METRICS_TOKEN=$(rand_hex 32)
SENTRY_DSN=

# Turn on once email works, so new accounts have to confirm their address
REQUIRE_EMAIL_VERIFICATION=false
CSP_MODE=report-only
EOF
  chmod 600 "$ENV_FILE"
  info "Generated all secrets in $ENV_FILE"
fi

# Values the rest of the script prints
env_get() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2-; }

# --- 5. The `vouchreel` command and nightly backups -----------------------------------------------------------------
step "Installing the vouchreel command and nightly backups"
cat > /usr/local/bin/vouchreel <<'CLI'
#!/usr/bin/env bash
# Day-to-day control of the Vouchreel install. Run `vouchreel help`.
set -euo pipefail
DIR=/opt/vouchreel
cd "$DIR"
dc() {
  docker compose -p vouchreel --env-file .env.production \
    -f docker-compose.yml -f docker-compose.production.yml -f deploy/docker-compose.vps.yml "$@"
}
env_get() { grep -E "^$1=" .env.production | head -n1 | cut -d= -f2-; }

case "${1:-help}" in
  status)  dc ps ;;
  logs)    shift; dc logs -f --tail=100 "$@" ;;
  restart) shift; dc up -d --force-recreate --no-deps ${@:-app worker video-worker scheduler} ;;
  update)  bash deploy/install.sh --from-package ;;
  backup)
    mkdir -p backups
    file="backups/vouchreel-$(date +%Y%m%d-%H%M%S).sql.gz"
    dc exec -T postgres pg_dump -U "$(env_get POSTGRES_USER)" "$(env_get POSTGRES_DB)" | gzip > "$file"
    find backups -name 'vouchreel-*.sql.gz' -mtime +14 -delete
    echo "Saved $DIR/$file"
    ;;
  restore)
    [ -n "${2:-}" ] || { echo "usage: vouchreel restore backups/<file>.sql.gz"; exit 1; }
    read -r -p "This replaces the current database with $2. Type yes to continue: " ok
    [ "$ok" = yes ] || exit 1
    dc exec -T postgres psql -U "$(env_get POSTGRES_USER)" -d postgres -c "DROP DATABASE IF EXISTS \"$(env_get POSTGRES_DB)\" WITH (FORCE)" \
      -c "CREATE DATABASE \"$(env_get POSTGRES_DB)\""
    gunzip -c "$2" | dc exec -T postgres psql -U "$(env_get POSTGRES_USER)" -d "$(env_get POSTGRES_DB)" >/dev/null
    echo "Restored from $2"
    ;;
  admin)
    [ -n "${2:-}" ] || { echo "usage: vouchreel admin you@example.com [--revoke]"; exit 1; }
    shift
    dc run --rm --no-deps worker node scripts/grant-admin.mjs "$@"
    ;;
  env)     "${EDITOR:-nano}" .env.production ;;
  help|*)
    cat <<'HELP'
vouchreel status                 Show the running services
vouchreel logs [service]         Follow logs (app, worker, video-worker, caddy, postgres, minio)
vouchreel restart [service]      Restart after editing .env.production (default: app and the workers)
vouchreel update                 Rebuild and restart with the code in /opt/vouchreel (re-upload first to ship new code)
vouchreel admin you@x.com        Make a signed-up account a platform admin (--revoke to remove)
vouchreel backup                 Dump the database to /opt/vouchreel/backups
vouchreel restore <file>         Replace the database from a backup
vouchreel env                    Edit .env.production
HELP
    ;;
esac
CLI
chmod +x /usr/local/bin/vouchreel

cat > /etc/cron.d/vouchreel-backup <<'CRON'
# Nightly database dump; dumps older than 14 days are deleted
15 3 * * * root /usr/local/bin/vouchreel backup >> /var/log/vouchreel-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/vouchreel-backup

# --- 6. Build and start ---------------------------------------------------------------------------------------------
step "Building and starting everything (the first build is slow; later runs reuse the cache)"
dc() {
  docker compose -p "$PROJECT" --env-file "$ENV_FILE" \
    -f docker-compose.yml -f docker-compose.production.yml -f deploy/docker-compose.vps.yml "$@"
}
dc config -q || die "the compose files did not validate; see the message above."
dc build
dc up -d --remove-orphans

step "Waiting for the app to answer on https://$DOMAIN"
ready=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 8 "https://$DOMAIN/api/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 5
done

init_state="$(docker inspect -f '{{.State.ExitCode}}' vouchreel-minio-init 2>/dev/null || echo '?')"
if [ "$init_state" != 0 ]; then
  warn "The storage bucket setup exited with code $init_state. Check:  vouchreel logs minio-init"
fi

# --- 7. Summary -----------------------------------------------------------------------------------------------------
SUMMARY="$INSTALL_DIR/INSTALL_SUMMARY.txt"
umask 077
cat > "$SUMMARY" <<EOF
Vouchreel install summary ($(date -u +%Y-%m-%dT%H:%M:%SZ))

Site:            https://$DOMAIN
Server:          ${PUBLIC_IP:-unknown}
Install folder:  $INSTALL_DIR
Settings file:   $ENV_FILE  (all secrets; edit with: vouchreel env)

Database:        PostgreSQL, user $(env_get POSTGRES_USER), database $(env_get POSTGRES_DB), password in .env.production
                 Not reachable from outside the server. Backups: $INSTALL_DIR/backups, nightly at 03:15, kept 14 days
Storage:         MinIO bucket $(env_get STORAGE_BUCKET), files served from https://$DOMAIN/$(env_get STORAGE_BUCKET)/
                 Access key $(env_get STORAGE_KEY)  Secret $(env_get STORAGE_SECRET)
                 Data is in the Docker volume vouchreel_miniodata (not covered by the database backup)
HTTPS:           Caddy, certificate from Let's Encrypt, renews by itself
Firewall:        ufw allows ssh ($SSH_PORT), 80, 443 only; fail2ban and automatic security updates are on

Commands:        vouchreel status | logs | restart | update | admin | backup | restore | env
EOF
chmod 600 "$SUMMARY"

printf '\n%s============================================================%s\n' "$GREEN" "$RESET"
if [ "$ready" = 1 ]; then
  printf '%s  Vouchreel is live at https://%s%s\n' "$BOLD" "$DOMAIN" "$RESET"
else
  printf '%s  Installed, but https://%s is not answering yet%s\n' "$BOLD$YELLOW" "$DOMAIN" "$RESET"
  printf '  Usually DNS has not reached the server yet, or the certificate is still being issued.\n'
  printf '  Watch it with:  vouchreel logs caddy     and check the services with:  vouchreel status\n'
fi
printf '%s============================================================%s\n' "$GREEN" "$RESET"
cat <<EOF

  Site            https://$DOMAIN
  Server          ${PUBLIC_IP:-unknown}   (install folder $INSTALL_DIR)
  Database        PostgreSQL, private to the server. User $(env_get POSTGRES_USER), db $(env_get POSTGRES_DB)
  Storage         MinIO bucket $(env_get STORAGE_BUCKET) at https://$DOMAIN/$(env_get STORAGE_BUCKET)/
  Passwords       all in $ENV_FILE ; a copy of these details is in $SUMMARY
  Backups         nightly database dump to $INSTALL_DIR/backups (14 days)

  Next steps
    1. Open https://$DOMAIN and create your account.
    2. Make that account the platform admin:   vouchreel admin you@example.com
    3. Email: password reset and invites need SMTP_* or RESEND_API_KEY.
       Run  vouchreel env , fill them in, then  vouchreel restart
    4. Payments and Google sign-in are optional: add the keys the same way.
    5. Updating later: upload the new code, then run  bash deploy/install.sh user@host  again from your computer.

  Day to day:  vouchreel help
EOF
