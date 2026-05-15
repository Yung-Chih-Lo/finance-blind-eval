#!/bin/bash
# Post-edit hook: warn when dependency files are touched
# Catches unnecessary package additions

file_path="$1"

case "$file_path" in
  *package.json|*requirements*.txt|*pyproject.toml) ;;
  *) exit 0 ;;
esac

case "$file_path" in
  *requirements*.txt|*pyproject.toml)
    echo "[deps] Python dependency file touched: $file_path" >&2
    echo "[deps] Verify the new dependency isn't already covered by existing packages." >&2
    ;;
  *package.json)
    echo "[deps] Node dependency file touched: $file_path" >&2
    echo "[deps] Verify the new dependency isn't already available through existing packages." >&2
    ;;
esac
