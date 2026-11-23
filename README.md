# GConf Events Atlas

A map of upcoming AI, tech and crypto/Web3 events in Europe, published
by [GConf.ai](https://gconf.ai). Modelled on the Marbella New-Build
Atlas: a static Leaflet site, self-hosted photos, and a cited source
for every fact.

Live: https://crmn111.github.io/gconf-events-atlas/

- Hash routes, e.g. `#/event/{slug}` and `#/swipe`.
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

## Licence and credits

Facts are researched from public sources and cited on each event page.
Photos remain © their publishers and are credited next to the image.
Basemaps © Esri, CARTO and OpenStreetMap contributors. The GConf mark
is a trademark of GConf AI Limited.
