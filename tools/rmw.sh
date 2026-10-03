#!/bin/bash
# Uso: tools/rmw.sh archivo "palabra" ... — elimina líneas exactas
f=$1; shift
for w in "$@"; do grep -qxF "$w" "$f" || echo "NO ENCONTRADA: $w"; grep -vxF "$w" "$f" > "$f.tmp" && mv "$f.tmp" "$f"; done
echo "$f: $(grep -vc '^#\|^$' "$f")"
