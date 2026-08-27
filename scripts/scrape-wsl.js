/* ============================================================
   scrape-wsl.js — Pull everything the app needs from
   worldsurfleague.com and write it into data/.

     data/current-rankings-men.json     season standings (men)
     data/current-rankings-women.json   season standings (women)
     data/season-2026.json              per-event results + schedule

   Run:  node scripts/scrape-wsl.js
   Env:  YEAR=2026   (defaults to the current calendar year)

   Nothing is written unless the parse looks sane, so a markup change
   on WSL's side surfaces as a non-zero exit rather than empty results.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { fetchRankings, fetchSchedule, unmappedCountries } = require('./lib/wsl');

const YEAR = process.env.YEAR || String(new Date().getFullYear());
const DATA_DIR = path.join(__dirname, '..', 'data');
const SEASON_FILE = path.join(DATA_DIR, `season-${YEAR}.json`);

const MIN_MEN = 20;
const MIN_WOMEN = 15;
const MIN_EVENTS = 8;

/* The app's event ids are referenced by Firestore admin overrides
   (collection "events", keyed by these ids), so they must stay stable
   even though WSL's own slugs are longer and sponsor-dependent. Anything
   not listed here falls back to `<wsl-slug>-<year>`. */
const EVENT_ID_ALIASES = {
  'rip-curl-pro-bells-beach': 'bells-beach-2026',
  'western-australia-margaret-river-pro': 'margaret-river-2026',
  'bonsoy-gold-coast-pro': 'gold-coast-2026',
  'corona-cero-new-zealand-pro': 'new-zealand-2026',
  'surf-city-el-salvador-pro': 'el-salvador-2026',
  'vivo-rio-pro': 'rio-pro-2026',
  'outerknown-tahiti-pro': 'tahiti-pro-2026',
  'fiji-pro': 'fiji-pro-2026',
  'lexus-trestles-pro': 'trestles-pro-2026',
  'meo-rip-curl-pro-portugal': 'portugal-pro-2026',
  'surf-abu-dhabi': 'surf-abu-dhabi-2026',
  'lexus-pipe-masters': 'pipe-masters-2026'
};

const SEASON_BONUS_ID = 'world-rankings-bonus';

const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn(`  ! ${msg}`);
};

/* ------------------------------------------------------------
   Serialising
   ------------------------------------------------------------ */

/** One surfer per line, so a live event produces a readable git diff. */
function surferLine(s, indent) {
  return (
    `${indent}{ "rank": ${s.rank}, "name": ${JSON.stringify(s.name)}, ` +
    `"country": ${JSON.stringify(s.country)} }`
  );
}

function serializeRankings(rows) {
  const lines = rows.map(
    (r) =>
      `  { "rank": ${r.rank}, "name": ${JSON.stringify(r.name)}, ` +
      `"country": ${JSON.stringify(r.country)}, "points": ${r.points} }`
  );
  return `[\n${lines.join(',\n')}\n]\n`;
}

function serializeSeason(events) {
  const blocks = events.map((ev) => {
    const field = (k) => `    ${JSON.stringify(k)}: ${JSON.stringify(ev[k])}`;
    const list = (k) =>
      ev[k].length === 0
        ? `    ${JSON.stringify(k)}: []`
        : `    ${JSON.stringify(k)}: [\n` +
          ev[k].map((s) => surferLine(s, '      ')).join(',\n') +
          `\n    ]`;

    return (
      '  {\n' +
      [
        field('id'),
        field('name'),
        field('date'),
        field('order'),
        field('type'),
        field('status'),
        field('completed'),
        list('men'),
        list('women')
      ].join(',\n') +
      '\n  }'
    );
  });
  return `[\n${blocks.join(',\n')}\n]\n`;
}

function writeIfChanged(file, next, label) {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (next === prev) {
    console.log(`${label}: unchanged`);
    return false;
  }
  fs.writeFileSync(file, next);
  console.log(`${label}: updated`);
  return true;
}

/* ------------------------------------------------------------
   Season file
   ------------------------------------------------------------ */

function eventId(ev, existing) {
  if (ev.slug && EVENT_ID_ALIASES[ev.slug]) return EVENT_ID_ALIASES[ev.slug];

  // WSL publishes some events before their page exists, so an event can gain a
  // slug mid-season. Reusing the id we already stored for that name keeps the
  // event from splitting in two once the link appears.
  const known = existing.find((e) => e.name === ev.name && e.id !== SEASON_BONUS_ID);
  if (known) return known.id;

  if (!ev.slug) return `ct-event-${String(ev.number).padStart(2, '0')}-${YEAR}`;
  return `${ev.slug}-${YEAR}`;
}

function buildSeason(schedule, men, women, existing) {
  const events = schedule.map((ev) => {
    const idx = ev.number - 1;
    const menResults = men.placesByEvent[idx] || [];
    const womenResults = women.placesByEvent[idx] || [];

    // WSL flips the schedule badge to "Completed" before we can be sure the
    // rankings table caught up. Scoring an event with no results would hand
    // every participant a zero, so require at least one result to agree.
    let completed = ev.completed;
    if (completed && menResults.length === 0 && womenResults.length === 0) {
      warn(
        `event ${ev.number} (${ev.name}) is marked Completed on WSL but has no ` +
          'results in the rankings table yet — leaving it uncompleted for now'
      );
      completed = false;
    }

    return {
      id: eventId(ev, existing),
      name: ev.name,
      date: ev.date,
      order: ev.number,
      type: 'competition',
      status: ev.status,
      completed,
      men: menResults,
      women: womenResults
    };
  });

  // Anything the app knows about that WSL no longer lists — keep it rather
  // than silently dropping results someone may already have been scored on.
  const producedIds = new Set([...events.map((e) => e.id), SEASON_BONUS_ID]);
  for (const old of existing) {
    if (producedIds.has(old.id)) continue;
    warn(`event "${old.id}" is no longer on WSL's calendar — kept as-is`);
    events.push({ status: 'unknown', ...old });
  }

  events.sort((a, b) => (a.order || 0) - (b.order || 0));

  const prevBonus = existing.find((e) => e.id === SEASON_BONUS_ID);
  const seasonOver =
    events.length > 0 &&
    events.every((e) => e.completed || e.status === 'canceled');

  events.push({
    id: SEASON_BONUS_ID,
    name: prevBonus?.name || 'Season Bonus — WSL World Rankings',
    date: prevBonus?.date || `${YEAR}-12-31`,
    order: events.length + 1,
    type: 'season',
    status: seasonOver ? 'over' : 'upcoming',
    completed: seasonOver,
    // Final standings decide the bonus; keeping them live lets the app
    // preview where the bonus stands mid-season.
    men: men.standings.map(({ rank, name, country }) => ({ rank, name, country })),
    women: women.standings.map(({ rank, name, country }) => ({ rank, name, country }))
  });

  return events;
}

/* ------------------------------------------------------------ */

async function main() {
  const [men, women, schedule] = await Promise.all([
    fetchRankings('mct', YEAR),
    fetchRankings('wct', YEAR),
    fetchSchedule(YEAR)
  ]);

  if (men.standings.length < MIN_MEN) {
    throw new Error(
      `men's rankings: ${men.standings.length} rows (expected ≥ ${MIN_MEN}) — ` +
        'the page markup probably changed'
    );
  }
  if (women.standings.length < MIN_WOMEN) {
    throw new Error(
      `women's rankings: ${women.standings.length} rows (expected ≥ ${MIN_WOMEN}) — ` +
        'the page markup probably changed'
    );
  }
  if (schedule.length < MIN_EVENTS) {
    throw new Error(
      `schedule: ${schedule.length} events (expected ≥ ${MIN_EVENTS}) — ` +
        'the page markup probably changed'
    );
  }

  console.log(
    `Fetched ${YEAR}: ${men.standings.length} men, ${women.standings.length} women, ` +
      `${schedule.length} events`
  );

  writeIfChanged(
    path.join(DATA_DIR, 'current-rankings-men.json'),
    serializeRankings(men.standings),
    `rankings/men   (leader ${men.standings[0].name})`
  );
  writeIfChanged(
    path.join(DATA_DIR, 'current-rankings-women.json'),
    serializeRankings(women.standings),
    `rankings/women (leader ${women.standings[0].name})`
  );

  const existing = fs.existsSync(SEASON_FILE)
    ? JSON.parse(fs.readFileSync(SEASON_FILE, 'utf8'))
    : [];
  const season = buildSeason(schedule, men, women, existing);
  writeIfChanged(SEASON_FILE, serializeSeason(season), `season-${YEAR}`);

  for (const ev of season) {
    if (ev.type === 'season') continue;
    const state = ev.completed ? 'done' : ev.status;
    console.log(
      `  ${String(ev.order).padStart(2)}. ${ev.name} — ${ev.date} — ${state} ` +
        `(${ev.men.length}m / ${ev.women.length}w)`
    );
  }

  for (const c of unmappedCountries()) {
    warn(`no country code mapped for "${c}" — wrote the full name`);
  }

  if (warnings.length) console.log(`\n${warnings.length} warning(s).`);
}

main().catch((err) => {
  console.error(`FAILED — ${err.message}`);
  process.exit(1);
});
