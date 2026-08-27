/* ============================================================
   lib/wsl.js — Fetching and parsing of worldsurfleague.com.

   Every page WSL serves for rankings and schedules is server-rendered,
   so plain HTML + regex is enough; no browser or API key involved.

   Two pages carry everything this project needs:

     /athletes/tour/{mct,wct}?year=YYYY
         One row per athlete: rank, name, country, season points — plus
         one "event place" cell per event on the calendar, whose tooltip
         holds that athlete's finish ("3rd Place", "9th Place", …).
         So a single fetch yields both the season standings and the full
         per-event results matrix.

     /events/YYYY/ct?all=1
         The calendar: event number, name, date range and status.
   ============================================================ */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* WSL prints full country names; the app's JSON uses short codes. */
const COUNTRY_CODES = {
  'Australia': 'AUS',
  'Brazil': 'BRA',
  'Canada': 'CAN',
  'Costa Rica': 'CRC',
  'France': 'FRA',
  'Hawaii': 'HAW',
  'Indonesia': 'INA',
  'Israel': 'ISR',
  'Italy': 'ITA',
  'Japan': 'JPN',
  'Mexico': 'MEX',
  'Morocco': 'MAR',
  'New Zealand': 'NZL',
  'Peru': 'PER',
  'Portugal': 'POR',
  'South Africa': 'RSA',
  'Spain': 'ESP',
  'United States': 'USA'
};

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&#39;': "'",
  '&nbsp;': ' '
};

const unknownCountries = new Set();

function decode(s) {
  return s
    .replace(/&#0?39;|&amp;|&lt;|&gt;|&quot;|&nbsp;/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function countryCode(fullName) {
  if (!fullName) return '';
  const code = COUNTRY_CODES[fullName];
  if (!code) unknownCountries.add(fullName);
  return code || fullName;
}

/** Country names seen during this run that have no short code mapped. */
function unmappedCountries() {
  return [...unknownCountries];
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' }
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

/* ------------------------------------------------------------
   Rankings
   ------------------------------------------------------------ */

/**
 * Parses a tour rankings page.
 * Returns { standings, eventCount, placesByEvent } where placesByEvent[n]
 * is the finishing order of event n+1 (1-based event numbers, WSL's own
 * tied placings: 1, 2, 3, 3, 5, 5, 5, 5, 9, …).
 */
function parseRankings(html) {
  const standings = [];
  const rowsPlaces = [];

  for (const [, row] of html.matchAll(/<tr class="athlete-\d+[^"]*">([\s\S]*?)<\/tr>/g)) {
    const rank = /class="athlete-rank stat[^"]*"[^>]*>\s*(\d+)/.exec(row);
    const name = /class="athlete-name"[^>]*>\s*([^<]+)/.exec(row);
    if (!rank || !name) continue;

    const country = /class="athlete-country-name"[^>]*>\s*([^<]+)/.exec(row);
    // Inner span may carry extra classes, e.g. `tour-points eliminated`.
    const points = /class="tour-points[^"]*"[^>]*>\s*([\d,]+)/.exec(row);

    const surfer = {
      rank: Number(rank[1]),
      name: decode(name[1]),
      country: countryCode(country ? decode(country[1]) : ''),
      points: points ? Number(points[1].replace(/,/g, '')) : 0
    };
    standings.push(surfer);

    // One cell per calendar event. A finished event carries the placing in
    // the cell's tooltip; an unstarted one is just a dash.
    const places = [];
    for (const [, cell] of row.matchAll(
      /<td class="athlete-event-place[^"]*">([\s\S]*?)<\/td>/g
    )) {
      const place = /&lt;span&gt;(\d+)(?:st|nd|rd|th) Place&lt;/.exec(cell);
      places.push(place ? Number(place[1]) : null);
    }
    rowsPlaces.push({ surfer, places });
  }

  standings.sort((a, b) => a.rank - b.rank);

  const eventCount = rowsPlaces.reduce((max, r) => Math.max(max, r.places.length), 0);
  const placesByEvent = [];
  for (let i = 0; i < eventCount; i++) {
    placesByEvent.push(
      rowsPlaces
        .filter((r) => r.places[i] != null)
        .map((r) => ({
          rank: r.places[i],
          name: r.surfer.name,
          country: r.surfer.country
        }))
        // Ties keep a stable alphabetical order so re-runs don't churn the diff.
        .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    );
  }

  return { standings, eventCount, placesByEvent };
}

async function fetchRankings(tourCode, year) {
  const url = `https://www.worldsurfleague.com/athletes/tour/${tourCode}?year=${year}`;
  return parseRankings(await fetchPage(url));
}

/* ------------------------------------------------------------
   Schedule
   ------------------------------------------------------------ */

/**
 * Parses the season calendar.
 * Returns [{ number, name, slug, date, dateRange, status, completed }].
 * `status` is WSL's own word: over | live | on | standby | upcoming | canceled.
 * Only `over` counts as completed — anything else may still change.
 */
function parseSchedule(html, year) {
  const events = [];

  for (const [, row] of html.matchAll(/<tr class="event-\d+[^"]*">([\s\S]*?)<\/tr>/g)) {
    const secondary = /class="event-tour-details__secondary"[^>]*>\s*([^<]*)/.exec(row);
    const numberMatch = secondary && /Event\s+(\d+)/i.exec(secondary[1]);
    if (!numberMatch) continue;

    const nameMatch = /class="event-schedule-details__event-name"[^>]*>\s*([^<]*)/.exec(row);
    const hrefMatch = /class="event-schedule-details__event-name"[^>]*href="([^"]+)"/.exec(row);
    const rangeMatch = /class="event-date-range[^"]*">\s*([^<]*)/.exec(row);
    const statusMatch = /class="event-status event-status--([a-z-]+)"><span>\s*([^<]*)/.exec(row);

    const number = Number(numberMatch[1]);
    const dateRange = rangeMatch ? decode(rangeMatch[1]) : '';
    const status = statusMatch ? statusMatch[1] : 'upcoming';
    // Slug sits between the numeric event id and the trailing page name:
    //   /events/2026/ct/436/rip-curl-pro-bells-beach/main
    const slugMatch = hrefMatch && /\/ct\/\d+\/([^/]+)\//.exec(hrefMatch[1]);

    events.push({
      number,
      name: nameMatch && decode(nameMatch[1]) ? decode(nameMatch[1]) : `CT Event ${number} (TBA)`,
      slug: slugMatch ? slugMatch[1] : null,
      date: startDate(dateRange, year),
      dateRange,
      status,
      completed: status === 'over'
    });
  }

  events.sort((a, b) => a.number - b.number);
  return events;
}

/** "Apr 1 - 11" / "Aug 25 - Sep 4" → "2026-04-01" (the opening day). */
function startDate(range, year) {
  const m = /^([A-Z][a-z]{2})\s+(\d+)/.exec(range);
  if (!m || !MONTHS[m[1]]) return '';
  return `${year}-${String(MONTHS[m[1]]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}

async function fetchSchedule(year) {
  const url = `https://www.worldsurfleague.com/events/${year}/ct?all=1`;
  return parseSchedule(await fetchPage(url), year);
}

module.exports = {
  fetchRankings,
  fetchSchedule,
  parseRankings,
  parseSchedule,
  unmappedCountries
};
