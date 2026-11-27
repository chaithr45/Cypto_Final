// ==UserScript==
// @name         Sabarimala Virtual-Q Watcher
// @namespace    https://sabarimalaonline.org/
// @version      1.0.0
// @description  Refreshes the Virtual-Q page every 40-45 s. When 4 Jan (16:00 or later) or 5 Jan (before 10:00) opens on the Pamba route, it picks the slot, selects Self, fills the nominee, sets both contributions to No and clicks Add to Wishlist.
// @match        https://sabarimalaonline.org/*
// @match        https://www.sabarimalaonline.org/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// ==/UserScript==

(function () {
  'use strict';

  /* =============================== SETTINGS =============================== */
  const CONFIG = {
    // Tried in this order. A slot qualifies when its START time is
    // >= fromTime and < toTime (24-hour clock, like the site shows: "16:00 - 17:00").
    targets: [
      { date: '2027-01-04', fromTime: '16:00', toTime: '24:00', label: '4 Jan, 16:00 or later' },
      { date: '2027-01-05', fromTime: '00:00', toTime: '10:00', label: '5 Jan, before 10:00' },
    ],
    routeContains: 'Pamba',     // matches "Pamba - Marakkoottam - 4 Kms"
    ticketsNeeded: 1,           // Self = 1 pilgrim
    refreshMinSec: 40,          // page refresh happens at a random time
    refreshMaxSec: 45,          // between these two values
    pilgrimReliefFund: 'no',    // "Contribute for Pilgrim Relief fund": 'yes' or 'no'
    cleanSabarimala: 'no',      // "Contribution to Clean Sabarimala Project": 'yes' or 'no'
    // Starting values for the nominee boxes in the panel. You can also edit them in the panel.
    nominee: { name: 'Bhavani Prasad', age: '52', relation: '' },
    maxSubmitErrors: 3,         // stop after this many rejected Add to Wishlist attempts
  };
  /* ======================================================================== */

  // ---------- storage (survives page refreshes) ----------
  const store = {
    get(k, d) { try { const v = GM_getValue('vqw_' + k); return v === undefined ? d : v; } catch (e) { return d; } },
    set(k, v) { try { GM_setValue('vqw_' + k, v); } catch (e) { /* ignore */ } },
  };

  // ---------- small helpers ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const text = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
  const isShown = (el) => !!el && el.getClientRects().length > 0;
  async function waitFor(fn, timeoutMs, everyMs) {
    const end = Date.now() + timeoutMs;
    for (;;) {
      let v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      if (Date.now() >= end) return null;
      await sleep(everyMs || 250);
    }
  }
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (o) => `${o.y}-${pad(o.m)}-${pad(o.d)}`;
  const shortDate = (s) => { const [, m, d] = s.split('-').map(Number); return `${d} ${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)}`; };
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

  class StopRequested extends Error {}
  class Important extends Error {}

  // ---------- state ----------
  let busy = false;
  let mode = null;            // 'watch' | 'test'
  let phase = '';
  let cycleStartedAt = 0;
  let cycleRanThisLoad = false;
  let reloadTimer = null;
  let reloadAt = 0;
  const loadedAt = Date.now();

  const isArmed = () => store.get('armed', false);
  function abortIfStopped() { if (mode === 'watch' && !isArmed()) throw new StopRequested('stopped'); }
  const onDarshanPage = () => /^#\/darshan(?:[?/]|$)/.test(location.hash);

  // ======================================================================
  //  Page actions
  // ======================================================================
  function loaderShown() {
    const l = document.getElementById('loader');
    return !!l && getComputedStyle(l).display !== 'none';
  }
  async function waitLoaderGone(ms) {
    await sleep(150);
    return waitFor(() => !loaderShown(), ms || 30000, 200);
  }

  async function pageReady() {
    phase = 'loading';
    const input = await waitFor(() => $('input[name="darshanDate"]'), 45000);
    if (!input) throw new Error('The Virtual-Q form did not load (site slow or logged out?)');
    await sleep(500);
    await waitLoaderGone(30000);
    await sleep(700);
    await dismissDialogs();
  }

  async function dismissDialogs() {
    for (let i = 0; i < 3; i++) {
      const dlg = $('mat-dialog-container');
      if (!dlg) return;
      const btns = $$('button', dlg);
      const btn = btns.find((b) => /^(ok|okay|close|i agree|agree|continue|proceed)$/i.test(text(b))) || btns[0];
      log(`Closed a pop-up: "${text(dlg).slice(0, 120)}"`);
      if (!btn) return;
      btn.click();
      await sleep(800);
    }
  }

  // ---------- calendar ----------
  function parseCellDate(td) {
    const a = td.getAttribute('aria-label') || '';            // e.g. "Mon Jan 04 2027"
    const mm = a.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
    const yy = a.match(/\b(\d{4})\b/);
    const dd = a.replace(/\b\d{4}\b/, '').match(/\b(\d{1,2})\b/);
    if (!mm || !yy || !dd) return null;
    return { y: +yy[1], m: MONTHS.indexOf(mm[1]) + 1, d: +dd[1] };
  }
  function cellStatus(td) {
    const c = td.classList;
    const disabled = c.contains('mat-calendar-body-disabled') || td.getAttribute('aria-disabled') === 'true';
    if (c.contains('example-custom-date-class')) return disabled ? 'green but not clickable' : 'available';
    if (c.contains('example-custom-date-class1')) return 'full (red)';
    if (c.contains('example-custom-date-class2')) return 'not released (grey)';
    return disabled ? 'not open' : 'unknown';
  }
  const calendarOpen = () => !!$('.mat-calendar');
  const cells = () => $$('.mat-calendar-body-cell').map((td) => ({ td, date: parseCellDate(td) })).filter((x) => x.date);
  const monthHasColours = () => cells().some((x) => /example-custom-date-class/.test(x.td.className));
  function shownMonth() { const c = cells(); return c.length ? c[0].date.y * 12 + (c[0].date.m - 1) : null; }
  const findCell = (dateStr) => cells().find((x) => ymd(x.date) === dateStr);

  async function openCalendar() {
    if (calendarOpen() && cells().length) return;
    const btn = $('mat-datepicker-toggle button');
    if (!btn) throw new Error('Calendar button not found');
    btn.click();
    if (!(await waitFor(() => cells().length > 0, 6000))) throw new Error('Calendar did not open');
    await sleep(200);
  }
  async function closeCalendar() {
    if (!calendarOpen()) return;
    const bd = $('.cdk-overlay-backdrop');
    if (bd) bd.click();
    else document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await waitFor(() => !calendarOpen(), 3000);
    await sleep(200);
  }
  async function goToMonth(y, m) {
    const want = y * 12 + (m - 1);
    for (let i = 0; i < 24; i++) {
      const cur = shownMonth();
      if (cur === null) return false;
      if (cur === want) return true;
      const btn = $(cur < want ? '.mat-calendar-next-button' : '.mat-calendar-previous-button');
      if (!btn || btn.disabled) return false;
      btn.click();
      await waitFor(() => shownMonth() !== cur, 3000, 100);
    }
    return false;
  }

  // Returns { 'YYYY-MM-DD': status } or null if the colours never loaded.
  async function checkTargets(targets) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await openCalendar();
      const res = {};
      let coloured = false;
      for (const t of targets) {
        const [y, m] = t.date.split('-').map(Number);
        if (!(await goToMonth(y, m))) { res[t.date] = 'outside calendar'; continue; }
        if (monthHasColours()) coloured = true;
        const c = findCell(t.date);
        res[t.date] = c ? cellStatus(c.td) : 'not in calendar';
      }
      if (coloured) return res;
      await closeCalendar();
      await sleep(3000);
    }
    return null;
  }

  // Green dates from the current month onward (used by the Test button).
  async function findAvailableDates(monthsAhead) {
    await openCalendar();
    await waitFor(monthHasColours, 4000);
    const found = [];
    for (let i = 0; i <= monthsAhead; i++) {
      cells().forEach((x) => { if (cellStatus(x.td) === 'available') found.push(ymd(x.date)); });
      const next = $('.mat-calendar-next-button');
      if (!next || next.disabled) break;
      const cur = shownMonth();
      next.click();
      await waitFor(() => shownMonth() !== cur, 3000, 100);
    }
    return Array.from(new Set(found)).sort();
  }

  async function pickDate(dateStr) {
    phase = 'date';
    await openCalendar();
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!(await goToMonth(y, m))) throw new Important(`Could not reach ${shortDate(dateStr)} in the calendar`);
    const c = findCell(dateStr);
    if (!c || cellStatus(c.td) !== 'available') throw new Important(`${shortDate(dateStr)} is no longer green`);
    c.td.click();
    const input = $('input[name="darshanDate"]');
    const ok = await waitFor(() => {
      const nums = ((input && input.value) || '').match(/\d+/g) || [];
      return nums.length >= 3 && +nums[0] === d && +nums[1] === m && +nums[2] === y;
    }, 4000);
    if (!ok) {
      if (input && input.value) log(`Date box shows "${input.value}" (expected ${d}-${m}-${y}); continuing`, 'warn');
      else throw new Important(`Clicking ${shortDate(dateStr)} did not fill the date box`);
    }
    await closeCalendar();
    await sleep(300);
  }

  // ---------- route + slots ----------
  async function pickRoute() {
    phase = 'route';
    const sel = await waitFor(() => {
      const s = $('select[name="reportingPlace"]');
      return s && !s.disabled && s.options.length > 1 ? s : null;
    }, 10000);
    if (!sel) throw new Important('Route dropdown not available');
    const want = CONFIG.routeContains.toLowerCase();
    const opt = Array.from(sel.options).find((o) => text(o).toLowerCase().includes(want));
    if (!opt) throw new Important(`No route containing "${CONFIG.routeContains}". Options: ${Array.from(sel.options).map(text).join(' | ')}`);
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await waitLoaderGone(30000);
    await sleep(400);
  }

  function parseStartMinutes(s) {
    let m = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
    if (!m) {
      const m2 = s.match(/(\d{1,2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)/i);
      if (m2) m = [m2[0], m2[1], '00', m2[2]];
    }
    if (!m) return null;
    let h = +m[1];
    const min = +m[2];
    if (m[3]) h = (h % 12) + (/p/i.test(m[3]) ? 12 : 0);
    return h * 60 + min;
  }
  function readSlots() {
    return $$('[id^="myName_"]').filter(isShown).map((el) => {
      const idx = el.id.slice('myName_'.length);
      const av = document.getElementById('myAvailability_' + idx);
      const name = text(el);
      const n = (text(av).match(/(\d+)/) || [])[1];
      return { el, idx, name, avail: n === undefined ? 0 : +n, start: parseStartMinutes(name) };
    });
  }
  async function loadSlots() {
    const r = await waitFor(() => {
      const list = readSlots();
      if (list.length) return { kind: 'slots', list };
      const q = $$('.noQuota-msg').map(text).filter(Boolean).join(' ');
      if (q) return { kind: 'noquota', msg: q };
      return null;
    }, 15000);
    return r || { kind: 'noquota', msg: 'no slots appeared' };
  }
  function chooseSlot(list, t, anyTime) {
    const from = toMin(t.fromTime);
    const to = toMin(t.toTime);
    const unreadable = list.filter((s) => s.start === null);
    if (unreadable.length) log(`Could not read the time of: ${unreadable.map((s) => s.name).join(', ')}`, 'warn');
    const ok = list.filter((s) => s.avail >= CONFIG.ticketsNeeded && s.start !== null && (anyTime || (s.start >= from && s.start < to)));
    ok.sort((a, b) => a.start - b.start);
    return ok[0] || null;
  }
  async function clickSlot(s) {
    phase = 'slot';
    s.el.click();
    const ok = await waitFor(() => /205,\s*133,\s*0|cd8500/i.test(s.el.getAttribute('style') || ''), 3000);
    if (!ok) log('Could not confirm the slot turned orange; continuing', 'warn');
    await sleep(200);
  }

  // ---------- Self, nominee, contributions ----------
  const nomineeNameInput = () => $$('input[placeholder="Enter Nominee Name"]').find(isShown);

  async function chooseSelf() {
    phase = 'self';
    for (let attempt = 1; attempt <= 2; attempt++) {
      const rb = $('mat-radio-button[value="individual"]');
      if (!rb) throw new Important('"Self" option not found');
      if (!rb.classList.contains('mat-radio-checked')) (rb.querySelector('input') || rb).click();
      await sleep(1300);   // the site waits 1 s before loading your own pilgrim details
      await waitLoaderGone(15000);
      if (await waitFor(nomineeNameInput, 8000)) return;
      const dlg = $('mat-dialog-container');
      if (dlg) throw new Important(`After choosing Self the site said: "${text(dlg).slice(0, 200)}"`);
    }
    throw new Important('Your pilgrim details did not appear after choosing Self');
  }

  function setText(el, v) {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur'));
  }

  async function fillNominee() {
    phase = 'nominee';
    const n = getNominee();
    const nameEl = await waitFor(nomineeNameInput, 8000);
    const ageEl = $$('input[placeholder="Enter Age"]').find(isShown);
    if (!nameEl || !ageEl) throw new Important('Nominee boxes not found');
    const relSel = await waitFor(() => {
      const s = $$('select').find((x) => Array.from(x.options).some((o) => /select relation/i.test(text(o))));
      return s && Array.from(s.options).some((o) => o.value !== '') ? s : null;
    }, 8000);
    if (!relSel) throw new Important('Nominee "Relationship" list did not load');
    setText(nameEl, n.name);
    setText(ageEl, String(n.age));
    const opts = Array.from(relSel.options).filter((o) => o.value !== '');
    const want = n.relation.trim().toLowerCase();
    const opt = opts.find((o) => text(o).toLowerCase() === want) || opts.find((o) => want && text(o).toLowerCase().includes(want));
    if (!opt) throw new Important(`Relation "${n.relation}" is not in the site's list: ${opts.map(text).join(', ')}`);
    relSel.value = opt.value;
    relSel.dispatchEvent(new Event('change', { bubbles: true }));
    relSel.dispatchEvent(new Event('blur'));
    await sleep(300);
  }

  async function setContributions() {
    phase = 'contributions';
    const groups = [['contribute', CONFIG.pilgrimReliefFund], ['sanityYesOrNo', CONFIG.cleanSabarimala]];
    for (const [name, want] of groups) {
      const rb = $(`mat-radio-group[name="${name}"] mat-radio-button[value="${want}"]`);
      if (!rb) continue;   // section not shown for this booking
      if (!rb.classList.contains('mat-radio-checked')) {
        (rb.querySelector('input') || rb).click();
        await sleep(400);
      }
    }
    await waitLoaderGone(10000);
    await sleep(300);
  }

  // ---------- Add to Wishlist ----------
  const wishlistButton = () => $$('button.btn-addto').find((b) => /add to wishlist/i.test(text(b)) && isShown(b));
  const errorTexts = () => $$('.fd-bck, .sloterr-msg, .error-msg').filter(isShown).map(text).filter(Boolean);

  async function waitWishlistEnabled() {
    const btn = await waitFor(() => { const b = wishlistButton(); return b && !b.disabled ? b : null; }, 10000);
    if (!btn) throw new Important('"Add to Wishlist" stayed greyed out, so some field is still empty');
    return btn;
  }

  async function submit() {
    phase = 'submit';
    const btn = await waitWishlistEnabled();
    const before = new Set(errorTexts());
    abortIfStopped();
    btn.click();
    log('Clicked "Add to Wishlist"…');
    const out = await waitFor(() => {
      const body = document.body.innerText || '';
      if (/added to wishlist successfully/i.test(body)) return { ok: true };
      const errs = errorTexts().filter((e) => !before.has(e));
      if (errs.length) return { ok: false, msg: errs.join(' | ') };
      const dlg = $('mat-dialog-container');
      if (dlg) return { ok: false, msg: 'Pop-up: ' + text(dlg).slice(0, 200) };
      return null;
    }, 30000, 200);
    return out || { ok: null };
  }

  // ======================================================================
  //  One attempt at a date
  // ======================================================================
  async function tryTarget(t, testMode) {
    log(`${shortDate(t.date)} is GREEN, opening it`, 'good');
    await pickDate(t.date);
    abortIfStopped();
    await pickRoute();
    const slots = await loadSlots();
    if (slots.kind === 'noquota') { log(`${shortDate(t.date)}: no ${CONFIG.routeContains} slots ("${slots.msg}")`); return null; }
    log(`${shortDate(t.date)} slots: ` + slots.list.map((s) => `${s.name} [${s.avail}]`).join(', '));
    const pick = chooseSlot(slots.list, t, testMode);
    if (!pick) { log(`${shortDate(t.date)}: no slot with tickets in your time window`); return null; }
    log(`Choosing ${shortDate(t.date)} ${pick.name} (${pick.avail} left)`, 'good');
    if (!testMode) notify(`VQ Watcher: ${shortDate(t.date)} ${pick.name} is OPEN`, 'Adding it to your wishlist now…');
    abortIfStopped();
    await clickSlot(pick);
    await chooseSelf();
    await fillNominee();
    await setContributions();
    if (testMode) { await waitWishlistEnabled(); return { kind: 'test-ok', date: t.date, slot: pick.name }; }
    abortIfStopped();
    const out = await submit();
    return { kind: 'submitted', date: t.date, slot: pick.name, out };
  }

  // ======================================================================
  //  Watch cycle (one per page load)
  // ======================================================================
  async function watchCycle() {
    setStatus('Waiting for the page…');
    await pageReady();
    abortIfStopped();
    setStatus('Checking the calendar…');
    phase = 'calendar';
    const st = await checkTargets(CONFIG.targets);
    await closeCalendar();
    if (!st) { log('Calendar colours did not load; will retry after refresh', 'warn'); return; }
    log(CONFIG.targets.map((t) => `${shortDate(t.date)}: ${st[t.date]}`).join(' · '));
    const open = CONFIG.targets.filter((t) => st[t.date] === 'available');
    if (!open.length) { setStatus('Not open yet'); return; }

    for (const t of open) {
      abortIfStopped();
      setStatus(`Booking ${t.label}…`);
      let r;
      try { r = await tryTarget(t, false); } catch (e) {
        if (e instanceof StopRequested) throw e;
        throw new Important(e.message);
      }
      if (!r) continue;
      if (r.out.ok === true) {
        store.set('armed', false);
        store.set('done', { date: r.date, slot: r.slot, at: new Date().toLocaleString('en-GB') });
        log(`ADDED TO WISHLIST: ${shortDate(r.date)} ${r.slot}. Open your wishlist and finish the booking!`, 'good');
        notify('Added to wishlist!', `${shortDate(r.date)} ${r.slot}: open your wishlist and finish the booking now.`);
        flashTitle('ADDED TO WISHLIST');
        setStatus('DONE');
        return;
      }
      if (r.out.ok === false) {
        const n = store.get('submitErrors', 0) + 1;
        store.set('submitErrors', n);
        log(`Site refused (${n}/${CONFIG.maxSubmitErrors}): ${r.out.msg}`, 'error');
        notify('VQ Watcher: Add to Wishlist was refused', r.out.msg);
        if (n >= CONFIG.maxSubmitErrors) { store.set('armed', false); log('Stopped after repeated refusals. Check the page.', 'error'); setStatus('Stopped (errors)'); }
        return;
      }
      store.set('armed', false);
      log('Clicked Add to Wishlist but could not see a result. Stopped so it does not add twice. Check your wishlist!', 'error');
      notify('VQ Watcher: check your wishlist', `Clicked Add to Wishlist for ${shortDate(r.date)} ${r.slot} but saw no confirmation.`);
      setStatus('Stopped: check wishlist');
      return;
    }
    setStatus('Open, but no matching slot');
  }

  async function runWatchCycle() {
    busy = true; mode = 'watch'; cycleRanThisLoad = true; cycleStartedAt = Date.now();
    store.set('warnedLogout', false);
    try {
      await watchCycle();
    } catch (e) {
      if (!(e instanceof StopRequested)) {
        log('Error: ' + e.message, 'error');
        if (e instanceof Important) notify('VQ Watcher: problem while booking', e.message);
      }
    } finally {
      busy = false; mode = null; phase = '';
    }
    if (isArmed()) scheduleReload();
    render();
  }

  function scheduleReload() {
    if (reloadTimer) return;
    const span = Math.max(0, CONFIG.refreshMaxSec - CONFIG.refreshMinSec);
    const target = loadedAt + (CONFIG.refreshMinSec + Math.random() * span) * 1000;
    reloadAt = Math.max(target, Date.now() + 3000);
    reloadTimer = setTimeout(() => {
      if (isArmed() && onDarshanPage() && !(busy && phase === 'submit')) location.reload();
    }, reloadAt - Date.now());
  }
  function cancelReload() { if (reloadTimer) clearTimeout(reloadTimer); reloadTimer = null; reloadAt = 0; }

  // ======================================================================
  //  Test button: fills everything on any green date, never submits
  // ======================================================================
  async function runTest() {
    if (busy) return;
    if (!onDarshanPage()) { log('Open the Virtual-Q page first, then press Test.', 'warn'); return; }
    if (!nomineeOk()) return;
    store.set('armed', false); cancelReload();
    busy = true; mode = 'test';
    setStatus('Testing…');
    try {
      await pageReady();
      const dates = await findAvailableDates(4);
      await closeCalendar();
      if (!dates.length) { log('Test: no green date anywhere right now, so the slot steps cannot be tested yet.', 'warn'); setStatus('Test: nothing green'); return; }
      log(`Test: green dates: ${dates.map(shortDate).join(', ')}`);
      for (const d of dates.slice(0, 3)) {
        const r = await tryTarget({ date: d, fromTime: '00:00', toTime: '24:00', label: 'test' }, true);
        if (r) {
          log(`TEST PASSED on ${shortDate(d)} ${r.slot}: everything is filled and "Add to Wishlist" is clickable. Nothing was submitted. Press Reset on the page.`, 'good');
          setStatus('Test passed');
          return;
        }
      }
      log(`Test: the green dates had no ${CONFIG.routeContains} slot with tickets.`, 'warn');
      setStatus('Test: no slot to try');
    } catch (e) {
      log('TEST FAILED: ' + e.message, 'error');
      setStatus('Test failed');
    } finally {
      busy = false; mode = null; phase = '';
      render();
    }
  }

  // ======================================================================
  //  Notifications
  // ======================================================================
  function notify(title, body) {
    try { GM_notification({ title, text: body || ' ', timeout: 0, highlight: true }); } catch (e) { /* ignore */ }
    beep();
  }
  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const play = () => {
        for (let i = 0; i < 6; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = i % 2 ? 660 : 880;
          o.connect(g); g.connect(ctx.destination);
          const t0 = ctx.currentTime + i * 0.3;
          g.gain.setValueAtTime(0.3, t0);
          o.start(t0); o.stop(t0 + 0.22);
        }
      };
      ctx.resume().then(play).catch(() => {});
    } catch (e) { /* no sound allowed */ }
  }
  let titleTimer = null;
  function flashTitle(msg) {
    if (titleTimer) return;
    const orig = document.title;
    let on = false;
    titleTimer = setInterval(() => { on = !on; document.title = on ? `✅ ${msg}` : orig; }, 900);
    window.addEventListener('focus', () => { clearInterval(titleTimer); titleTimer = null; document.title = orig; }, { once: true });
  }

  // ======================================================================
  //  Panel
  // ======================================================================
  let ui = null;
  let statusText = 'Stopped';

  function getNominee() { return Object.assign({}, CONFIG.nominee, store.get('nominee', {})); }
  function nomineeOk() {
    const n = getNominee();
    const problems = [];
    if (!/^[a-zA-Z ]{1,32}$/.test(n.name.trim())) problems.push('nominee name (letters and spaces only)');
    if (!(+n.age >= 1 && +n.age <= 120)) problems.push('nominee age');
    if (!n.relation.trim()) problems.push('nominee relation (e.g. Father)');
    if (problems.length) { log('Fill in: ' + problems.join(', '), 'error'); return false; }
    return true;
  }

  function log(msg, level) {
    const lines = store.get('log', []);
    const t = new Date().toLocaleTimeString('en-GB');
    const last = lines[lines.length - 1];
    if (last && last.msg === msg) { last.t = t; last.n = (last.n || 1) + 1; } else lines.push({ t, msg, level: level || 'info' });
    while (lines.length > 80) lines.shift();
    store.set('log', lines);
    try { console.log('[VQ Watcher]', msg); } catch (e) { /* ignore */ }
    render();
  }
  function setStatus(s) { statusText = s; render(); }

  function el(tag, style, txt) { const e = document.createElement(tag); if (style) e.style.cssText = style; if (txt !== undefined) e.textContent = txt; return e; }

  function buildPanel() {
    if (ui || !document.body) return;
    const box = el('div', 'position:fixed;left:12px;bottom:12px;width:330px;z-index:2147483647;background:#14161a;color:#e8e8e8;border:2px solid #cd8500;border-radius:8px;font:12px/1.4 Arial,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.5);');
    const head = el('div', 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:#cd8500;color:#000;font-weight:bold;cursor:pointer;');
    const title = el('span', '', 'VQ Watcher');
    const state = el('span', 'font-weight:bold;');
    head.append(title, state);
    const body = el('div', 'padding:8px;');
    const targets = el('div', 'margin-bottom:6px;color:#bbb;', `Looking for: ${CONFIG.targets.map((t) => t.label).join(' OR ')} · ${CONFIG.routeContains} · Self · contributions No`);
    const nomRow = el('div', 'display:flex;gap:4px;margin-bottom:6px;');
    const inp = (ph, w) => { const i = el('input', `width:${w};padding:3px;border:1px solid #555;background:#222;color:#fff;border-radius:3px;font-size:12px;`); i.placeholder = ph; return i; };
    const nName = inp('Nominee name', '48%'); const nAge = inp('Age', '14%'); const nRel = inp('Relation', '34%');
    const n0 = getNominee(); nName.value = n0.name; nAge.value = n0.age; nRel.value = n0.relation;
    const saveNom = () => store.set('nominee', { name: nName.value.trim(), age: nAge.value.trim(), relation: nRel.value.trim() });
    [nName, nAge, nRel].forEach((i) => i.addEventListener('change', saveNom));
    nomRow.append(nName, nAge, nRel);
    const btnRow = el('div', 'display:flex;gap:4px;margin-bottom:6px;');
    const mk = (label, bg) => { const b = el('button', `flex:1;padding:5px;border:0;border-radius:4px;background:${bg};color:#fff;font-weight:bold;cursor:pointer;font-size:12px;`, label); return b; };
    const bStart = mk('Start', '#2e8b2e');
    const bStop = mk('Stop', '#a33');
    const bTest = mk('Test (no submit)', '#555');
    const bClear = mk('Clear log', '#333');
    btnRow.append(bStart, bStop, bTest, bClear);
    const countdown = el('div', 'margin-bottom:4px;color:#cd8500;');
    const logBox = el('div', 'max-height:170px;overflow:auto;background:#0c0d10;border:1px solid #333;border-radius:4px;padding:4px;font:11px/1.35 Consolas,monospace;');
    body.append(targets, nomRow, btnRow, countdown, logBox);
    box.append(head, body);
    document.body.appendChild(box);

    let collapsed = store.get('collapsed', false);
    const applyCollapse = () => { body.style.display = collapsed ? 'none' : 'block'; };
    head.addEventListener('click', () => { collapsed = !collapsed; store.set('collapsed', collapsed); applyCollapse(); });
    applyCollapse();

    bStart.addEventListener('click', () => {
      saveNom();
      if (!nomineeOk()) return;
      store.set('armed', true); store.set('done', null); store.set('submitErrors', 0);
      log('Started. Checking every ' + CONFIG.refreshMinSec + '-' + CONFIG.refreshMaxSec + ' s.', 'good');
      cycleRanThisLoad = false;
      render();
    });
    bStop.addEventListener('click', () => { store.set('armed', false); cancelReload(); setStatus('Stopped'); log('Stopped by you.'); });
    bTest.addEventListener('click', () => { saveNom(); runTest(); });
    bClear.addEventListener('click', () => { store.set('log', []); render(); });

    ui = { box, state, countdown, logBox, bStart, bStop, bTest };
    render();
  }

  function render() {
    if (!ui) return;
    const armed = isArmed();
    const done = store.get('done', null);
    let label = armed ? 'RUNNING' : 'STOPPED';
    let col = armed ? '#063' : '#600';
    if (done && !armed) { label = 'DONE ✅'; col = '#063'; }
    ui.state.textContent = label;
    ui.state.style.color = col;
    let line = statusText;
    if (done && !armed) line = `Added ${shortDate(done.date)} ${done.slot} to wishlist at ${done.at}. Finish the booking from your wishlist!`;
    else if (armed && reloadAt) line = `${statusText} · refresh in ${Math.max(0, Math.round((reloadAt - Date.now()) / 1000))} s`;
    ui.countdown.textContent = line;
    ui.bStart.disabled = armed || busy; ui.bStart.style.opacity = ui.bStart.disabled ? 0.5 : 1;
    ui.bTest.disabled = busy; ui.bTest.style.opacity = busy ? 0.5 : 1;
    const lines = store.get('log', []);
    const colours = { info: '#ccc', good: '#6c6', warn: '#fc6', error: '#f66' };
    ui.logBox.textContent = '';
    lines.slice(-40).forEach((l) => {
      const d = el('div', `color:${colours[l.level] || '#ccc'};`, `${l.t} ${l.msg}${l.n > 1 ? ` (x${l.n})` : ''}`);
      ui.logBox.appendChild(d);
    });
    ui.logBox.scrollTop = ui.logBox.scrollHeight;
  }

  // ======================================================================
  //  Main loop
  // ======================================================================
  function tick() {
    if (!ui) buildPanel();
    if (busy) {
      // Watchdog: a cycle stuck for 2.5 minutes (outside the submit step) gets a fresh page.
      if (mode === 'watch' && phase !== 'submit' && Date.now() - cycleStartedAt > 150000 && isArmed()) location.reload();
      render();
      return;
    }
    if (!isArmed()) { if (statusText !== 'Stopped' && !/Test/.test(statusText)) setStatus('Stopped'); render(); return; }
    if (location.hash.startsWith('#/login')) {
      if (!store.get('warnedLogout', false)) {
        store.set('warnedLogout', true);
        log('You are logged out. Log in and open Virtual-Q; the watcher continues by itself.', 'error');
        notify('VQ Watcher: you are logged out', 'Log in again and open Virtual-Q.');
      }
      setStatus('Waiting: logged out');
      return;
    }
    if (!onDarshanPage()) { setStatus('Waiting: open the Virtual-Q page'); return; }
    if (cycleRanThisLoad) { render(); return; }
    runWatchCycle();
  }

  function start() {
    if (!document.body) { setTimeout(start, 200); return; }
    buildPanel();
    setInterval(tick, 1000);
    tick();
  }
  start();

  // Lets a local test page reach the internals; does nothing on the real site.
  if (window.__VQW_EXPOSE) window.__VQW = { CONFIG, checkTargets, findAvailableDates, pickDate, pickRoute, loadSlots, readSlots, chooseSlot, parseStartMinutes, closeCalendar, openCalendar, cellStatus };
})();
