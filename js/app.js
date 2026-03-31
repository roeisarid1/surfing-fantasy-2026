/* ============================================================
   app.js — Bootstrap + all view renderers
   ============================================================ */

/* ---- Helper: render into #app ---- */
function setView(html) {
  UI.stopCountdown();
  document.getElementById('app').innerHTML = html;
}

/* ============================================================
   VIEW: DASHBOARD
   ============================================================ */
async function viewDashboard() {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);

  const participants = Participants.getAll();
  const { men, women } = await Rankings.getBoth();

  const leaderboard = Scoring.buildLeaderboard(participants, men.data, women.data);
  const submitted   = participants.filter(p => Participants.hasSubmitted(p.id)).length;

  const topRows = leaderboard.slice(0, 5).map(row => `
    <div class="dash-leader-row">
      ${UI.rankBadge(row.displayRank)}
      <span class="dash-leader-row__name">${UI.esc(row.participant.name)}</span>
      ${row.hasPredictions
        ? `<span class="dash-leader-row__score">${row.score.total} pts</span>`
        : `<span class="pill pill--gray">No picks</span>`}
    </div>
  `).join('');

  const menSource   = men.source;
  const womenSource = women.source;
  const sourceLabel = menSource === 'live' ? 'Live WSL data'
                    : menSource === 'override' ? 'Admin override'
                    : 'Local JSON data';

  setView(`
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
        <div style="display:flex;gap:8px;align-items:center">
          ${UI.sourceBadge(menSource)}
          <span style="font-size:12px;color:var(--text-dim)">${sourceLabel}</span>
        </div>
      </div>
      ${leaderboard.length === 0
        ? `<div class="empty-state">
            <div class="empty-state__icon">🏆</div>
            <div class="empty-state__title">No participants yet</div>
            <div class="empty-state__desc">Add participants and submit picks to see rankings.</div>
            <a href="#/participants" class="btn btn-primary">Add Participants</a>
           </div>`
        : `<div>${topRows}</div>
           ${leaderboard.length > 5 ? `<div style="text-align:center;margin-top:12px"><a href="#/leaderboard" class="btn btn-secondary btn-sm">View full leaderboard →</a></div>` : ''}`
      }
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card">
        <h3 style="font-size:14px;font-weight:700;margin-bottom:12px;color:var(--text-muted)">MEN — TOP 3</h3>
        ${men.data.slice(0,3).map(s => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            ${UI.rankBadge(s.rank)}
            <span style="font-size:13px">${UI.flag(s.country)} ${UI.esc(s.name)}</span>
          </div>
        `).join('') || '<span style="color:var(--text-dim);font-size:13px">No data</span>'}
        <a href="#/standings" style="font-size:12px;color:var(--accent)">Full standings →</a>
      </div>
      <div class="card">
        <h3 style="font-size:14px;font-weight:700;margin-bottom:12px;color:var(--text-muted)">WOMEN — TOP 3</h3>
        ${women.data.slice(0,3).map(s => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            ${UI.rankBadge(s.rank)}
            <span style="font-size:13px">${UI.flag(s.country)} ${UI.esc(s.name)}</span>
          </div>
        `).join('') || '<span style="color:var(--text-dim);font-size:13px">No data</span>'}
        <a href="#/standings" style="font-size:12px;color:var(--accent)">Full standings →</a>
      </div>
    </div>
  `);
}

/* ============================================================
   VIEW: PARTICIPANTS
   ============================================================ */
function viewParticipants() {
  function render() {
    const list = Participants.getAll();

    const rows = list.map(p => {
      const locked   = Participants.isLocked(p.id);
      const hasPicks = Participants.hasSubmitted(p.id);
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
            <button class="btn btn-secondary btn-sm btn-rename" data-id="${UI.esc(p.id)}" data-name="${UI.esc(p.name)}">Rename</button>
            <button class="btn btn-danger btn-sm btn-delete" data-id="${UI.esc(p.id)}" data-name="${UI.esc(p.name)}">✕</button>
          </div>
        </div>
      `;
    }).join('');

    setView(`
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
        : `<div id="participantList">${rows}</div>`
      }
    `);

    attachParticipantListeners();
  }

  function attachParticipantListeners() {
    // Add on button click
    document.getElementById('btnAdd')?.addEventListener('click', doAdd);
    // Add on Enter key
    document.getElementById('newName')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doAdd();
    });

    // Rename buttons
    document.querySelectorAll('.btn-rename').forEach(btn => {
      btn.addEventListener('click', () => {
        const id   = btn.dataset.id;
        const name = btn.dataset.name;
        const row  = document.getElementById('prow-' + id);
        if (!row) return;
        const nameDiv = row.querySelector('.participant-row__name');
        nameDiv.innerHTML = `
          <div class="inline-edit-form">
            <input type="text" id="rename-${id}" value="${UI.esc(name)}" maxlength="40" />
            <button class="btn btn-success btn-sm" id="saveRename-${id}">Save</button>
            <button class="btn btn-secondary btn-sm" id="cancelRename-${id}">Cancel</button>
          </div>
        `;
        document.getElementById(`rename-${id}`)?.focus();
        document.getElementById(`saveRename-${id}`)?.addEventListener('click', () => {
          const val = document.getElementById(`rename-${id}`)?.value.trim();
          if (!val) return;
          Participants.update(id, val);
          UI.toast(`Renamed to "${val}"`);
          render();
        });
        document.getElementById(`cancelRename-${id}`)?.addEventListener('click', render);
        document.getElementById(`rename-${id}`)?.addEventListener('keydown', e => {
          if (e.key === 'Enter') document.getElementById(`saveRename-${id}`)?.click();
          if (e.key === 'Escape') render();
        });
      });
    });

    // Delete buttons
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id   = btn.dataset.id;
        const name = btn.dataset.name;
        UI.confirm('Delete participant', `Remove "${name}" and all their picks?`, () => {
          Participants.delete(id);
          UI.toast(`"${name}" removed`);
          render();
        });
      });
    });
  }

  function doAdd() {
    const input = document.getElementById('newName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) { UI.toast('Please enter a name'); return; }
    Participants.add(name);
    input.value = '';
    UI.toast(`"${name}" added!`);
    render();
  }

  render();
}

/* ============================================================
   VIEW: PREDICTION ENTRY
   ============================================================ */
async function viewPredictions(id) {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);

  const participant = Participants.getById(id);
  if (!participant) {
    setView(`<div class="empty-state"><div class="empty-state__title">Participant not found</div><a href="#/participants" class="btn btn-primary" style="margin-top:16px">Back</a></div>`);
    return;
  }

  const locked      = Participants.isLocked(id);
  const existing    = Participants.getPredictions(id);
  const msRemaining = Participants.msUntilLock(id);

  // Load surfer rosters from JSON
  let menPool   = [];
  let womenPool = [];
  try {
    const [mr, wr] = await Promise.all([
      fetch('data/surfers-men.json').then(r => r.json()),
      fetch('data/surfers-women.json').then(r => r.json())
    ]);
    menPool   = mr;
    womenPool = wr;
  } catch (e) {
    console.warn('Could not load surfer pool', e);
  }

  // Current picks state (copy so we can mutate)
  let menPicks   = existing ? [...existing.men]   : ['','','','',''];
  let womenPicks = existing ? [...existing.women] : ['','',''];

  function buildLockBanner() {
    if (!existing) {
      return `<div class="lock-banner lock-banner--open">🟢 Submit your picks. You'll have 1 hour to make changes.</div>`;
    }
    if (locked) {
      return `<div class="lock-banner lock-banner--locked">🔒 Picks are locked. No more edits allowed.</div>`;
    }
    return `<div class="lock-banner lock-banner--editing">
      ⏳ Picks editable for <span id="lockCountdown" style="font-weight:800">…</span> more
    </div>`;
  }

  function buildPicker(pool, picks, prefix) {
    const slots = picks.map((name, i) => {
      const filled = !!name;
      return `
        <div class="slot ${filled ? 'slot--filled' : ''}" data-slot="${i}" data-prefix="${prefix}">
          <span class="slot__rank">${UI.ordinal(i+1)}</span>
          ${filled
            ? `<span class="slot__name">${UI.esc(name)}</span>
               ${!locked ? `<button class="slot__clear" data-slot="${i}" data-prefix="${prefix}" title="Clear">×</button>` : ''}`
            : `<span class="slot__empty">— pick surfer —</span>`}
        </div>
      `;
    }).join('');

    const usedSet = new Set(picks.filter(Boolean).map(n => n.toLowerCase()));
    const poolItems = pool.map(s => {
      const used = usedSet.has(s.name.toLowerCase());
      return `
        <div class="pool-item ${used ? 'pool-item--used' : ''}" data-name="${UI.esc(s.name)}" data-prefix="${prefix}">
          <span>${UI.flag(s.country)} ${UI.esc(s.name)}</span>
          <span class="pool-item__flag" style="font-size:12px;color:var(--text-dim)">${UI.esc(s.country)}</span>
        </div>
      `;
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
      </div>
    `;
  }

  function render() {
    const content = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <a href="#/participants" class="btn btn-secondary btn-sm">← Back</a>
        <h1 style="font-size:22px;font-weight:800">${UI.esc(participant.name)}'s Picks</h1>
      </div>

      ${buildLockBanner()}

      ${locked ? '' : `<div style="margin-bottom:24px">`}
      ${buildPicker(menPool, menPicks, 'men')}
      <div style="margin:20px 0;border-top:1px solid var(--border)"></div>
      ${buildPicker(womenPool, womenPicks, 'women')}
      ${locked ? '' : `</div>`}

      ${locked ? '' : `
        <div style="margin-top:24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary" id="btnSave">💾 Save Picks</button>
          <span style="font-size:13px;color:var(--text-dim)">
            ${existing ? 'Updates reset once the 1-hour window expires.' : 'Saving starts your 1-hour edit window.'}
          </span>
        </div>
      `}
    `;

    setView(content);
    attachPickerListeners();

    if (!locked && existing && msRemaining > 0) {
      UI.startCountdown('lockCountdown', msRemaining, () => {
        UI.toast('Picks are now locked!');
        viewPredictions(id);
      });
    }
  }

  function attachPickerListeners() {
    if (locked) return;

    // Click pool item → assign to first empty slot
    document.querySelectorAll('.pool-item:not(.pool-item--used)').forEach(item => {
      item.addEventListener('click', () => {
        const name   = item.dataset.name;
        const prefix = item.dataset.prefix;
        const picks  = prefix === 'men' ? menPicks : womenPicks;
        const emptyIdx = picks.findIndex(p => !p);
        if (emptyIdx === -1) { UI.toast('All slots filled — clear one first'); return; }
        picks[emptyIdx] = name;
        render();
      });
    });

    // Click slot clear button
    document.querySelectorAll('.slot__clear').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const i      = parseInt(btn.dataset.slot);
        const prefix = btn.dataset.prefix;
        if (prefix === 'men') menPicks[i] = '';
        else womenPicks[i] = '';
        render();
      });
    });

    // Save button
    document.getElementById('btnSave')?.addEventListener('click', () => {
      const menFilled   = menPicks.filter(Boolean).length;
      const womenFilled = womenPicks.filter(Boolean).length;
      if (menFilled < 5) { UI.toast('Please fill all 5 men\'s picks'); return; }
      if (womenFilled < 3) { UI.toast('Please fill all 3 women\'s picks'); return; }
      Participants.savePredictions(id, menPicks, womenPicks);
      UI.toast('✅ Picks saved!');
      viewPredictions(id); // re-render to show lock timer
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
      <button class="btn btn-secondary btn-sm" id="btnRefresh" style="margin-left:auto">↻ Refresh</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        <div class="section-title">🏄 Men's CT</div>
        <div class="card" style="padding:0;overflow:hidden">
          ${UI.rankingsTable(men.data, 5)}
        </div>
      </div>
      <div>
        <div class="section-title">🏄‍♀️ Women's CT</div>
        <div class="card" style="padding:0;overflow:hidden">
          ${UI.rankingsTable(women.data, 3)}
        </div>
      </div>
    </div>

    <p style="margin-top:16px;font-size:12px;color:var(--text-dim);text-align:right">
      Fantasy scoring uses Top 5 (men) and Top 3 (women) from these standings.
    </p>
  `);

  document.getElementById('btnRefresh')?.addEventListener('click', async () => {
    Rankings.clearCache('men');
    Rankings.clearCache('women');
    UI.toast('Refreshing rankings…');
    await viewStandings();
  });
}

/* ============================================================
   VIEW: LEADERBOARD
   ============================================================ */
async function viewLeaderboard() {
  setView(`<div class="loader"><div class="loader__spinner"></div></div>`);

  const participants = Participants.getAll();
  const { men, women } = await Rankings.getBoth();
  const leaderboard = Scoring.buildLeaderboard(participants, men.data, women.data);

  if (leaderboard.length === 0) {
    setView(`
      <div class="page-header"><h1>Fantasy Leaderboard</h1></div>
      <div class="empty-state">
        <div class="empty-state__icon">🏆</div>
        <div class="empty-state__title">No participants yet</div>
        <div class="empty-state__desc">Add participants and submit picks to see scores.</div>
        <a href="#/participants" class="btn btn-primary">Add Participants</a>
      </div>
    `);
    return;
  }

  // Calculate max possible score for reference
  const maxScore = 7 + 5 + 5 + 5 + 5 + 4 + 3 + 3; // 37

  const rows = leaderboard.map((row, idx) => {
    const p     = row.participant;
    const score = row.score;
    const pct   = maxScore > 0 ? Math.round((score.total / maxScore) * 100) : 0;
    const isTop = row.displayRank === 1 && row.hasPredictions;

    return `
      <div class="leaderboard-row" id="lbrow-${UI.esc(p.id)}" data-id="${UI.esc(p.id)}">
        <div class="leaderboard-row__rank">${UI.rankBadge(row.displayRank)}</div>
        <div class="leaderboard-row__name">
          ${UI.esc(p.name)} ${isTop ? '👑' : ''}
        </div>
        ${row.hasPredictions
          ? `<div>
              <div style="font-size:11px;color:var(--text-dim);margin-bottom:3px">
                ${pct}% of max
              </div>
              <div style="display:flex;gap:8px;font-size:12px;color:var(--text-muted)">
                <span>⚡ Men: ${score.men.reduce((s,p)=>s+p.points,0)}</span>
                <span>⚡ Women: ${score.women.reduce((s,p)=>s+p.points,0)}</span>
              </div>
             </div>`
          : `<span class="pill pill--gray">No picks</span>`}
        <div class="leaderboard-row__score">${row.hasPredictions ? score.total : '—'}</div>
        <div class="leaderboard-row__pts-label">pts</div>
        ${row.hasPredictions ? `<div class="leaderboard-row__chevron">›</div>` : ''}
      </div>
      <div id="breakdown-${UI.esc(p.id)}" style="display:none"></div>
    `;
  }).join('');

  setView(`
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h1>Fantasy Leaderboard</h1>
        <p>Combined score from Men Top 5 + Women Top 3 predictions</p>
      </div>
      ${UI.sourceBadge(men.source)}
    </div>
    <div>${rows}</div>
    <p style="margin-top:16px;font-size:12px;color:var(--text-dim)">
      Max possible score: ${maxScore} pts &nbsp;·&nbsp; Click a participant to see pick breakdown
    </p>
  `);

  // Expand/collapse breakdown on row click
  document.querySelectorAll('.leaderboard-row').forEach(rowEl => {
    rowEl.addEventListener('click', () => {
      const pid       = rowEl.dataset.id;
      const breakdown = document.getElementById('breakdown-' + pid);
      if (!breakdown) return;
      const isOpen = rowEl.classList.contains('open');

      // Close all others
      document.querySelectorAll('.leaderboard-row.open').forEach(r => {
        r.classList.remove('open');
        const bd = document.getElementById('breakdown-' + r.dataset.id);
        if (bd) bd.style.display = 'none';
      });

      if (!isOpen) {
        rowEl.classList.add('open');
        breakdown.style.display = 'block';
        const lbRow = leaderboard.find(r => r.participant.id === pid);
        if (lbRow && lbRow.hasPredictions) {
          breakdown.innerHTML = UI.breakdownTable(lbRow.score);
        }
      }
    });
  });
}

/* ============================================================
   VIEW: ADMIN
   ============================================================ */
async function viewAdmin() {
  const menOverride   = Rankings.getOverride('men');
  const womenOverride = Rankings.getOverride('women');

  function fmtDate(iso) {
    if (!iso) return 'never';
    return new Date(iso).toLocaleString();
  }

  setView(`
    <div class="page-header">
      <h1>Admin</h1>
      <p>Manage rankings data and league settings.</p>
    </div>

    <!-- Override: Men -->
    <div class="card" style="margin-bottom:20px">
      <h2 style="font-size:16px;font-weight:700;margin-bottom:6px">Override Men Rankings</h2>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        Paste JSON array. Each item: <code style="background:var(--bg);padding:2px 6px;border-radius:4px">{"rank":1,"name":"…","country":"USA","points":56000}</code>
        ${menOverride ? `<br><span style="color:var(--yellow)">⚠ Override active — set ${fmtDate(menOverride.updatedAt)}</span>` : ''}
      </p>
      <textarea class="admin-textarea" id="menOverrideInput" placeholder='[{"rank":1,"name":"John John Florence","country":"USA","points":56000}]'>${menOverride ? JSON.stringify(menOverride.data, null, 2) : ''}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="btnSaveMen">💾 Save Men Override</button>
        ${menOverride ? `<button class="btn btn-secondary btn-sm" id="btnClearMen">✕ Clear Override</button>` : ''}
      </div>
    </div>

    <!-- Override: Women -->
    <div class="card" style="margin-bottom:20px">
      <h2 style="font-size:16px;font-weight:700;margin-bottom:6px">Override Women Rankings</h2>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        Paste JSON array. Same format as men.
        ${womenOverride ? `<br><span style="color:var(--yellow)">⚠ Override active — set ${fmtDate(womenOverride.updatedAt)}</span>` : ''}
      </p>
      <textarea class="admin-textarea" id="womenOverrideInput" placeholder='[{"rank":1,"name":"Carissa Moore","country":"USA","points":40000}]'>${womenOverride ? JSON.stringify(womenOverride.data, null, 2) : ''}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="btnSaveWomen">💾 Save Women Override</button>
        ${womenOverride ? `<button class="btn btn-secondary btn-sm" id="btnClearWomen">✕ Clear Override</button>` : ''}
      </div>
    </div>

    <!-- Danger zone -->
    <div class="card" style="border-color:rgba(239,68,68,0.3)">
      <h2 style="font-size:16px;font-weight:700;margin-bottom:6px;color:var(--red)">Danger Zone</h2>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        Wipe all league data from localStorage. Cannot be undone.
      </p>
      <button class="btn btn-danger btn-sm" id="btnWipeAll">🗑 Wipe All Data</button>
    </div>
  `);

  // Save men override
  document.getElementById('btnSaveMen')?.addEventListener('click', () => {
    try {
      const data = JSON.parse(document.getElementById('menOverrideInput').value.trim());
      if (!Array.isArray(data)) throw new Error('Must be an array');
      Rankings.setOverride('men', data);
      UI.toast(`✅ Men override saved (${data.length} entries)`);
      viewAdmin();
    } catch (e) {
      UI.toast('❌ Invalid JSON: ' + e.message);
    }
  });

  // Clear men override
  document.getElementById('btnClearMen')?.addEventListener('click', () => {
    Rankings.clearOverride('men');
    UI.toast('Men override cleared');
    viewAdmin();
  });

  // Save women override
  document.getElementById('btnSaveWomen')?.addEventListener('click', () => {
    try {
      const data = JSON.parse(document.getElementById('womenOverrideInput').value.trim());
      if (!Array.isArray(data)) throw new Error('Must be an array');
      Rankings.setOverride('women', data);
      UI.toast(`✅ Women override saved (${data.length} entries)`);
      viewAdmin();
    } catch (e) {
      UI.toast('❌ Invalid JSON: ' + e.message);
    }
  });

  // Clear women override
  document.getElementById('btnClearWomen')?.addEventListener('click', () => {
    Rankings.clearOverride('women');
    UI.toast('Women override cleared');
    viewAdmin();
  });

  // Wipe all
  document.getElementById('btnWipeAll')?.addEventListener('click', () => {
    UI.confirm('Wipe all data', 'This deletes ALL participants, picks, and cached rankings. Are you sure?', () => {
      Storage.clear();
      UI.toast('All data wiped');
      Router.navigate('/');
    });
  });
}

/* ============================================================
   SEED DEMO DATA
   Runs once on first load if no participants exist.
   ============================================================ */
function seedDemoData() {
  if (Participants.getAll().length > 0) return; // already have data

  // Add 3 demo participants
  const p1 = Participants.add('Roie');
  const p2 = Participants.add('Adi');
  const p3 = Participants.add('Tal');

  // Lock their predictions by backdating submittedAt by 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const preds = {
    [p1.id]: {
      men:   ['John John Florence', 'Filipe Toledo', 'Griffin Colapinto', 'Italo Ferreira', 'Jack Robinson'],
      women: ['Carissa Moore', 'Tyler Wright', 'Caroline Marks']
    },
    [p2.id]: {
      men:   ['Filipe Toledo', 'John John Florence', 'Ethan Ewing', 'Jack Robinson', 'Griffin Colapinto'],
      women: ['Caitlin Simmers', 'Carissa Moore', 'Molly Picklum']
    },
    [p3.id]: {
      men:   ['Griffin Colapinto', 'Jack Robinson', 'John John Florence', 'Ethan Ewing', 'Kanoa Igarashi'],
      women: ['Tyler Wright', 'Carissa Moore', 'Brisa Hennessy']
    }
  };

  [p1, p2, p3].forEach(p => {
    const pred = preds[p.id];
    Storage.set('predictions_' + p.id, {
      submittedAt: twoHoursAgo,
      men:   pred.men,
      women: pred.women
    });
  });
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
(function init() {
  // Seed demo data on first run
  seedDemoData();

  // Wire up mobile nav
  UI.initNavBurger();

  // Register routes
  Router
    .on('/',                  ()       => viewDashboard())
    .on('/standings',         ()       => viewStandings())
    .on('/leaderboard',       ()       => viewLeaderboard())
    .on('/participants',      ()       => viewParticipants())
    .on('/predictions/:id',   (params) => viewPredictions(params.id))
    .on('/admin',             ()       => viewAdmin());

  // Start router (handles initial hash)
  Router.start();
})();
