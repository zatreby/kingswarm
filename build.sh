#!/usr/bin/env bash
# Wraps kingswarm.html (artifact fragment: <title>+<style>+body content) into a full document for static hosting.
set -euo pipefail
mkdir -p docs
python3 - <<'PY'
s=open('kingswarm.html').read()
i=s.index('<div id="stage">')
head,body=s[:i],s[i:]
doc=('<!doctype html><html lang="en"><head><meta charset="utf-8">'
     '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
     '<meta name="description" content="Kingswarm: a hero-plus-swarm action game you can play in the browser, solo, on the couch, or online by link.">'
     +head+'</head><body>'+body+'</body></html>')
open('docs/index.html','w').write(doc)
print('docs/index.html',len(doc),'bytes')
PY
