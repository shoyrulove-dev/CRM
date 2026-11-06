#!/usr/bin/env bash
set -Eeuo pipefail

required=(MONGODB_URI R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Thiếu cấu hình: ${name}" >&2
    exit 1
  fi
done

backup_dir="$(mktemp -d)"
trap 'rm -rf -- "$backup_dir"' EXIT
stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
archive="$backup_dir/nichiei-crm-$stamp.archive.gz"

mongodump --uri="$MONGODB_URI" --archive="$archive" --gzip
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION=auto \
aws s3 cp "$archive" "s3://$R2_BUCKET/mongodb/daily/$(basename "$archive")" \
  --endpoint-url "$R2_ENDPOINT" --only-show-errors

echo "Đã sao lưu dữ liệu: mongodb/daily/$(basename "$archive")"
