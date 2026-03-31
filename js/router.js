/* ============================================================
   router.js — Hash-based client-side router.
   Patterns support :param segments, e.g. "/predictions/:id"
   ============================================================ */

const Router = {
  _routes: [],
  _current: null,

  // Register a route handler
  on(pattern, handler) {
    this._routes.push({ pattern, handler });
    return this;
  },

  // Navigate to a hash route
  navigate(path) {
    window.location.hash = '#' + path;
  },

  // Start listening for hash changes
  start() {
    window.addEventListener('hashchange', () => this._resolve());
    this._resolve(); // handle initial load
  },

  _resolve() {
    const hash = window.location.hash;
    const path = hash.startsWith('#') ? hash.slice(1) : '/';
    const current = path || '/';

    for (const route of this._routes) {
      const params = this._match(route.pattern, current);
      if (params !== null) {
        this._current = current;
        this._updateNav(current);
        route.handler(params);
        return;
      }
    }

    // No match → redirect to dashboard
    this.navigate('/');
  },

  // Match a pattern against a path, return params object or null
  _match(pattern, path) {
    const pp = pattern.split('/').filter(Boolean);
    const hp = path.split('/').filter(Boolean);

    // Handle root
    if (pattern === '/' && (path === '/' || path === '')) return {};
    if (pattern === '/') return null;

    if (pp.length !== hp.length) return null;

    const params = {};
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) {
        params[pp[i].slice(1)] = decodeURIComponent(hp[i]);
      } else if (pp[i] !== hp[i]) {
        return null;
      }
    }
    return params;
  },

  // Highlight the active nav link
  _updateNav(path) {
    document.querySelectorAll('.nav__link').forEach(el => {
      const route = el.getAttribute('data-route');
      // Active if path starts with route (to handle nested like /predictions/123)
      const isActive = path === route || (route !== '/' && path.startsWith(route));
      el.classList.toggle('active', isActive);
    });
  }
};
