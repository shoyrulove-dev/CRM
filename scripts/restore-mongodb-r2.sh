#!/usr/bin/env bash
set -Eeuo pipefail

required=(MONGODB_URI R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY BACKUP_KEY)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Thiếu cấu hình: ${name}" >&2
    exit 1
  fi
done

case "$BACKUP_KEY" in
  mongodb/daily/*.archive.gz) ;;
  *) echo "BACKUP_KEY phải thuộc thư mục mongodb/daily/ và kết thúc bằng .archive.gz" >&2; exit 1 ;;
esac

restore_dir="$(mktemp -d)"
trap 'rm -rf -- "$restore_dir"' EXIT
archive="$restore_dir/restore.archive.gz"

AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION=auto \
aws s3 cp "s3://$R2_BUCKET/$BACKUP_KEY" "$archive" \
  --endpoint-url "$R2_ENDPOINT" --only-show-errors

mongorestore --uri="$MONGODB_URI" --archive="$archive" --gzip --drop
echo "Đã khôi phục MongoDB từ: $BACKUP_KEY"
