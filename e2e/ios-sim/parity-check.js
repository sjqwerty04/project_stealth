/*
 * The e2e/ios-parity.spec.ts checks, run inside the app's own web view (iOS simulator or a device).
 * Paste into the Safari Web Inspector console attached to the app while signed in. See e2e/README.md.
 * It drives the app like a person (taps, typing), then prints one row per check.
 */
(async () => {
  // Mirror of the titles in src/lib/fallbackCatalog.ts.
  const FALLBACK = ['The Dark Knight', 'Inception', 'Parasite', '12 Angry Men', 'Fight Club', 'Forrest Gump'];
  const CHAT_ERRORS = /couldn't reach the projector booth|Something went wrong reaching the chat/i;
  const results = [];
  const record = (check, pass, detail) => results.push({ check, result: pass ? 'PASS' : 'FAIL', detail });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const waitFor = async (fn, ms = 30000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const value = fn();
      if (value) return value;
      await sleep(250);
    }
    return null;
  };
  const go = (path) => {
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  };
  const type = (input, text) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const button = (re) => $$('button').find((b) => re.test(b.innerText.trim()));
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > 1 && r.left < innerWidth - 1;
  };

  const apiFailures = [];
  const realFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = new URL(args[0] instanceof Request ? args[0].url : String(args[0]), location.href);
    try {
      const res = await realFetch(...args);
      if (url.pathname.startsWith('/api/')) {
        const kind = res.headers.get('content-type') || '';
        if (!res.ok) apiFailures.push(`${res.status} ${url.pathname}`);
        else if (kind.includes('text/html')) apiFailures.push(`${res.status} ${url.pathname} returned HTML`);
      }
      return res;
    } catch (error) {
      if (url.pathname.startsWith('/api/')) apiFailures.push(`${url.pathname} ${error}`);
      throw error;
    }
  };
  const ytStates = [];
  addEventListener('message', (event) => {
    if (!/youtube/.test(event.origin)) return;
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (typeof data?.info?.playerState === 'number') ytStates.push(data.info.playerState);
    } catch {
      // not a player message
    }
  });

  try {
    record('origin', location.origin === 'https://selects-film.vercel.app', location.href);
    if (!(await waitFor(() => $('[data-testid="tab-bar"]'), 10000))) {
      record('signed in', false, 'No tab bar. Sign in as the QA account, then run again.');
      return;
    }

    go('/app');
    const selects = await waitFor(() => $$('[data-testid="select-open-movie"]').length && $$('[data-testid="select-open-movie"]'), 60000);
    const titles = [...new Set((selects || []).map((b) => b.getAttribute('aria-label')).filter(Boolean))];
    const real = titles.filter((t) => !FALLBACK.includes(t));
    record('home Selects are real films', real.length > 0, titles.join(', ') || 'no Selects');
    const still = await waitFor(() => $$('[data-testid="select-open-movie"]').filter(onScreen).some((b) => b.querySelector('img')?.naturalWidth > 0));
    record('Select still shows', Boolean(still), still ? 'loaded' : 'no still on screen');

    const visible = $$('[data-testid="select-open-movie"]').find(onScreen);
    visible?.click();
    const heading = await waitFor(() => /\/movie\/\d+/.test(location.pathname) && $('h1, h2'), 30000);
    const title = heading?.innerText.trim() || '';
    record('opening a Select shows the film', Boolean(heading), title || location.pathname);

    const iframe = await waitFor(() => $('iframe[src*="youtube.com/embed"]'), 20000);
    const playing = iframe && (await waitFor(() => ytStates.includes(1) && getComputedStyle(iframe).opacity === '1', 45000));
    record('trailer plays', Boolean(playing), iframe ? `YouTube states ${[...new Set(ytStates)].join(',') || 'none'}, opacity ${getComputedStyle(iframe).opacity}` : 'no trailer iframe');

    button(/^ask ai$/i)?.click();
    const ask = await waitFor(() => $('input[placeholder^="Ask about"]'), 10000);
    if (ask) {
      const question = 'In one sentence, who directed this film?';
      type(ask, question);
      ask.form.requestSubmit();
      const sheet = ask.form.parentElement;
      const reply = await waitFor(() => {
        const lines = sheet.innerText.split('\n').map((l) => l.trim()).filter(Boolean);
        const asked = lines.indexOf(question);
        return asked >= 0 && lines.slice(asked + 1).join(' ');
      }, 60000);
      record('Ask AI answers', Boolean(reply) && !CHAT_ERRORS.test(reply), reply || 'no reply');
      $('button[aria-label="Close"]')?.click();
    } else {
      record('Ask AI answers', false, 'no Ask AI sheet');
    }

    button(/^enter orbit$/i)?.click();
    const score = await waitFor(() => /\/orbit\/\d+/.test(location.pathname) && $('[data-testid="select-score"]'), 30000);
    record('Orbit shows the film and Select score', Boolean(score) && document.body.innerText.includes(title), score ? `${title}: ${score.innerText.replace(/\s+/g, ' ')}` : 'no Select score');

    $('[data-testid="tab-library"]')?.click();
    const hub = await waitFor(() => $('[data-testid="library-hub"]'), 20000);
    record('Library loads', Boolean(hub), location.pathname);

    $('[data-testid="tab-orbit"]')?.click();
    const search = await waitFor(() => $('[data-testid="orbit-search"]'), 20000);
    if (search) type(search, 'heat');
    const heat = await waitFor(() => $$('button').find((b) => b.querySelector('h3')?.innerText === 'Heat' && b.innerText.includes('1995')), 20000);
    record('Hunt finds a film', Boolean(heat), heat ? 'Heat (1995)' : 'no result for "heat"');

    await sleep(2000);
    record('no failed /api calls', apiFailures.length === 0, apiFailures.join('; ') || 'none');
    results.push({ check: 'sign out and back in', result: 'MANUAL', detail: 'The app has no sign-out control today. Delete and reinstall, then sign in.' });
  } finally {
    window.fetch = realFetch;
    console.table(results);
  }
  return results;
})();
