/* ============================================================
   router.js — Hash-based client-side router
   ============================================================ */
export const Router = {
  _routes: [],

  on(pattern, handler) {
    this._routes.push({ pattern, handler });
    return this;
  },

  navigate(path) {
    window.location.hash = '#' + path;
  },

  start() {
    window.addEventListener('hashchange', () => this._resolve());
    this._resolve();
  },

  _resolve() {
    const hash = window.location.hash;
    const path = hash.startsWith('#') ? hash.slice(1) : '/';
    const current = path || '/';

    for (const route of this._routes) {
      const params = this._match(route.pattern, current);
      if (params !== null) {
        this._updateNav(current);
        route.handler(params);
        return;
      }
    }
    this.navigate('/');
  },

  _match(pattern, path) {
    const pp = pattern.split('/').filter(Boolean);
    const hp = path.split('/').filter(Boolean);
    if (pattern === '/' && (path === '/' || path === '')) return {};
    if (pattern === '/') return null;
    if (pp.length !== hp.length) return null;
    const params = {};
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(hp[i]);
      else if (pp[i] !== hp[i]) return null;
    }
    return params;
  },

  _updateNav(path) {
    document.querySelectorAll('.nav__link').forEach(el => {
      const route = el.getAttribute('data-route');
      const isActive = path === route || (route !== '/' && path.startsWith(route));
      el.classList.toggle('active', isActive);
    });
  }
};
