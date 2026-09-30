# Fonts

Both fonts are bundled locally in `public/fonts/` (no web requests) under the SIL Open Font License 1.1.
Raw sources are kept in `assets-src/fonts/` (gitignored) together with each font's `OFL.txt`.

| File | Font | Author / copyright | Source | Processing |
|---|---|---|---|---|
| `public/fonts/lilita-one.woff2` (12 KB) | Lilita One Regular | Copyright (c) 2011 Juan Montoreano, with Reserved Font Name "Lilita" | `https://raw.githubusercontent.com/google/fonts/main/ofl/lilitaone/LilitaOne-Regular.ttf` (fetched 2026-09-30) | WOFF2 re-wrap only (`woff2_compress`), glyph data unchanged. Not subset, so it is not a Modified Version and keeps its Reserved Font Name. |
| `public/fonts/nunito-latin-var.woff2` (33 KB) | Nunito variable (wght 200-1000) | Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito) | `https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/Nunito%5Bwght%5D.ttf` (fetched 2026-09-30) | Subset to Basic Latin + Latin-1 + common punctuation with `pyftsubset` (fonttools), WOFF2. No Reserved Font Name, so the subset may keep the name. |

Licence: SIL Open Font License, Version 1.1, https://openfontlicense.org . The full text ships next to the fonts as `public/fonts/OFL-LilitaOne.txt` and `public/fonts/OFL-Nunito.txt` (fonts may be bundled with software; they may not be sold on their own).

Rebuild the Nunito subset:

```bash
cd assets-src/fonts
UV_CACHE_DIR=../../.cache/uv uvx --from 'fonttools[woff]' pyftsubset Nunito.ttf \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+00D7" \
  --layout-features='kern,liga,tnum,lnum,case' --flavor=woff2 --output-file=../../public/fonts/nunito-latin-var.woff2
```
