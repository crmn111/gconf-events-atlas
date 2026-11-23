# GConf Events Atlas

A map of conferences and festivals in Europe and the UAE,
published by [GConf.ai](https://gconf.ai). Modelled on the Marbella
New-Build Atlas: a static Leaflet site, self-hosted photos, and a
cited source for every fact.

Live: https://crmn111.github.io/gconf-events-atlas/

- Hash routes, e.g. `#/event/{slug}`, `#/timeline`, `#/timeline/play`
  and `#/swipe`. The timeline opens in a presentation that steps
  through filtered events (pause, speed and Stop in the play bar;
  Space, arrows and Esc; autoplay is skipped when
  `prefers-reduced-motion` is set). During play the map comes on
  stage with a cinematic fly between venues, a dashed route arc,
  a pulsing pin and a date/city caption. A speaker control in the play
  bar (off by default) can synthesise a soft flight whoosh with the Web
  Audio API; no third-party recording is used.
- A Conferences / Festivals toggle switches the map, timeline, swipe
  and play lists. Category chips follow the selected kind (AI / tech /
  crypto for conferences; music, arts, film, food, culture or other
  for festivals). Region filters and a Europe / UAE map jump fit the
  map to the visible pins.
- Filters for city, date range, category/topic and ticket price, with
  an “unknown price” toggle so unpriced events can still be shown.
  Festivals whose dates are still to be announced stay on the map and
  in the list (Dates TBA badge) and in a Dates TBA group at the end of
  the timeline; play mode skips them.
- Detail panel with a self-hosted photo gallery, lightbox, credits and
  sources. Each event has an “Organisers: claim this listing” placeholder
  (nothing is sent).
- Alerts sign-up is on the page but disabled until Supabase + Resend
  are wired up. See `backend/README.md`.

## Working tree vs published site

This repository’s public copy is the slim GitHub Pages tree. The
working tree on the build machine keeps the research pipeline in
`_build/` (`events.json`, `events_uae.json`, `festivals.json`, photos
staging, `build.py`) and the
unpublished-until-ready backend in `backend/`.

```bash
python3 _build/build.py          # events.json + events_uae.json + festivals.json → data.js (upcoming + dates TBA)
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
