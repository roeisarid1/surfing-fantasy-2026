# 🏄 Fantasy Surf League 2026

A static, frontend-only fantasy surfing league web app. Predict WSL Championship Tour final rankings — men's Top 5 and women's Top 3 — and compete with friends throughout the season.

**No backend. No server. Runs entirely in the browser.**

---

## Quick Start (Local)

You need a local HTTP server (required for `fetch()` to load JSON data files).

**Option A — VS Code:**
Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension, right-click `index.html` → "Open with Live Server".

**Option B — Python:**
```bash
cd SurfingFantasy
python -m http.server 8080
# Open http://localhost:8080
```

**Option C — Node.js:**
```bash
npx serve .
```

> Opening `index.html` directly via `file://` will work for navigation, but rankings data fetch may be blocked by browser security. Use a local server for the full experience.

---

## Deploying to GitHub Pages

1. **Create a new GitHub repository** (e.g. `surfing-fantasy-2026`).

2. **Initialize and push:**
```bash
cd SurfingFantasy
git init
git add .
git commit -m "Initial commit: Fantasy Surf League 2026"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/surfing-fantasy-2026.git
git push -u origin main
```

3. **Enable GitHub Pages:**
   - Go to your repo → Settings → Pages
   - Source: `Deploy from a branch` → Branch: `main` → Folder: `/ (root)`
   - Save. Your app will be live at `https://YOUR_USERNAME.github.io/surfing-fantasy-2026/`

---

## How It Works

### Adding Participants
Go to **Participants** → enter a name → click Add. Each person then clicks their name to enter their picks.

### Submitting Picks
- Select Men's Top 5 in predicted order (1st through 5th)
- Select Women's Top 3 in predicted order
- Click **Save Picks**
- You have **1 hour** to edit after saving. After that, picks are locked.

### Scoring
Scores update automatically whenever WSL rankings change.

**Men's Top 5:**
| Situation | Points |
|---|---|
| Predicted 1st AND actual 1st (World Champion) | 7 pts |
| Exact position match (2nd–5th) | 5 pts |
| Off by 1 position | 3 pts |
| Off by 2 positions | 2 pts |
| Off by 3+ but still in top 5 | 1 pt |
| Outside top 5 | 0 pts |

**Women's Top 3:**
| Situation | Points |
|---|---|
| Predicted 1st AND actual 1st (World Champion) | 4 pts |
| Exact position match (2nd–3rd) | 3 pts |
| Off by 1 or still in top 3 | 1 pt |
| Outside top 3 | 0 pts |

Maximum possible score: **37 points**

---

## Updating Rankings

The app tries to fetch live rankings from worldsurfleague.com on every load (via CORS proxy). If that fails, it falls back to local JSON.

**To manually update after each WSL event:**

### Option A: Admin Override (no file editing needed)
1. Go to the **Admin** page in the app
2. Paste updated JSON into the Men or Women override boxes
3. Click Save — the leaderboard updates instantly

### Option B: Update JSON files (for permanent updates)
Edit `data/current-rankings-men.json` and `data/current-rankings-women.json`:

```json
[
  { "rank": 1, "name": "John John Florence", "country": "USA", "points": 59800 },
  { "rank": 2, "name": "Filipe Toledo",       "country": "BRA", "points": 54300 }
]
```

Then commit and push to GitHub:
```bash
git add data/
git commit -m "Update rankings after [Event Name]"
git push
```

---

## Adding Surfers to the Roster

If the 2026 CT roster changes, edit `data/surfers-men.json` or `data/surfers-women.json`:

```json
[
  { "name": "Surfer Name", "country": "AUS" }
]
```

Country codes: `USA`, `AUS`, `BRA`, `RSA`, `JPN`, `ITA`, `FRA`, `PRT`, `CRI`, `MAR`

---

## File Structure

```
SurfingFantasy/
├── index.html              # App shell + nav
├── styles.css              # Dark dashboard theme
├── js/
│   ├── storage.js          # localStorage helpers
│   ├── scoring.js          # Pure scoring functions
│   ├── participants.js     # Participant CRUD
│   ├── rankings.js         # Data provider (fetch → JSON fallback)
│   ├── router.js           # Hash-based router
│   ├── ui.js               # DOM helpers, toast, tables
│   └── app.js              # Views + bootstrap
├── data/
│   ├── surfers-men.json    # 2026 CT men roster
│   ├── surfers-women.json  # 2026 CT women roster
│   ├── current-rankings-men.json     # Fallback standings
│   └── current-rankings-women.json   # Fallback standings
└── README.md
```

---

## Data Sources

- Live rankings: [worldsurfleague.com](https://www.worldsurfleague.com) via CORS proxy
- Fallback: local JSON files (manually maintained)

---

Built with plain HTML, CSS, and vanilla JavaScript. No dependencies.
