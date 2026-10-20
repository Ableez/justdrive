export function renderInstallScript(baseUrl: string): string {
  return `#!/bin/sh
# justdrive installer. Usage: curl -fsSL ${baseUrl}/install.sh | sh
set -eu

BASE="\${JUSTDRIVE_BASE_URL:-${baseUrl}}"
BIN_DIR="\${JUSTDRIVE_BIN_DIR:-$HOME/.local/bin}"
PROG="$BIN_DIR/justdrive"

if [ -t 1 ] && [ "\${NO_COLOR:-}" = "" ]; then
  GREEN='\\033[32m'; BOLD='\\033[1m'; DIM='\\033[2m'; RESET='\\033[0m'
else
  GREEN=''; BOLD=''; DIM=''; RESET=''
fi

say() { printf "%b\\n" "$1"; }
ok() { say "  \${GREEN}✓\${RESET} $1"; }
fail() { say "  ✗ $1" >&2; exit 1; }

spin_while() {
  if [ ! -t 1 ]; then wait "$1"; return $?; fi
  i=0
  while kill -0 "$1" 2>/dev/null; do
    i=$((i + 1)); f=$((i % 10))
    case "$f" in
      0) c='⠋' ;; 1) c='⠙' ;; 2) c='⠹' ;; 3) c='⠸' ;; 4) c='⠼' ;;
      5) c='⠴' ;; 6) c='⠦' ;; 7) c='⠧' ;; 8) c='⠇' ;; *) c='⠏' ;;
    esac
    printf '\\r  %s %s' "$c" "$2"
    sleep 0.08
  done
  printf '\\r'
  wait "$1"
}

say ""
say "  \${BOLD}justdrive\${RESET} \${DIM}— move files between your machines\${RESET}"
say ""

if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL --retry 3 --retry-all-errors --retry-delay 2 "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q --tries=3 -O "$2" "$1"; }
else
  fail "needs curl or wget. Install one and run again."
fi
command -v node >/dev/null 2>&1 || fail "needs node 20 or newer."

major="$(node --version | sed 's/^v//; s/\\..*//')"
if [ "$major" -lt 20 ]; then
  fail "needs node 20 or newer (found $(node --version))."
fi
ok "[1/3] node $(node --version)"

mkdir -p "$BIN_DIR"
tmp="$PROG.tmp.$$"
trap 'rm -f "$tmp"' EXIT INT TERM
fetch "$BASE/r/justdrive.mjs" "$tmp" &
spin_while "$!" "Downloading justdrive..."
ok "[2/3] downloaded justdrive.mjs"

chmod +x "$tmp"
mv "$tmp" "$PROG"
trap - EXIT INT TERM
ver="$("$PROG" --version 2>/dev/null || echo "")"
ok "[3/3] installed justdrive $ver to $PROG"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) say "  \${DIM}$BIN_DIR is not on your PATH yet.\${RESET}" ;;
esac
say "  \${BOLD}Next:\${RESET} justdrive login"
`;
}
