/* ============================================================
   ui.js — Reusable DOM builders, toast, modal, countdown
   ============================================================ */
export const UI = {

  toast(msg, duration = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  },

  confirm(title, message, onConfirm) {
    const existing = document.getElementById('appModal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'appModal';
    overlay.innerHTML = `
      <div class="modal">
        <h3>${this.esc(title)}</h3>
        <p>${this.esc(message)}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modalCancel">Cancel</button>
          <button class="btn btn-danger" id="modalConfirm">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#modalCancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#modalConfirm').addEventListener('click', () => { overlay.remove(); onConfirm(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  },

  esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  flag(code) {
    const map = {
      USA: '🇺🇸', AUS: '🇦🇺', BRA: '🇧🇷', RSA: '🇿🇦', ZAF: '🇿🇦',
      JPN: '🇯🇵', ITA: '🇮🇹', FRA: '🇫🇷', PRT: '🇵🇹', CRI: '🇨🇷',
      MAR: '🇲🇦', NZL: '🇳🇿', ESP: '🇪🇸', IDN: '🇮🇩', HAW: '🌺',
      CAN: '🇨🇦', IND: '🇮🇳', MEX: '🇲🇽', ARG: '🇦🇷', CHL: '🇨🇱',
      PER: '🇵🇪', INA: '🇮🇩', CRC: '🇨🇷', POR: '🇵🇹', ISR: '🇮🇱'
    };
    return map[(code || '').toUpperCase()] || '🏳️';
  },

  rankBadge(n) {
    const cls = n <= 3 ? ` rank-badge--${n}` : '';
    return `<span class="rank-badge${cls}">${this.esc(n)}</span>`;
  },

  ordinal(n) {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },

  sourceBadge(source) {
    const map = {
      override: ['override', '● Override'],
      local:    ['local',    '● Local'],
      empty:    ['local',    '● No Data']
    };
    const [cls, label] = map[source] || map.local;
    return `<span class="source-badge source-badge--${cls}"><span class="source-dot"></span>${this.esc(label)}</span>`;
  },

  rankingsTable(data) {
    if (!data || data.length === 0) {
      return `<div class="empty-state"><div class="empty-state__icon">🌊</div><div class="empty-state__title">No rankings data</div><div class="empty-state__desc">Update via Admin page.</div></div>`;
    }
    const rows = data.map(s => `
      <tr>
        <td>${this.rankBadge(s.rank)}</td>
        <td><span style="margin-right:6px">${this.flag(s.country)}</span><strong>${this.esc(s.name)}</strong></td>
        <td style="color:var(--text-muted);font-size:12px">${this.esc(s.country)}</td>
        <td style="font-weight:700;color:var(--accent)">${(s.points || 0).toLocaleString()}</td>
      </tr>`).join('');
    return `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Surfer</th><th>Country</th><th>WSL Points</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  },

  breakdownTable(score) {
    const Scoring = window._Scoring;
    const makeRows = (picks) => picks.map(pick => {
      const cls = Scoring.classify(pick.points, pick.maxPoints);
      const actualLabel = pick.actualRank
        ? `#${pick.actualRank}`
        : `<span style="color:var(--text-dim)">outside</span>`;
      return `<tr class="pick-${cls}"><td>${this.esc(pick.name || '—')}</td><td style="color:var(--text-muted)">${this.ordinal(pick.predictedRank)}</td><td>${actualLabel}</td><td class="score-${cls}">${pick.points} pt${pick.points !== 1 ? 's' : ''}</td></tr>`;
    }).join('');
    const sectionStyle = `background:var(--surface);color:var(--text-muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:8px 14px`;
    return `<div class="breakdown"><div class="table-wrap"><table>
      <thead><tr><th>Surfer</th><th>Predicted</th><th>Actual</th><th>Points</th></tr></thead>
      <tbody>
        <tr><td colspan="4" style="${sectionStyle}">🏄 Men — Top 5</td></tr>
        ${makeRows(score.men) || '<tr><td colspan="4" style="color:var(--text-dim);padding:10px 14px">No picks</td></tr>'}
        <tr><td colspan="4" style="${sectionStyle}">🏄‍♀️ Women — Top 3</td></tr>
        ${makeRows(score.women) || '<tr><td colspan="4" style="color:var(--text-dim);padding:10px 14px">No picks</td></tr>'}
      </tbody></table></div></div>`;
  },

  eventBreakdownSections(eventScores) {
    const Scoring = window._Scoring;
    if (!eventScores || eventScores.length === 0) return '';
    return eventScores.map(({ event, score }) => {
      const makeRows = (picks) => picks.map(pick => {
        const cls = Scoring.classify(pick.points, pick.maxPoints);
        const actualLabel = pick.actualRank
          ? `#${pick.actualRank}`
          : `<span style="color:var(--text-dim)">outside</span>`;
        return `<tr class="pick-${cls}"><td>${this.esc(pick.name || '—')}</td><td style="color:var(--text-muted)">${this.ordinal(pick.predictedRank)}</td><td>${actualLabel}</td><td class="score-${cls}">${pick.points} pt${pick.points !== 1 ? 's' : ''}</td></tr>`;
      }).join('');
      const sectionStyle = `background:var(--surface);color:var(--text-muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:8px 14px`;
      const typeBadge = event.type === 'season'
        ? `<span style="font-size:10px;background:var(--yellow);color:#000;padding:1px 6px;border-radius:10px;margin-left:6px">SEASON BONUS</span>`
        : '';
      const tableId = `evtable-${this.esc(event.id)}`;
      return `
        <div style="margin-bottom:4px">
          <div data-ev-toggle="${tableId}" style="padding:10px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer">
            <span style="font-size:13px;font-weight:700">${this.esc(event.name)}${typeBadge}</span>
            <span style="display:flex;align-items:center;gap:10px">
              <span style="font-weight:800;color:var(--accent)">${score.total} pts</span>
              <span data-ev-chevron="${tableId}" style="font-size:16px;color:var(--text-muted);transition:transform .2s;display:inline-block;transform:rotate(-90deg)">⌄</span>
            </span>
          </div>
          <div id="${tableId}" style="display:none">
            <div class="table-wrap"><table>
              <thead><tr><th>Surfer</th><th>Predicted</th><th>Actual</th><th>Points</th></tr></thead>
              <tbody>
                <tr><td colspan="4" style="${sectionStyle}">🏄 Men</td></tr>
                ${makeRows(score.men) || '<tr><td colspan="4" style="color:var(--text-dim);padding:10px 14px">No picks</td></tr>'}
                <tr><td colspan="4" style="${sectionStyle}">🏄‍♀️ Women</td></tr>
                ${makeRows(score.women) || '<tr><td colspan="4" style="color:var(--text-dim);padding:10px 14px">No picks</td></tr>'}
              </tbody>
            </table></div>
          </div>
        </div>`;
    }).join('');
  },

  startCountdown(elementId, msRemaining, onExpire) {
    this.stopCountdown();
    let remaining = msRemaining;
    const update = () => {
      const el = document.getElementById(elementId);
      if (!el) { this.stopCountdown(); return; }
      if (remaining <= 0) { el.textContent = 'Locked'; this.stopCountdown(); if (onExpire) onExpire(); return; }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      el.textContent = `${m}m ${s.toString().padStart(2, '0')}s`;
      remaining -= 1000;
    };
    update();
    this._countdownTimer = setInterval(update, 1000);
  },

  stopCountdown() {
    if (this._countdownTimer) { clearInterval(this._countdownTimer); this._countdownTimer = null; }
  },

  initNavBurger() {
    const burger = document.getElementById('navBurger');
    const links  = document.getElementById('navLinks');
    if (!burger || !links) return;
    burger.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('.nav__link').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }
};
