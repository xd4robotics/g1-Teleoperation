#!/usr/bin/env bash
# Launch the existing backend/frontend using one explicit wireless profile.
set -euo pipefail
PROFILE_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/g1-wireless-dds-profile"
PROFILE="${1:-}"
if [[ -z "$PROFILE" ]]; then
    if [[ -r "$PROFILE_FILE" ]]; then PROFILE="$(<"$PROFILE_FILE")"; else PROFILE=xd4; fi
fi
case "$PROFILE" in xd4|robot) ;; *) echo "Uso: $0 {xd4|robot}" >&2; exit 2 ;; esac
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
source "$PROJECT_DIR/profiles/$PROFILE.env"
set +a
export PATH="$PROJECT_DIR/.runtime/bin:$PATH"
cd "$PROJECT_DIR"
exec npm run dev
