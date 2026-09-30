#!/usr/bin/env bash
# Capture desktop + mobile screenshots of the exact CAPTURE_URL into CAPTURE_DIR.
# Exit 75 = temporary navigation/browser infrastructure failure; exit 1 = script/rendering defect.
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/time -p pwd
if /usr/bin/time -p test -z "${CAPTURE_URL:-}"; then echo "CAPTURE_URL is required." >&2; exit 1; fi
if /usr/bin/time -p test -z "${CAPTURE_DIR:-}"; then echo "CAPTURE_DIR is required." >&2; exit 1; fi
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p bash -c 'echo "capturing $0 -> $1" "$CAPTURE_URL" "$CAPTURE_DIR"'
set +e
/usr/bin/time -p node "${RUNTIME_DIR:?}/scripts/default-capture.mjs"
status=$?
set -e
/usr/bin/time -p echo "capture exit: $status"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-mobile.png"
exit "$status"
