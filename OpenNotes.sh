#!/bin/sh
# ---------------------------------------------------------------------------
#  OpenNotes - start the editor.
#
#  Double click this file, or add it to your applications.
#  It uses the native launcher when it has been built, otherwise it starts
#  the Electron runtime directly.
# ---------------------------------------------------------------------------
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ -x "$ROOT/bin/opennotes-launcher" ]; then
  exec "$ROOT/bin/opennotes-launcher" "$@"
fi

if [ -x "$ROOT/node_modules/electron/dist/electron" ]; then
  exec "$ROOT/node_modules/electron/dist/electron" "$ROOT" "$@"
fi

echo "OpenNotes is not installed yet. Run 'npm install' in this folder first."
exit 1
