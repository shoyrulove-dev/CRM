#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source "$BASE_DIR/.env"
set +a

: "${R2_ENDPOINT:?R2_ENDPOINT is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
: "${MONGO_ROOT_PASSWORD:?MONGO_ROOT_PASSWORD is required}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
KEY="mongodb/daily/nichiei-crm-${STAMP}.archive.gz"

docker exec nichieicrm-mongodb-1 mongodump \
  --username nichiei_admin \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db nichiei_crm \
  --archive --gzip \
| docker run --rm -i \
    -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    amazon/aws-cli:2.27.41 \
    s3 cp - "s3://${R2_BUCKET}/${KEY}" --endpoint-url "$R2_ENDPOINT" --only-show-errors

# Keep only the latest seven days of daily backups.
CUTOFF="$(date -u -d '7 days ago' '+%Y-%m-%dT%H:%M:%SZ')"
docker run --rm \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e R2_BUCKET="$R2_BUCKET" \
  -e R2_ENDPOINT="$R2_ENDPOINT" \
  -e CUTOFF="$CUTOFF" \
  amazon/aws-cli:2.27.41 \
  sh -c 'aws s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix mongodb/daily/ --endpoint-url "$R2_ENDPOINT" --query "Contents[?LastModified<=\x27$CUTOFF\x27].Key" --output text | tr "\\t" "\\n" | while read -r key; do [ -n "$key" ] && aws s3 rm "s3://$R2_BUCKET/$key" --endpoint-url "$R2_ENDPOINT" --only-show-errors; done'

echo "Backup uploaded: s3://${R2_BUCKET}/${KEY}"
