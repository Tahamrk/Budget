/* Taha Muhasebe — tüm veriler telefonda (localStorage) */
(() => {
  'use strict';
  const VERSION = '1.4.0';
  const KEY = 'tm.data.v1';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const DEFAULT_CATS = [
    { id: 'food', name: 'Yemek', emoji: '🍜' },
    { id: 'coffee', name: 'Kahve & İçecek', emoji: '☕' },
    { id: 'market', name: 'Market', emoji: '🛒' },
    { id: 'transport', name: 'Ulaşım', emoji: '🚇' },
    { id: 'shopping', name: 'Alışveriş', emoji: '🛍️' },
    { id: 'bills', name: 'Faturalar', emoji: '📱' },
    { id: 'home', name: 'Ev', emoji: '🏠' },
    { id: 'health', name: 'Sağlık', emoji: '💊' },
    { id: 'fun', name: 'Eğlence', emoji: '🎬' },
    { id: 'travel', name: 'Seyahat', emoji: '✈️' },
    { id: 'personal', name: 'Bakım', emoji: '💇' },
    { id: 'other', name: 'Diğer', emoji: '📦' },
  ];
  const METHODS = [
    { id: 'alipay', name: 'Alipay', s: 'A', cls: 'm-alipay' },
    { id: 'wechat', name: 'WeChat', s: 'W', cls: 'm-wechat' },
    { id: 'card', name: 'Kart', s: 'K', cls: 'm-card' },
    { id: 'cash', name: 'Nakit', s: 'N', cls: 'm-cash' },
  ];
  const CURS = { CNY: '¥', TRY: '₺', USD: '$' };
  const CUR_ORDER = ['CNY', 'TRY', 'USD'];

  /* ---------------- veri ---------------- */
  let db = load();
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* boş */ }
    return normalizeDb(d);
  }
  function normalizeDb(d) {
    d = d && typeof d === 'object' ? d : {};
    return {
      tx: Array.isArray(d.tx) ? d.tx : [],
      cats: Array.isArray(d.cats) && d.cats.length ? d.cats : DEFAULT_CATS.map(c => ({ ...c })),
      merchants: d.merchants && typeof d.merchants === 'object' ? d.merchants : {},
      settings: Object.assign({
        displayCur: 'CNY', lastMethod: 'alipay', lastCur: 'CNY', nameLang: 'en',
        rates: { CNY: 1, TRY: 6.0, USD: 0.14 }, ratesAt: 0, lastBackup: 0, createdAt: Date.now(),
      }, d.settings || {}),
    };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('Kaydedilemedi: depolama dolu olabilir'); }
  }

  /* ---------------- biçimlendirme ---------------- */
  const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtNum = v => (Math.abs(v - Math.round(v)) < 0.005 ? nf0 : nf2).format(v);
  const fmt = (v, cur = 'CNY') => CURS[cur] + fmtNum(v);
  const rate = cur => cur === 'CNY' ? 1 : (+db.settings.rates[cur] || 1);
  const fromCny = (cny, cur) => cny * rate(cur);
  const toCny = (amt, cur) => amt / rate(cur);
  const dispCur = () => db.settings.displayCur;
  const fmtDisp = cny => fmt(fromCny(cny, dispCur()), dispCur());
  const others = cny => CUR_ORDER.filter(c => c !== dispCur()).map(c => '≈ ' + fmt(fromCny(cny, c), c)).join(' · ');

  // Mağaza adı: ayara göre İngilizce (çeviri) ya da orijinal Çince
  const nameEn = zh => (zh && window.NameEN ? NameEN.toEnglish(zh) : zh || '');
  const mname = zh => !zh ? '' : db.settings.nameLang === 'zh' ? zh : nameEn(zh);
  const mnameOther = zh => !zh ? '' : db.settings.nameLang === 'zh' ? nameEn(zh) : zh;

  const catById = id => db.cats.find(c => c.id === id) || db.cats.find(c => c.id === 'other') || { id: 'other', name: 'Diğer', emoji: '📦' };
  const methodById = id => METHODS.find(m => m.id === id) || METHODS[0];
  const mdot = id => { const m = methodById(id); return `<span class="mdot ${m.cls}" aria-hidden="true">${m.s}</span>`; };

  const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
  const monthShort = new Intl.DateTimeFormat('tr-TR', { month: 'short' });
  const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  const dayShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
  const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function dayLabel(t) {
    const today = startOfDay(Date.now()), d = startOfDay(t);
    if (d === today) return 'Bugün';
    if (d === today - 864e5 || (today - d > 0 && today - d < 864e5 * 1.1)) return 'Dün';
    return dayFmt.format(t);
  }

  /* ---------------- durum ---------------- */
  const now = new Date();
  let view = 'list';
  let month = { y: now.getFullYear(), m: now.getMonth() };
  let search = '';
  let filter = null; // {type:'cat'|'method', id}
  const monthRange = (y, m) => [new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()];
  const txInMonth = (y, m) => { const [a, b] = monthRange(y, m); return db.tx.filter(t => t.ts >= a && t.ts < b); };
  /* ---------------- bölüşme ----------------
   * t.split = { n: kişi sayısı (sen dahil), mine: elle girilen payın | null,
   *             got: [{ a: gelen tutar, ts, from }], closed: "gerisi gelmeyecek" }
   * Tutarlar harcamanın kendi para biriminde. Toplamlara sadece SENİN payın yazılır. */
  function splitInfo(t) {
    const sp = t.split;
    if (!sp) return null;
    const c2 = v => Math.round(v * 100) / 100; // kuruşa yuvarla → her yerde aynı rakam
    const amt = +t.amt || 0;
    const n = Math.max(1, sp.n || 1);
    const mine = c2(sp.mine != null ? Math.min(amt, Math.max(0, +sp.mine)) : amt / n);
    const expected = c2(Math.max(0, amt - mine));
    const got = c2((sp.got || []).reduce((s, g) => s + (+g.a || 0), 0));
    const back = sp.closed ? Math.min(got, amt) : Math.min(amt, Math.max(expected, got));
    const pending = sp.closed ? 0 : c2(Math.max(0, expected - got));
    const share = c2(n > 1 ? expected / (n - 1) : expected);
    return { n, mine, expected, got, back, pending, share, net: amt - back };
  }
  const ratio = (t, part) => (t.amt ? (+t.cny || 0) * part / t.amt : 0);
  const netCny = t => { const s = splitInfo(t); return s ? ratio(t, s.net) : (+t.cny || 0); };
  const pendingCny = t => { const s = splitInfo(t); return s ? ratio(t, s.pending) : 0; };
  const isPending = t => { const s = splitInfo(t); return !!s && s.pending > 0.005; };
  const sumCny = list => list.reduce((s, t) => s + netCny(t), 0);

  /* ---------------- gezinme ---------------- */
  function setView(v) {
    view = v;
    $$('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
    $$('.tab[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === v));
    render();
    window.scrollTo(0, 0);
  }
  $$('.tab[data-view]').forEach(el => el.addEventListener('click', () => setView(el.dataset.view)));
  $$('[data-month]').forEach(el => el.addEventListener('click', () => {
    let m = month.m + +el.dataset.month, y = month.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    month = { y, m };
    render();
  }));

  function render() {
    const title = monthFmt.format(new Date(month.y, month.m, 1));
    $('#list-month').textContent = title;
    $('#stats-month').textContent = title;
    if (view === 'list') renderList();
    if (view === 'stats') renderStats();
    if (view === 'settings') renderSettings();
  }

  /* ---------------- KAYITLAR ---------------- */
  $('#btn-search').addEventListener('click', () => {
    const row = $('#search-row');
    row.classList.toggle('hidden');
    if (!row.classList.contains('hidden')) $('#search-input').focus();
    else { search = ''; $('#search-input').value = ''; filter = null; renderList(); }
  });
  $('#btn-lang').addEventListener('click', () => {
    db.settings.nameLang = db.settings.nameLang === 'zh' ? 'en' : 'zh';
    save(); render();
    toast(db.settings.nameLang === 'zh' ? 'Mağaza adları: 中文' : 'Mağaza adları: English', null, null, 1500);
  });
  $('#search-input').addEventListener('input', e => { search = e.target.value.trim().toLowerCase(); renderList(); });
  $('#filter-chip').addEventListener('click', () => { filter = null; if (!search) $('#search-row').classList.add('hidden'); renderList(); });

  function renderList() {
    $('#btn-lang').textContent = db.settings.nameLang === 'zh' ? '中' : 'EN';
    let list;
    const searching = !!search;
    if (searching) {
      const q = search.replace(',', '.');
      list = db.tx.filter(t => {
        const c = catById(t.cat);
        return [t.note, t.orig, nameEn(t.orig), c.name, methodById(t.method).name, String(t.amt)].join(' ').toLowerCase().includes(q);
      });
    } else list = txInMonth(month.y, month.m);
    const pendingView = filter && filter.type === 'pending';
    if (pendingView) list = db.tx.filter(isPending);
    else if (filter) list = list.filter(t => t[filter.type === 'cat' ? 'cat' : 'method'] === filter.id);

    const chip = $('#filter-chip');
    if (filter) {
      const label = pendingView ? '👥 Arkadaşlardan bekleyenler'
        : filter.type === 'cat' ? `${catById(filter.id).emoji} ${catById(filter.id).name}` : methodById(filter.id).name;
      chip.hidden = false; chip.innerHTML = `${esc(label)} ✕`;
      $('#search-row').classList.remove('hidden');
    } else chip.hidden = true;

    const total = pendingView ? list.reduce((s, t) => s + pendingCny(t), 0) : sumCny(list);
    $('.hero-label').textContent = pendingView ? 'Arkadaşlardan bekleyen (tüm aylar)' : searching ? 'Arama sonucu (tüm aylar)' : filter ? 'Filtrelenmiş toplam' : 'Bu ay toplam (senin payın)';
    $('#hero-total').textContent = fmtDisp(total);
    $('#hero-sub').textContent = `${others(total)} · ${list.length} kayıt`;
    const byM = {};
    if (!pendingView) list.forEach(t => byM[t.method] = (byM[t.method] || 0) + netCny(t));
    const allPending = db.tx.filter(isPending);
    const pendTotal = allPending.reduce((s, t) => s + pendingCny(t), 0);
    $('#method-strip').innerHTML = METHODS.filter(m => byM[m.id]).map(m =>
      `<span class="mpill">${mdot(m.id)}${m.name} ${fmtDisp(byM[m.id])}</span>`).join('')
      + (allPending.length && !pendingView ? `<button class="mpill pend" id="pend-pill">👥 Bekleyen ${fmtDisp(pendTotal)} (${allPending.length})</button>` : '');

    // gün gruplarına ayır
    const groups = new Map();
    [...list].sort((a, b) => b.ts - a.ts).forEach(t => {
      const k = startOfDay(t.ts);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    });
    let html = '';
    groups.forEach((rows, k) => {
      html += `<div class="day"><div class="day-head"><span>${esc(dayLabel(k))}</span><span>${fmtDisp(sumCny(rows))}</span></div><div class="day-rows">`;
      rows.forEach(t => {
        const c = catById(t.cat);
        const name = mname(t.orig);
        // taranan kayıtlarda başlık = mağaza adı (EN/中), alt satır = açıklama
        const title = name || t.note || c.name;
        const si = splitInfo(t);
        const splitTxt = si ? (si.pending > 0.005 ? `👥 ${fmt(si.pending, t.cur)} bekleniyor` : `👥 ${si.n} kişi ✓`) : '';
        const sub = [timeFmt.format(t.ts), t.note && t.note !== title ? t.note : (title !== c.name ? c.name : ''), splitTxt].filter(Boolean).join(' · ');
        const conv = t.cur !== dispCur() ? `<span class="muted">${fmtDisp(netCny(t))}</span>` : '';
        const amtHtml = si ? `<b>${fmt(si.net, t.cur)}</b><span class="of">/ ${fmt(t.amt, t.cur)}</span>` : `<b>${fmt(t.amt, t.cur)}</b>`;
        html += `<button class="tx" data-id="${t.id}">
          <span class="tx-ico">${c.emoji}${mdot(t.method)}</span>
          <span class="tx-main"><div class="tx-title">${esc(title)}</div><div class="tx-sub">${esc(sub)}</div></span>
          <span class="tx-amt">${amtHtml}${conv}</span></button>`;
      });
      html += '</div></div>';
    });
    $('#tx-list').innerHTML = html;
    $('#list-empty').classList.toggle('hidden', list.length > 0);
    $('#list-empty p').textContent = searching || filter ? 'Eşleşen kayıt yok.' : 'Bu ay henüz kayıt yok.';

    const lb = db.settings.lastBackup || db.settings.createdAt;
    $('#backup-banner').classList.toggle('hidden', !(db.tx.length >= 10 && Date.now() - lb > 30 * 864e5));
  }
  $('#method-strip').addEventListener('click', e => {
    if (!e.target.closest('#pend-pill')) return;
    filter = { type: 'pending' }; search = ''; $('#search-input').value = '';
    renderList();
  });
  $('#tx-list').addEventListener('click', e => {
    const b = e.target.closest('.tx');
    if (b) openSheet({ mode: 'edit', tx: db.tx.find(t => t.id === b.dataset.id) });
  });

  /* ---------------- EKLE / DÜZENLE ---------------- */
  let S = null; // sayfa durumu
  let scanQueue = [];
  let scanTotal = 0;

  function openSheet(opts) {
    const t = opts.tx || {};
    S = {
      mode: opts.mode,
      id: t.id || null,
      amountStr: t.amt ? String(+(+t.amt).toFixed(2)).replace('.', ',') : '',
      cur: t.cur || db.settings.lastCur || 'CNY',
      method: t.method || db.settings.lastMethod || 'alipay',
      cat: t.cat || null,
      note: t.note || '',
      ts: t.ts || null,
      orig: t.orig || '',
      scan: opts.scan || null,
      split: t.split ? JSON.parse(JSON.stringify(t.split)) : null,
    };
    $('#sheet-title').textContent = S.mode === 'edit' ? 'Düzenle' : S.mode === 'scan' ? `Tarama ${scanTotal - scanQueue.length}/${scanTotal}` : 'Yeni harcama';
    $('#sheet-delete').classList.toggle('hidden', S.mode !== 'edit');
    $('#cat-hint').classList.toggle('hidden', S.mode !== 'add');
    $('#note-input').value = S.note;

    const sp = $('#scan-preview');
    if (S.scan) {
      sp.classList.remove('hidden');
      $('#scan-thumb').src = S.scan.thumb;
      $('#scan-orig').innerHTML = S.orig ? `Mağaza: <b>${esc(mname(S.orig))}</b><br><span class="orig-alt">${esc(mnameOther(S.orig))}</span>` : 'Mağaza adı okunamadı.';
      $('#scan-warn').textContent = S.scan.warnings.join(' ');
    } else if (S.mode === 'edit' && S.orig) {
      sp.classList.remove('hidden');
      $('#scan-thumb').removeAttribute('src');
      $('#scan-thumb').style.display = 'none';
      $('#scan-orig').innerHTML = `Mağaza: <b>${esc(mname(S.orig))}</b><br><span class="orig-alt">${esc(mnameOther(S.orig))}</span>`;
      $('#scan-warn').textContent = '';
    } else sp.classList.add('hidden');
    if (S.scan) $('#scan-thumb').style.display = '';

    renderSheet();
    $('#sheet').classList.remove('hidden');
    $('#sheet-backdrop').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    $('#sheet').classList.add('hidden');
    $('#sheet-backdrop').classList.add('hidden');
    document.body.style.overflow = '';
    if (S && S.scan && S.scan.thumb) URL.revokeObjectURL(S.scan.thumb);
    S = null;
  }

  function renderSheet() {
    // para birimi
    $('#cur-seg').innerHTML = CUR_ORDER.map(c => `<button class="${c === S.cur ? 'on' : ''}" data-cur="${c}">${CURS[c]}</button>`).join('');
    // ödeme yöntemi
    $('#method-chips').innerHTML = METHODS.map(m =>
      `<button class="chip ${m.id === S.method ? 'on' : ''}" data-method="${m.id}">${mdot(m.id)}${m.name}</button>`).join('');
    // sık kullanılanlar
    $('#freq-chips').innerHTML = S.mode === 'add' ? frequents().map((f, i) => {
      const c = catById(f.cat);
      return `<button class="chip freq" data-freq="${i}">↻ ${c.emoji} ${esc(f.note || c.name)} ${fmt(f.amt, f.cur)}</button>`;
    }).join('') : '';
    // kategoriler
    $('#cat-grid').innerHTML = db.cats.map(c =>
      `<button class="cat ${c.id === S.cat ? 'on' : ''}" data-cat="${c.id}"><span class="ce">${c.emoji}</span><span>${esc(c.name)}</span></button>`).join('');
    // tuş takımı
    if (!$('#keypad').children.length) {
      $('#keypad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']
        .map(k => `<button class="key ${k === ',' || k === '⌫' ? 'fn' : ''}" data-key="${k}">${k}</button>`).join('');
    }
    renderAmount();
    renderDate();
  }
  function amountVal() { return parseFloat((S.amountStr || '0').replace(',', '.')) || 0; }
  function renderAmount() {
    $('#amount-display .cur-sym').textContent = CURS[S.cur];
    $('#amount-text').textContent = S.amountStr || '0';
    const v = amountVal();
    $('#amount-conv').textContent = v ? CUR_ORDER.filter(c => c !== S.cur).map(c => '≈ ' + fmt(fromCny(toCny(v, S.cur), c), c)).join(' · ') : '';
    renderSplit();
  }

  /* bölüş paneli */
  function renderSplit() {
    const tog = $('#split-toggle'), p = $('#split-panel');
    tog.classList.toggle('on', !!S.split);
    tog.textContent = S.split ? '👥 Bölüşülüyor' : '👥 Arkadaşlarla bölüş';
    if (!S.split) { p.classList.add('hidden'); p.innerHTML = ''; return; }
    p.classList.remove('hidden');
    const s = splitInfo({ amt: amountVal(), split: S.split });
    const f = v => fmt(v, S.cur);
    const minePh = String(Math.round(s.mine * 100) / 100).replace('.', ',');
    const active = document.activeElement && document.activeElement.id === 'split-mine';
    const mineVal = active ? document.activeElement.value : (S.split.mine != null ? minePh : '');
    const nextOne = s.pending > 0.005 ? Math.min(s.share, s.pending) : s.share;
    p.innerHTML = `
      <div class="sp-row"><span>Kaç kişi? <small>(sen dahil)</small></span>
        <div class="stepper"><button data-sa="minus" aria-label="Azalt">−</button><b>${s.n}</b><button data-sa="plus" aria-label="Artır">＋</button></div></div>
      <div class="sp-row"><span>Senin payın <small>${S.split.mine != null ? '(elle)' : '(eşit)'}</small></span>
        <input id="split-mine" type="text" inputmode="decimal" placeholder="${esc(minePh)}" value="${esc(mineVal)}" aria-label="Senin payın"></div>
      <div class="sp-sum">Arkadaşlardan gelecek: <b>${f(s.expected)}</b>${s.n > 2 ? ` · kişi başı ${f(s.share)}` : ''}</div>
      <div class="sp-got">${(S.split.got || []).map((g, i) => `<span class="gchip">✓ ${f(g.a)}${g.from ? ' · ' + esc(g.from) : ''} · ${dayShort.format(g.ts)}<button data-sa="del" data-i="${i}" aria-label="Sil">✕</button></span>`).join('')}</div>
      ${S.split.closed ? '<div class="sp-status">Kapatıldı: gelmeyen kısım senin harcaman sayılır.</div>'
        : s.pending > 0.005 ? `<div class="sp-status">Bekleyen: ${f(s.pending)}</div>
          <div class="sp-btns"><button class="btn small" data-sa="one">＋ Biri gönderdi (${f(nextOne)})</button><button class="btn small" data-sa="custom">＋ Farklı tutar</button></div>`
        : (s.expected > 0 ? '<div class="sp-status done">✓ Herkes payını gönderdi</div>' : '')}
      <div class="sp-links">
        <button class="link-btn" data-sa="close">${S.split.closed ? 'Yeniden aç' : (s.pending > 0.005 ? 'Gerisi gelmeyecek' : '')}</button>
        <button class="link-btn danger" data-sa="remove">Bölüşmeyi kaldır</button></div>`;
  }
  $('#split-toggle').addEventListener('click', () => {
    if (!S) return;
    if (!S.split) S.split = { n: 2, mine: null, got: [], closed: false };
    renderSplit();
    $('#split-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('#split-panel').addEventListener('click', e => {
    const b = e.target.closest('[data-sa]'); if (!b || !S || !S.split) return;
    const sp = S.split, s = splitInfo({ amt: amountVal(), split: sp });
    const addGot = a => { if (a > 0) sp.got.push({ a: Math.round(a * 100) / 100, ts: Date.now() }); };
    switch (b.dataset.sa) {
      case 'plus': sp.n = Math.min(50, (sp.n || 1) + 1); sp.mine = null; break;
      case 'minus': sp.n = Math.max(2, (sp.n || 2) - 1); sp.mine = null; break;
      case 'one': addGot(s.pending > 0.005 ? Math.min(s.share, s.pending) : s.share); break;
      case 'custom': {
        const v = parseFloat(String(prompt('Gelen tutar:', String(Math.round(s.share * 100) / 100).replace('.', ',')) || '').replace(',', '.'));
        addGot(v);
        break;
      }
      case 'del': sp.got.splice(+b.dataset.i, 1); break;
      case 'close': sp.closed = !sp.closed; break;
      case 'remove': S.split = null; break;
    }
    renderSplit();
  });
  $('#split-panel').addEventListener('change', e => {
    if (e.target.id !== 'split-mine' || !S || !S.split) return;
    const v = parseFloat(e.target.value.replace(',', '.'));
    S.split.mine = v >= 0 && e.target.value.trim() !== '' ? v : null;
    renderSplit();
  });
  function renderDate() {
    const t = S.ts || Date.now();
    const d = new Date(t);
    const label = startOfDay(t) === startOfDay(Date.now()) ? (S.ts ? 'Bugün ' + timeFmt.format(t) : 'Şimdi')
      : dayLabel(t) === 'Dün' ? 'Dün ' + timeFmt.format(t) : dayShort.format(t) + ' ' + timeFmt.format(t);
    $('#date-label').textContent = '🗓 ' + label;
    const pad = n => String(n).padStart(2, '0');
    $('#date-input').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  $('#cur-seg').addEventListener('click', e => { const b = e.target.closest('[data-cur]'); if (b) { S.cur = b.dataset.cur; renderSheet(); } });
  $('#method-chips').addEventListener('click', e => { const b = e.target.closest('[data-method]'); if (b) { S.method = b.dataset.method; renderSheet(); } });
  $('#keypad').addEventListener('click', e => {
    const b = e.target.closest('[data-key]'); if (!b || !S) return;
    const k = b.dataset.key; let s = S.amountStr;
    if (k === '⌫') s = s.slice(0, -1);
    else if (k === ',') { if (!s.includes(',')) s = (s || '0') + ','; }
    else {
      const [i, f] = s.split(',');
      if (f !== undefined && f.length >= 2) return;
      if (f === undefined && i.replace(/^0+/, '').length >= 7) return;
      s = s === '0' ? k : s + k;
    }
    S.amountStr = s; renderAmount();
  });
  $('#amount-display').addEventListener('click', () => { if (S) { S.amountStr = ''; renderAmount(); } });
  $('#note-input').addEventListener('input', e => { if (S) S.note = e.target.value; });
  $('#note-input').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('#date-input').addEventListener('change', e => {
    const v = e.target.value; if (!v || !S) return;
    const t = new Date(v).getTime(); if (!isNaN(t)) { S.ts = t; renderDate(); }
  });
  $('#cat-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b || !S) return;
    S.cat = b.dataset.cat;
    if (S.mode === 'add') {
      if (amountVal() > 0) return commit();
      const a = $('#amount-display'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
    }
    renderSheet();
  });
  $('#freq-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-freq]'); if (!b) return;
    const f = frequents()[+b.dataset.freq]; if (!f) return;
    Object.assign(S, { amountStr: String(f.amt).replace('.', ','), cur: f.cur, method: f.method, cat: f.cat, note: f.note });
    commit();
  });
  $('#sheet-save').addEventListener('click', () => commit());
  $('#sheet-cancel').addEventListener('click', () => { const wasScan = S && S.mode === 'scan'; closeSheet(); if (wasScan) nextScan(); });
  $('#sheet-backdrop').addEventListener('click', () => { const wasScan = S && S.mode === 'scan'; closeSheet(); if (wasScan) nextScan(); });
  $('#sheet-delete').addEventListener('click', () => {
    const t = db.tx.find(x => x.id === S.id); if (!t) return closeSheet();
    db.tx = db.tx.filter(x => x.id !== S.id); save(); closeSheet(); render();
    toast('Kayıt silindi', 'Geri al', () => { db.tx.push(t); save(); render(); });
  });
  $('#btn-add').addEventListener('click', () => openSheet({ mode: 'add' }));

  function commit() {
    const v = amountVal();
    if (!(v > 0)) { const a = $('#amount-display'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); return; }
    if (!S.cat) { toast('Bir kategori seç'); return; }
    const existing = S.id ? db.tx.find(t => t.id === S.id) : null;
    const amt = Math.round(v * 100) / 100;
    const sameAmount = existing && existing.amt === amt && existing.cur === S.cur;
    const tx = {
      id: S.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: S.ts || Date.now(),
      amt, cur: S.cur,
      cny: sameAmount ? existing.cny : Math.round(toCny(amt, S.cur) * 100) / 100,
      method: S.method, cat: S.cat,
      note: (S.note || '').trim(),
      orig: S.orig || '',
      src: existing ? existing.src : (S.mode === 'scan' ? 'scan' : 'manual'),
      created: existing ? existing.created : Date.now(),
      split: S.split && ((S.split.n || 1) > 1 || S.split.mine != null || (S.split.got || []).length) ? S.split : undefined,
    };
    const prev = existing ? { ...existing } : null;
    if (existing) Object.assign(existing, tx); else db.tx.push(tx);
    if (tx.orig) db.merchants[tx.orig] = { d: tx.note, c: tx.cat, n: ((db.merchants[tx.orig] || {}).n || 0) + 1 };
    db.settings.lastMethod = tx.method;
    db.settings.lastCur = tx.cur;
    save();
    const wasScan = S.mode === 'scan';
    closeSheet();
    // kaydedilen ayı göster
    const d = new Date(tx.ts);
    if (!search) month = { y: d.getFullYear(), m: d.getMonth() };
    if (view !== 'list') setView('list'); else render();
    const c = catById(tx.cat);
    const si = splitInfo(tx);
    toast(`${prev ? 'Güncellendi' : 'Kaydedildi'} · ${fmt(si ? si.net : tx.amt, tx.cur)} ${c.emoji}${si ? ' (senin payın)' : ''}`, 'Geri al', () => {
      if (prev) Object.assign(db.tx.find(t => t.id === prev.id) || {}, prev);
      else db.tx = db.tx.filter(t => t.id !== tx.id);
      save(); render();
    });
    if (wasScan) setTimeout(nextScan, 250);
  }

  function frequents() {
    const since = Date.now() - 120 * 864e5, map = new Map();
    db.tx.forEach(t => {
      if (t.ts < since) return;
      const k = [t.note, t.cat, t.method, t.amt, t.cur].join('|');
      const e = map.get(k) || { note: t.note, cat: t.cat, method: t.method, amt: t.amt, cur: t.cur, n: 0, last: 0 };
      e.n++; e.last = Math.max(e.last, t.ts); map.set(k, e);
    });
    return [...map.values()].filter(e => e.n >= 2).sort((a, b) => b.n - a.n || b.last - a.last).slice(0, 6);
  }

  /* ---------------- TARAMA (OCR) ---------------- */
  const OCR_STATUS = {
    'loading tesseract core': 'OCR motoru yükleniyor',
    'initializing tesseract': 'Hazırlanıyor',
    'loading language traineddata': 'Dil verisi yükleniyor',
    'loading language traineddata (from cache)': 'Dil verisi yükleniyor',
    'initializing api': 'Hazırlanıyor',
    'recognizing text': 'Metin okunuyor',
  };
  $('#scan-input').addEventListener('change', async e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const ov = $('#ocr-overlay');
    ov.classList.remove('hidden');
    $('#ocr-sub').textContent = localStorage.getItem('tm.ocrReady') ? '' : 'İlk kullanımda OCR motoru indirilir (~8 MB), sonra internetsiz çalışır.';
    const results = [];
    for (let i = 0; i < files.length; i++) {
      $('#ocr-status').textContent = files.length > 1 ? `Okunuyor ${i + 1}/${files.length}` : 'Okunuyor…';
      $('#ocr-bar').style.width = '0%';
      try {
        const r = await OCR.read(files[i], m => {
          const label = OCR_STATUS[m.status] || 'Hazırlanıyor';
          $('#ocr-status').textContent = (files.length > 1 ? `${i + 1}/${files.length} · ` : '') + label + '…';
          if (typeof m.progress === 'number') $('#ocr-bar').style.width = Math.round(m.progress * 100) + '%';
        });
        try { localStorage.setItem('tm.ocrReady', '1'); } catch (_) { /* yok say */ }
        results.push({ file: files[i], r });
      } catch (err) {
        console.error(err);
        results.push({ file: files[i], r: { amount: 0, ts: null, method: null, orig: '', origAlt: '', desc: '', cat: null, warnings: ['Okunamadı: ' + (err.message || err)] } });
      }
    }
    ov.classList.add('hidden');
    scanQueue = results;
    scanTotal = results.length;
    nextScan();
  });

  /* Gelen para (arkadaşın payını gönderdi) → hangi bölüşülmüş harcamaya ait? */
  function openReceiptPicker(item) {
    const r = item.r, amt = r.amount;
    const open = db.tx.filter(isPending).map(t => {
      const s = splitInfo(t);
      const inCur = amt * rate(t.cur); // gelen ¥ → harcamanın para birimi
      const score = Math.min(Math.abs(s.share - inCur), Math.abs(s.pending - inCur)) / Math.max(1, s.share) + (Date.now() - t.ts) / (90 * 864e5);
      return { t, s, score };
    }).sort((a, b) => a.score - b.score).slice(0, 8);
    $('#picker-title').textContent = `Gelen ödeme: ${fmt(amt)}`;
    $('#picker-sub').textContent = (r.from ? `Gönderen: ${r.from} · ` : '') + (open.length ? 'Hangi bölüşülmüş harcamaya ait?' : 'Bekleyen bölüşülmüş harcama yok.');
    $('#picker-list').innerHTML = open.map(({ t, s }) => {
      const title = mname(t.orig) || t.note || catById(t.cat).name;
      return `<button class="pick" data-id="${t.id}"><span class="pk-main"><div class="pk-title">${catById(t.cat).emoji} ${esc(title)}</div>
        <div class="pk-sub">${dayShort.format(t.ts)} · ${s.n} kişi · toplam ${fmt(t.amt, t.cur)}</div></span>
        <span class="pk-amt">bekleyen<br><b>${fmt(s.pending, t.cur)}</b></span></button>`;
    }).join('') + '<button class="pick alt" data-id="__expense">Bu bir harcama, normal kaydet</button>';
    const ov = $('#picker');
    ov.classList.remove('hidden');
    const done = () => { ov.classList.add('hidden'); $('#picker-list').onclick = null; $('#picker-cancel').onclick = null; };
    $('#picker-cancel').onclick = () => { done(); nextScan(); };
    $('#picker-list').onclick = e => {
      const b = e.target.closest('.pick'); if (!b) return;
      done();
      if (b.dataset.id === '__expense') return nextScan({ ...item, r: { ...r, incoming: false } });
      const t = db.tx.find(x => x.id === b.dataset.id); if (!t) return nextScan();
      const g = { a: Math.round(amt * rate(t.cur) * 100) / 100, ts: r.ts || Date.now() };
      if (r.from) g.from = r.from;
      t.split.got = t.split.got || [];
      t.split.got.push(g);
      save(); render();
      const s = splitInfo(t);
      toast(`${fmt(g.a, t.cur)} → ${mname(t.orig) || t.note || catById(t.cat).name}` + (s.pending > 0.005 ? ` · kalan ${fmt(s.pending, t.cur)}` : ' · ✓ tamamlandı'), 'Geri al', () => {
        const i = t.split.got.indexOf(g); if (i >= 0) t.split.got.splice(i, 1); save(); render();
      }, 5000);
      setTimeout(nextScan, 300);
    };
  }

  function nextScan(forced) {
    const item = forced || scanQueue.shift();
    if (!item) return;
    const r = item.r;
    if (r.incoming && r.amount) return openReceiptPicker(item);
    const mem = r.orig ? db.merchants[r.orig] : null;
    const warnings = [...r.warnings];
    const cny = r.amount;
    if (cny && r.ts) {
      const dup = db.tx.find(t => Math.abs(t.cny - cny) < 0.01 && Math.abs(t.ts - r.ts) < 3 * 60e3);
      if (dup) warnings.unshift(`⚠️ Bu harcama zaten kayıtlı olabilir (${dayShort.format(dup.ts)} ${timeFmt.format(dup.ts)}).`);
    }
    openSheet({
      mode: 'scan',
      tx: {
        amt: r.amount || 0, cur: 'CNY',
        method: r.method || db.settings.lastMethod,
        cat: (mem && mem.c) || r.cat || null,
        note: (mem && mem.d) || r.desc || '',
        ts: r.ts || null,
        orig: r.orig || '',
      },
      scan: { thumb: URL.createObjectURL(item.file), origAlt: r.origAlt || '', warnings },
    });
  }

  /* ---------------- ÖZET ---------------- */
  function renderStats() {
    const list = txInMonth(month.y, month.m);
    const pm = month.m === 0 ? { y: month.y - 1, m: 11 } : { y: month.y, m: month.m - 1 };
    const total = sumCny(list), prevTotal = sumCny(txInMonth(pm.y, pm.m));
    const daysIn = new Date(month.y, month.m + 1, 0).getDate();
    const isCur = month.y === now.getFullYear() && month.m === new Date().getMonth();
    const daysElapsed = isCur ? new Date().getDate() : daysIn;

    let delta = '';
    if (prevTotal > 0) {
      const p = Math.round((total - prevTotal) / prevTotal * 100);
      delta = p === 0 ? 'Geçen ayla aynı' : `<span class="${p > 0 ? 'delta-up' : 'delta-down'}">${p > 0 ? '▲' : '▼'} %${Math.abs(p)}</span> geçen aya göre (${fmtDisp(prevTotal)})`;
    }
    const byCat = groupSum(list, 'cat'), byMethod = groupSum(list, 'method');
    const topCat = byCat[0] ? catById(byCat[0].id) : null;
    const biggest = list.reduce((a, t) => (!a || netCny(t) > netCny(a) ? t : a), null);
    const allPending = db.tx.filter(isPending);
    const pendTotal = allPending.reduce((s, t) => s + pendingCny(t), 0);
    const bigSi = biggest ? splitInfo(biggest) : null;
    $('#stat-tiles').innerHTML = `
      <div class="tile wide"><div class="tile-label">Toplam harcama</div><div class="tile-value big">${fmtDisp(total)}</div>
        <div class="tile-sub">${others(total)}</div>${delta ? `<div class="tile-sub">${delta}</div>` : ''}</div>
      <div class="tile"><div class="tile-label">Günlük ortalama</div><div class="tile-value">${fmtDisp(total / Math.max(1, daysElapsed))}</div><div class="tile-sub">${daysElapsed} gün</div></div>
      <div class="tile"><div class="tile-label">Kayıt sayısı</div><div class="tile-value">${list.length}</div><div class="tile-sub">${topCat ? 'En çok: ' + topCat.emoji + ' ' + esc(topCat.name) : '—'}</div></div>
      ${biggest ? `<div class="tile wide"><div class="tile-label">En büyük harcama${bigSi ? ' (senin payın)' : ''}</div><div class="tile-value">${fmt(bigSi ? bigSi.net : biggest.amt, biggest.cur)}</div><div class="tile-sub">${catById(biggest.cat).emoji} ${esc(mname(biggest.orig) || biggest.note || catById(biggest.cat).name)} · ${dayShort.format(biggest.ts)}</div></div>` : ''}
      ${allPending.length ? `<button class="tile wide" id="tile-pending" style="text-align:left"><div class="tile-label">👥 Arkadaşlardan bekleyen</div><div class="tile-value">${fmtDisp(pendTotal)}</div><div class="tile-sub">${allPending.length} bölüşülmüş harcama · dokun ve gör</div></button>` : ''}`;

    $('#cat-bars').innerHTML = hbars(byCat.map(g => ({ ...g, label: `${catById(g.id).emoji} ${catById(g.id).name}`, type: 'cat' })), total);
    $('#method-bars').innerHTML = hbars(byMethod.map(g => ({ ...g, label: methodById(g.id).name, type: 'method' })), total);

    // günlük
    const daily = Array.from({ length: daysIn }, (_, i) => ({ v: 0, label: dayShort.format(new Date(month.y, month.m, i + 1)), tick: [1, 5, 10, 15, 20, 25, daysIn].includes(i + 1) ? String(i + 1) : '' }));
    list.forEach(t => { daily[new Date(t.ts).getDate() - 1].v += netCny(t); });
    $('#daily-chart').innerHTML = list.length ? vbars(daily, { hl: isCur ? new Date().getDate() - 1 : -1 }) : '<div class="chart-empty">Bu ay kayıt yok.</div>';

    // son 6 ay
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(month.y, month.m - i, 1);
      months.push({ v: sumCny(txInMonth(d.getFullYear(), d.getMonth())), label: monthFmt.format(d), tick: monthShort.format(d) });
    }
    $('#months-chart').innerHTML = months.some(m => m.v) ? vbars(months, { hl: 5, labelHl: true }) : '<div class="chart-empty">Henüz veri yok.</div>';
  }
  function groupSum(list, key) {
    const m = {};
    list.forEach(t => m[t[key]] = (m[t[key]] || 0) + netCny(t));
    return Object.entries(m).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  }
  function hbars(rows, total) {
    if (!rows.length) return '<div class="chart-empty">Bu ay kayıt yok.</div>';
    const max = rows[0].v || 1;
    return rows.map(r => `<button class="hbar" data-ftype="${r.type}" data-fid="${esc(r.id)}">
      <span class="hbar-label">${esc(r.label)}</span>
      <span class="hbar-val">${fmtDisp(r.v)}<span>%${Math.round(r.v / (total || 1) * 100)}</span></span>
      <span class="hbar-track"><div class="hbar-fill" style="width:${Math.max(1, r.v / max * 100)}%"></div></span></button>`).join('');
  }
  $('#stat-tiles').addEventListener('click', e => {
    if (!e.target.closest('#tile-pending')) return;
    filter = { type: 'pending' }; search = ''; $('#search-input').value = '';
    setView('list');
  });
  ['#cat-bars', '#method-bars'].forEach(sel => $(sel).addEventListener('click', e => {
    const b = e.target.closest('.hbar'); if (!b) return;
    filter = { type: b.dataset.ftype, id: b.dataset.fid };
    search = ''; $('#search-input').value = '';
    setView('list');
  }));

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function vbars(data, { hl = -1, labelHl = false } = {}) {
    const W = 340, H = 150, padL = 34, padB = 18, padT = labelHl ? 16 : 6;
    const max = niceMax(Math.max(...data.map(d => fromCny(d.v, dispCur()))));
    const ih = H - padB - padT, iw = W - padL;
    const step = iw / data.length, bw = Math.max(2, Math.min(28, step - 2));
    const y = v => padT + ih - (v / max) * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
    [0, 0.5, 1].forEach(f => {
      const yy = y(max * f);
      s += `<line class="${f === 0 ? 'base' : 'grid'}" x1="${padL}" x2="${W}" y1="${yy}" y2="${yy}"/>`;
      s += `<text x="${padL - 6}" y="${yy + 3}" text-anchor="end">${compact(max * f)}</text>`;
    });
    data.forEach((d, i) => {
      const v = fromCny(d.v, dispCur());
      const x = padL + i * step + (step - bw) / 2;
      const top = y(v), h = padT + ih - top;
      if (h > 0.5) {
        const r = Math.min(4, bw / 2, h);
        s += `<path class="bar ${i === hl ? 'hl' : (hl >= 0 && labelHl ? 'dim' : '')}" d="M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${top + h}Z"/>`;
      }
      if (d.tick) s += `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle">${esc(d.tick)}</text>`;
      if (labelHl && i === hl && v > 0) s += `<text x="${x + bw / 2}" y="${top - 4}" text-anchor="middle" style="fill:var(--ink);font-weight:600">${esc(compact(v))}</text>`;
      s += `<rect class="hit" x="${padL + i * step}" y="0" width="${step}" height="${H}" data-tip="${esc(d.label + ': ' + fmt(v, dispCur()))}"/>`;
    });
    return s + '</svg>';
  }
  function compact(v) {
    const sym = CURS[dispCur()];
    if (v >= 1e6) return sym + fmtNum(Math.round(v / 1e5) / 10) + 'M';
    if (v >= 1e4) return sym + fmtNum(Math.round(v / 100) / 10) + 'B';
    return sym + nf0.format(v);
  }
  // grafik ipucu (dokun / üzerine gel)
  const tip = $('#tooltip');
  function showTip(e) {
    const r = e.target.closest('[data-tip]');
    if (!r) { tip.classList.add('hidden'); return; }
    const b = r.getBoundingClientRect();
    tip.textContent = r.dataset.tip;
    tip.style.left = Math.min(window.innerWidth - 80, Math.max(80, b.left + b.width / 2)) + 'px';
    tip.style.top = (b.top + 10) + 'px';
    tip.classList.remove('hidden');
  }
  ['#daily-chart', '#months-chart'].forEach(sel => {
    $(sel).addEventListener('pointerdown', showTip);
    $(sel).addEventListener('pointermove', showTip);
    $(sel).addEventListener('pointerleave', () => tip.classList.add('hidden'));
  });
  document.addEventListener('scroll', () => tip.classList.add('hidden'), { passive: true });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.vchart')) tip.classList.add('hidden'); });

  /* ---------------- AYARLAR ---------------- */
  function renderSettings() {
    $('#set-display-cur').innerHTML = CUR_ORDER.map(c => `<button class="${c === dispCur() ? 'on' : ''}" data-dc="${c}">${CURS[c]} ${c}</button>`).join('');
    $('#set-name-lang').innerHTML = [['en', 'English'], ['zh', '中文']].map(([v, l]) => `<button class="${db.settings.nameLang === v ? 'on' : ''}" data-nl="${v}">${l}</button>`).join('');
    ['TRY', 'USD'].forEach(c => { $('#rate-' + c).value = String(db.settings.rates[c]).replace('.', ','); });
    $('#rates-info').textContent = db.settings.ratesAt ? 'Son güncelleme: ' + dayShort.format(db.settings.ratesAt) + ' ' + timeFmt.format(db.settings.ratesAt) : 'Henüz güncellenmedi';
    $('#backup-info').textContent = `${db.tx.length} kayıt · ` + (db.settings.lastBackup ? 'Son yedek: ' + dayShort.format(db.settings.lastBackup) : 'Henüz yedek alınmadı');
    $('#cat-editor').innerHTML = db.cats.map(c => `<div class="cat-edit-row" data-id="${c.id}">
      <input class="emoji" value="${esc(c.emoji)}" maxlength="4" aria-label="Simge">
      <input class="name" value="${esc(c.name)}" aria-label="Kategori adı">
      ${c.id === 'other' ? '<span class="x-btn"></span>' : '<button class="x-btn" data-del aria-label="Sil">✕</button>'}</div>`).join('');
    const ms = Object.entries(db.merchants).sort((a, b) => (b[1].n || 0) - (a[1].n || 0));
    $('#merchant-list').innerHTML = ms.length ? ms.map(([k, v]) => `<div class="merchant-row" data-k="${esc(k)}">
      <span>${catById(v.c).emoji}</span><div class="mr-main"><div>${esc(v.d || catById(v.c).name)}</div><div>${esc(mname(k))} · ${esc(mnameOther(k))}</div></div>
      <button class="x-btn" data-del aria-label="Unut">✕</button></div>`).join('') : '<p class="muted small">Henüz yok.</p>';
    $('#version-info').textContent = 'Taha Muhasebe v' + VERSION;
  }
  $('#set-name-lang').addEventListener('click', e => {
    const b = e.target.closest('[data-nl]'); if (!b) return;
    db.settings.nameLang = b.dataset.nl; save(); renderSettings();
  });
  $('#set-display-cur').addEventListener('click', e => {
    const b = e.target.closest('[data-dc]'); if (!b) return;
    db.settings.displayCur = b.dataset.dc; save(); renderSettings();
  });
  ['TRY', 'USD'].forEach(c => $('#rate-' + c).addEventListener('change', e => {
    const v = parseFloat(e.target.value.replace(',', '.'));
    if (v > 0) { db.settings.rates[c] = v; db.settings.ratesAt = Date.now(); save(); }
    renderSettings();
  }));
  $('#btn-rates').addEventListener('click', () => updateRates(true));

  async function fetchJson(url) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 7000);
    try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    finally { clearTimeout(to); }
  }
  async function updateRates(manual) {
    if (manual) toast('Kurlar güncelleniyor…');
    let rates = null;
    try {
      const j = await fetchJson('https://open.er-api.com/v6/latest/CNY');
      if (j && j.rates && j.rates.TRY && j.rates.USD) rates = { TRY: j.rates.TRY, USD: j.rates.USD };
    } catch (_) { /* sonraki kaynağı dene */ }
    if (!rates) {
      try {
        const j = await fetchJson('https://api.frankfurter.dev/v1/latest?base=CNY&symbols=TRY,USD');
        if (j && j.rates && j.rates.TRY) rates = { TRY: j.rates.TRY, USD: j.rates.USD };
      } catch (_) { /* yok */ }
    }
    if (rates) {
      db.settings.rates = { CNY: 1, TRY: +rates.TRY.toFixed(4), USD: +rates.USD.toFixed(5) };
      db.settings.ratesAt = Date.now(); save();
      if (manual) toast('Kurlar güncellendi');
      render();
    } else if (manual) toast('Kurlar alınamadı (internet/VPN?). Elle girebilirsin.');
  }

  $('#cat-editor').addEventListener('change', e => {
    const row = e.target.closest('.cat-edit-row'); if (!row) return;
    const c = db.cats.find(x => x.id === row.dataset.id); if (!c) return;
    if (e.target.classList.contains('emoji')) c.emoji = e.target.value.trim() || '📦';
    if (e.target.classList.contains('name')) c.name = e.target.value.trim() || c.name;
    save();
  });
  $('#cat-editor').addEventListener('click', e => {
    if (!e.target.closest('[data-del]')) return;
    const id = e.target.closest('.cat-edit-row').dataset.id;
    const used = db.tx.filter(t => t.cat === id).length;
    if (used && !confirm(`${used} kayıt bu kategoride. Silinirse “Diğer”e taşınacak. Devam?`)) return;
    db.tx.forEach(t => { if (t.cat === id) t.cat = 'other'; });
    db.cats = db.cats.filter(c => c.id !== id);
    save(); renderSettings();
  });
  $('#btn-add-cat').addEventListener('click', () => {
    db.cats.splice(db.cats.length - 1, 0, { id: 'c' + Date.now().toString(36), name: 'Yeni kategori', emoji: '🏷️' });
    save(); renderSettings();
    const inputs = $$('#cat-editor input.name'); const inp = inputs[inputs.length - 2];
    if (inp) { inp.focus(); inp.select(); }
  });
  $('#merchant-list').addEventListener('click', e => {
    if (!e.target.closest('[data-del]')) return;
    delete db.merchants[e.target.closest('.merchant-row').dataset.k];
    save(); renderSettings();
  });

  /* ---------------- yedekleme ---------------- */
  const today = () => new Date().toISOString().slice(0, 10);
  async function shareOrDownload(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  }
  async function backup() {
    const blob = new Blob([JSON.stringify({ app: 'taha-muhasebe', version: 1, exportedAt: new Date().toISOString(), data: db }, null, 1)], { type: 'application/json' });
    if (await shareOrDownload(blob, `muhasebe-yedek-${today()}.json`)) {
      db.settings.lastBackup = Date.now(); save(); render(); toast('Yedek hazır');
    }
  }
  $('#btn-backup').addEventListener('click', backup);
  $('#banner-backup').addEventListener('click', backup);
  $('#btn-csv').addEventListener('click', () => {
    const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const num = v => String(Math.round(v * 100) / 100).replace('.', ',');
    const rows = [['Tarih', 'Saat', 'Tutar', 'Para birimi', 'Tutar (CNY)', 'Senin payın (CNY)', 'Kişi', 'Arkadaşlardan gelen', 'Bekleyen', 'Kategori', 'Ödeme', 'Açıklama', 'Mağaza (İngilizce)', 'Mağaza (Çince)']];
    [...db.tx].sort((a, b) => a.ts - b.ts).forEach(t => {
      const d = new Date(t.ts), si = splitInfo(t);
      rows.push([d.toLocaleDateString('tr-TR'), timeFmt.format(d), num(t.amt), t.cur, num(t.cny), num(netCny(t)),
        si ? si.n : 1, si ? num(si.got) : '', si ? num(si.pending) : '',
        catById(t.cat).name, methodById(t.method).name, t.note, nameEn(t.orig), t.orig]);
    });
    const csv = '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n');
    shareOrDownload(new Blob([csv], { type: 'text/csv' }), `harcamalar-${today()}.csv`);
  });
  $('#restore-input').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const d = j && j.data ? j.data : j;
      if (!d || !Array.isArray(d.tx)) throw new Error('Geçersiz dosya');
      if (!confirm(`Yedekte ${d.tx.length} kayıt var. Mevcut ${db.tx.length} kaydın yerine geçsin mi?`)) return;
      db = normalizeDb(d); save(); render(); toast('Yedek geri yüklendi');
    } catch (err) { toast('Dosya okunamadı: ' + err.message); }
  });
  $('#btn-wipe').addEventListener('click', () => {
    if (!confirm('Tüm kayıtlar silinecek. Önce yedek aldın mı?')) return;
    if (!confirm('Emin misin? Bu işlem geri alınamaz.')) return;
    db = normalizeDb(null); save(); render(); toast('Tüm veriler silindi');
  });

  /* ---------------- toast ---------------- */
  let toastTimer = null;
  function toast(text, actionLabel, action, ms = 4000) {
    const t = $('#toast');
    $('#toast-text').textContent = text;
    const btn = $('#toast-action');
    btn.textContent = actionLabel || '';
    btn.onclick = () => { t.classList.add('hidden'); if (action) action(); };
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  /* ---------------- başlangıç ---------------- */
  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (Date.now() - (db.settings.ratesAt || 0) > 12 * 3600e3 && navigator.onLine !== false) updateRates(false);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
      // OCR dosyalarını arka planda önbelleğe al → tarama internetsiz de çalışsın
      if (navigator.onLine !== false && reg.active) reg.active.postMessage('warm-ocr');
    }).catch(() => {});
  }
  // test için dışarıya aç
  window.TM = { get db() { return db; }, render, VERSION };
})();
