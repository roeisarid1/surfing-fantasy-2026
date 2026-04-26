/* ============================================================
   app.js — Bootstrap + all view renderers
   ES module: imports all dependencies
   ============================================================ */
import { Storage }      from './storage.js';
import { Scoring }      from './scoring.js';
import { Participants } from './participants.js';
import { Rankings }     from './rankings.js';
import { Events }       from './events.js';
import { Router }       from './router.js';
import { UI }           from './ui.js';
import { db, collection, getDocs, onSnapshot } from './firebase.js';

// Expose Scoring to UI helpers
window._Scoring = Scoring;

// Active Firestore real-time unsubscribe
let _unsub = null;
function clearListener() { if (_unsub) { _unsub(); _unsub = null; } }

function setView(html) {
  UI.stopCountdown();
  clearListener();
  document.getElementById('app').innerHTML = html;
}

/* ============================================================
   VIEW: DASHBOARD
   ============================================================ */
async function viewDashboard() {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);

  const [{ men, women }, events] = await Promise.all([
    Rankings.getBoth(),
    Events.getAll()
  ]);
  const completedEvents = events.filter(e => e.completed);

  _unsub = onSnapshot(collection(db, 'participants'), async (snap) => {
    const participants = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const predSnap = await getDocs(collection(db, 'predictions'));
    const predictionsMap = {};
    predSnap.forEach(d => { predictionsMap[d.id] = d.data(); });

    const hasEvents   = completedEvents.length > 0;
    const leaderboard = hasEvents
      ? Scoring.buildCumulativeLeaderboard(participants, predictionsMap, events)
      : [];
    const submitted = participants.filter(p => predictionsMap[p.id]).length;

    const topRows = hasEvents
      ? leaderboard.slice(0, 5).map(row => `
          <div class="dash-leader-row">
            ${UI.rankBadge(row.displayRank)}
            <span class="dash-leader-row__name">${UI.esc(row.participant.name)}</span>
            ${row.hasPredictions
              ? `<span class="dash-leader-row__score">${row.total} pts</span>`
              : `<span class="pill pill--gray">No picks</span>`}
          </div>`).join('')
      : `<div class="empty-state" style="padding:28px 20px">
           <div class="empty-state__icon">🌊</div>
           <div class="empty-state__title">Season hasn't started yet</div>
           <div class="empty-state__desc">Scores will appear once the first event results are entered.</div>
         </div>`;

    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <h1>🏄 Fantasy Surf League 2026</h1>
        <p>WSL Championship Tour · Season-long prediction league</p>
      </div>

      <div class="card-grid" style="margin-bottom:28px">
        <div class="stat-card">
          <div class="stat-card__value">${participants.length}</div>
          <div class="stat-card__label">Participants</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${submitted}</div>
          <div class="stat-card__label">Picks Submitted</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${completedEvents.length}</div>
          <div class="stat-card__label">Events Done</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${events.length}</div>
          <div class="stat-card__label">Total Events</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <h2 style="font-size:17px;font-weight:700">Fantasy Leaderboard</h2>
          <a href="#/leaderboard" class="btn btn-secondary btn-sm">View</a>
        </div>
        ${participants.length === 0
          ? `<div class="empty-state">
              <div class="empty-state__icon">🏆</div>
              <div class="empty-state__title">No participants yet</div>
              <div class="empty-state__desc">Add participants and submit picks to see rankings.</div>
              <a href="#/participants" class="btn btn-primary">Add Participants</a>
             </div>`
          : `<div>${topRows}</div>
             ${hasEvents && leaderboard.length > 5
               ? `<div style="text-align:center;margin-top:12px">
                    <a href="#/leaderboard" class="btn btn-secondary btn-sm">View full leaderboard →</a>
                  </div>` : ''}`}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <h3 style="font-size:14px;font-weight:700;margin-bottom:12px;color:var(--text-muted)">MEN — TOP 3</h3>
          ${men.data.slice(0,3).map(s => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              ${UI.rankBadge(s.rank)}
              <span style="font-size:13px">${UI.flag(s.country)} ${UI.esc(s.name)}</span>
            </div>`).join('') || '<span style="color:var(--text-dim);font-size:13px">No data</span>'}
          <a href="#/standings" style="font-size:12px;color:var(--accent)">Full standings →</a>
        </div>
        <div class="card">
          <h3 style="font-size:14px;font-weight:700;margin-bottom:12px;color:var(--text-muted)">WOMEN — TOP 3</h3>
          ${women.data.slice(0,3).map(s => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              ${UI.rankBadge(s.rank)}
              <span style="font-size:13px">${UI.flag(s.country)} ${UI.esc(s.name)}</span>
            </div>`).join('') || '<span style="color:var(--text-dim);font-size:13px">No data</span>'}
          <a href="#/standings" style="font-size:12px;color:var(--accent)">Full standings →</a>
        </div>
      </div>
    `;
  });
}

/* ============================================================
   VIEW: PARTICIPANTS
   ============================================================ */
function viewParticipants() {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);

  _unsub = onSnapshot(collection(db, 'participants'), async (snap) => {
    const isAdmin = Storage.isAdmin();
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const predSnap = await getDocs(collection(db, 'predictions'));
    const predsMap = {};
    predSnap.forEach(d => { predsMap[d.id] = d.data(); });

    const rows = list.map(p => {
      const pred     = predsMap[p.id];
      const locked   = Participants.isLocked(pred?.submittedAt);
      const hasPicks = !!pred;
      const statusPill = !hasPicks
        ? `<span class="pill pill--gray">No picks</span>`
        : locked
          ? `<span class="pill pill--green">Locked in</span>`
          : `<span class="pill pill--yellow">Editing</span>`;

      return `
        <div class="participant-row" id="prow-${UI.esc(p.id)}">
          <div class="participant-row__name">${UI.esc(p.name)}</div>
          <div class="participant-row__meta">${statusPill}</div>
          <div class="participant-row__actions">
            <a href="#/predictions/${UI.esc(p.id)}" class="btn btn-primary btn-sm">
              ${hasPicks ? (locked ? '👁 View' : '✏️ Edit') : '+ Picks'}
            </a>
            ${isAdmin ? `<button class="btn btn-secondary btn-sm btn-rename" data-id="${UI.esc(p.id)}" data-name="${UI.esc(p.name)}">Rename</button>` : ''}
            ${isAdmin ? `<button class="btn btn-danger btn-sm btn-delete" data-id="${UI.esc(p.id)}" data-name="${UI.esc(p.name)}">✕</button>` : ''}
          </div>
        </div>`;
    }).join('');

    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <h1>Participants</h1>
        <p>Manage league members and their pick submissions.</p>
      </div>
      <div class="card" style="margin-bottom:24px">
        <h3 style="font-size:14px;font-weight:700;margin-bottom:14px;color:var(--text-muted)">ADD PARTICIPANT</h3>
        <div class="form-row">
          <div class="form-group">
            <input type="text" id="newName" placeholder="Enter name…" maxlength="40" />
          </div>
          <button class="btn btn-primary" id="btnAdd">Add</button>
        </div>
      </div>
      ${list.length === 0
        ? `<div class="empty-state">
            <div class="empty-state__icon">👥</div>
            <div class="empty-state__title">No participants yet</div>
            <div class="empty-state__desc">Add the first league member above.</div>
           </div>`
        : `<div id="participantList">${rows}</div>`}
    `;

    const doAdd = async () => {
      const input = document.getElementById('newName');
      const name  = input?.value.trim();
      if (!name) { UI.toast('Please enter a name'); return; }
      input.value = '';
      await Participants.add(name);
      UI.toast(`"${name}" added!`);
    };
    document.getElementById('btnAdd')?.addEventListener('click', doAdd);
    document.getElementById('newName')?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

    document.querySelectorAll('.btn-rename').forEach(btn => {
      btn.addEventListener('click', () => {
        const id   = btn.dataset.id;
        const name = btn.dataset.name;
        const row  = document.getElementById('prow-' + id);
        if (!row) return;
        row.querySelector('.participant-row__name').innerHTML = `
          <div class="inline-edit-form">
            <input type="text" id="rename-${id}" value="${UI.esc(name)}" maxlength="40" />
            <button class="btn btn-success btn-sm" id="saveRename-${id}">Save</button>
            <button class="btn btn-secondary btn-sm" id="cancelRename-${id}">Cancel</button>
          </div>`;
        document.getElementById(`rename-${id}`)?.focus();
        document.getElementById(`saveRename-${id}`)?.addEventListener('click', async () => {
          const val = document.getElementById(`rename-${id}`)?.value.trim();
          if (!val) return;
          await Participants.update(id, val);
          UI.toast(`Renamed to "${val}"`);
        });
        document.getElementById(`cancelRename-${id}`)?.addEventListener('click', () => {
          row.querySelector('.participant-row__name').textContent = name;
        });
        document.getElementById(`rename-${id}`)?.addEventListener('keydown', e => {
          if (e.key === 'Enter') document.getElementById(`saveRename-${id}`)?.click();
        });
      });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.confirm('Delete participant', `Remove "${btn.dataset.name}" and all their picks?`, async () => {
          await Participants.delete(btn.dataset.id);
          UI.toast(`"${btn.dataset.name}" removed`);
        });
      });
    });
  });
}

/* ============================================================
   VIEW: PREDICTION ENTRY
   ============================================================ */
async function viewPredictions(id) {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);

  const participant = await Participants.getById(id);
  if (!participant) {
    setView(`<div class="empty-state"><div class="empty-state__title">Participant not found</div><a href="#/participants" class="btn btn-primary" style="margin-top:16px">Back</a></div>`);
    return;
  }

  const existing    = await Participants.getPredictions(id);
  const locked      = Participants.isLocked(existing?.submittedAt);
  const msRemaining = Participants.msUntilLock(existing?.submittedAt);

  let [menPool, womenPool] = [[], []];
  try {
    [menPool, womenPool] = await Promise.all([
      fetch('data/surfers-men.json').then(r => r.json()),
      fetch('data/surfers-women.json').then(r => r.json())
    ]);
  } catch(e) { console.warn('Could not load surfer pool', e); }

  let menPicks   = existing ? [...existing.men]   : ['','','','',''];
  let womenPicks = existing ? [...existing.women] : ['','',''];

  function buildLockBanner() {
    if (!existing)  return `<div class="lock-banner lock-banner--open">🟢 Submit your picks. You'll have 1 hour to make changes.</div>`;
    if (locked)     return `<div class="lock-banner lock-banner--locked">🔒 Picks are locked. No more edits allowed.</div>`;
    return `<div class="lock-banner lock-banner--editing">⏳ Picks editable for <span id="lockCountdown" style="font-weight:800">…</span> more</div>`;
  }

  function buildPicker(pool, picks, prefix) {
    const usedSet = new Set(picks.filter(Boolean).map(n => n.toLowerCase()));
    const slots = picks.map((name, i) => `
      <div class="slot ${name ? 'slot--filled' : ''}" data-slot="${i}" data-prefix="${prefix}">
        <span class="slot__rank">${UI.ordinal(i+1)}</span>
        ${name
          ? `<span class="slot__name">${UI.esc(name)}</span>
             ${!locked ? `<button class="slot__clear" data-slot="${i}" data-prefix="${prefix}" title="Clear">×</button>` : ''}`
          : `<span class="slot__empty">— pick surfer —</span>`}
      </div>`).join('');

    const poolItems = pool.map(s => {
      const used = usedSet.has(s.name.toLowerCase());
      return `<div class="pool-item ${used ? 'pool-item--used' : ''}" data-name="${UI.esc(s.name)}" data-prefix="${prefix}">
        <span>${UI.flag(s.country)} ${UI.esc(s.name)}</span>
        <span style="font-size:12px;color:var(--text-dim)">${UI.esc(s.country)}</span>
      </div>`;
    }).join('');

    return `
      <div class="picker-layout">
        <div class="picker-slots">
          <h3>${prefix === 'men' ? '🏄 Men — Top 5' : '🏄‍♀️ Women — Top 3'}</h3>
          <div id="${prefix}-slots">${slots}</div>
        </div>
        <div class="picker-pool">
          <h3>Surfer Pool</h3>
          <div class="pool-list" id="${prefix}-pool">${poolItems}</div>
        </div>
      </div>`;
  }

  function render() {
    setView(`
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <a href="#/participants" class="btn btn-secondary btn-sm">← Back</a>
        <h1 style="font-size:22px;font-weight:800">${UI.esc(participant.name)}'s Picks</h1>
      </div>
      ${buildLockBanner()}
      ${buildPicker(menPool, menPicks, 'men')}
      <div style="margin:20px 0;border-top:1px solid var(--border)"></div>
      ${buildPicker(womenPool, womenPicks, 'women')}
      ${locked ? '' : `
        <div style="margin-top:24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary" id="btnSave">💾 Save Picks</button>
          <span style="font-size:13px;color:var(--text-dim)">
            ${existing ? 'Updates locked after 1-hour window.' : 'Saving starts your 1-hour edit window.'}
          </span>
        </div>`}
    `);

    if (!locked) attachPickerListeners();
    if (!locked && existing && msRemaining > 0) {
      UI.startCountdown('lockCountdown', msRemaining, () => {
        UI.toast('Picks are now locked!');
        viewPredictions(id);
      });
    }
  }

  function attachPickerListeners() {
    document.querySelectorAll('.pool-item:not(.pool-item--used)').forEach(item => {
      item.addEventListener('click', () => {
        const picks = item.dataset.prefix === 'men' ? menPicks : womenPicks;
        const emptyIdx = picks.findIndex(p => !p);
        if (emptyIdx === -1) { UI.toast('All slots filled — clear one first'); return; }
        picks[emptyIdx] = item.dataset.name;
        render();
      });
    });

    document.querySelectorAll('.slot__clear').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.prefix === 'men') menPicks[parseInt(btn.dataset.slot)] = '';
        else womenPicks[parseInt(btn.dataset.slot)] = '';
        render();
      });
    });

    document.getElementById('btnSave')?.addEventListener('click', async () => {
      if (menPicks.filter(Boolean).length < 5)   { UI.toast('Please fill all 5 men\'s picks');   return; }
      if (womenPicks.filter(Boolean).length < 3)  { UI.toast('Please fill all 3 women\'s picks'); return; }
      await Participants.savePredictions(id, menPicks, womenPicks);
      UI.toast('✅ Picks saved!');
      viewPredictions(id);
    });
  }

  render();
}

/* ============================================================
   VIEW: STANDINGS
   ============================================================ */
async function viewStandings() {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);
  const { men, women } = await Rankings.getBoth();

  setView(`
    <div class="page-header">
      <h1>WSL Rankings 2026</h1>
      <p>Current Championship Tour standings</p>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:24px;flex-wrap:wrap">
      ${UI.sourceBadge(men.source)}
      <span style="font-size:12px;color:var(--text-dim)">
        ${men.source === 'override' ? 'Admin override active' : 'Using local JSON data'}
      </span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        <div class="section-title">🏄 Men's CT</div>
        <div class="card" style="padding:0;overflow:hidden">${UI.rankingsTable(men.data, 5)}</div>
      </div>
      <div>
        <div class="section-title">🏄‍♀️ Women's CT</div>
        <div class="card" style="padding:0;overflow:hidden">${UI.rankingsTable(women.data, 3)}</div>
      </div>
    </div>
    <p style="margin-top:16px;font-size:12px;color:var(--text-dim);text-align:right">
      World rankings are informational. Fantasy scores are based on per-event results.
    </p>
  `);
}

/* ============================================================
   VIEW: EVENTS
   ============================================================ */
async function viewEvents() {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);

  const [events, participantsSnap, predSnap] = await Promise.all([
    Events.getAll(),
    getDocs(collection(db, 'participants')),
    getDocs(collection(db, 'predictions'))
  ]);

  const participants = participantsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const predictionsMap = {};
  predSnap.forEach(d => { predictionsMap[d.id] = d.data(); });

  if (events.length === 0) {
    setView(`
      <div class="page-header"><h1>Events</h1><p>Season competition results</p></div>
      <div class="empty-state">
        <div class="empty-state__icon">🏆</div>
        <div class="empty-state__title">No events yet</div>
        <div class="empty-state__desc">Add events via the Admin page once competitions are completed.</div>
        <a href="#/admin" class="btn btn-primary">Go to Admin</a>
      </div>`);
    return;
  }

  const completedCount = events.filter(e => e.completed).length;

  const eventCards = events.map(event => {
    const typeBadge = event.type === 'season'
      ? `<span class="pill" style="background:var(--yellow);color:#000;font-size:11px">Season Bonus</span>`
      : `<span class="pill pill--gray" style="font-size:11px">Competition</span>`;
    const statusBadge = event.completed
      ? `<span class="pill pill--green" style="font-size:11px">✅ Completed</span>`
      : `<span class="pill pill--gray" style="font-size:11px">⏳ Upcoming</span>`;
    const dateStr = event.date
      ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    if (!event.completed) {
      return `
        <div class="card" style="margin-bottom:16px;opacity:.6">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:16px;font-weight:700">${UI.esc(event.name)}</span>
            ${typeBadge} ${statusBadge}
            ${dateStr ? `<span style="font-size:12px;color:var(--text-dim)">${dateStr}</span>` : ''}
          </div>
        </div>`;
    }

    // Build per-participant scores for this event
    const eventRows = participants.map(p => {
      const pred  = predictionsMap[p.id] || null;
      const score = Scoring.scoreParticipantForEvent(pred, event);
      return { participant: p, score, hasPredictions: !!pred };
    });
    eventRows.sort((a, b) => b.score.total - a.score.total);

    let displayRank = 1;
    eventRows.forEach((row, i) => {
      if (i > 0 && eventRows[i].score.total < eventRows[i - 1].score.total) displayRank = i + 1;
      row.displayRank = displayRank;
    });

    const scoreRows = eventRows.map(row => `
      <div class="leaderboard-row" data-eid="${UI.esc(event.id)}" data-pid="${UI.esc(row.participant.id)}" style="cursor:pointer">
        <div class="leaderboard-row__rank">${UI.rankBadge(row.displayRank)}</div>
        <div class="leaderboard-row__name">${UI.esc(row.participant.name)}</div>
        ${row.hasPredictions
          ? `<div style="font-size:12px;color:var(--text-muted)">
               <span>⚡ Men: ${row.score.men.reduce((s,p)=>s+p.points,0)}</span>&nbsp;
               <span>⚡ Women: ${row.score.women.reduce((s,p)=>s+p.points,0)}</span>
             </div>`
          : `<span class="pill pill--gray">No picks</span>`}
        <div class="leaderboard-row__score">${row.hasPredictions ? row.score.total : '—'}</div>
        <div class="leaderboard-row__pts-label">pts</div>
        ${row.hasPredictions ? `<div class="leaderboard-row__chevron">›</div>` : ''}
      </div>
      <div id="ebd-${UI.esc(event.id)}-${UI.esc(row.participant.id)}" style="display:none"></div>
    `).join('');

    const topMen = (event.men || []).filter(s => s.rank <= 5).sort((a,b) => a.rank - b.rank);
    const topWomen = (event.women || []).filter(s => s.rank <= 3).sort((a,b) => a.rank - b.rank);

    const podiumCol = (surfers, label) => surfers.length === 0 ? '' : `
      <div style="flex:1;min-width:160px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">${label}</div>
        ${surfers.map(s => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px">
            ${UI.rankBadge(s.rank)}
            <span>${UI.flag(s.country)} ${UI.esc(s.name)}</span>
          </div>`).join('')}
      </div>`;

    const hasPodium = topMen.length || topWomen.length;
    const bodyId = `body-${UI.esc(event.id)}`;
    return `
      <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer" data-body-toggle="${bodyId}">
          <span style="font-size:16px;font-weight:700">${UI.esc(event.name)}</span>
          ${typeBadge} ${statusBadge}
          ${dateStr ? `<span style="font-size:12px;color:var(--text-dim)">${dateStr}</span>` : ''}
          <span data-chevron="${bodyId}" style="margin-left:auto;font-size:18px;color:var(--text-muted);line-height:1;transition:transform .2s;display:inline-block">⌄</span>
        </div>
        <div id="${bodyId}">
          ${hasPodium ? `
          <div style="padding:16px 20px;border-bottom:1px solid var(--border);background:var(--surface);display:flex;gap:32px;flex-wrap:wrap">
            ${podiumCol(topMen, '🏄 Men — Top 5')}
            ${podiumCol(topWomen, '🏄‍♀️ Women — Top 3')}
          </div>` : ''}
          <div>${scoreRows}</div>
        </div>
      </div>`;
  }).join('');

  setView(`
    <div class="page-header">
      <h1>Events</h1>
      <p>Season competition results · ${completedCount} of ${events.length} completed</p>
    </div>
    ${eventCards}
  `);

  // Attach event body toggle handlers
  document.querySelectorAll('[data-body-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const bodyEl = document.getElementById(header.dataset.bodyToggle);
      const chevron = document.querySelector(`[data-chevron="${header.dataset.bodyToggle}"]`);
      if (!bodyEl) return;
      const isOpen = bodyEl.style.display !== 'none';
      bodyEl.style.display = isOpen ? 'none' : '';
      if (chevron) chevron.style.transform = isOpen ? 'rotate(-90deg)' : '';
    });
  });

  // Attach click handlers for per-pick breakdown
  document.querySelectorAll('[data-eid][data-pid]').forEach(rowEl => {
    rowEl.addEventListener('click', () => {
      const eid = rowEl.dataset.eid;
      const pid = rowEl.dataset.pid;
      const bdEl = document.getElementById(`ebd-${eid}-${pid}`);
      if (!bdEl) return;
      const isOpen = rowEl.classList.contains('open');
      // Close all in this event card
      rowEl.closest('.card').querySelectorAll('.leaderboard-row.open').forEach(r => {
        r.classList.remove('open');
        const key = `ebd-${r.dataset.eid}-${r.dataset.pid}`;
        const el = document.getElementById(key);
        if (el) el.style.display = 'none';
      });
      if (!isOpen) {
        rowEl.classList.add('open');
        bdEl.style.display = 'block';
        const event   = events.find(e => e.id === eid);
        const pred    = predictionsMap[pid];
        const score   = Scoring.scoreParticipantForEvent(pred, event);
        bdEl.innerHTML = UI.breakdownTable(score);
      }
    });
  });
}

/* ============================================================
   VIEW: LEADERBOARD
   ============================================================ */
async function viewLeaderboard() {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);

  const events = await Events.getAll();
  const completedEvents = events.filter(e => e.completed);

  _unsub = onSnapshot(collection(db, 'participants'), async (snap) => {
    const participants = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const predSnap = await getDocs(collection(db, 'predictions'));
    const predictionsMap = {};
    predSnap.forEach(d => { predictionsMap[d.id] = d.data(); });

    if (completedEvents.length === 0) {
      document.getElementById('app').innerHTML = `
        <div class="page-header"><h1>Fantasy Leaderboard</h1></div>
        <div class="empty-state">
          <div class="empty-state__icon">🌊</div>
          <div class="empty-state__title">Season hasn't started yet</div>
          <div class="empty-state__desc">Scores will appear once the first event results are entered.</div>
          <a href="#/events" class="btn btn-primary">View Events</a>
        </div>`;
      return;
    }

    const leaderboard = Scoring.buildCumulativeLeaderboard(participants, predictionsMap, events);

    if (leaderboard.length === 0) {
      document.getElementById('app').innerHTML = `
        <div class="page-header"><h1>Fantasy Leaderboard</h1></div>
        <div class="empty-state">
          <div class="empty-state__icon">🏆</div>
          <div class="empty-state__title">No participants yet</div>
          <div class="empty-state__desc">Add participants and submit picks to see scores.</div>
          <a href="#/participants" class="btn btn-primary">Add Participants</a>
        </div>`;
      return;
    }

    const rows = leaderboard.map(row => {
      const p = row.participant;
      return `
        <div class="leaderboard-row" id="lbrow-${UI.esc(p.id)}" data-id="${UI.esc(p.id)}">
          <div class="leaderboard-row__rank">${UI.rankBadge(row.displayRank)}</div>
          <div class="leaderboard-row__name">${UI.esc(p.name)} ${row.displayRank === 1 && row.hasPredictions ? '👑' : ''}</div>
          ${row.hasPredictions
            ? `<div style="font-size:12px;color:var(--text-muted)">
                 ${completedEvents.length} event${completedEvents.length !== 1 ? 's' : ''} scored
               </div>`
            : `<span class="pill pill--gray">No picks</span>`}
          <div class="leaderboard-row__score">${row.hasPredictions ? row.total : '—'}</div>
          <div class="leaderboard-row__pts-label">pts</div>
          ${row.hasPredictions ? `<div class="leaderboard-row__chevron">›</div>` : ''}
        </div>
        <div id="breakdown-${UI.esc(p.id)}" style="display:none"></div>`;
    }).join('');

    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <h1>Fantasy Leaderboard</h1>
        <p>Cumulative score across ${completedEvents.length} completed event${completedEvents.length !== 1 ? 's' : ''}</p>
      </div>
      <div>${rows}</div>
      <p style="margin-top:16px;font-size:12px;color:var(--text-dim)">
        Click a participant to see per-event breakdown
      </p>`;

    document.querySelectorAll('.leaderboard-row').forEach(rowEl => {
      rowEl.addEventListener('click', () => {
        const pid       = rowEl.dataset.id;
        const breakdown = document.getElementById('breakdown-' + pid);
        if (!breakdown) return;
        const isOpen = rowEl.classList.contains('open');
        document.querySelectorAll('.leaderboard-row.open').forEach(r => {
          r.classList.remove('open');
          const bd = document.getElementById('breakdown-' + r.dataset.id);
          if (bd) bd.style.display = 'none';
        });
        if (!isOpen) {
          rowEl.classList.add('open');
          breakdown.style.display = 'block';
          const lbRow = leaderboard.find(r => r.participant.id === pid);
          if (lbRow?.hasPredictions) {
            breakdown.innerHTML = `<div class="breakdown">${UI.eventBreakdownSections(lbRow.eventScores)}</div>`;
            breakdown.querySelectorAll('[data-ev-toggle]').forEach(hdr => {
              hdr.addEventListener('click', () => {
                const tableEl = hdr.nextElementSibling;
                const chevron = hdr.querySelector('[data-ev-chevron]');
                if (!tableEl) return;
                const isOpen = tableEl.style.display !== 'none';
                tableEl.style.display = isOpen ? 'none' : '';
                if (chevron) chevron.style.transform = isOpen ? 'rotate(-90deg)' : '';
              });
            });
          }
        }
      });
    });
  });
}

/* ============================================================
   VIEW: RULES
   ============================================================ */
function viewRules() {
  const tdL = `style="padding:6px 0;border-bottom:1px solid var(--border)"`;
  const tdR = `style="text-align:right;font-weight:700;color:var(--accent);padding:6px 0;border-bottom:1px solid var(--border)"`;
  const tdLl = `style="padding:6px 0"`;
  const tdRl = `style="text-align:right;font-weight:700;color:var(--text-dim);padding:6px 0"`;
  const tdRlg = `style="text-align:right;font-weight:700;color:var(--accent);padding:6px 0"`;
  const h3 = `style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:10px"`;

  setView(`
    <div class="page-header">
      <h1>Rules</h1>
      <p>Fantasy Surf League 2026 — scoring explained</p>
    </div>

    <div class="card" style="margin-bottom:16px;padding:24px;max-width:720px">
      <p style="margin-bottom:16px">Instead of scoring once at the end of the season, we now score <strong>every competition separately</strong> and accumulate points throughout the year!</p>

      <h2 style="font-size:15px;font-weight:700;margin-bottom:8px">How it works</h2>
      <p style="color:var(--text-muted);margin-bottom:4px">Your <strong>5 men's picks + 3 women's picks</strong> are measured against each event's results — the same picks, all season long.</p>
      <p style="color:var(--text-muted);margin-bottom:20px;font-size:13px">Scoring has two factors: <strong>how important the predicted position was</strong> (higher picks are worth more) and <strong>how close the prediction was</strong> (partial points for near misses).</p>

      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:24px">
        <div style="flex:1;min-width:260px">
          <h3 ${h3}>🏄 Men — Per Event</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:var(--surface)">
              <th style="text-align:left;padding:6px 8px;font-weight:700">Predicted</th>
              <th style="text-align:right;padding:6px 8px;font-weight:700">Exact</th>
              <th style="text-align:right;padding:6px 8px;font-weight:700">Off by 1</th>
              <th style="text-align:right;padding:6px 8px;font-weight:700">Off by 2</th>
              <th style="text-align:right;padding:6px 8px;font-weight:700">Off by 3+</th>
            </tr></thead>
            <tbody>
              <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">🎯 1st</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">10</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">7</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">5</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">3</td></tr>
              <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">2nd</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">8</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">5</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">3</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">2</td></tr>
              <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">3rd</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">7</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">4</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">2</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">1</td></tr>
              <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">4th</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">6</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">3</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">1</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">1</td></tr>
              <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">5th</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">5</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">2</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">1</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">1</td></tr>
            </tbody>
          </table>
        </div>
        <div style="flex:1;min-width:240px">
          <h3 ${h3}>🏄‍♀️ Women — Per Event</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:var(--surface)">
              <th style="text-align:left;padding:6px 8px;font-weight:700">Predicted</th>
              <th style="text-align:right;padding:6px 8px;font-weight:700">Exact</th>
              <th style="text-align:right;padding:6px 8px;font-weight:700">Off by 1</th>
              <th style="text-align:right;padding:6px 8px;font-weight:700">Off by 2</th>
            </tr></thead>
            <tbody>
              <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">🎯 1st</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">8</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">5</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">3</td></tr>
              <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">2nd</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">6</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">3</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">2</td></tr>
              <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">3rd</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">5</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">2</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">1</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:10px;padding:16px;margin-bottom:24px">
        <div style="font-weight:700;margin-bottom:6px">⚠️ WSL Tie Rule (Per-Event Only)</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px">WSL doesn't have unique rankings — surfers share positions: both semifinal losers are <strong>tied 3rd</strong> (stored as 3 & 4), and all 4 quarterfinalist losers are <strong>tied 5th</strong> (stored as 5–8). The normal diff-based scoring would unfairly penalize picks within the same tier, so these bridge rules apply:</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px">
          <thead><tr style="background:var(--surface)">
            <th style="text-align:left;padding:6px 8px;font-weight:700">Predicted</th>
            <th style="text-align:left;padding:6px 8px;font-weight:700">Actual</th>
            <th style="text-align:left;padding:6px 8px;font-weight:700">Reason</th>
            <th style="text-align:right;padding:6px 8px;font-weight:700">Points</th>
          </tr></thead>
          <tbody>
            <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">Men 3rd</td><td style="padding:6px 8px">4th</td><td style="padding:6px 8px;color:var(--text-muted)">both semi-losers → exact for 3rd slot</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">7 pts</td></tr>
            <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">Men 4th</td><td style="padding:6px 8px">3rd</td><td style="padding:6px 8px;color:var(--text-muted)">both semi-losers → exact for 4th slot</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">6 pts</td></tr>
            <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">Men 4th</td><td style="padding:6px 8px">5th</td><td style="padding:6px 8px;color:var(--text-muted)">predicted semi, finished QF — a real miss</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">3 pts (off by 1)</td></tr>
            <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">Men 5th</td><td style="padding:6px 8px">6th / 7th / 8th</td><td style="padding:6px 8px;color:var(--text-muted)">all QF-losers → exact for 5th slot</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">5 pts</td></tr>
            <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">Women 3rd</td><td style="padding:6px 8px">4th</td><td style="padding:6px 8px;color:var(--text-muted)">both semi-losers → exact for 3rd slot</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">5 pts</td></tr>
          </tbody>
        </table>
        <p style="font-size:12px;color:var(--text-dim);margin:0">These rules do <strong>not</strong> apply to the End of Season Bonus.</p>
      </div>

      <div style="background:var(--surface);border-radius:10px;padding:20px;border:1px solid var(--border)">
        <h2 style="font-size:15px;font-weight:700;margin-bottom:4px">🏆 End of Season Bonus — After Pipeline</h2>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">The final WSL world rankings count as one last mega-event. Same position-weighted logic, much higher stakes. Tie rule does <strong>not</strong> apply here.</p>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          <div style="flex:1;min-width:260px">
            <h3 ${h3}>🏄 Men's Final Rankings</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:var(--card-bg)">
                <th style="text-align:left;padding:6px 8px;font-weight:700">Predicted</th>
                <th style="text-align:right;padding:6px 8px;font-weight:700">Exact</th>
                <th style="text-align:right;padding:6px 8px;font-weight:700">Off 1</th>
                <th style="text-align:right;padding:6px 8px;font-weight:700">Off 2</th>
                <th style="text-align:right;padding:6px 8px;font-weight:700">Off 3+</th>
              </tr></thead>
              <tbody>
                <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">🎯 1st</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">40</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">28</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">20</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">8</td></tr>
                <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">2nd</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">32</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">20</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">12</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">4</td></tr>
                <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">3rd</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">28</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">16</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">8</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">4</td></tr>
                <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">4th</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">24</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">12</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">4</td><td style="text-align:right;padding:6px 8px;color:var(--text-dim)">0</td></tr>
                <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">5th</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">20</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">8</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">4</td><td style="text-align:right;padding:6px 8px;color:var(--text-dim)">0</td></tr>
              </tbody>
            </table>
          </div>
          <div style="flex:1;min-width:220px">
            <h3 ${h3}>🏄‍♀️ Women's Final Rankings</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:var(--card-bg)">
                <th style="text-align:left;padding:6px 8px;font-weight:700">Predicted</th>
                <th style="text-align:right;padding:6px 8px;font-weight:700">Exact</th>
                <th style="text-align:right;padding:6px 8px;font-weight:700">Off 1</th>
                <th style="text-align:right;padding:6px 8px;font-weight:700">Off 2</th>
              </tr></thead>
              <tbody>
                <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">🎯 1st</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">32</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">20</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">12</td></tr>
                <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">2nd</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">24</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">12</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">4</td></tr>
                <tr style="border-top:1px solid var(--border)"><td style="padding:6px 8px">3rd</td><td style="text-align:right;padding:6px 8px;font-weight:700;color:var(--accent)">20</td><td style="text-align:right;padding:6px 8px;color:var(--accent)">8</td><td style="text-align:right;padding:6px 8px;color:var(--text-dim)">0</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `);
}

/* ============================================================
   VIEW: ADMIN
   ============================================================ */
async function viewAdmin() {
  const _h = 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f';
  async function _chk(v) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('');
  }

  if (!Storage.isAdmin()) {
    setView(`
      <div style="max-width:320px;margin:80px auto">
        <div class="card" style="text-align:center">
          <div style="font-size:32px;margin-bottom:12px">🔒</div>
          <h2 style="margin-bottom:20px">Admin Access</h2>
          <div class="form-group">
            <input type="password" id="pinInput" placeholder="Enter PIN"
              style="text-align:center;font-size:20px;letter-spacing:4px" maxlength="20" />
          </div>
          <button class="btn btn-primary" style="width:100%" id="pinSubmit">Enter</button>
          <div id="pinError" style="color:var(--red);font-size:13px;margin-top:10px;min-height:18px"></div>
        </div>
      </div>`);

    const submit = async () => {
      const val = document.getElementById('pinInput')?.value;
      if (!val) return;
      if (await _chk(val) === _h) {
        Storage.setAdmin();
        viewAdmin();
      } else {
        document.getElementById('pinError').textContent = 'Incorrect PIN';
        document.getElementById('pinInput').value = '';
        document.getElementById('pinInput').focus();
      }
    };
    document.getElementById('pinSubmit')?.addEventListener('click', submit);
    document.getElementById('pinInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    document.getElementById('pinInput')?.focus();
    return;
  }

  const [menOverride, womenOverride, events] = await Promise.all([
    Rankings.getOverride('men'),
    Rankings.getOverride('women'),
    Events.getAll()
  ]);

  const fmtDate = iso => iso ? new Date(iso).toLocaleString() : 'never';

  const eventCards = events.length === 0
    ? `<p style="font-size:13px;color:var(--text-dim)">No events yet. Add one below.</p>`
    : events.map(ev => {
        const statusBadge = ev.completed
          ? `<span class="pill pill--green" style="font-size:11px">✅ Completed</span>`
          : `<span class="pill pill--gray" style="font-size:11px">⏳ Upcoming</span>`;
        const typeBadge = ev.type === 'season'
          ? `<span class="pill" style="background:var(--yellow);color:#000;font-size:11px">Season Bonus</span>`
          : `<span class="pill pill--gray" style="font-size:11px">Competition</span>`;
        return `
          <div class="card" style="margin-bottom:12px;padding:14px 16px" id="evcard-${UI.esc(ev.id)}">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              <span style="font-weight:700">${UI.esc(ev.name)}</span>
              ${typeBadge} ${statusBadge}
              <span style="font-size:12px;color:var(--text-dim)">#${ev.order || 0} · ${ev.date || ''}</span>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-secondary btn-sm btn-ev-edit" data-id="${UI.esc(ev.id)}">✏️ Edit</button>
              <button class="btn btn-danger btn-sm btn-ev-delete" data-id="${UI.esc(ev.id)}" data-name="${UI.esc(ev.name)}">✕ Delete</button>
            </div>
            <div id="evform-${UI.esc(ev.id)}" style="display:none;margin-top:14px"></div>
          </div>`;
      }).join('');

  setView(`
    <div class="page-header"><h1>Admin</h1><p>Manage events, rankings data and league settings.</p></div>

    <!-- EVENTS -->
    <div class="card" style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <h2 style="font-size:16px;font-weight:700">Events</h2>
        <button class="btn btn-primary btn-sm" id="btnAddEvent">+ Add Event</button>
      </div>
      <div id="newEventForm" style="display:none;margin-bottom:16px;padding:16px;background:var(--surface);border-radius:8px;border:1px solid var(--border)"></div>
      <div id="eventList">${eventCards}</div>
    </div>

    <!-- WORLD RANKINGS OVERRIDES -->
    <div class="card" style="margin-bottom:20px">
      <h2 style="font-size:16px;font-weight:700;margin-bottom:6px">Override Men Rankings</h2>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        Paste JSON array. Each item: <code style="background:var(--bg);padding:2px 6px;border-radius:4px">{"rank":1,"name":"…","country":"USA","points":56000}</code>
        ${menOverride ? `<br><span style="color:var(--yellow)">⚠ Override active — set ${fmtDate(menOverride.updatedAt)}</span>` : ''}
      </p>
      <textarea class="admin-textarea" id="menOverrideInput" placeholder='[{"rank":1,"name":"Yago Dora","country":"BRA","points":0}]'>${menOverride ? JSON.stringify(menOverride.data, null, 2) : ''}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="btnSaveMen">💾 Save Men Override</button>
        ${menOverride ? `<button class="btn btn-secondary btn-sm" id="btnClearMen">✕ Clear Override</button>` : ''}
      </div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <h2 style="font-size:16px;font-weight:700;margin-bottom:6px">Override Women Rankings</h2>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        Paste JSON array. Same format as men.
        ${womenOverride ? `<br><span style="color:var(--yellow)">⚠ Override active — set ${fmtDate(womenOverride.updatedAt)}</span>` : ''}
      </p>
      <textarea class="admin-textarea" id="womenOverrideInput" placeholder='[{"rank":1,"name":"Molly Picklum","country":"AUS","points":0}]'>${womenOverride ? JSON.stringify(womenOverride.data, null, 2) : ''}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="btnSaveWomen">💾 Save Women Override</button>
        ${womenOverride ? `<button class="btn btn-secondary btn-sm" id="btnClearWomen">✕ Clear Override</button>` : ''}
      </div>
    </div>

    <div class="card" style="border-color:rgba(239,68,68,0.3)">
      <h2 style="font-size:16px;font-weight:700;margin-bottom:6px;color:var(--red)">Danger Zone</h2>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Wipe all Firestore data. Cannot be undone.</p>
      <button class="btn btn-danger btn-sm" id="btnWipeAll">🗑 Wipe All Data</button>
    </div>
  `);

  // --- Event form builder ---
  function buildEventForm(existing) {
    const ev = existing || { name: '', date: '', order: events.length + 1, type: 'competition', completed: false, men: [], women: [] };
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="form-group">
          <label style="font-size:12px;color:var(--text-muted)">Event Name</label>
          <input type="text" id="efName" value="${UI.esc(ev.name)}" placeholder="e.g. Bells Beach Pro" maxlength="80" />
        </div>
        <div class="form-group">
          <label style="font-size:12px;color:var(--text-muted)">Date</label>
          <input type="date" id="efDate" value="${UI.esc(ev.date || '')}" />
        </div>
        <div class="form-group">
          <label style="font-size:12px;color:var(--text-muted)">Order #</label>
          <input type="number" id="efOrder" value="${ev.order || 1}" min="1" />
        </div>
        <div class="form-group">
          <label style="font-size:12px;color:var(--text-muted)">Type</label>
          <select id="efType">
            <option value="competition" ${ev.type === 'competition' ? 'selected' : ''}>Competition</option>
            <option value="season" ${ev.type === 'season' ? 'selected' : ''}>Season Bonus</option>
          </select>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px;cursor:pointer">
        <input type="checkbox" id="efCompleted" ${ev.completed ? 'checked' : ''} />
        Completed (results locked in)
      </label>
      <div class="form-group" style="margin-bottom:10px">
        <label style="font-size:12px;color:var(--text-muted)">Men's Results (JSON) — <code>[{"rank":1,"name":"…","country":"BRA"}, …]</code></label>
        <textarea class="admin-textarea" id="efMen" style="min-height:100px">${ev.men && ev.men.length ? JSON.stringify(ev.men, null, 2) : ''}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label style="font-size:12px;color:var(--text-muted)">Women's Results (JSON)</label>
        <textarea class="admin-textarea" id="efWomen" style="min-height:80px">${ev.women && ev.women.length ? JSON.stringify(ev.women, null, 2) : ''}</textarea>
      </div>`;
  }

  function readEventForm() {
    const name      = document.getElementById('efName')?.value.trim();
    const date      = document.getElementById('efDate')?.value.trim();
    const order     = parseInt(document.getElementById('efOrder')?.value) || 1;
    const type      = document.getElementById('efType')?.value || 'competition';
    const completed = document.getElementById('efCompleted')?.checked || false;
    let men = [], women = [];
    try { men   = JSON.parse(document.getElementById('efMen')?.value.trim()  || '[]'); } catch(e) { throw new Error('Men JSON: ' + e.message); }
    try { women = JSON.parse(document.getElementById('efWomen')?.value.trim() || '[]'); } catch(e) { throw new Error('Women JSON: ' + e.message); }
    if (!name) throw new Error('Event name is required');
    return { name, date, order, type, completed, men, women };
  }

  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  }

  // Add new event
  document.getElementById('btnAddEvent')?.addEventListener('click', () => {
    const form = document.getElementById('newEventForm');
    if (form.style.display !== 'none') { form.style.display = 'none'; return; }
    form.innerHTML = buildEventForm(null) + `
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" id="btnSaveNewEvent">💾 Save Event</button>
        <button class="btn btn-secondary btn-sm" id="btnCancelNewEvent">Cancel</button>
      </div>`;
    form.style.display = 'block';

    document.getElementById('btnCancelNewEvent')?.addEventListener('click', () => { form.style.display = 'none'; });
    document.getElementById('btnSaveNewEvent')?.addEventListener('click', async () => {
      try {
        const data = readEventForm();
        const id   = slugify(data.name);
        await Events.save(id, data);
        UI.toast('✅ Event saved');
        viewAdmin();
      } catch(e) { UI.toast('❌ ' + e.message); }
    });
  });

  // Edit existing event
  document.querySelectorAll('.btn-ev-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = btn.dataset.id;
      const ev    = events.find(e => e.id === id);
      const formEl = document.getElementById('evform-' + id);
      if (!formEl) return;
      if (formEl.style.display !== 'none') { formEl.style.display = 'none'; return; }
      formEl.innerHTML = buildEventForm(ev) + `
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" id="btnSaveEv-${UI.esc(id)}">💾 Save</button>
          <button class="btn btn-secondary btn-sm" id="btnCancelEv-${UI.esc(id)}">Cancel</button>
        </div>`;
      formEl.style.display = 'block';

      document.getElementById('btnCancelEv-' + id)?.addEventListener('click', () => { formEl.style.display = 'none'; });
      document.getElementById('btnSaveEv-' + id)?.addEventListener('click', async () => {
        try {
          const data = readEventForm();
          await Events.save(id, data);
          UI.toast('✅ Event updated');
          viewAdmin();
        } catch(e) { UI.toast('❌ ' + e.message); }
      });
    });
  });

  // Delete event
  document.querySelectorAll('.btn-ev-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      UI.confirm('Delete event', `Remove "${btn.dataset.name}"?`, async () => {
        await Events.remove(btn.dataset.id);
        UI.toast('Event deleted');
        viewAdmin();
      });
    });
  });

  // World rankings overrides
  document.getElementById('btnSaveMen')?.addEventListener('click', async () => {
    try {
      const data = JSON.parse(document.getElementById('menOverrideInput').value.trim());
      if (!Array.isArray(data)) throw new Error('Must be an array');
      await Rankings.setOverride('men', data);
      UI.toast(`✅ Men override saved (${data.length} entries)`);
      viewAdmin();
    } catch(e) { UI.toast('❌ Invalid JSON: ' + e.message); }
  });

  document.getElementById('btnClearMen')?.addEventListener('click', async () => {
    await Rankings.clearOverride('men');
    UI.toast('Men override cleared');
    viewAdmin();
  });

  document.getElementById('btnSaveWomen')?.addEventListener('click', async () => {
    try {
      const data = JSON.parse(document.getElementById('womenOverrideInput').value.trim());
      if (!Array.isArray(data)) throw new Error('Must be an array');
      await Rankings.setOverride('women', data);
      UI.toast(`✅ Women override saved (${data.length} entries)`);
      viewAdmin();
    } catch(e) { UI.toast('❌ Invalid JSON: ' + e.message); }
  });

  document.getElementById('btnClearWomen')?.addEventListener('click', async () => {
    await Rankings.clearOverride('women');
    UI.toast('Women override cleared');
    viewAdmin();
  });

  document.getElementById('btnWipeAll')?.addEventListener('click', () => {
    UI.confirm('Wipe all data', 'Delete ALL Firestore participants, predictions, overrides and events?', async () => {
      const { deleteDoc, doc } = await import('./firebase.js');
      for (const cname of ['participants','predictions','overrides','events']) {
        const snap = await getDocs(collection(db, cname));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, cname, d.id))));
      }
      UI.toast('All data wiped');
      Router.navigate('/');
    });
  });
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
UI.initNavBurger();

Router
  .on('/',                 ()       => viewDashboard())
  .on('/standings',        ()       => viewStandings())
  .on('/events',           ()       => viewEvents())
  .on('/leaderboard',      ()       => viewLeaderboard())
  .on('/rules',            ()       => viewRules())
  .on('/participants',     ()       => viewParticipants())
  .on('/predictions/:id',  (params) => viewPredictions(params.id))
  .on('/admin',            ()       => viewAdmin());

Router.start();
