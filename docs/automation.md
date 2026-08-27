# How the WSL data automation works

> A self-contained explainer for the automated data pipeline in the
> **Fantasy Surf League 2026** project. Written so it can be read on its own,
> without access to the repository — all the relevant code is quoted inline.

---

## Context: what this project is

A fantasy surfing league web app. Participants predict the final World Surf
League (WSL) Championship Tour standings — men's top 5 and women's top 3 — and
score points as the real season unfolds.

Technically it is deliberately minimal:

- Plain HTML, CSS and vanilla JavaScript. **No framework, no build step, no bundler.**
- Hosted on **GitHub Pages** as a static site (`roeisarid1.github.io/surfing-fantasy-2026/`).
- **Firebase Firestore** holds the shared mutable state: participants, their
  predictions, and optional admin overrides.
- Rankings and event results live as **static JSON files** in the repo under `data/`.

The problem this automation solves: rankings and results used to be typed in by
hand after every WSL event — partly into the JSON files, partly into Firestore
overrides via an admin page. That was slow and error-prone. When the automation
first ran and its output was compared against what had been entered manually, it
found a finished event missing entirely, a pair of brothers whose placings had
been swapped, six events where only 16 of 23 women had been recorded, and
rankings overrides that had gone stale by one to two months.

All hand-entered WSL data has since been deleted, so the scraper is now the sole
source for rankings and results. Participants and their predictions — the one
kind of data that legitimately *is* hand-entered — remain in Firestore.

---

## The one-sentence version

There is **no server owned by this project** anywhere in the pipeline. GitHub
provides a temporary Linux machine every 3 hours; that machine downloads a
couple of pages from worldsurfleague.com, converts them to JSON, commits the
JSON back into the repository, and GitHub Pages republishes the site. The app
then reads those JSON files from its own domain.

```
        ┌─────────────────────── every 3 hours (GitHub's scheduler) ───────────────────────┐
        │                                                                                  │
        ▼                                                                                  │
┌───────────────────┐   plain HTTPS GET    ┌──────────────────────┐                        │
│  ubuntu-latest    │ ───────────────────► │ worldsurfleague.com  │                        │
│  (throwaway VM,   │ ◄─────────────────── │  (server-rendered    │                        │
│   GitHub-hosted)  │      raw HTML        │   HTML)              │                        │
└─────────┬─────────┘                      └──────────────────────┘                        │
          │ node scripts/scrape-wsl.js  →  parse  →  write data/*.json                     │
          │ git commit + git push                                                          │
          ▼                                                                                │
┌───────────────────┐   push to main triggers  ┌──────────────────────┐                    │
│  the GitHub repo  │ ───────────────────────► │  GitHub Pages build  │ ───────────────────┘
└───────────────────┘                          └──────────┬───────────┘
                                                          │ static hosting
                                                          ▼
                                    roeisarid1.github.io/surfing-fantasy-2026/
                                                          │
                                                          │ fetch('data/season-2026.json')
                                                          ▼
                                                   participants' browsers
```

---

## 1. Why there is no CORS problem

This is the most counter-intuitive part, and it is worth understanding properly.

The original assumption was: *"a browser can display worldsurfleague.com, but
code can't read it, because of CORS."* That assumption is wrong in two separate
ways.

### CORS is enforced by the browser, not by the website

When JavaScript running on `roeisarid1.github.io` calls
`fetch('https://worldsurfleague.com/...')`, WSL's server responds normally and
sends the data. It is **the browser** that then inspects the response headers,
looks for an `Access-Control-Allow-Origin` header, and — if it doesn't like what
it finds — discards the body and hands the JavaScript an error.

The server never refused anything. The browser is the gatekeeper, and it only
guards code running inside a web page.

### Reason (a): the fetch was moved out of the browser

`node scripts/scrape-wsl.js` runs on a Linux VM. Node's `fetch` is not a
browser. There is no page, no origin, no same-origin policy, and therefore no
gatekeeper. It is exactly equivalent to running `curl` in a terminal — CORS is
not a concept that exists in that context at all.

### Reason (b): even in a browser it would have worked

Checking the actual response headers from WSL:

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8
Server: Apache/2.4.54 (Debian)
Access-Control-Allow-Origin: *
```

`*` means "any website may read this". A direct browser fetch was permitted all
along. The server-side route was still chosen — for reasons unrelated to CORS:

| | Browser fetch | Server-side scrape |
|---|---|---|
| Page weight | Every visitor downloads ~540 KB of WSL HTML | Downloaded once per 3 hours |
| Parsing cost | Every visitor's phone parses it | Parsed once |
| If WSL adds bot protection | App silently breaks for everyone | One failed-workflow email |
| If WSL drops the CORS header | App breaks | Nothing happens |
| History | None | Every change is a git commit |

### And the app itself never hits CORS

The client code fetches a **relative** path:

```js
// js/rankings.js
const res = await fetch('data/current-rankings-' + gender + '.json?v=' + Date.now());
```

Same origin as the page it's running on. Same-origin requests don't go through
CORS checks at all.

---

## 2. The cron schedule

It lives in the workflow YAML — this is the complete file:

```yaml
# .github/workflows/update-rankings.yml
name: Update WSL rankings

on:
  schedule:
    # Every 3 hours (UTC) — often enough to follow a running event's placings
    # and to flip it to completed soon after WSL calls it.
    - cron: '0 */3 * * *'
  workflow_dispatch:
    inputs:
      year:
        description: 'Season year to scrape'
        required: false
        default: '2026'

permissions:
  contents: write

concurrency:
  group: update-rankings
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Scrape worldsurfleague.com
        run: node scripts/scrape-wsl.js
        env:
          YEAR: ${{ inputs.year || '2026' }}

      - name: Commit if anything changed
        run: |
          if [ -z "$(git status --porcelain data/)" ]; then
            echo "No changes."
            exit 0
          fi
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/
          git commit -m "Update WSL rankings and event results ($(date -u '+%Y-%m-%d %H:%M UTC'))"
          git push
```

The schedule is a standard 5-field cron expression:

```
 0    */3    *      *      *
 │     │     │      │      │
 │     │     │      │      └── day of week  (any)
 │     │     │      └───────── month        (any)
 │     │     └──────────────── day of month (any)
 │     └────────────────────── hour         (every 3rd: 0,3,6,9,12,15,18,21)
 └──────────────────────────── minute       (:00)
```

Three things worth knowing:

- **It is always UTC.** Israel is UTC+3, so runs land at 03:00, 06:00, 09:00…
  local time. GitHub ignores local timezones and does not adjust for daylight saving.
- **It is best-effort, not guaranteed.** GitHub queues scheduled workflows
  globally; runs can be delayed by 10–20 minutes, or occasionally skipped when
  the platform is under load. Acceptable for surf results; unacceptable for
  anything time-critical.
- **`workflow_dispatch`** adds a second trigger: the "Run workflow" button in
  the repository's Actions tab. It accepts an optional `year` input, so a past
  season can be re-scraped without editing any code.

One operational caveat: GitHub automatically disables scheduled workflows after
**60 days of repository inactivity**. Since this workflow pushes commits, the
repository shouldn't go quiet — but if the schedule ever stops firing, that is
the first thing to check.

---

## 3. Which server actually runs this

`runs-on: ubuntu-latest`.

GitHub provisions a **fresh, disposable Ubuntu virtual machine** for every run.
It is not owned or rented by this project, and it does not persist: it boots,
performs the job, and is destroyed. Nothing carries over between runs. Public
repositories get this for free with no minute limit.

The four steps executed on it:

```
1. actions/checkout@v4        git clone the repo into the VM
2. actions/setup-node@v4      install Node.js
3. node scripts/scrape-wsl.js fetch, parse, write data/*.json
4. git add / commit / push    push the result back
```

### How it is allowed to push back

GitHub injects a temporary credential called `GITHUB_TOKEN` into every workflow
run — a token scoped to that repository and valid only for the lifetime of that
job. `actions/checkout` writes it into the VM's git configuration automatically,
which is why a bare `git push` works with no user-supplied secret anywhere.

Its permissions are capped by **two** independent settings, and both must allow
the write:

1. `permissions: contents: write` in the YAML — what the job *requests*.
2. The repository setting under *Settings → Actions → General → Workflow
   permissions* — the *ceiling*. If that is set to "Read repository contents
   and packages permissions", the push fails regardless of what the YAML says.

### Concurrency

```yaml
concurrency:
  group: update-rankings
  cancel-in-progress: false
```

Guarantees two runs never overlap. Without it, a manually triggered run during a
scheduled one could produce two commits racing to push, and one would be
rejected as non-fast-forward.

---

## 4. How the results are obtained without scraping 13 event pages

The obvious approach — scrape each event's own results page — is bad: those
pages are structured heat-by-heat (round of 32, round of 16, quarterfinals…),
reconstructing final placings from them is fiddly, and it means 13+ HTTP
requests.

The better route came from looking at the markup of the **rankings** page. Each
athlete's row contains not only rank / name / country / season points, but also
**one cell per event on the calendar**, whose tooltip holds that athlete's finish
in that specific event:

```html
<td class="athlete-event-place">
  <span data-tooltip="{...&lt;span&gt;3rd Place&lt;/span&gt; &lt;span&gt;6,085 Points&lt;/span&gt;...}">
    6,085
  </span>
</td>
```

So the entire season's results are a matrix embedded in a single page. Three
fetches cover everything:

| URL | Provides |
|---|---|
| `/athletes/tour/mct?year=2026` | Men's standings **and** every man's placing in all 13 events |
| `/athletes/tour/wct?year=2026` | The same for women |
| `/events/2026/ct?all=1` | The calendar: event number, name, dates, status |

### Why this works at all: server-rendered HTML

WSL builds these pages on their server and sends complete HTML. A plain HTTP GET
returns markup that already contains every row of data.

Had the site been a client-rendered single-page app that fetches its data after
loading, `curl` would return an empty shell and this approach would fail — a
headless browser would be required instead. **This distinction is the single
most important thing to check before deciding a site can be scraped simply.**

### The parsing layer

`scripts/lib/wsl.js` handles fetching and parsing. Its core function walks the
athlete rows and transposes them into per-event result lists:

```js
function parseRankings(html) {
  const standings = [];
  const rowsPlaces = [];

  for (const [, row] of html.matchAll(/<tr class="athlete-\d+[^"]*">([\s\S]*?)<\/tr>/g)) {
    const rank = /class="athlete-rank stat[^"]*"[^>]*>\s*(\d+)/.exec(row);
    const name = /class="athlete-name"[^>]*>\s*([^<]+)/.exec(row);
    if (!rank || !name) continue;

    const country = /class="athlete-country-name"[^>]*>\s*([^<]+)/.exec(row);
    const points  = /class="tour-points[^"]*"[^>]*>\s*([\d,]+)/.exec(row);

    const surfer = { rank: Number(rank[1]), name: decode(name[1]), /* … */ };
    standings.push(surfer);

    // One cell per calendar event. A finished event carries the placing in the
    // cell's tooltip; an unstarted one is just a dash.
    const places = [];
    for (const [, cell] of row.matchAll(/<td class="athlete-event-place[^"]*">([\s\S]*?)<\/td>/g)) {
      const place = /&lt;span&gt;(\d+)(?:st|nd|rd|th) Place&lt;/.exec(cell);
      places.push(place ? Number(place[1]) : null);
    }
    rowsPlaces.push({ surfer, places });
  }

  // Transpose: placesByEvent[n] is the finishing order of event n+1
  // …
}
```

A second function, `parseSchedule`, reads the calendar page and extracts WSL's
own status word for each event: `over`, `standby`, `live`, `on`, `upcoming`, or
`canceled`.

---

## 5. Tied placings — a domain detail that matters

WSL does not award unique positions. A Championship Tour event produces:

```
1st  ×1      2nd  ×1      3rd  ×2      5th  ×4
9th  ×8      17th ×14     33rd ×4
```

There is no unique 4th place (both semifinal losers are 3rd), and four surfers
share 5th (the quarterfinal losers).

The scraper records these real placings. The scoring engine (`js/scoring.js`)
already normalises them into tiers before comparing a prediction to a result:

```js
// Converts a raw WSL result rank into the scoring tier used for diff calculation.
// Men:   1→1, 2→2, 3-4→3, 5-8→5, 9+→null (outside)
// Women: 1→1, 2→2, 3-4→3, 5+→null (outside)
_wslTier(actualRank, topN) {
  if (actualRank === 1) return 1;
  if (actualRank === 2) return 2;
  if (actualRank === 3 || actualRank === 4) return 3;
  if (topN === 5 && actualRank >= 5 && actualRank <= 8) return 5;
  return null;
}
```

Because the tie groups occupy exactly the slots those tiers cover, switching
from hand-entered unique ranks (1…34) to real WSL placings **does not change any
score**. This was verified empirically: the Bells Beach event scores identically
before and after the migration.

The only visible consequence is in the UI — a "top 5" filter now returns eight
names rather than five, so the labels were changed to "Top Finishes".

---

## 6. What happens when a running event finishes

The scoring model only counts events flagged `completed: true`:

```js
buildCumulativeLeaderboard(participants, predictionsMap, events) {
  const completedEvents = events.filter(e => e.completed);
  // …
}
```

So the automatic flip of that flag is the whole point of the system:

```
while running   WSL schedule says "Standby" / "Running"
                → status: "standby", completed: false
                → partial placings are written (already-eliminated surfers)
                → the leaderboard ignores the event entirely

finals day      WSL flips the badge to "Completed"
                → the next run, at most 3 hours later:
                    status: "over"
                    men / women filled with final placings
                    completed: true
                    commit → push → Pages rebuild
                → every participant's leaderboard updates
```

No manual step is involved at any point.

---

## 7. Safety rails

Unattended automation that writes to a repository can corrupt data silently.
Four guards prevent that:

**Row-count floors.** If the parse yields fewer than 20 men, 15 women or 8
events, the script throws, exits with code `1`, and **writes nothing**:

```js
if (men.standings.length < MIN_MEN) {
  throw new Error(
    `men's rankings: ${men.standings.length} rows (expected ≥ ${MIN_MEN}) — ` +
      'the page markup probably changed'
  );
}
```

If WSL redesigns their HTML, the result is a failed-workflow notification rather
than an emptied leaderboard.

**"Completed" requires corroborating evidence.** WSL sometimes flips the
schedule badge before their rankings table catches up. Marking an event complete
with no results would score every participant zero:

```js
let completed = ev.completed;
if (completed && menResults.length === 0 && womenResults.length === 0) {
  warn(`event ${ev.number} (${ev.name}) is marked Completed on WSL but has no ` +
       'results in the rankings table yet — leaving it uncompleted for now');
  completed = false;
}
```

**Stable event ids.** Firestore admin overrides are keyed by event id. An alias
table pins WSL's slugs to the ids the app already uses, so a sponsor rename or a
calendar reshuffle on WSL's side cannot silently detach an override:

```js
const EVENT_ID_ALIASES = {
  'rip-curl-pro-bells-beach': 'bells-beach-2026',
  'western-australia-margaret-river-pro': 'margaret-river-2026',
  // …
};
```

**Nothing is ever deleted.** An event that disappears from WSL's calendar is
retained with a warning rather than dropped.

---

## 8. Data precedence — the one gotcha

```
worldsurfleague.com          ← the only upstream source of truth
        ↓ (scraper, every 3 hours)
data/*.json in the repo      ← committed, versioned, diffable
        ↓ (GitHub Pages build)
roeisarid1.github.io/.../data/*.json
        ↓ (fetch, same-origin)
Firestore override           ← WINS if one exists (currently: none)
        ↓
what participants actually see
```

The client reads Firestore first and only falls back to the JSON files:

```js
// js/rankings.js
async get(gender) {
  // 1. Firestore override
  const snap = await getDoc(doc(db, 'overrides', gender));
  if (snap.exists() && snap.data().data?.length > 0) {
    return { data: snap.data().data, source: 'override' };
  }
  // 2. Local JSON
  const res = await fetch('data/current-rankings-' + gender + '.json?v=' + Date.now());
  return { data: await res.json(), source: 'local' };
}
```

The `events` collection works the same way: `events.js` loads the season JSON as
a base and lets any Firestore document with a matching `id` replace it wholesale.

**Consequence:** an admin override is a *freeze*, not an edit. The automation
keeps updating the JSON files underneath while the app carries on displaying the
frozen copy — silently, with no indication that the two have diverged. This
actually happened: six hand-entered event documents and two rankings overrides
shadowed the scraper from the moment it was switched on, so the site showed
months-old standings while the repo held correct, current data.

Both collections have since been emptied, so every path above now resolves to
the scraped JSON. If an override is ever saved again, deleting that document
hands control back to the automation.

---

## Repository layout

```
SurfingFantasy/
├── index.html
├── styles.css
├── .github/workflows/
│   └── update-rankings.yml     # 3-hourly scrape + commit
├── scripts/
│   ├── scrape-wsl.js           # writes the three data/ files
│   └── lib/wsl.js              # worldsurfleague.com fetching + parsing
├── js/
│   ├── firebase.js             # Firestore init
│   ├── scoring.js              # pure scoring functions (incl. _wslTier)
│   ├── rankings.js             # data provider: Firestore override → JSON fallback
│   ├── events.js               # Firestore CRUD for events, merged over season JSON
│   ├── participants.js
│   ├── router.js
│   ├── ui.js
│   └── app.js
├── docs/
│   └── automation.md           # this document
└── data/
    ├── surfers-men.json
    ├── surfers-women.json
    ├── current-rankings-men.json     # written by the scraper
    ├── current-rankings-women.json   # written by the scraper
    └── season-2026.json              # written by the scraper
```
