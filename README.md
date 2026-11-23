# GConf Events Atlas

A map of upcoming AI, tech and crypto/Web3 events in Europe, published
by [GConf.ai](https://gconf.ai). Modelled on the Marbella New-Build
Atlas: a static Leaflet site, self-hosted photos, and a cited source
for every fact.

Live: https://crmn111.github.io/gconf-events-atlas/

- Hash routes, e.g. `#/event/{slug}`, `#/timeline` and `#/swipe`.
- Filters for city, date range, category/topic and ticket price, with
  an “unknown price” toggle so unpriced events can still be shown.
- Detail panel with a self-hosted photo gallery, lightbox, credits and
  sources. Each event has an “Organisers: claim this listing” placeholder
  (nothing is sent).
- Alerts sign-up is on the page but disabled until Supabase + Resend
  are wired up. See `backend/README.md`.

## Working tree vs published site

This repository’s public copy is the slim GitHub Pages tree. The
working tree on the build machine keeps the research pipeline in
`_build/` (`events.json`, photos staging, `build.py`) and the
unpublished-until-ready backend in `backend/`.

```bash
python3 _build/build.py          # events.json → data.js (upcoming only)
./publish.sh                     # rebuild, copy the slim tree, push Pages
```

`publish.sh` does not deploy Supabase or Resend.

## Basemaps

The default light map is **CARTO Voyager** (vector), with a switcher for
CARTO Positron, CARTO Dark Matter and Esri World Imagery (satellite).
Attribution for OSM, CARTO and Esri stays on the map.

CARTO’s raster tile CDN (`basemaps.cartocdn.com/rastertiles/…`) has
required an API key since 25 September 2026, so the atlas uses their
vector styles, which still load without a key today. A free key (no
account) can be requested at https://carto.com/basemaps/apikey and
pasted into `cartoKey` in `config.js`. That future-proofs the map if
CARTO later requires a key for vector tiles too.

Styles that need an API key and are **not** shipped:

- CARTO raster Voyager / Positron / Dark Matter
- Stadia Alidade Smooth (and other Stadia styles)
- MapTiler custom (or any MapTiler raster/vector style)

If a CARTO vector style fails to load, the switcher falls back to Esri
World Topo (Voyager), Esri Light Gray (Positron) and Esri Dark Gray
(Dark Matter). Those Esri layers, and Esri satellite, are keyless with
attribution.

The colour theme (light by default, or dark) is remembered in
`localStorage`. Switching to dark while Voyager or Positron is selected
moves the map to Dark Matter; switching back restores the previous light
basemap.

## Licence and credits

Facts are researched from public sources and cited on each event page.
Photos remain © their publishers and are credited next to the image.
Basemaps © Esri, CARTO and OpenStreetMap contributors. MapLibre GL JS
is used under the 3-Clause BSD licence. The GConf mark is a trademark
of GConf AI Limited.
