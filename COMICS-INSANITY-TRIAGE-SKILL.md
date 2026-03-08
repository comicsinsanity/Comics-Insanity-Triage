# Comics Insanity Triage Suite — Skill File

## Overview

This skill documents the architecture, conventions, and patterns for the Comics Insanity Triage Suite — three static HTML apps deployed to Netlify from a single GitHub repository (`comicsinsanity/Comics-Insanity-Triage`).

**The three apps:**
- **CardTriage** (`mtg-triage.html`) → `cardtriage.netlify.app`
- **IssueTriage** (`issue-triage.html`) → `issuetriage.netlify.app`
- **WaxTriage** (`wax-triage.html`) → `waxtriage.netlify.app`

**Routing:** `index.html` is a hostname-detecting router — no content, just a script that reads `window.location.hostname` and redirects accordingly:
```html
<script>
  if (window.location.hostname.includes('issuetriage')) {
    window.location.replace('/issue-triage.html');
  } else if (window.location.hostname.includes('waxtriage')) {
    window.location.replace('/wax-triage.html');
  } else {
    window.location.replace('/mtg-triage.html');
  }
</script>
```

---

## Design System (shared across all three apps)

### Fonts
```html
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
```
- **Cinzel** — headers, logo, section titles, card names
- **Rajdhani** — all body text, buttons, labels, stats

### CSS Variables (identical across all three)
```css
:root {
  --bg: #0a0c10;
  --surface: #111520;
  --surface2: #181d2e;
  --border: #252d45;
  --accent: #c9a84c;       /* gold — primary brand color */
  --accent2: #e8c97a;      /* lighter gold */
  --grade: #a855f7;        /* purple — grade bucket */
  --text: #e8eaf0;
  --text-muted: #6b7a99;
  --text-dim: #3d4a6b;
}
```

### Per-app bucket color overrides
**CardTriage:**
```css
--ebay: #3b82f6;    /* blue */
--tcg: #22c55e;     /* green */
--bulk: #f97316;    /* orange */
--damaged: #6b7280; /* gray */
```

**IssueTriage & WaxTriage (shared bucket naming):**
```css
--show: #3b82f6;      /* blue — "Show / eBay" */
--dollarbox: #22c55e; /* green — "$1 Box" */
--trash: #6b7280;     /* gray */
```

### Background texture (all apps)
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background: 
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201,168,76,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 80%, rgba(59,130,246,0.05) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}
```

### Sticky Header (all apps)
```css
header {
  position: sticky; top: 0; z-index: 100;
  background: rgba(10,12,16,0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
```
Logo uses gold gradient text. Session stats in top right.

### Accent bar on cards/panels
```css
.card-display::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--accent), transparent);
}
```

---

## Shared UI Patterns

### Three-tab navigation
```html
<div class="tabs">
  <button class="tab active" onclick="switchTab('import')">① Import</button>
  <button class="tab" onclick="switchTab('triage')" id="tab-triage">② Triage</button>
  <button class="tab" onclick="switchTab('results')" id="tab-results">③ Results</button>
</div>
```
Tabs are numbered with circled numbers (①②③). `switchTab()` toggles `.active` on both tabs and panels.

### Decision buttons
All apps use the same `.btn-decision` pattern — flex column, icon on top, label below, border-highlight on hover/selected:
```html
<button class="btn-decision btn-grade" onclick="decide('grade')">
  <span class="icon">💎</span>Grade
</button>
```
Buckets: `grade` (💎), then app-specific buckets.

### Auto-advance after decision
```js
setTimeout(() => nextCard(), 300);
```
300ms delay after decision before advancing, so user can see the selection highlight.

### Back/Next navigation
All three apps have Back and Next nav buttons below the decision buttons:
```html
<div class="nav-buttons">
  <button class="btn btn-sm" onclick="prevCard()">← Back</button>
  <button class="btn btn-sm btn-primary" onclick="nextCard()">Next Card →</button>
</div>
```

### Progress bar
```html
<div class="progress-bar">
  <div class="progress-fill" id="progress-fill" style="width:0%"></div>
</div>
```
Gold gradient fill, updated via `updateProgress()`.

### Toast notifications
```js
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 2500);
}
```
Types: `success` (green border), `error` (red border).

### Export CSV pattern
All apps export with `Blob` → `URL.createObjectURL` → invisible `<a>` click. Filename format: `{app}-{filter}-YYYY-MM-DD.csv`.

### Promo footer (all apps, identical)
```html
<div style="text-align:center; padding: 20px 16px; margin-top: 16px; border-top: 1px solid #252d45; background: #111520;">
  <p style="font-family: 'Rajdhani', sans-serif; font-size: 13px; color: #6b7a99; letter-spacing: 1px;">
    📘 <strong style="color: #c9a84c;">Want a complete bulk decision framework?</strong><br>
    <a href="https://comicsinsanity.gumroad.com/l/pqztus" target="_blank" 
       style="color: #c9a84c; text-decoration: none; font-weight: 700; letter-spacing: 1px;">
       TCG SELLER'S BULK DECISION GUIDE — $15
    </a>
  </p>
</div>
```
Always include this footer at the bottom of every app's `<body>`.

---

## CardTriage (`mtg-triage.html`)

### Purpose
Triage Magic: The Gathering cards from a **Manabox CSV export** into 5 buckets: Grade / eBay / TCGplayer / Bulk / Damaged.

### Input: Manabox CSV fields
```
name, set code, scryfall id, condition, foil, rarity, quantity
```
Parser accepts variations: `card name`, `cardname`, `setcode`, `set name`, `scryfallid`, `qty`.
Foil detected when `foil === 'foil'` or `foil === 'true'`.

### Price data: Scryfall API
- Primary lookup: `https://api.scryfall.com/cards/{scryfallId}` (if ID present)
- Fallback: `https://api.scryfall.com/cards/named?exact={name}&set={set}`
- Further fallback: `https://api.scryfall.com/cards/named?fuzzy={name}`
- Rate limit courtesy: `await new Promise(r => setTimeout(r, 100))`
- **Batch prefetch:** Uses `POST https://api.scryfall.com/cards/collection` with up to 75 identifiers at a time, runs in background while user triages current card.

**Price fields used from Scryfall:**
```
prices.usd          → non-foil market price
prices.usd_foil     → foil market price
prices.usd_etched   → etched foil fallback
image_uris.small    → card image (or card_faces[0].image_uris.small for DFCs)
legalities          → format legality object
rarity, set_name, collector_number
```

**Foil edge case:** If card is foil but no foil price exists → show `⚠ Manual Check`, suggest eBay.

### Condition multipliers (CardTriage)
```js
const multipliers = { NM: 1.0, LP: 0.78, MP: 0.55, HP: 0.28, DMG: 0.10 };
```

### Decision thresholds (defaults)
```
Grade: ≥ $50
eBay:  ≥ $15
TCG:   ≥ $1
Bulk:  < $1
```
All thresholds are user-editable on the Import tab. Threshold inputs: `thresh-grade`, `thresh-ebay`, `thresh-tcg`, `thresh-bulk`.

### eBay sold comps link construction
```js
function updateEbayLink(cardName) {
  const query = encodeURIComponent(`"${cardName}" mtg magic`);
  const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Complete=1&LH_Sold=1&_sop=13`;
}
```
`LH_Complete=1&LH_Sold=1` = completed/sold listings. `_sop=13` = sort by most recent.

### Format legality display
Priority formats shown: `standard, pioneer, modern, legacy, vintage, commander, pauper, historic, explorer`
Hidden: `not_legal` formats (to keep it clean). Banned/restricted shown even outside priority list.

### Card key (for decisions object)
```js
function cardKey(card) {
  return card.scryfallId || (card.name + '|' + card.set);
}
```

### Export columns
`Name, Set, Condition, Foil, Quantity, Price, Bucket, Standard, Pioneer, Modern, Legacy, Vintage, Commander, Pauper`

---

## IssueTriage (`issue-triage.html`)

### Purpose
Triage comic books from a **ComicBase CSV export** into 4 buckets: Grade / Show / $1 Box / Trash.

### Input: ComicBase CSV fields
```
title, item #, condition, qty in stock, cost, printing, grading notes, item description, writer, artist
```

### No live pricing API
GoCollect API is blocked by CORS — attempted, removed. Instead:
- **CB Price** = `cost` field from CSV (what was paid / ComicBase value)
- **GoCollect** button = link-out to `https://gocollect.com/search?q={title+number}&type=comic`
- **eBay Sold** button = link-out (see below)

### Condition: Full 24-point CGC scale
Dropdown with all grades 0.5–10.0, each with label:
```
10.0 Gem Mint, 9.8 NM/Mint, 9.6 NM+, 9.4 NM, 9.2 NM-, 9.0 VF/NM,
8.5 VF+, 8.0 VF, 7.5 VF-, 7.0 FN/VF, 6.5 FN+, 6.0 FN, 5.5 FN-,
5.0 VG/FN, 4.5 VG+, 4.0 VG, 3.5 VG-, 3.0 GD/VG, 2.5 GD+,
2.0 GD, 1.8 GD-, 1.5 FR/GD, 1.0 FR, 0.5 Poor
```

Default selected: `9.4` (Near Mint).

### Condition multipliers (IssueTriage)
```js
const CONDITION_MULTIPLIERS = {
  '10.0': 1.50, '9.8': 1.25, '9.6': 1.15, '9.4': 1.00,
  '9.2': 0.95, '9.0': 0.90, '8.5': 0.85, '8.0': 0.75,
  '7.5': 0.65, '7.0': 0.50, '6.5': 0.40, '6.0': 0.30,
  '5.5': 0.28, '5.0': 0.25, '4.5': 0.20, '4.0': 0.18,
  '3.5': 0.15, '3.0': 0.13, '2.5': 0.12, '2.0': 0.10,
  '1.8': 0.09, '1.5': 0.08, '1.0': 0.06, '0.5': 0.03
};
```

### Condition string → grade mapping
```js
const COND_MAP = {
  'Near Mint': '9.4', 'NM': '9.4', 'NM/M': '9.8',
  'Very Fine': '8.0', 'VF': '8.0', 'VF/NM': '9.0',
  'Fine': '6.0', 'FN': '6.0', 'FN/VF': '7.0',
  'Very Good': '4.0', 'VG': '4.0', 'VG/FN': '5.0',
  'Good': '2.0', 'GD': '2.0',
  'Fair': '1.0', 'FR': '1.0',
  'Poor': '0.5', 'PR': '0.5'
};
```

### Decision thresholds (defaults)
```
Grade: ≥ $100 at grade 8.0+
Show:  ≥ $5
$1 Box: < $5
Trash: grade ≤ 1.5
```

### Key issue detection
```js
function isKnownKey(comic) {
  const desc = (comic.description || comic.gradeNotes || '').toLowerCase();
  return ['1st app','first app','1st appearance','origin of','death of','key issue'].some(p => desc.includes(p));
}
```
Key issues always suggested Show regardless of price (as long as grade > 1.5).

### eBay link construction (IssueTriage)
```js
const ebayQuery = encodeURIComponent(`"${comic.title}" #${comic.itemNum} comic`);
// URL: https://www.ebay.com/sch/i.html?_nkw={query}&LH_Complete=1&LH_Sold=1&_sop=13
```

### Card key
```js
function cardKey(comic) { return `${comic.title}|${comic.itemNum}`; }
```

### Export columns
`Title, Issue, Printing, Grade, Quantity, Price, Bucket, Key Issue, Description, Notes, Writer, Artist`

---

## WaxTriage (`wax-triage.html`)

### Purpose
Triage sports cards from a **CollX Pro CSV export** into 4 buckets: Grade / Show / $1 Box / Trash.
Unlike the other two apps, WaxTriage also supports **manual card entry** without a CSV.

### Input: CollX CSV fields
```
name, year, brand, set, number, condition, quantity, flags, market_value, asking_price, front_image, collx_id
```
Flags field can contain comma-separated values like `RC`, `SN/10`, etc. RC and SN get special pill styling.

### Key differences from CardTriage/IssueTriage
1. **Two modes:** CollX Queue (CSV-driven) and Manual Entry (freeform)
2. **Target Players system:** User-defined list of players that auto-flag cards for Show/Grade regardless of price. Saved to `localStorage`.
3. **Persistent decisions:** `decisions` array saved to `localStorage['wax-decisions']` — survives page refresh.
4. **Session counter:** Tracks how many cards triaged in current session (not persistent).
5. **Settings tab** (not Import tab) — thresholds and target players managed there.
6. **No condition multipliers** — uses CollX market_value directly.

### Default target players (pre-loaded)
```js
["Shaquille O'Neal", "Shaq", "Penny Hardaway", "Anfernee Hardaway", 
 "Tracy McGrady", "T-Mac", "Julius Erving", "Dr. J"]
```
(These are Mike's personal target players — his collecting focus.)

### Target player detection
```js
function isTargetPlayer(name) {
  const lower = name.toLowerCase();
  return targetPlayers.some(p => lower.includes(p.toLowerCase()) || p.toLowerCase().includes(lower));
}
```
Bidirectional partial match — catches "Shaq" matching "Shaquille O'Neal" and vice versa.

### eBay link construction (WaxTriage) — two buttons
**Raw sold:**
```js
const parts = [card.year, card.set || card.brand, card.player, card.number ? '#'+card.number : ''].filter(Boolean);
// URL: https://www.ebay.com/sch/i.html?_nkw={parts.join(' ')}&LH_Complete=1&LH_Sold=1&_sop=13
```
**Graded sold:** Same but appends `'PSA BGS SGC'` to the query.

### Manual entry flow
- Tab order via Enter key: player → year → set → number → condition → qty → notes
- eBay buttons disabled until player name entered
- Auto-clears all fields 400ms after decision
- Focuses back to player field for rapid entry

### Decision storage structure
```js
{
  player, year, set, number, condition, qty, notes,
  flags, team, market_value, asking_price, front_image, collx_id,
  isTarget, bucket, timestamp
}
```

### Export columns
`Player, Year, Set, Card #, Condition, Quantity, Bucket, Target Player, CollX Market, Notes`

---

## Deployment

### GitHub repo
`https://github.com/comicsinsanity/Comics-Insanity-Triage`

### Files in repo
```
index.html          ← hostname router (no content)
mtg-triage.html     ← CardTriage
issue-triage.html   ← IssueTriage
wax-triage.html     ← WaxTriage
```

### Netlify sites (three separate sites, same repo)
| Site | Netlify URL | File served |
|------|-------------|-------------|
| CardTriage | cardtriage.netlify.app | mtg-triage.html |
| IssueTriage | issuetriage.netlify.app | issue-triage.html |
| WaxTriage | waxtriage.netlify.app | wax-triage.html |

Each site has its own Netlify deployment pointing to the same repo. The router `index.html` handles directing each hostname to its file.

### Deploy process
1. Edit file locally or via GitHub web editor
2. Commit to `main`
3. Netlify auto-deploys (all three sites rebuild on any push)

---

## Known Issues & History

- **IssueTriage duplicate function bug:** A prior AI assistant introduced duplicate function definitions (`switchTab`, `initTriage`, `updateProgress`, `updateStats`, `showToast`, `filterResults`) which broke the app. Fixed by full rewrite of the file. Always check for duplicate function names when editing.
- **GoCollect CORS:** GoCollect API blocks browser-direct requests. Integration attempted and removed. Link-out button only.
- **WaxTriage localStorage:** Uses `localStorage` for decisions and player list persistence. Note: this is specific to WaxTriage — CardTriage and IssueTriage are session-only.

---

## Conventions for Future Edits

1. **Complete file, not patches.** When making significant changes, provide the complete updated file rather than diff patches.
2. **Preserve the design system.** All CSS variables, fonts, and the background gradient must remain consistent.
3. **Always include the promo footer** at the bottom of every app file.
4. **Test card key uniqueness** when adding new data sources — the key must reliably identify a unique item.
5. **Never add duplicate function definitions** — check before adding any function that might already exist.
6. **eBay URL pattern** is always: `LH_Complete=1&LH_Sold=1&_sop=13` (completed + sold + newest first).
7. **Condition dropdowns** use text grades for IssueTriage (9.4, 8.0, etc.) and short strings for CardTriage/WaxTriage (NM, LP, etc.).
