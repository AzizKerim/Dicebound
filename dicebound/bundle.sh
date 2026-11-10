#!/bin/sh
# Optional: inline all scripts into one standalone file (../index.html, the page GitHub Pages serves).
# The game also runs directly from dicebound/index.html - this is only for convenience.
cd "$(dirname "$0")"
awk '
  /<script src="[^"]+"><\/script>/ {
    match($0, /src="[^"]+"/); f = substr($0, RSTART+5, RLENGTH-6)
    print "  <script>"; while ((getline line < f) > 0) print line; close(f); print "  </script>"; next
  }
  { print }' index.html > ../index.html
echo "Wrote ../index.html"
