# Data format

The atlas is a static site. The public dataset is `data.js`
(`window.ATLASDATA`), built from `_build/events.json`.

## Source: `_build/events.json`

Produced by the research pipeline. Do not hand-edit it from the site
build. The file is either an array of events or an object:

```json
{ "updated": "2026-11-23", "events": [ /* ... */ ] }
```

Only records with `"status": "upcoming"` are published. Anything else
(past, cancelled, draft, missing status) is skipped.

### Event fields

Sheet columns (passed through if present):

| Field | Notes |
| --- | --- |
| `event_id` | Stable id from the conference sheet (e.g. `EVT-0008`) |
| `name` | Event name |
| `website_url` | Official site |
| `start_date`, `end_date` | ISO `YYYY-MM-DD` |
| `city`, `country`, `region`, `venue` | Location |
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
| `category` | `ai` \| `tech` \| `crypto` |
| `topics` | Array of short topic strings |
| `ticket_price_min`, `ticket_price_max` | Numbers, in `currency` |
| `currency` | ISO code, e.g. `EUR` |
| `ticket_price_text` | Display string; built from min/max if omitted |
| `ticket_url`, `price_source_url` | Where the price was published |
| `photos` | Array of `{ src, thumb, orig, page, credit? }`. Paths are self-hosted, usually under `img/events/` |
| `sources` | Array of `{ label, url, field? }`. Every displayed fact should be able to point at a source |
| `status` | `upcoming` to publish |

Extra sheet columns are preserved in `data.js`.

## Output: `data.js`

```js
window.ATLASDATA = {
  updated: "2026-11-23",
  generated: "2026-11-23T16:40:53Z",
  scope: "AI, tech and crypto/Web3 events in Europe",
  eurRates: { EUR: 1, GBP: 1.16 /* ... */ },
  eurRatesNote: "Indicative mid-market rates used only to compare ticket prices on the slider.",
  events: [ /* upcoming only */ ]
};
```

The slider compares prices in indicative euro (`price_eur_min` /
`price_eur_max`). The figure shown on the event is always the published
currency and text. Rates are not official ECB figures.

Rebuild:

```bash
python3 _build/build.py
```

`build.py` never writes to `events.json` or `img/events/`.
