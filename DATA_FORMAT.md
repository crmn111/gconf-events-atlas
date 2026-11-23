# Data format

The atlas is a static site. The public dataset is `data.js`
(`window.ATLASDATA`), built from the research files in `_build/`.

## Sources

`build.py` merges, when present:

| File | Default `kind` | Default `region` |
| --- | --- | --- |
| `_build/events.json` | `conference` | `europe` |
| `_build/events_*.json` | `conference` | from the filename (`events_uae.json` → `uae`, `events_gulf.json` → `gulf`) |
| `_build/festivals.json` | `festival` | `europe` |

Missing files are skipped. Events are de-duplicated by slug (first file wins). Do not hand-edit these from the site build.
Each file is either an array of events or an object:

```json
{ "updated": "2026-11-23", "events": [ /* ... */ ] }
```

Records with `"status": "upcoming"` or `"status": "dates TBA"` are
published. Anything else (past, cancelled, draft, missing status) is
skipped. Festivals marked dates TBA (no start/end date) appear on the
map and in the list with a Dates TBA badge, and in a Dates TBA group at
the end of the timeline. They are left out of play mode so sorting and
playback stay intact.

### Event fields

Sheet columns (passed through if present):

| Field | Notes |
| --- | --- |
| `event_id` | Stable id from the conference sheet (e.g. `EVT-0008`) |
| `name` | Event name |
| `website_url` | Official site |
| `start_date`, `end_date` | ISO `YYYY-MM-DD`. Blank when `status` is `dates TBA`. |
| `city`, `country`, `venue` | Location |
| `region` | `europe` \| `uae`. Legacy values such as `"Europe"` or `"United Arab Emirates"` are normalised. |
| `kind` | `conference` \| `festival`. Omitted rows pick up the default for their source file. |
| `industry`, `format`, `organizer` | As published |
| `expected_attendance` | Only when sourced |
| `sponsor_page_url`, `sponsorship_prospectus_url` | Optional |
| `year`, `source_url`, `last_scraped_at`, `notes` | Provenance |

Atlas fields added by the research worker:

| Field | Notes |
| --- | --- |
| `slug` | Used in `#/event/{slug}` and as `id` |
| `lat`, `lng` | WGS84. Events without coordinates appear in the list only |
| `precise` | `true` when the pin is a verified venue/listing point; `false` for an approximate city or area pin |
| `category` | Conferences: `ai` \| `tech` \| `crypto`. Festivals: `music` \| `arts` \| `film` \| `food` \| `culture` \| `other`. Festival categories are not coerced to the conference set. |
| `topics` | Array of short topic strings |
| `ticket_price_min`, `ticket_price_max` | Numbers, in `currency` |
| `currency` | ISO code, e.g. `EUR` |
| `ticket_price_text` | Display string; built from min/max if omitted |
| `ticket_url`, `price_source_url` | Where the price was published |
| `photos` | Array of `{ src, thumb, orig, page, credit? }`. Paths are self-hosted, usually under `img/events/`. Optional `_build/photo_drop.txt` lists srcs omitted at build time (logos, typographic cards, blanks). Source files are not deleted. |
| `sources` | Array of `{ label, url, field? }`. Every displayed fact should be able to point at a source |
| `status` | `upcoming` or `dates TBA` to publish |

Extra sheet columns are preserved in `data.js`.

## Output: `data.js`

```js
window.ATLASDATA = {
  updated: "2026-11-23",
  generated: "2026-11-23T16:40:53Z",
  scope: "Conferences and festivals in Europe and the UAE", /* derived from regions in the data */
  regions: ["europe", "uae"],
  eurRates: { EUR: 1, GBP: 1.16, AED: 0.25 /* ... */ },
  eurRatesNote: "Indicative mid-market rates used only to compare ticket prices on the slider.",
  events: [ /* upcoming and dates TBA */ ],
  sourceMissing: [ /* names of source files that were absent */ ],
  counts: { conference: 0, festival: 0, dated: 0, dates_tba: 0, regions: { europe: 0, uae: 0 }, europe: 0, uae: 0 }
};
```

The slider compares prices in indicative euro (`price_eur_min` /
`price_eur_max`). The figure shown on the event is always the published
currency and text. Rates are not official ECB figures.

Rebuild:

```bash
python3 _build/build.py
```

`build.py` never writes to the source JSON files or `img/events/`. Duplicate slugs are dropped (first wins). Tickets in AED use an indicative euro rate of 0.25 for the slider only.
