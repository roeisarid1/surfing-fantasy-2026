# 🏄 Fantasy Surf League 2026

A fantasy surfing league web app for predicting WSL Championship Tour final rankings — men's Top 5 and women's Top 3 — and competing with friends throughout the season.

Backed by **Firebase Firestore** for real-time shared data — all participants, predictions, and admin overrides are synced instantly across every device.

---

## Live App

**[https://roeisarid1.github.io/surfing-fantasy-2026/](https://roeisarid1.github.io/surfing-fantasy-2026/)**

No installation or local server needed — just open the link in any browser.

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

## Rules

### The Goal
Each participant predicts the **WSL Championship Tour final standings** before the season locks. The closer your predictions are to the actual end-of-season results, the more points you score.

### What You Predict
- **Men:** Final top 5 surfers, in exact order (1st through 5th)
- **Women:** Final top 3 surfers, in exact order (1st through 3rd)

### How Points Are Calculated

**Men's Top 5 — per surfer predicted:**
| Your prediction vs. actual result | Points |
|---|---|
| Predicted World Champion (1st) AND they won | 7 pts |
| Exact position match (2nd–5th) | 5 pts |
| Off by 1 position | 3 pts |
| Off by 2 positions | 2 pts |
| Off by 3+ positions but still in top 5 | 1 pt |
| Surfer finished outside top 5 | 0 pts |

**Women's Top 3 — per surfer predicted:**
| Your prediction vs. actual result | Points |
|---|---|
| Predicted World Champion (1st) AND they won | 4 pts |
| Exact position match (2nd–3rd) | 3 pts |
| Off by 1 position or still in top 3 | 1 pt |
| Surfer finished outside top 3 | 0 pts |

**Maximum possible score: 37 points**
(35 from men + 12 from women — only achievable with a perfect prediction)

### Deadlines & Locking
- Picks can be submitted or changed at any time **before the season starts**
- Once submitted, you have a **1-hour grace period** to make changes
- After that, picks are **locked for the season**

### Leaderboard
- The leaderboard is hidden until the season begins (first real points appear in WSL standings)
- Scores update automatically after each WSL event as rankings change

---

## Firebase Integration

Participant data, predictions, and admin ranking overrides are stored in **Firebase Firestore**. This means:

- All users see the same data in real time — no refresh needed
- Picks and participants persist across devices and sessions
- Admin overrides update the leaderboard instantly for everyone

---

## Updating Rankings

**To manually update after each WSL event:**

### Option A: Admin Override (recommended)
1. Go to the **Admin** page in the app
2. Paste updated JSON into the Men or Women override boxes
3. Click Save — the leaderboard updates instantly for all users via Firestore

### Option B: Update JSON files (fallback only)
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
├── styles.css              # Surf theme styles
├── js/
│   ├── firebase.js         # Firebase init + Firestore exports
│   ├── scoring.js          # Pure scoring functions
│   ├── participants.js     # Firestore participant CRUD
│   ├── rankings.js         # Data provider (Firestore overrides → JSON fallback)
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

## Tech Stack

- Plain HTML, CSS, and vanilla JavaScript — no framework, no build tools
- [Firebase Firestore](https://firebase.google.com/docs/firestore) for real-time shared state
- Hosted on GitHub Pages
