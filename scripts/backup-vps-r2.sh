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

# Delete daily backups older than seven days (R2 tokens commonly do not allow
# bucket-lifecycle changes, so retention is enforced explicitly after upload).
CUTOFF_EPOCH="$(date -u -d '7 days ago' +%s)"
docker run --rm \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  amazon/aws-cli:2.27.41 s3api list-objects-v2 \
  --bucket "$R2_BUCKET" --prefix mongodb/daily/ --endpoint-url "$R2_ENDPOINT" \
  --query 'Contents[].[Key,LastModified]' --output text \
| while IFS=$'\\t' read -r old_key old_date; do
    [ -z "$old_key" ] && continue
    old_epoch="$(date -u -d "$old_date" +%s 2>/dev/null || echo 0)"
    if [ "$old_epoch" -gt 0 ] && [ "$old_epoch" -lt "$CUTOFF_EPOCH" ]; then
      docker run --rm -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
        amazon/aws-cli:2.27.41 s3 rm "s3://${R2_BUCKET}/${old_key}" --endpoint-url "$R2_ENDPOINT" --only-show-errors
    fi
  done

echo "Backup uploaded: s3://${R2_BUCKET}/${KEY}"
