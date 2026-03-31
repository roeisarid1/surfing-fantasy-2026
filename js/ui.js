/* ============================================================
   ui.js — Reusable DOM builders, toast, modal, countdown
   ============================================================ */

const UI = {

  /* ---- Toast notification ---- */
  toast(msg, duration = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  },

  /* ---- Simple confirm modal ---- */
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
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#modalCancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#modalConfirm').addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  },

  /* ---- Escape HTML to prevent XSS ---- */
  esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /* ---- Country flag emoji ---- */
  flag(code) {
    const map = {
      USA: '🇺🇸', AUS: '🇦🇺', BRA: '🇧🇷', RSA: '🇿🇦', ZAF: '🇿🇦',
      JPN: '🇯🇵', ITA: '🇮🇹', FRA: '🇫🇷', PRT: '🇵🇹', CRI: '🇨🇷',
      MAR: '🇲🇦', NZL: '🇳🇿', ESP: '🇪🇸', IDN: '🇮🇩', HAW: '🌺',
      IND: '🇮🇳', MEX: '🇲🇽', ARG: '🇦🇷', CHL: '🇨🇱', PER: '🇵🇪'
    };
    return map[(code || '').toUpperCase()] || '🏳️';
  },

  /* ---- Rank badge HTML ---- */
  rankBadge(n) {
    const cls = n <= 3 ? ` rank-badge--${n}` : '';
    return `<span class="rank-badge${cls}">${this.esc(n)}</span>`;
  },

  /* ---- Ordinal label ---- */
  ordinal(n) {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },

  /* ---- Source badge HTML ---- */
  sourceBadge(source) {
    const map = {
      live:     ['live',     '● Live'],
      override: ['override', '● Override'],
      local:    ['local',    '● Local'],
      empty:    ['local',    '● No Data']
    };
    const [cls, label] = map[source] || map.local;
    return `<span class="source-badge source-badge--${cls}">
              <span class="source-dot"></span>${this.esc(label)}
            </span>`;
  },

  /* ---- Rankings table (men or women) ---- */
  rankingsTable(data, topN) {
    if (!data || data.length === 0) {
      return `<div class="empty-state">
        <div class="empty-state__icon">🌊</div>
        <div class="empty-state__title">No rankings data</div>
        <div class="empty-state__desc">Try refreshing on the Admin page.</div>
      </div>`;
    }

    const rows = data.slice(0, Math.max(topN + 5, 15)).map(s => `
      <tr>
        <td>${this.rankBadge(s.rank)}</td>
        <td>
          <span style="margin-right:6px">${this.flag(s.country)}</span>
          <strong>${this.esc(s.name)}</strong>
        </td>
        <td style="color:var(--text-muted);font-size:12px">${this.esc(s.country)}</td>
        <td style="font-weight:700;color:var(--accent)">${(s.points || 0).toLocaleString()}</td>
      </tr>
    `).join('');

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Surfer</th>
              <th>Country</th>
              <th>WSL Points</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  /* ---- Leaderboard breakdown table for one participant ---- */
  breakdownTable(score) {
    const menRows = score.men.map(pick => {
      const maxPts = pick.predictedRank === 1 ? 7 : 5;
      const cls = Scoring.classify(pick.points, maxPts);
      const actualLabel = pick.actualRank
        ? `#${pick.actualRank}`
        : '<span style="color:var(--text-dim)">outside</span>';
      return `
        <tr class="pick-${cls}">
          <td>${this.flag('')} <strong>${this.esc(pick.name || '—')}</strong></td>
          <td style="color:var(--text-muted)">${this.ordinal(pick.predictedRank)}</td>
          <td>${actualLabel}</td>
          <td class="score-${cls}">${pick.points} pt${pick.points !== 1 ? 's' : ''}</td>
        </tr>
      `;
    }).join('');

    const womenRows = score.women.map(pick => {
      const maxPts = pick.predictedRank === 1 ? 4 : 3;
      const cls = Scoring.classify(pick.points, maxPts);
      const actualLabel = pick.actualRank
        ? `#${pick.actualRank}`
        : '<span style="color:var(--text-dim)">outside</span>';
      return `
        <tr class="pick-${cls}">
          <td>${this.flag('')} <strong>${this.esc(pick.name || '—')}</strong></td>
          <td style="color:var(--text-muted)">${this.ordinal(pick.predictedRank)}</td>
          <td>${actualLabel}</td>
          <td class="score-${cls}">${pick.points} pt${pick.points !== 1 ? 's' : ''}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="breakdown">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Surfer</th>
                <th>Predicted</th>
                <th>Actual</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="4" style="background:var(--surface);color:var(--text-muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:8px 14px">
                  🏄 Men — Top 5
                </td>
              </tr>
              ${menRows || '<tr><td colspan="4" style="color:var(--text-dim);padding:10px 14px">No picks</td></tr>'}
              <tr>
                <td colspan="4" style="background:var(--surface);color:var(--text-muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:8px 14px">
                  🏄‍♀️ Women — Top 3
                </td>
              </tr>
              ${womenRows || '<tr><td colspan="4" style="color:var(--text-dim);padding:10px 14px">No picks</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /* ---- Countdown timer: starts an interval, updates element by id ---- */
  startCountdown(elementId, msRemaining, onExpire) {
    this.stopCountdown();
    let remaining = msRemaining;

    const update = () => {
      const el = document.getElementById(elementId);
      if (!el) { this.stopCountdown(); return; }
      if (remaining <= 0) {
        el.textContent = 'Locked';
        this.stopCountdown();
        if (onExpire) onExpire();
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      el.textContent = `${m}m ${s.toString().padStart(2, '0')}s`;
      remaining -= 1000;
    };

    update();
    this._countdownTimer = setInterval(update, 1000);
  },

  stopCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  },

  /* ---- Mobile nav burger toggle ---- */
  initNavBurger() {
    const burger = document.getElementById('navBurger');
    const links  = document.getElementById('navLinks');
    if (!burger || !links) return;
    burger.addEventListener('click', () => links.classList.toggle('open'));
    // Close on nav link click
    links.querySelectorAll('.nav__link').forEach(a => {
      a.addEventListener('click', () => links.classList.remove('open'));
    });
  }
};
