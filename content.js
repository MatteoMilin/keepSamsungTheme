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

  function update() {
    scheduled = false;
    setAttr(root, 'data-sn-theme', keepTheme() ?? root.dataset.snTheme);
    updateTitleBar(root.dataset.snTheme);

    for (const card of document.querySelectorAll(SELECTORS.card)) {
      setAttr(card, 'data-sn-date', dateOf(card));
      const title = card.querySelector(SELECTORS.cardTitle)?.textContent.trim();
      setAttr(card, 'data-sn-untitled', title ? null : '');
    }

    // Page title and note count above the grid, as in Samsung Notes.
    const main = document.querySelector(SELECTORS.main);
    if (main) {
      const title = document.querySelector(SELECTORS.selectedTab)?.getAttribute('aria-label') ?? null;
      const count = main.querySelectorAll(SELECTORS.card).length;
      setAttr(main, 'data-sn-title', title);
      setAttr(main, 'data-sn-count', title ? `${count} note${count === 1 ? '' : 's'}` : null);
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }

  // Attributes this script writes (data-sn-*) are not observed, so it never triggers itself.
  new MutationObserver(schedule).observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'aria-selected'],
  });
  systemDark.addEventListener('change', schedule);
  schedule();
})();
