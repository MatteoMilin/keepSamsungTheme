/*
 * Samsung Notes look for Google Keep.
 *
 * Marks a few Keep elements with data-sn-* attributes that theme.css styles.
 * Visual only: it never clicks, types, sends or stores anything.
 */
(() => {
  'use strict';

  // Keep's class names come from its build. They have been stable for years;
  // if Keep renames them, update them here and in theme.css.
  const SELECTORS = {
    card: '.RNfche',
    grid: '.gkA7Yd-sKfxWe > div',
    cardTitle: '.IZ65Hb-r4nke-haAclf [role=textbox]',
    cardDate: '.IZ65Hb-jfdpUb-fmcmS',
    main: '.RfDI4d-bN97Pc',
    selectedTab: '.PvRhvb [role=tab].gk6SMd',
  };

  // Page background in theme.css (--sn-bg), also used for the app window's title bar.
  const BACKGROUNDS = { light: '#fcfcfc', dark: '#000000' };

  const root = document.documentElement;
  const systemDark = matchMedia('(prefers-color-scheme: dark)');

  // Until Keep's styles load, follow the system theme.
  root.dataset.snTheme = systemDark.matches ? 'dark' : 'light';

  /** Keep's theme, read from its text colour: light text means dark mode. */
  function keepTheme() {
    if (!document.body) return null;
    const rgb = getComputedStyle(document.body).color.match(/\d+/g)?.map(Number);
    if (!rgb || rgb.slice(0, 3).every((v) => v === 0)) return null; // Keep's styles are not loaded yet
    const [r, g, b] = rgb;
    return 0.299 * r + 0.587 * g + 0.114 * b > 128 ? 'dark' : 'light';
  }

  function setAttr(el, name, value) {
    if (value == null) {
      if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== value) {
      el.setAttribute(name, value);
    }
  }

  /** "Modification : 02:22" → "02:22". */
  function dateOf(card) {
    const text = card.querySelector(SELECTORS.cardDate)?.textContent.trim();
    if (!text) return null;
    const colon = text.indexOf(': ');
    return colon >= 0 ? text.slice(colon + 2) : text;
  }

  /**
   * When Keep is installed as an app, Chrome paints the title bar with the
   * page's theme colour (Keep's yellow): use the page background instead.
   */
  function updateTitleBar(theme) {
    if (!document.head) return;
    let meta = document.head.querySelector('meta[name="theme-color"][data-sn]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.dataset.sn = '';
      document.head.append(meta);
    }
    setAttr(meta, 'content', BACKGROUNDS[theme]);
  }

  /** Where Keep's own layout puts a card: it moves cards with transform: translate(x, y). */
  function keepPlace(card) {
    const m = card.style.transform.match(/translate\(\s*(-?[\d.]+)px(?:\s*,\s*(-?[\d.]+)px)?/);
    return m ? { x: Math.round(Number(m[1])), y: Math.round(Number(m[2] ?? 0)) } : { x: 0, y: 0 };
  }

  /**
   * Shows the cards of a grid in the order of Keep's layout. Keep reorders notes
   * (drag and drop, new notes) by moving them, not always in the page, and
   * moves the empty slot under the pointer while dragging: its positions are
   * the reference. All pages have the same height, so Keep fills its rows from
   * left to right, and sorting by (y, x) gives its order.
   */
  function syncOrder(grid) {
    const cards = [...grid.children].filter((el) => el.matches(SELECTORS.card));
    const places = new Map(cards.map((card) => [card, keepPlace(card)]));
    cards.sort((a, b) => places.get(a).y - places.get(b).y || places.get(a).x - places.get(b).x);
    cards.forEach((card, i) => {
      if (card.style.order !== String(i)) card.style.order = String(i);
    });
  }

  /** The note dragged under the pointer gets the size of the pages in the grid. */
  let cardWidth = 0;
  function syncCardWidth() {
    const width = document.querySelector(`${SELECTORS.grid} > ${SELECTORS.card}`)?.offsetWidth;
    if (width && width !== cardWidth) {
      cardWidth = width;
      root.style.setProperty('--sn-card-width', `${width}px`);
    }
  }

  function update() {
    scheduled = false;
    setAttr(root, 'data-sn-theme', keepTheme() ?? root.dataset.snTheme);
    updateTitleBar(root.dataset.snTheme);

    for (const card of document.querySelectorAll(SELECTORS.card)) {
      setAttr(card, 'data-sn-date', dateOf(card));
      const title = card.querySelector(SELECTORS.cardTitle)?.textContent.trim();
      setAttr(card, 'data-sn-untitled', title ? null : '');
    }
    document.querySelectorAll(SELECTORS.grid).forEach(syncOrder);
    syncCardWidth();

    // Page title above the grid, as in Samsung Notes.
    const main = document.querySelector(SELECTORS.main);
    if (main) {
      const title = document.querySelector(SELECTORS.selectedTab)?.getAttribute('aria-label') ?? null;
      setAttr(main, 'data-sn-title', title);
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }

  // Keep moves notes through their style. This script only writes a value when
  // it changes, so its own writes end in an update that changes nothing.
  new MutationObserver(schedule).observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'aria-selected', 'style'],
  });
  systemDark.addEventListener('change', schedule);
  schedule();
})();
