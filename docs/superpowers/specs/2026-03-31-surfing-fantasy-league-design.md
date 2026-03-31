# Surfing Fantasy League — Design Spec
**Date:** 2026-03-31  
**Season:** 2026 WSL Championship Tour  
**Status:** Approved

---

## Overview

A static, frontend-only fantasy surfing league web app for a private group of friends. Participants predict the final end-of-season WSL rankings before the season begins. The app tracks real WSL standings throughout the season and calculates each participant's fantasy score based on how accurate their predictions are against the current real rankings.

No backend, no server, no database. Runs locally and deploys to GitHub Pages.

---

## Tech Stack

- **HTML/CSS/Vanilla JavaScript only** — no frameworks, no build tools
- **localStorage** for all participant and prediction data
- **Static JSON files** as ranking data fallback
- **hash-based router** for navigation (no server config needed for GitHub Pages)

---

## Folder Structure

```
SurfingFantasy/
├── index.html                        # Single entry point, all views rendered here
├── styles.css                        # Global styles, responsive, sports dashboard theme
├── js/
│   ├── app.js                        # Bootstrap, initializes router and app state
│   ├── router.js                     # Hash-based view switching
│   ├── storage.js                    # localStorage read/write helpers
│   ├── scoring.js                    # Pure deterministic score calculation functions
│   ├── rankings.js                   # Data provider: fetch → parse → fallback to JSON
│   ├── participants.js               # Participant CRUD logic
│   └── ui.js                         # DOM helpers, table/card builders, color coding
├── data/
│   ├── surfers-men.json              # Full 2026 CT men roster (picker source)
│   ├── surfers-women.json            # Full 2026 CT women roster (picker source)
│   ├── current-rankings-men.json     # Fallback WSL men standings
│   └── current-rankings-women.json   # Fallback WSL women standings
├── docs/
│   └── superpowers/specs/
│       └── 2026-03-31-surfing-fantasy-league-design.md
└── README.md
```

---

## Pages / Views (Hash Routes)

| Route | Page | Purpose |
|---|---|---|
| `#/` | Dashboard | Season overview, participant count, leaderboard snapshot, last updated time |
| `#/participants` | Participants | Add / edit / delete participants; shows submission status per participant |
| `#/predictions/:id` | Prediction Entry | Ranked drag-or-select picker for Men Top 5 + Women Top 3; lock timer |
| `#/standings` | Current WSL Rankings | Live rankings tables (men + women) with points; fetch source indicator |
| `#/leaderboard` | Fantasy Leaderboard | Combined scores ranked descending; per-pick breakdown with color coding |
| `#/admin` | Admin | Trigger re-fetch, view fetch status, paste/edit override rankings JSON in-browser |

---

## Data Layer (`rankings.js`)

### Priority Chain (called on every standings/leaderboard load)

1. **Manual override** — if admin has pasted override data into localStorage, use it (highest priority)
2. **Live fetch via CORS proxy** — `allorigins.win` → `worldsurfleague.com/athletes/tour/mct?year=2026` (and `/wct` for women); result cached in localStorage for 30 minutes
3. **Local JSON fallback** — `data/current-rankings-men.json` / `data/current-rankings-women.json`

### Cache Strategy

- Live fetch result stored in `sf_rankings_men` / `sf_rankings_women` with a `fetchedAt` timestamp
- Cache is considered fresh for 30 minutes; re-fetch only after expiry
- On fetch/parse failure, fall back silently to JSON — no error shown to user
- A small subtle badge shows data source: green "● Live" (fetched) or yellow "● Local" (JSON fallback); never an error message

### Rankings Data Shape

Both live-parsed and JSON fallback conform to the same structure:

```json
[
  { "rank": 1, "name": "John John Florence", "country": "USA", "points": 56000 },
  { "rank": 2, "name": "Filipe Toledo", "country": "BRA", "points": 52000 }
]
```

### Admin Override

Admin page allows pasting a JSON array directly into the browser. Saved to:
- `sf_rankings_override_men`
- `sf_rankings_override_women`

These keys take priority over live fetch and local JSON until manually cleared.

---

## Prediction Entry & Locking

- Participant selects Men Top 5 (in ranked order 1–5) from the full 2026 CT men roster
- Participant selects Women Top 3 (in ranked order 1–3) from the full 2026 CT women roster
- Duplicate prevention enforced — same surfer cannot appear twice in a list
- On submit, `submittedAt` timestamp is saved to localStorage
- For 60 minutes after submission, an "Edit picks" button + countdown timer is shown
- After 60 minutes, picks are locked — no edits possible
- Locked status is derived from `Date.now() - submittedAt > 3600000`

---

## Scoring Engine (`scoring.js`)

Pure functions only — deterministic, no side effects, easy to unit test.

### Men Top 5 Scoring

Each of the 5 predicted positions is scored independently against the actual current ranking:

| Situation | Points |
|---|---|
| Predicted rank 1 AND actual rank 1 (World Champion) | **7 pts** |
| Exact position match (ranks 2–5) | 5 pts |
| Off by 1 position | 3 pts |
| Off by 2 positions | 2 pts |
| Off by 3+ positions, surfer still in top 5 | 1 pt |
| Surfer not in actual top 5 | 0 pts |

### Women Top 3 Scoring

| Situation | Points |
|---|---|
| Predicted rank 1 AND actual rank 1 (World Champion) | **4 pts** |
| Exact position match (ranks 2–3) | 3 pts |
| Off by 1 OR surfer still in top 3 | 1 pt |
| Surfer not in actual top 3 | 0 pts |

### Combined Score

`totalScore = sum(menPickScores) + sum(womenPickScores)`

### Leaderboard

- Sorted descending by `totalScore`
- Tied participants share the same displayed rank (no tie-breaker)
- Breakdown per pick shown with color coding:
  - **Green** = full points (exact match or champion bonus)
  - **Yellow** = partial points
  - **Red** = 0 points

---

## localStorage Schema

```js
"sf_participants"           // Array<{ id: string, name: string, createdAt: string }>

"sf_predictions_{id}"       // {
                            //   submittedAt: ISO string,
                            //   locked: boolean,
                            //   men: string[5],   // surfer names, index = predicted rank - 1
                            //   women: string[3]  // surfer names, index = predicted rank - 1
                            // }

"sf_rankings_men"           // { fetchedAt: ISO string, data: RankingEntry[] }
"sf_rankings_women"         // { fetchedAt: ISO string, data: RankingEntry[] }

"sf_rankings_override_men"  // { updatedAt: ISO string, data: RankingEntry[] }
"sf_rankings_override_women"// { updatedAt: ISO string, data: RankingEntry[] }
```

---

## UX / Visual Design

- **Theme:** dark sports dashboard — deep navy/slate background, bright accent colors
- **Mobile-first responsive** — works on phones, tables in landscape on desktop
- **Navigation:** top nav bar with links to all views, active state highlighted
- **Rankings tables:** rank badge, surfer name, country flag emoji, WSL points
- **Leaderboard cards:** participant name, total score, expandable breakdown table
- **Prediction picker:** scrollable list with rank slots (1st, 2nd, etc.), click to assign surfer, click again to clear
- **Lock timer:** countdown badge shown on prediction page while still editable
- **Last updated:** shown on standings and leaderboard pages

---

## Seed Demo Data

- 3 demo participants with submitted predictions
- Seeded with realistic 2026 CT surfer names
- Rankings JSON seeded with plausible 2026 mid-season standings

---

## Git & Deployment

- Initialize git in `/SurfingFantasy`
- `main` branch
- GitHub Pages serves from `main` branch root (`index.html`)
- README includes: setup, usage, how to update rankings, how to add participants

---

## Out of Scope

- Authentication or access control
- Backend of any kind
- Real-time updates / websockets
- Tie-breaker logic (tied participants share same rank)
- Historical event-by-event snapshots (current season only)
