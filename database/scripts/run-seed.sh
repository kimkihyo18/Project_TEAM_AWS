#!/bin/bash
# ============================================================
# seed 실행 스크립트
# 사용법: bash database/scripts/run-seed.sh
# ============================================================

set -e

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-P@ssw0rd}"
SEED_PASSWORD="${SEED_PASSWORD:-password123}"

# node / npm 없으면 설치
if ! command -v node &> /dev/null; then
  echo "▶ Node.js 설치 중..."
  sudo dnf install -y nodejs
fi

# bcryptjs 없으면 설치
if [ ! -d "/tmp/bcrypt_seed/node_modules/bcryptjs" ]; then
  echo "▶ bcryptjs 설치 중..."
  mkdir -p /tmp/bcrypt_seed
  cd /tmp/bcrypt_seed
  npm install bcryptjs --save 2>/dev/null
  cd -
fi

echo "▶ bcrypt 해시 생성 중..."
BCRYPT_HASH=$(node -e "
const b = require('/tmp/bcrypt_seed/node_modules/bcryptjs');
b.hash('${SEED_PASSWORD}', 10).then(h => process.stdout.write(h));
")
echo "✅ 해시 생성 완료"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "▶ seed.sql 실행 중..."
sed "s/__BCRYPT_HASH__/${BCRYPT_HASH//\//\\/}/g" "$SCRIPT_DIR/seed.sql" | \
  mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD"

echo "✅ 시드 데이터 삽입 완료"
