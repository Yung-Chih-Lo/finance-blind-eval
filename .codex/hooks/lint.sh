#!/bin/bash
# Multi-language lint hook for Edit/Write
# Dispatches by file extension; silently skips when the language tool isn't installed.
# Always exits 0 — never block the edit; only print warnings to stderr.

file_path="$1"
[ -f "$file_path" ] || exit 0

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    if command -v npx >/dev/null && [ -f package.json ]; then
      npx --no-install eslint "$file_path" 2>&1 | head -20 >&2
    fi
    grep -n 'console\.log' "$file_path" 2>/dev/null | grep -v '// keep' | head -3 >&2
    ;;

  *.py)
    if command -v ruff >/dev/null; then
      ruff check "$file_path" 2>&1 | head -20 >&2
    elif command -v flake8 >/dev/null; then
      flake8 "$file_path" 2>&1 | head -20 >&2
    fi
    ;;

  *.go)
    if command -v gofmt >/dev/null; then
      out=$(gofmt -l "$file_path" 2>&1)
      [ -n "$out" ] && echo "[gofmt] $out needs formatting" >&2
    fi
    ;;

  *.rs)
    : # clippy is too slow per-file; rely on cargo build / opsxp-verify
    ;;

  *.json|*.yaml|*.yml)
    if command -v npx >/dev/null && [ -f package.json ]; then
      npx --no-install prettier --check "$file_path" 2>&1 | head -10 >&2
    fi
    ;;

  *.md)
    if command -v markdownlint >/dev/null; then
      markdownlint "$file_path" 2>&1 | head -10 >&2
    fi
    ;;

  *.sh|*.bash)
    if command -v shellcheck >/dev/null; then
      shellcheck "$file_path" 2>&1 | head -10 >&2
    fi
    ;;

  *.css|*.scss|*.sass)
    if command -v npx >/dev/null && [ -f package.json ]; then
      npx --no-install stylelint "$file_path" 2>&1 | head -10 >&2
    fi
    ;;
esac

exit 0
