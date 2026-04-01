/* ============================================================
   app.js — Bootstrap + all view renderers
   ES module: imports all dependencies
   ============================================================ */
import { Storage }      from './storage.js';
import { Scoring }      from './scoring.js';
import { Participants } from './participants.js';
import { Rankings }     from './rankings.js';
import { Router }       from './router.js';
import { UI }           from './ui.js';
import { db, collection, getDocs, onSnapshot } from './firebase.js';

// Expose Scoring to UI.breakdownTable
window._Scoring = Scoring;

// Returns true once at least one surfer has points > 0
function seasonHasStarted(menData, womenData) {
  return [...menData, ...womenData].some(s => s.points > 0);
}

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
  const { men, women } = await Rankings.getBoth();

  // Real-time listener on participants
  _unsub = onSnapshot(collection(db, 'participants'), async (snap) => {
    const participants = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const predSnap = await getDocs(collection(db, 'predictions'));
    const predictionsMap = {};
    predSnap.forEach(d => { predictionsMap[d.id] = d.data(); });

    const started     = seasonHasStarted(men.data, women.data);
    const leaderboard = started ? Scoring.buildLeaderboard(participants, predictionsMap, men.data, women.data) : [];
    const submitted   = participants.filter(p => predictionsMap[p.id]).length;

    const topRows = started
      ? leaderboard.slice(0, 5).map(row => `
          <div class="dash-leader-row">
            ${UI.rankBadge(row.displayRank)}
            <span class="dash-leader-row__name">${UI.esc(row.participant.name)}</span>
            ${row.hasPredictions
              ? `<span class="dash-leader-row__score">${row.score.total} pts</span>`
              : `<span class="pill pill--gray">No picks</span>`}
          </div>`).join('')
      : `<div class="empty-state" style="padding:28px 20px">
           <div class="empty-state__icon">🌊</div>
           <div class="empty-state__title">Season hasn't started yet</div>
           <div class="empty-state__desc">Scores will appear once the first event rankings are updated.</div>
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
          <div class="stat-card__value">${men.data.length > 0 ? men.data[0].name.split(' ').pop() : '—'}</div>
          <div class="stat-card__label">Men's Leader</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${women.data.length > 0 ? women.data[0].name.split(' ').pop() : '—'}</div>
          <div class="stat-card__label">Women's Leader</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <h2 style="font-size:17px;font-weight:700">Fantasy Leaderboard</h2>
          ${UI.sourceBadge(men.source)}
        </div>
        ${participants.length === 0
          ? `<div class="empty-state">
              <div class="empty-state__icon">🏆</div>
              <div class="empty-state__title">No participants yet</div>
              <div class="empty-state__desc">Add participants and submit picks to see rankings.</div>
              <a href="#/participants" class="btn btn-primary">Add Participants</a>
             </div>`
          : `<div>${topRows}</div>
             ${started && leaderboard.length > 5
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

    // Add
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

    // Rename
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

    // Delete
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
      Fantasy scoring uses Top 5 (men) and Top 3 (women) from these standings.
    </p>
  `);
}

/* ============================================================
   VIEW: LEADERBOARD
   ============================================================ */
async function viewLeaderboard() {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);
  const { men, women } = await Rankings.getBoth();
  const maxScore = 7 + 5 + 5 + 5 + 5 + 4 + 3 + 3;

  _unsub = onSnapshot(collection(db, 'participants'), async (snap) => {
    const participants = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const predSnap = await getDocs(collection(db, 'predictions'));
    const predictionsMap = {};
    predSnap.forEach(d => { predictionsMap[d.id] = d.data(); });

    const started     = seasonHasStarted(men.data, women.data);
    const leaderboard = started ? Scoring.buildLeaderboard(participants, predictionsMap, men.data, women.data) : [];

    if (!started) {
      document.getElementById('app').innerHTML = `
        <div class="page-header"><h1>Fantasy Leaderboard</h1></div>
        <div class="empty-state">
          <div class="empty-state__icon">🌊</div>
          <div class="empty-state__title">Season hasn't started yet</div>
          <div class="empty-state__desc">Scores will appear once the first event rankings are updated.</div>
          <a href="#/participants" class="btn btn-primary">View Participants</a>
        </div>`;
      return;
    }

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
      const p   = row.participant;
      const pct = maxScore > 0 ? Math.round((row.score.total / maxScore) * 100) : 0;
      return `
        <div class="leaderboard-row" id="lbrow-${UI.esc(p.id)}" data-id="${UI.esc(p.id)}">
          <div class="leaderboard-row__rank">${UI.rankBadge(row.displayRank)}</div>
          <div class="leaderboard-row__name">${UI.esc(p.name)} ${row.displayRank === 1 && row.hasPredictions ? '👑' : ''}</div>
          ${row.hasPredictions
            ? `<div>
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:3px">${pct}% of max</div>
                <div style="display:flex;gap:8px;font-size:12px;color:var(--text-muted)">
                  <span>⚡ Men: ${row.score.men.reduce((s,p)=>s+p.points,0)}</span>
                  <span>⚡ Women: ${row.score.women.reduce((s,p)=>s+p.points,0)}</span>
                </div>
               </div>`
            : `<span class="pill pill--gray">No picks</span>`}
          <div class="leaderboard-row__score">${row.hasPredictions ? row.score.total : '—'}</div>
          <div class="leaderboard-row__pts-label">pts</div>
          ${row.hasPredictions ? `<div class="leaderboard-row__chevron">›</div>` : ''}
        </div>
        <div id="breakdown-${UI.esc(p.id)}" style="display:none"></div>`;
    }).join('');

    document.getElementById('app').innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div><h1>Fantasy Leaderboard</h1><p>Combined score from Men Top 5 + Women Top 3 predictions</p></div>
        ${UI.sourceBadge(men.source)}
      </div>
      <div>${rows}</div>
      <p style="margin-top:16px;font-size:12px;color:var(--text-dim)">
        Max possible score: ${maxScore} pts &nbsp;·&nbsp; Click a participant to see pick breakdown
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
          if (lbRow?.hasPredictions) breakdown.innerHTML = UI.breakdownTable(lbRow.score);
        }
      });
    });
  });
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

  const [menOverride, womenOverride] = await Promise.all([
    Rankings.getOverride('men'),
    Rankings.getOverride('women')
  ]);

  const fmtDate = iso => iso ? new Date(iso).toLocaleString() : 'never';

  setView(`
    <div class="page-header"><h1>Admin</h1><p>Manage rankings data and league settings.</p></div>

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
    UI.confirm('Wipe all data', 'Delete ALL Firestore participants, predictions and overrides?', async () => {
      const { deleteDoc, doc } = await import('./firebase.js');
      for (const cname of ['participants','predictions','overrides']) {
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
  .on('/leaderboard',      ()       => viewLeaderboard())
  .on('/participants',     ()       => viewParticipants())
  .on('/predictions/:id',  (params) => viewPredictions(params.id))
  .on('/admin',            ()       => viewAdmin());

Router.start();
