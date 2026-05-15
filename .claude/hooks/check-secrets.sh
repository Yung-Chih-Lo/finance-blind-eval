#!/bin/bash
# Post-edit hook: detect secrets in file content
# Runs on text-like files only

file_path="$1"

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.py|*.env|*.env.*|*.yaml|*.yml|*.toml|*.json) ;;
  *) exit 0 ;;
esac

[ -f "$file_path" ] || exit 0

patterns='(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|AIza[a-zA-Z0-9_-]{35}|xox[bpsar]-[a-zA-Z0-9-]{10,})'

matches=$(grep -nE "$patterns" "$file_path" 2>/dev/null)
if [ -n "$matches" ]; then
  echo "[security] Possible secrets detected in $file_path:" >&2
  echo "$matches" >&2
  echo "[security] Do NOT commit secrets. Use environment variables." >&2
fi
