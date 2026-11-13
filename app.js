/* Taha Muhasebe — tüm veriler telefonda (localStorage) */
(() => {
  'use strict';
  const VERSION = '1.7.0';
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
  const CURS = { CNY: '¥', TRY: '₺', USD: '$' };
  const CUR_ORDER = ['CNY', 'TRY', 'USD'];
  // hesap türleri (görünüm); hesapların kendisi db.accounts'ta, her birinin kendi para birimi var
  const TYPES = {
    alipay: { name: 'Alipay', s: 'A', cls: 'm-alipay' },
    wechat: { name: 'WeChat', s: 'W', cls: 'm-wechat' },
    card: { name: 'Kart', s: 'K', cls: 'm-card' },
    cash: { name: 'Nakit', s: 'N', cls: 'm-cash' },
  };
  const DEFAULT_ACCOUNTS = [
    { id: 'alipay', name: 'Alipay', type: 'alipay', cur: 'CNY' },
    { id: 'wechat', name: 'WeChat', type: 'wechat', cur: 'CNY' },
    { id: 'card', name: 'Kart', type: 'card', cur: 'CNY' },
    { id: 'cash', name: 'Nakit', type: 'cash', cur: 'CNY' },
  ];
  const OWED = { id: 'owed', name: 'Borçla', s: 'B', cls: 'm-owed', type: 'owed', cur: 'CNY' }; // başkası benim yerime ödedi
  let ACCS = [], ACC_IDS = [], METHODS = [];
  function syncAccounts() {
    ACCS = db.accounts.map(a => ({ ...a, s: a.cur !== 'CNY' ? CURS[a.cur] : TYPES[a.type].s, cls: TYPES[a.type].cls }));
    ACC_IDS = ACCS.map(a => a.id);
    METHODS = [...ACCS, OWED];
  }

  /* ---------------- veri ---------------- */
  let db = load();
  syncAccounts();
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
      // hesap hareketleri: set (gerçek bakiye) / in (para ekle) / out / xfer (hesaplar arası) — tutarlar ¥
      moves: Array.isArray(d.moves) ? d.moves : [],
      // borçlar: dir 'in' = bana borçlu, 'out' = ben borçluyum
      debts: Array.isArray(d.debts) ? d.debts : [],
      people: Array.isArray(d.people) ? d.people : [],
      accounts: Array.isArray(d.accounts) && d.accounts.length ? d.accounts : DEFAULT_ACCOUNTS.map(a => ({ ...a })),
      settings: Object.assign({
        displayCur: 'CNY', lastMethod: 'alipay', lastCur: 'CNY', nameLang: 'en', recvAcc: 'wechat',
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
  const methodById = id => METHODS.find(m => m.id === id) || { id, name: 'Silinmiş hesap', s: '?', cls: 'm-owed', cur: 'CNY' };
  const accCur = id => (ACCS.find(a => a.id === id) || { cur: 'CNY' }).cur;
  // silinmiş bir hesaba ya da türe ("alipay") işaret ediyorsa var olan bir hesaba çevir
  const resolveAcc = x => (ACC_IDS.includes(x) ? x : ((ACCS.find(a => a.type === x) || ACCS[0] || {}).id));
  const conv = (amt, from, to) => (from === to ? amt : fromCny(toCny(amt, from), to));
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
  const c2 = v => Math.round(v * 100) / 100;
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* Bölüşmedeki diğer kişiler (slot): her birinin payı ve ödediği */
  function splitSlots(t) {
    const s = splitInfo(t);
    if (!s || s.n < 2) return [];
    const k = s.n - 1, names = t.split.people || [];
    const slots = Array.from({ length: k }, (_, i) => ({ i, name: names[i] || '', owed: s.expected / k, paid: 0 }));
    const loose = [];
    (t.split.got || []).forEach(g => { if (g.who != null && slots[g.who]) slots[g.who].paid += +g.a || 0; else loose.push(+g.a || 0); });
    // kime ait olduğu belirtilmemiş ödemeleri sırayla boş slotlara dağıt
    loose.forEach(a => { for (const sl of slots) { const r = sl.owed - sl.paid; if (r > 0.005 && a > 0.005) { const x = Math.min(r, a); sl.paid += x; a -= x; } } });
    slots.forEach(sl => { sl.owed = c2(sl.owed); sl.paid = c2(sl.paid); sl.pending = t.split.closed ? 0 : Math.max(0, c2(sl.owed - sl.paid)); });
    return slots;
  }

  /* Hesap bakiyeleri: son "gerçek bakiye" kaydı + ondan sonraki tüm hareketler.
   * Her hareketin tutarı (amt) o hesabın KENDİ para biriminde. Eski kayıtlarda sadece cny vardır (¥ hesaplar). */
  const mvAmt = m => (m.amt != null ? m.amt : m.cny);
  const debtCur = d => d.cur || 'CNY';
  const debtAmt = d => (d.amt != null ? d.amt : d.cny);
  const paidAmt = p => (p.amt != null ? p.amt : p.cny);
  function flows() {
    const f = [];
    const push = (acc, ts, amt, cur, label) => { if (acc) f.push({ acc, ts, amt: conv(amt, cur, accCur(acc)), label }); };
    db.tx.forEach(t => {
      if (ACC_IDS.includes(t.method)) {
        const cur = accCur(t.method);
        f.push({ acc: t.method, ts: t.ts, amt: -(t.cur === cur ? +t.amt : fromCny(+t.cny || 0, cur)), label: mname(t.orig) || t.note || catById(t.cat).name });
      }
      ((t.split && t.split.got) || []).forEach(g => push(g.acc, g.ts, +g.a || 0, t.cur, '👥 ' + (g.from || 'Pay geldi')));
    });
    db.moves.forEach(m => {
      const cur = accCur(m.acc);
      if (m.type === 'in') push(m.acc, m.ts, mvAmt(m), cur, m.note || 'Para eklendi');
      if (m.type === 'out') push(m.acc, m.ts, -mvAmt(m), cur, m.note || 'Para çıktı');
      if (m.type === 'xfer') {
        push(m.acc, m.ts, -mvAmt(m), cur, '⇄ ' + methodById(m.to).name + "'a");
        if (m.amt2 != null) push(m.to, m.ts, m.amt2, accCur(m.to), '⇄ ' + methodById(m.acc).name + "'dan");
        else push(m.to, m.ts, mvAmt(m), cur, '⇄ ' + methodById(m.acc).name + "'dan");
      }
    });
    db.debts.forEach(d => {
      const sign = d.dir === 'out' ? 1 : -1; // borç aldım → para girdi; borç verdim → para çıktı
      push(d.acc, d.ts, sign * debtAmt(d), debtCur(d), (d.dir === 'out' ? 'Borç alındı: ' : 'Borç verildi: ') + d.who);
      (d.paid || []).forEach(p => push(p.acc, p.ts, -sign * paidAmt(p), debtCur(d), (d.dir === 'out' ? 'Borç ödendi: ' : 'Borç geri geldi: ') + d.who));
    });
    return f;
  }
  function balances() {
    const F = flows(), res = {};
    ACCS.forEach(a => {
      const set = db.moves.filter(m => m.type === 'set' && m.acc === a.id).sort((x, y) => y.ts - x.ts)[0];
      if (!set) { res[a.id] = null; return; }
      const after = F.filter(x => x.acc === a.id && x.ts > set.ts).sort((x, y) => y.ts - x.ts);
      const bal = c2(mvAmt(set) + after.reduce((s, x) => s + x.amt, 0));
      res[a.id] = { bal, cur: a.cur, cny: toCny(bal, a.cur), at: set.ts, recent: after.slice(0, 6) };
    });
    return res;
  }

  /* Borçlar kişi bazında: bölüşmelerden ve elle eklenen borçlardan (kalan tutar borcun kendi para biriminde) */
  const debtRemaining = d => c2(debtAmt(d) - (d.paid || []).reduce((s, p) => s + paidAmt(p), 0));
  function debtsByPerson() {
    const owed = new Map(), iowe = new Map();
    const add = (map, who, item) => {
      const k = (who || '').trim();
      if (!map.has(k)) map.set(k, { who: k, total: 0, items: [] });
      const e = map.get(k); e.total += item.cny; e.items.push(item);
    };
    db.tx.forEach(t => splitSlots(t).forEach(sl => {
      if (sl.pending > 0.005) add(owed, sl.name, { kind: 'split', t, slot: sl.i, amt: sl.pending, cur: t.cur, cny: ratio(t, sl.pending), title: mname(t.orig) || t.note || catById(t.cat).name, ts: t.ts });
    }));
    db.debts.forEach(d => {
      const rem = debtRemaining(d);
      if (rem > 0.005) add(d.dir === 'in' ? owed : iowe, d.who, { kind: 'debt', d, amt: rem, cur: debtCur(d), cny: toCny(rem, debtCur(d)), title: d.note || (d.dir === 'in' ? 'Borç verdim' : 'Borç'), ts: d.ts });
    });
    const sort = m => [...m.values()].sort((a, b) => b.total - a.total);
    return { owed: sort(owed), iowe: sort(iowe) };
  }
  function rememberPerson(name) {
    name = (name || '').trim(); if (!name) return;
    db.people = [name, ...db.people.filter(p => p !== name)].slice(0, 50);
  }

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
    if (view === 'wallet') renderWallet();
    if (view === 'settings') renderSettings();
  }
  $('#btn-settings').addEventListener('click', () => setView('settings'));
  $('#btn-settings-back').addEventListener('click', () => setView('wallet'));

  /* ---------------- CÜZDAN ---------------- */
  function renderWallet() {
    const bals = balances();
    const known = ACC_IDS.filter(id => bals[id]);
    const total = known.reduce((s, id) => s + bals[id].cny, 0);
    // para birimi bazında: "¥1.200 · ₺3.000"
    const byCur = {};
    known.forEach(id => { byCur[bals[id].cur] = (byCur[bals[id].cur] || 0) + bals[id].bal; });
    const curLine = CUR_ORDER.filter(c => byCur[c] != null).map(c => fmt(byCur[c], c)).join(' + ');
    const hide = masked();
    const eye = $('#btn-eye');
    eye.innerHTML = hide ? EYE_OFF : EYE;
    eye.classList.toggle('on', !!db.settings.pin && !hide);
    eye.setAttribute('aria-label', hide ? 'Bakiyeyi göster' : 'Bakiyeyi gizle');
    const tot = $('#w-total');
    tot.classList.toggle('masked', hide && known.length > 0);
    if (hide && known.length) tot.innerHTML = `<span class="cs">${CURS[dispCur()]}</span>${DOTS(6)}`;
    else tot.textContent = known.length ? fmtDisp(total) : '—';
    $('#w-sub').textContent = !known.length ? 'Hesaplara dokunup şu anki bakiyeni gir'
      : hide ? 'Gizli · görmek için göz simgesine dokun'
      : `${Object.keys(byCur).length > 1 ? curLine + ' · ' : others(total) + ' · '}${known.length < ACC_IDS.length ? `${ACC_IDS.length - known.length} hesabın bakiyesi girilmedi` : 'tüm hesaplar'}`;
    $('#w-accounts').innerHTML = ACCS.map(a => {
      const b = bals[a.id];
      const sub = b ? `Bakiye ${dayShort.format(b.at)} girildi${b.recent.length ? ` · sonra ${b.recent.length} hareket` : ''}${a.cur !== dispCur() && !hide ? ` · ≈ ${fmtDisp(b.cny)}` : ''}` : `Bakiye girilmedi · ${CURS[a.cur]} ${a.cur}`;
      return `<button class="acc-row" data-acc="${a.id}">${mdot(a.id)}
        <span class="acc-main"><div class="acc-name">${esc(a.name)}</div><div class="acc-sub">${esc(sub)}</div></span>
        <span class="acc-bal ${!b ? 'unknown' : hide ? 'masked' : b.bal < 0 ? 'neg' : ''}">${!b ? 'Bakiye gir ›' : hide ? maskAmt(a.cur) : fmt(b.bal, a.cur)}</span></button>`;
    }).join('') + '<button class="link-btn" id="btn-add-acc">＋ Hesap ekle (ör. Nakit ₺, Türk kartı)</button>';

    const { owed, iowe } = debtsByPerson();
    const personRows = (list, dir) => list.length ? list.map((p, i) => `<button class="person-row" data-dir="${dir}" data-i="${i}">
        <span class="pr-ico">${p.who ? '👤' : '❔'}</span>
        <span class="pr-main"><div class="pr-name">${esc(p.who || 'İsimsiz')}</div><div class="pr-sub">${(() => { const u = [...new Set(p.items.map(x => x.title))]; return esc(u.slice(0, 3).join(', ')) + (u.length > 3 ? '…' : '') + (!p.who && p.items.length > 1 ? ` · ${p.items.length} kişi` : ''); })()}</div></span>
        <span class="pr-amt">${personAmt(p)}</span></button>`).join('')
      : `<div class="w-empty">${dir === 'owed' ? 'Kimsenin sana borcu yok.' : 'Kimseye borcun yok. 👍'}</div>`;
    $('#w-owed').innerHTML = personRows(owed, 'owed');
    $('#w-iowe').innerHTML = personRows(iowe, 'iowe');
    const groupAmt = list => personAmt({ items: list.flatMap(p => p.items), total: list.reduce((s, p) => s + p.total, 0) });
    $('#w-owed-total').textContent = owed.length ? groupAmt(owed) : '';
    $('#w-iowe-total').textContent = iowe.length ? groupAmt(iowe) : '';
    WALLET_CACHE = { owed, iowe };
  }
  let WALLET_CACHE = { owed: [], iowe: [] };
  // kişinin borçları tek para birimindeyse o birimde göster (₺200), karışıksa ana para biriminde
  function personAmt(p) {
    const curs = [...new Set(p.items.map(x => x.cur || 'CNY'))];
    return curs.length === 1 ? fmt(p.items.reduce((s, x) => s + x.amt, 0), curs[0]) : fmtDisp(p.total);
  }

  /* ---------------- bakiye gizleme (PIN) ----------------
   * Bakiyeler ekranda gizlenir, 4 haneli PIN ile açılır. PIN'in kendisi değil, tuzlanmış özeti saklanır.
   * db.settings.pin = { s: tuz, h: özet } varsa gizleme açıktır. */
  let unlocked = false, hiddenAt = 0, pinFails = 0, pinWaitUntil = 0, pinState = null;
  const RELOCK_MS = 60e3; // uygulamadan bu kadar uzun çıkınca yeniden gizle
  const masked = () => !!db.settings.pin && !unlocked;
  const DOTS = n => `<span class="mask-dots" role="img" aria-label="gizli">${'<i></i>'.repeat(n)}</span>`;
  const maskAmt = cur => `${CURS[cur] || ''}${DOTS(4)}`;
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const EYE = svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>');
  const EYE_OFF = svg('<path d="M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-2.9 3.7"/><path d="M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3.5 3.5l17 17"/>');
  const pinSleep = ms => new Promise(r => setTimeout(r, ms));

  async function pinHash(pin, salt) {
    const data = new TextEncoder().encode('tm-pin:' + salt + ':' + pin);
    if (window.crypto && crypto.subtle) {
      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261; for (const b of data) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
    return 'f' + h.toString(16);
  }
  const checkPin = async p => !!db.settings.pin && (await pinHash(p, db.settings.pin.s)) === db.settings.pin.h;
  async function storePin(p) {
    const s = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
    db.settings.pin = { s, h: await pinHash(p, s) };
    save();
  }

  // tuş takımı
  const PIN_LETTERS = ['&nbsp;', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
  $('#pin-pad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="pin-key" data-k="${n}">${n}<small>${PIN_LETTERS[n - 1]}</small></button>`).join('')
    + '<span class="pin-key blank"></span><button class="pin-key" data-k="0">0<small>&nbsp;</small></button>'
    + `<button class="pin-key fn" data-k="del" aria-label="Sil">${svg('<path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7Z"/><path d="m12.5 9.5 5 5m0-5-5 5"/>')}</button>`;
  const setPinSub = (text, err) => { const el = $('#pin-sub'); el.textContent = text || ''; el.classList.toggle('err', !!err); };
  const drawDots = () => { const n = pinState ? pinState.entry.length : 0; $$('#pin-dots i').forEach((d, i) => d.classList.toggle('on', i < n)); };
  const waitMsg = () => `Çok fazla yanlış deneme. ${Math.ceil((pinWaitUntil - Date.now()) / 1000)} sn bekle.`;

  // PIN ekranını aç; check(pin) → true (kabul) ya da hata metni. Kabul edilen PIN'le, vazgeçilirse null ile döner.
  function pinPad({ title, sub, check }) {
    return new Promise(resolve => {
      const box = $('#pin-box'), wasOpen = !$('#pin').classList.contains('hidden');
      if (pinState) pinState.resolve(null);
      pinState = { entry: '', check, resolve, busy: false };
      $('#pin-title').textContent = title;
      setPinSub(sub);
      $('#pin-dots').classList.remove('ok', 'err');
      drawDots();
      $('#pin').classList.remove('hidden');
      if (wasOpen) { box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); }
    });
  }
  function closePin(val) {
    const st = pinState; pinState = null;
    if (st) st.resolve(val);
    // arka arkaya iki ekran (PIN + tekrar) açılırken kapanıp açılma titremesi olmasın
    setTimeout(() => { if (!pinState) $('#pin').classList.add('hidden'); }, 0);
  }
  async function pinPress(k) {
    const st = pinState; if (!st || st.busy) return;
    if (Date.now() < pinWaitUntil) { setPinSub(waitMsg(), true); return; }
    if (k === 'del') { st.entry = st.entry.slice(0, -1); drawDots(); return; }
    if (st.entry.length >= 4) return;
    st.entry += k; drawDots();
    if (st.entry.length < 4) return;
    st.busy = true;
    const res = await st.check(st.entry);
    if (pinState !== st) return;
    const dots = $('#pin-dots');
    if (res === true) { dots.classList.add('ok'); await pinSleep(160); if (pinState === st) closePin(st.entry); return; }
    dots.classList.remove('err'); void dots.offsetWidth; dots.classList.add('err');
    setPinSub(typeof res === 'string' ? res : 'Yanlış PIN', true);
    await pinSleep(450);
    if (pinState !== st) return;
    st.entry = ''; st.busy = false; dots.classList.remove('err'); drawDots();
  }
  $('#pin-pad').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) pinPress(b.dataset.k); });
  $('#pin-cancel').addEventListener('click', () => closePin(null));
  document.addEventListener('keydown', e => {
    if (!pinState) return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); pinPress(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); pinPress('del'); }
    else if (e.key === 'Escape') closePin(null);
  });

  // mevcut PIN'i sor (yanlış denemeler sınırlı)
  async function verifyPin(title, sub) {
    const ok = await pinPad({ title, sub: sub || 'PIN kodunu gir', check: async p => {
      if (Date.now() < pinWaitUntil) return waitMsg();
      if (await checkPin(p)) { pinFails = 0; return true; }
      if (++pinFails >= 5) { pinFails = 0; pinWaitUntil = Date.now() + 30e3; return 'Çok fazla yanlış deneme. 30 sn bekle.'; }
      return `Yanlış PIN · ${5 - pinFails} deneme hakkın kaldı`;
    } });
    return !!ok;
  }
  async function setupPin(title) {
    let first = '';
    const a = await pinPad({ title: title || 'PIN belirle', sub: 'Bakiyeni görmek için kullanacağın 4 haneli PIN', check: async p => { first = p; return true; } });
    if (!a) return false;
    const b = await pinPad({ title: 'PIN\'i tekrar gir', sub: 'Onaylamak için aynı PIN\'i gir', check: async p => p === first || 'PIN\'ler eşleşmedi, tekrar dene' });
    if (!b) return false;
    await storePin(first);
    return true;
  }
  async function unlockBalances() {
    if (!masked()) return true;
    if (!(await verifyPin('Bakiyeyi göster'))) return false;
    unlocked = true; render();
    $$('#w-total, .acc-bal, #bal-pill').forEach(el => { el.classList.remove('reveal'); void el.offsetWidth; el.classList.add('reveal'); });
    return true;
  }
  function lockBalances() { unlocked = false; render(); }
  $('#btn-eye').addEventListener('click', async () => {
    if (masked()) return unlockBalances();
    if (db.settings.pin) return lockBalances();
    if (await setupPin()) { unlocked = false; render(); toast('Bakiye gizlendi · göz simgesiyle PIN girerek açarsın', null, null, 5000); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (unlocked && db.settings.pin && Date.now() - hiddenAt > RELOCK_MS) lockBalances();
  });

  /* genel pencere */
  let modalOnSeg = null; // açık penceredeki seçim değişince çağrılır
  $('#modal-body').addEventListener('segchange', () => { if (modalOnSeg) modalOnSeg(); });
  function openModal({ title, body, buttons }) {
    modalOnSeg = null;
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    const box = $('#modal-btns');
    box.innerHTML = '';
    (buttons || [{ label: 'Kapat' }]).forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '');
      el.textContent = b.label;
      el.onclick = () => { if (b.onClick && b.onClick() === false) return; closeModal(); };
      box.appendChild(el);
    });
    $('#modal').classList.remove('hidden');
  }
  const closeModal = () => { $('#modal').classList.add('hidden'); modalOnSeg = null; render(); };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  // pencere içindeki seçim düğmeleri (data-seg grubu)
  $('#modal-body').addEventListener('click', e => {
    const b = e.target.closest('[data-segv]'); if (!b) return;
    const seg = b.closest('[data-seg]');
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    seg.dataset.value = b.dataset.segv;
    seg.dispatchEvent(new Event('segchange', { bubbles: true }));
  });
  const segHtml = (name, opts, val) => `<div class="seg" data-seg="${name}" data-value="${val}">${opts.map(([v, l]) => `<button type="button" data-segv="${v}" class="${v === val ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const segVal = name => { const s = $(`#modal-body [data-seg="${name}"]`); return s ? s.dataset.value : null; };
  const accOpts = (withNone) => [...ACCS.map(a => [a.id, esc(a.name)]), ...(withNone ? [['', 'Hiçbiri']] : [])];
  const curOpts = CUR_ORDER.map(c => [c, `${CURS[c]} ${c}`]);
  const typeOpts = Object.entries(TYPES).map(([k, v]) => [k, v.name]);
  const numIn = sel => { const el = $(sel); return el ? parseFloat(String(el.value).replace(/\s/g, '').replace(',', '.')) : NaN; };
  const peopleDatalist = () => { $('#people-list').innerHTML = db.people.map(p => `<option value="${esc(p)}">`).join(''); };

  // hesaba dokun → gerçek bakiyeyi gir + son hareketler + düzenle/sil
  $('#w-accounts').addEventListener('click', e => {
    if (e.target.closest('#btn-add-acc')) return openAccountForm(null);
    const r = e.target.closest('[data-acc]'); if (!r) return;
    const id = r.dataset.acc;
    if (masked() && balances()[id]) { unlockBalances().then(ok => { if (ok) openAccount(id); }); return; }
    openAccount(id);
  });
  function openAccount(id) {
    const a = ACCS.find(x => x.id === id), b = balances()[id];
    const mv = b && b.recent.length ? `<div class="mv-list"><div class="muted">Son girişten sonraki hareketler:</div>${b.recent.map(x =>
      `<div class="mv"><span>${dayShort.format(x.ts)} · ${esc(x.label)}</span><b class="${x.amt > 0 ? 'plus' : ''}">${x.amt > 0 ? '+' : ''}${fmt(x.amt, a.cur)}</b></div>`).join('')}</div>` : '';
    openModal({
      title: `${a.name} · ${CURS[a.cur]}`,
      body: `<div>${b ? `Uygulamadaki bakiye: <b>${fmt(b.bal, a.cur)}</b>` : `Şu anki gerçek bakiyeni yaz (${CURS[a.cur]} ${a.cur}).`}</div>
        <label class="f">Gerçek bakiye (${CURS[a.cur]})<input id="m-bal" type="text" inputmode="decimal" placeholder="örn. 1250,80" value="${b ? String(b.bal).replace('.', ',') : ''}"></label>
        <div class="muted small">Bundan sonra bu hesapla yaptığın harcamalar bakiyeden düşer, gelen paralar eklenir. Arada bir gerçek bakiyeyi girerek düzeltebilirsin.</div>${mv}
        <button class="link-btn" id="m-edit-acc" type="button">✎ Hesabı düzenle / sil</button>`,
      buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', primary: true, onClick: () => {
        const v = numIn('#m-bal'); if (isNaN(v)) { toast('Bir tutar yaz'); return false; }
        db.moves.push({ id: newId(), type: 'set', acc: id, amt: c2(v), ts: Date.now() });
        save(); render(); toast(`${a.name} bakiyesi: ${fmt(v, a.cur)}`);
      } }],
    });
    $('#m-edit-acc').onclick = () => openAccountForm(a);
    setTimeout(() => { const i = $('#m-bal'); if (i) i.select(); }, 50);
  }

  // hesap ekle / düzenle / sil
  // hesabı kullanan GERÇEK kayıtlar (girilen bakiye kaydı sayılmaz; hesapla birlikte silinir)
  function accountUsage(id) {
    const n = {
      harcama: db.tx.filter(t => t.method === id).length,
      'gelen ödeme': db.tx.reduce((s, t) => s + ((t.split && t.split.got) || []).filter(g => g.acc === id).length, 0),
      'para ekleme/aktarma': db.moves.filter(m => m.type !== 'set' && (m.acc === id || m.to === id)).length,
      borç: db.debts.filter(d => d.acc === id || (d.paid || []).some(p => p.acc === id)).length,
    };
    const parts = Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`);
    return { used: parts.length > 0, text: parts.join(', ') };
  }
  function openAccountForm(a) {
    const isNew = !a, usage = a ? accountUsage(a.id) : { used: false }, used = usage.used;
    openModal({
      title: isNew ? 'Yeni hesap' : 'Hesabı düzenle',
      body: `<label class="f">Türü${segHtml('type', typeOpts, a ? a.type : 'cash')}</label>
        <label class="f">Para birimi${used ? `<div class="muted small">${CURS[a.cur]} ${a.cur} (bu hesapla ${esc(usage.text)} olduğu için değiştirilemez)</div>` : segHtml('cur', curOpts, a ? a.cur : 'TRY')}</label>
        <label class="f">Adı<input id="m-name" type="text" value="${a ? esc(a.name) : ''}" placeholder="örn. Nakit ₺"></label>
        ${a ? (used
          ? `<div class="muted small">Silinemez: bu hesapla ${esc(usage.text)} kayıtlı. Önce o kayıtları silmen ya da başka hesaba taşıman gerekir.</div>`
          : `<button class="link-btn danger" id="m-del-acc" type="button">Hesabı sil</button>`) : ''}`,
      buttons: [{ label: 'Vazgeç' }, { label: isNew ? 'Ekle' : 'Kaydet', primary: true, onClick: () => {
        const type = segVal('type'), cur = used ? a.cur : segVal('cur');
        const name = $('#m-name').value.trim() || `${TYPES[type].name} ${CURS[cur]}`;
        if (isNew) db.accounts.push({ id: 'a' + newId(), name, type, cur });
        else Object.assign(db.accounts.find(x => x.id === a.id), { name, type, cur });
        syncAccounts(); save(); render(); toast(isNew ? `${name} eklendi — dokunup bakiyesini gir` : 'Hesap güncellendi');
      } }],
    });
    // ad boşken türe/para birimine göre öneri yaz
    let touched = !!a;
    $('#m-name').addEventListener('input', () => { touched = true; });
    const suggest = () => { if (!touched) { const t = segVal('type'), c = used ? a.cur : segVal('cur'); $('#m-name').value = `${TYPES[t].name} ${CURS[c]}`; } };
    modalOnSeg = suggest; suggest();
    const del = $('#m-del-acc');
    if (del) del.onclick = () => {
      if (db.accounts.length <= 1) { toast('En az bir hesap kalmalı'); return; }
      if (!confirm(`${a.name} silinsin mi? (Girdiğin bakiye de silinir.)`)) return;
      const removedAcc = { ...db.accounts.find(x => x.id === a.id) }, idx = db.accounts.findIndex(x => x.id === a.id);
      const removedMoves = db.moves.filter(m => m.acc === a.id);
      db.accounts = db.accounts.filter(x => x.id !== a.id);
      db.moves = db.moves.filter(m => m.acc !== a.id);
      syncAccounts(); save(); closeModal();
      toast(`${a.name} silindi`, 'Geri al', () => {
        db.accounts.splice(idx, 0, removedAcc); db.moves.push(...removedMoves);
        syncAccounts(); save(); render();
      }, 5000);
    };
  }

  $('#btn-income').addEventListener('click', () => {
    openModal({
      title: 'Para ekle',
      body: `<div class="muted small">Maaş, yükleme, iade gibi dışarıdan gelen para.</div>
        <label class="f">Hangi hesaba?${segHtml('acc', accOpts(false), ACC_IDS.includes('card') ? 'card' : ACC_IDS[0])}</label>
        <label class="f"><span id="m-amt-l"></span><input id="m-amt" type="text" inputmode="decimal"></label>
        <label class="f">Açıklama<input id="m-note" type="text" placeholder="örn. Maaş"></label>`,
      buttons: [{ label: 'Vazgeç' }, { label: 'Ekle', primary: true, onClick: () => {
        const v = numIn('#m-amt'), acc = segVal('acc'); if (!(v > 0)) { toast('Bir tutar yaz'); return false; }
        db.moves.push({ id: newId(), type: 'in', acc, amt: c2(v), ts: Date.now(), note: $('#m-note').value.trim() });
        save(); render(); toast(`${fmt(v, accCur(acc))} eklendi → ${methodById(acc).name}`);
      } }],
    });
    modalOnSeg = () => { $('#m-amt-l').textContent = `Tutar (${CURS[accCur(segVal('acc'))]})`; };
    modalOnSeg();
  });

  $('#btn-xfer').addEventListener('click', () => {
    const def2 = ACC_IDS.includes('alipay') ? 'alipay' : ACC_IDS[1] || ACC_IDS[0];
    openModal({
      title: 'Hesaplar arası / döviz bozdur',
      body: `<div class="muted small">Örn. karttan Alipay'e yükleme ya da ₺ nakiti ¥'ye bozdurma.</div>
        <label class="f">Nereden?${segHtml('from', accOpts(false), ACC_IDS.includes('card') ? 'card' : ACC_IDS[0])}</label>
        <label class="f">Nereye?${segHtml('to', accOpts(false), def2)}</label>
        <label class="f"><span id="m-amt-l"></span><input id="m-amt" type="text" inputmode="decimal"></label>
        <label class="f" id="m-amt2-w"><span id="m-amt2-l"></span><input id="m-amt2" type="text" inputmode="decimal"></label>
        <div class="muted small" id="m-rate"></div>`,
      buttons: [{ label: 'Vazgeç' }, { label: 'Aktar', primary: true, onClick: () => {
        const v = numIn('#m-amt'), from = segVal('from'), to = segVal('to');
        if (!(v > 0)) { toast('Bir tutar yaz'); return false; }
        if (from === to) { toast('İki farklı hesap seç'); return false; }
        const m = { id: newId(), type: 'xfer', acc: from, to, amt: c2(v), ts: Date.now() };
        if (accCur(from) !== accCur(to)) {
          const v2 = numIn('#m-amt2'); if (!(v2 > 0)) { toast('Gelen tutarı yaz'); return false; }
          m.amt2 = c2(v2);
        }
        db.moves.push(m);
        save(); render(); toast(`${fmt(v, accCur(from))}: ${methodById(from).name} → ${methodById(to).name}${m.amt2 ? ` (${fmt(m.amt2, accCur(to))})` : ''}`);
      } }],
    });
    let typed2 = false;
    const sync = () => {
      const f = accCur(segVal('from')), t = accCur(segVal('to')), diff = f !== t;
      $('#m-amt-l').textContent = diff ? `Çıkan tutar (${CURS[f]})` : `Tutar (${CURS[f]})`;
      $('#m-amt2-w').classList.toggle('hidden', !diff);
      $('#m-amt2-l').textContent = `Giren tutar (${CURS[t]}) — bozdurduğun kur farklıysa düzelt`;
      const v = numIn('#m-amt');
      if (diff && !typed2) $('#m-amt2').value = v > 0 ? String(c2(conv(v, f, t))).replace('.', ',') : '';
      $('#m-rate').textContent = diff ? `Güncel kur: 1 ${CURS[f]} ≈ ${fmtNum(c2(conv(1, f, t) * 100) / 100)} ${CURS[t]}` : '';
    };
    $('#m-amt').addEventListener('input', sync);
    $('#m-amt2').addEventListener('input', () => { typed2 = true; });
    modalOnSeg = sync; sync();
  });

  // borç / alacak ekle
  $('#btn-add-debt').addEventListener('click', () => openDebtForm('out'));
  function openDebtForm(dir) {
    peopleDatalist();
    const catOpts = db.cats.map(c => `<option value="${c.id}">${c.emoji} ${esc(c.name)}</option>`).join('');
    openModal({
      title: 'Borç / alacak ekle',
      body: `${segHtml('dir', [['out', 'Ben borçluyum'], ['in', 'O bana borçlu']], dir)}
        <label class="f">Kim?<input id="m-who" type="text" list="people-list" placeholder="İsim" autocomplete="off"></label>
        <label class="f">Para birimi${segHtml('cur', curOpts, 'CNY')}</label>
        <label class="f"><span id="m-amt-l">Tutar</span><input id="m-amt" type="text" inputmode="decimal"></label>
        <label class="f">Ne için?<input id="m-note" type="text" placeholder="örn. Akşam yemeği, taksi"></label>
        <label class="f" id="m-acc-wrap"><span id="m-acc-label"></span>${segHtml('acc', accOpts(true), '')}</label>
        <label class="f" id="m-cat-wrap">Harcama olarak da kaydet (kategori)<select id="m-cat"><option value="">— Kaydetme —</option>${catOpts}</select></label>`,
      buttons: [{ label: 'Vazgeç' }, { label: 'Kaydet', primary: true, onClick: () => {
        const d = segVal('dir'), who = $('#m-who').value.trim(), v = numIn('#m-amt'), acc = segVal('acc') || null;
        if (!who) { toast('Kişinin adını yaz'); return false; }
        if (!(v > 0)) { toast('Bir tutar yaz'); return false; }
        const note = $('#m-note').value.trim(), cur = segVal('cur') || 'CNY';
        const debt = { id: newId(), dir: d, who, amt: c2(v), cur, cny: c2(toCny(v, cur)), note, ts: Date.now(), acc, paid: [] };
        const cat = $('#m-cat').value;
        if (d === 'out' && !acc && cat) {
          // biri benim yerime ödedi → bu benim harcamam; para henüz hesabımdan çıkmadı
          const tx = { id: newId(), ts: Date.now(), amt: c2(v), cur, cny: c2(toCny(v, cur)), method: 'owed', cat, note: note || `${who} ödedi`, orig: '', src: 'manual', created: Date.now() };
          db.tx.push(tx); debt.txId = tx.id;
        }
        db.debts.push(debt); rememberPerson(who);
        save(); render();
        toast(d === 'out' ? `${who}'a ${fmt(v, cur)} borçlusun` : `${who} sana ${fmt(v, cur)} borçlu`);
      } }],
    });
    const sync = () => {
      const d = segVal('dir'), acc = segVal('acc');
      $('#m-amt-l').textContent = `Tutar (${CURS[segVal('cur') || 'CNY']})`;
      $('#m-acc-label').textContent = d === 'out' ? 'Para hesabıma girdi mi? (borç aldıysan)' : 'Para hangi hesabımdan çıktı? (borç verdiysen)';
      $('#m-cat-wrap').classList.toggle('hidden', !(d === 'out' && !acc));
    };
    modalOnSeg = sync;
    sync();
    // varsayılan: "ben borçluyum" + hiçbiri → arkadaş benim yerime ödedi, harcama olarak "Yemek"
    $('#m-cat').value = dir === 'out' ? 'food' : '';
  }

  // kişiye dokun → kalemler ve "Ödendi"
  $('#w-owed').addEventListener('click', e => openPerson(e, 'owed'));
  $('#w-iowe').addEventListener('click', e => openPerson(e, 'iowe'));
  function openPerson(e, dir, again) {
    let p;
    if (again) p = again;
    else { const r = e.target.closest('.person-row'); if (!r) return; p = WALLET_CACHE[dir][+r.dataset.i]; }
    if (!p) return;
    const who = p.who;
    const fresh = () => (debtsByPerson()[dir].find(x => x.who === who));
    const draw = () => {
      const q = fresh();
      if (!q) { closeModal(); toast(dir === 'owed' ? `${who || 'İsimsiz'}: hepsi ödendi ✓` : `${who} borcu kapandı ✓`); return; }
      $('#modal-title').textContent = `${who || 'İsimsiz'} · ${personAmt(q)}`;
      $('#modal-body').innerHTML = `<div class="muted small">${dir === 'owed' ? 'Sana olan borcu. Para geldiyse “Ödedi”ye dokun.' : 'Senin ona borcun. Ödediysen “Ödedim”e dokun.'}</div>
        <label class="f">${dir === 'owed' ? 'Para hangi hesabına geldi?' : 'Hangi hesabından ödedin?'}${segHtml('acc', accOpts(true), resolveAcc(db.settings.recvAcc || 'wechat'))}</label>
        ${q.items.map((it, i) => `<div class="item-row"><span class="ir-main"><div class="ir-title">${esc(it.title)}</div>
          <div class="ir-sub">${dayShort.format(it.ts)}${it.kind === 'split' ? ` · bölüşme (${splitInfo(it.t).n} kişi)` : ''}</div></span>
          <b>${fmt(it.amt, it.cur)}</b>
          <button class="btn small" data-settle="${i}">${dir === 'owed' ? 'Ödedi' : 'Ödedim'}</button></div>`).join('')}`;
      $('#modal-body').querySelectorAll('[data-settle]').forEach(b => b.onclick = () => {
        const it = q.items[+b.dataset.settle], acc = segVal('acc') || null;
        if (acc) db.settings.recvAcc = acc;
        if (it.kind === 'split') {
          const g = { a: it.amt, ts: Date.now(), who: it.slot }; if (acc) g.acc = acc; if (who) g.from = who;
          it.t.split.got = it.t.split.got || []; it.t.split.got.push(g);
        } else {
          it.d.paid = it.d.paid || []; it.d.paid.push({ amt: it.amt, ts: Date.now(), acc });
        }
        save(); draw();
      });
    };
    openModal({ title: '', body: '', buttons: [{ label: 'Kapat' }] });
    draw();
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
      `<span class="mpill">${mdot(m.id)}${esc(m.name)} ${fmtDisp(byM[m.id])}</span>`).join('')
      + (allPending.length && !pendingView ? `<button class="mpill pend" id="pend-pill">👥 Bekleyen ${fmtDisp(pendTotal)} (${allPending.length})</button>` : '')
      + (() => { const b = balances(), k = ACC_IDS.filter(id => b[id]); return k.length && !pendingView
        ? `<button class="mpill pend" id="bal-pill">💰 Kalan ${masked() ? maskAmt(dispCur()) : fmtDisp(k.reduce((s, id) => s + b[id].cny, 0))}</button>` : ''; })();

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
    if (e.target.closest('#bal-pill')) return setView('wallet');
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
      method: t.method || (db.settings.lastMethod === 'owed' ? 'owed' : resolveAcc(db.settings.lastMethod || 'alipay')),
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
    $('#method-chips').innerHTML = METHODS.filter(m => m.id !== 'owed' || S.method === 'owed').map(m =>
      `<button class="chip ${m.id === S.method ? 'on' : ''}" data-method="${m.id}">${mdot(m.id)}${esc(m.name)}</button>`).join('');
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
    const slots = splitSlots({ amt: amountVal(), cny: 0, split: S.split });
    const names = S.split.people || [];
    const recv = resolveAcc(db.settings.recvAcc || 'wechat');
    p.innerHTML = `
      <div class="sp-row"><span>Kaç kişi? <small>(sen dahil)</small></span>
        <div class="stepper"><button data-sa="minus" aria-label="Azalt">−</button><b>${s.n}</b><button data-sa="plus" aria-label="Artır">＋</button></div></div>
      <div class="sp-row"><span>Senin payın <small>${S.split.mine != null ? '(elle)' : '(eşit)'}</small></span>
        <input id="split-mine" type="text" inputmode="decimal" placeholder="${esc(minePh)}" value="${esc(mineVal)}" aria-label="Senin payın"></div>
      <div class="sp-sum">Arkadaşlardan gelecek: <b>${f(s.expected)}</b></div>
      <div class="sp-people">${slots.map(sl => `<div class="sp-person">
        <input class="sp-name" data-i="${sl.i}" list="people-list" placeholder="${sl.i + 2}. kişi (isim, isteğe bağlı)" value="${esc(names[sl.i] || '')}" autocomplete="off">
        <span class="sp-pamt">${f(sl.owed)}</span>
        ${S.split.closed ? '' : sl.pending > 0.005 ? `<button class="btn small" data-sa="paid" data-i="${sl.i}">Ödedi</button>` : '<span class="sp-ok">✓ Ödedi</span>'}</div>`).join('')}</div>
      ${s.pending > 0.005 && !S.split.closed ? `<div class="sp-row"><small>Paralar hangi hesabına geliyor?</small>
        <div class="seg small">${ACCS.map(a => `<button type="button" data-sa="recv" data-acc="${a.id}" class="${a.id === recv ? 'on' : ''}">${esc(a.name)}</button>`).join('')}</div></div>` : ''}
      <div class="sp-got">${(S.split.got || []).map((g, i) => `<span class="gchip">✓ ${f(g.a)}${(g.who != null && names[g.who]) || g.from ? ' · ' + esc((g.who != null && names[g.who]) || g.from) : ''} · ${dayShort.format(g.ts)}<button data-sa="del" data-i="${i}" aria-label="Sil">✕</button></span>`).join('')}</div>
      ${S.split.closed ? '<div class="sp-status">Kapatıldı: gelmeyen kısım senin harcaman sayılır.</div>'
        : s.pending > 0.005 ? `<div class="sp-status">Bekleyen: ${f(s.pending)}</div>
          <div class="sp-btns"><button class="btn small" data-sa="custom">＋ Farklı tutar geldi</button></div>`
        : (s.expected > 0 ? '<div class="sp-status done">✓ Herkes payını gönderdi</div>' : '')}
      <div class="sp-links">
        <button class="link-btn" data-sa="close">${S.split.closed ? 'Yeniden aç' : (s.pending > 0.005 ? 'Gerisi gelmeyecek' : '')}</button>
        <button class="link-btn danger" data-sa="remove">Bölüşmeyi kaldır</button></div>`;
  }
  $('#split-toggle').addEventListener('click', () => {
    if (!S) return;
    peopleDatalist();
    if (!S.split) S.split = { n: 2, mine: null, got: [], closed: false, people: [] };
    renderSplit();
    $('#split-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('#split-panel').addEventListener('click', e => {
    const b = e.target.closest('[data-sa]'); if (!b || !S || !S.split) return;
    const sp = S.split, s = splitInfo({ amt: amountVal(), split: sp });
    sp.got = sp.got || [];
    const recv = resolveAcc(db.settings.recvAcc || 'wechat');
    const addGot = (a, who) => {
      if (!(a > 0)) return;
      const g = { a: Math.round(a * 100) / 100, ts: Date.now(), acc: recv };
      if (who != null) { g.who = who; if ((sp.people || [])[who]) g.from = sp.people[who]; }
      sp.got.push(g);
    };
    switch (b.dataset.sa) {
      case 'plus': sp.n = Math.min(50, (sp.n || 1) + 1); sp.mine = null; break;
      case 'minus': sp.n = Math.max(2, (sp.n || 2) - 1); sp.mine = null; sp.people = (sp.people || []).slice(0, sp.n - 1); break;
      case 'paid': {
        const sl = splitSlots({ amt: amountVal(), cny: 0, split: sp })[+b.dataset.i];
        if (sl) addGot(sl.pending, sl.i);
        break;
      }
      case 'recv': db.settings.recvAcc = b.dataset.acc; save(); break;
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
  $('#split-panel').addEventListener('input', e => {
    if (!e.target.classList.contains('sp-name') || !S || !S.split) return;
    S.split.people = S.split.people || [];
    S.split.people[+e.target.dataset.i] = e.target.value.trim();
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
  $('#method-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-method]'); if (!b) return;
    S.method = b.dataset.method;
    // ₺ hesabı seçilince tutar da ₺ olsun (istersen sonra elle değiştirebilirsin)
    if (ACC_IDS.includes(S.method)) S.cur = accCur(S.method);
    renderSheet();
  });
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
    if (tx.split) (tx.split.people || []).forEach(rememberPerson);
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
    const hasDebts = db.debts.some(d => d.dir === 'in' && debtRemaining(d) > 0.005);
    const open = db.tx.filter(isPending).map(t => {
      const s = splitInfo(t);
      const inCur = amt * rate(t.cur); // gelen ¥ → harcamanın para birimi
      const score = Math.min(Math.abs(s.share - inCur), Math.abs(s.pending - inCur)) / Math.max(1, s.share) + (Date.now() - t.ts) / (90 * 864e5);
      return { t, s, score };
    }).sort((a, b) => a.score - b.score).slice(0, 8);
    $('#picker-title').textContent = `Gelen ödeme: ${fmt(amt)}`;
    $('#picker-sub').textContent = (r.from ? `Gönderen: ${r.from} · ` : '') + (open.length || hasDebts ? 'Kimden / hangi harcama için?' : 'Bekleyen alacağın yok.');
    $('#picker-list').innerHTML = open.map(({ t, s }) => {
      const title = mname(t.orig) || t.note || catById(t.cat).name;
      return `<button class="pick" data-id="${t.id}"><span class="pk-main"><div class="pk-title">${catById(t.cat).emoji} ${esc(title)}</div>
        <div class="pk-sub">${dayShort.format(t.ts)} · ${s.n} kişi · toplam ${fmt(t.amt, t.cur)}</div></span>
        <span class="pk-amt">bekleyen<br><b>${fmt(s.pending, t.cur)}</b></span></button>`;
    }).join('') + db.debts.filter(d => d.dir === 'in' && debtRemaining(d) > 0.005).map(d =>
      `<button class="pick" data-debt="${d.id}"><span class="pk-main"><div class="pk-title">👤 ${esc(d.who)} · ${esc(d.note || 'Borç verdim')}</div>
        <div class="pk-sub">${dayShort.format(d.ts)} · alacak</div></span>
        <span class="pk-amt">kalan<br><b>${fmt(debtRemaining(d), debtCur(d))}</b></span></button>`).join('')
      + '<button class="pick alt" data-id="__expense">Bu bir harcama, normal kaydet</button>';
    const ov = $('#picker');
    ov.classList.remove('hidden');
    const done = () => { ov.classList.add('hidden'); $('#picker-list').onclick = null; $('#picker-cancel').onclick = null; };
    $('#picker-cancel').onclick = () => { done(); nextScan(); };
    $('#picker-list').onclick = e => {
      const b = e.target.closest('.pick'); if (!b) return;
      done();
      if (b.dataset.id === '__expense') return nextScan({ ...item, r: { ...r, incoming: false } });
      if (b.dataset.debt) {
        const d = db.debts.find(x => x.id === b.dataset.debt); if (!d) return nextScan();
        const p = { amt: Math.min(c2(conv(amt, 'CNY', debtCur(d))), debtRemaining(d)), ts: r.ts || Date.now(), acc: resolveAcc(r.method || db.settings.recvAcc || 'wechat') };
        d.paid = d.paid || []; d.paid.push(p); save(); render();
        toast(`${fmt(p.amt, debtCur(d))} ← ${d.who}` + (debtRemaining(d) > 0.005 ? ` · kalan ${fmt(debtRemaining(d), debtCur(d))}` : ' · ✓ kapandı'), 'Geri al', () => {
          const i = d.paid.indexOf(p); if (i >= 0) d.paid.splice(i, 1); save(); render();
        }, 5000);
        return setTimeout(nextScan, 300);
      }
      const t = db.tx.find(x => x.id === b.dataset.id); if (!t) return nextScan();
      const g = { a: Math.round(amt * rate(t.cur) * 100) / 100, ts: r.ts || Date.now(), acc: resolveAcc(r.method || db.settings.recvAcc || 'wechat') };
      if (r.from) g.from = r.from;
      // hangi kişi? önce isimden eşleştir, yoksa ödemeyen ilk kişi
      const slots = splitSlots(t), names = t.split.people || [];
      let sl = r.from ? slots.find(x => x.name && (x.name.includes(r.from) || r.from.includes(x.name)) && x.pending > 0.005) : null;
      if (!sl) sl = slots.find(x => !x.name && x.pending > 0.005) || slots.find(x => x.pending > 0.005);
      if (sl) {
        g.who = sl.i;
        if (!names[sl.i] && r.from) { t.split.people = names; names[sl.i] = r.from; rememberPerson(r.from); }
      }
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
        method: resolveAcc(r.method || db.settings.lastMethod || 'alipay'),
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
    const hasPin = !!db.settings.pin;
    $('#pin-info').textContent = hasPin
      ? 'Açık. Cüzdan’daki bakiyeler gizli; göz simgesine dokunup PIN girince görünür. Uygulamadan 1 dakikadan uzun çıkınca yeniden gizlenir.'
      : 'Kapalı. Açarsan Cüzdan’daki bakiyeler gizlenir, görmek için 4 haneli PIN istenir.';
    $('#pin-btns').innerHTML = hasPin
      ? '<button class="btn" data-pin="change">PIN’i değiştir</button><button class="btn" data-pin="off">Gizlemeyi kapat</button><button class="link-btn" data-pin="forgot">PIN’i unuttum</button>'
      : '<button class="btn" data-pin="on">🔒 Bakiyeyi gizle (PIN belirle)</button>';
  }
  $('#pin-btns').addEventListener('click', async e => {
    const b = e.target.closest('[data-pin]'); if (!b) return;
    const act = b.dataset.pin;
    if (act === 'on') {
      if (await setupPin()) { unlocked = false; toast('Bakiye gizlendi'); }
    } else if (act === 'change') {
      if (!(await verifyPin('Mevcut PIN'))) return;
      if (await setupPin('Yeni PIN')) toast('PIN değiştirildi');
    } else if (act === 'off') {
      if (!(await verifyPin('Gizlemeyi kapat'))) return;
      db.settings.pin = null; unlocked = false; save(); toast('Bakiyeler artık açık görünüyor');
    } else if (act === 'forgot') {
      if (!confirm('PIN silinecek ve bakiyeler açık görünecek. Kayıtların silinmez. Sonra yeni bir PIN belirleyebilirsin. Devam?')) return;
      db.settings.pin = null; unlocked = false; save(); toast('PIN sıfırlandı');
    }
    render();
  });
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
      db = normalizeDb(d); syncAccounts(); unlocked = false; save(); render(); toast('Yedek geri yüklendi');
    } catch (err) { toast('Dosya okunamadı: ' + err.message); }
  });
  $('#btn-wipe').addEventListener('click', () => {
    if (!confirm('Tüm kayıtlar silinecek. Önce yedek aldın mı?')) return;
    if (!confirm('Emin misin? Bu işlem geri alınamaz.')) return;
    db = normalizeDb(null); syncAccounts(); save(); render(); toast('Tüm veriler silindi');
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
    // yeni sürüm devreye girince bir kez yenile (bir şey yazılıyorsa sadece haber ver)
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      const busy = !$('#sheet').classList.contains('hidden') || !$('#modal').classList.contains('hidden') || !$('#pin').classList.contains('hidden');
      if (busy) { toast('Yeni sürüm hazır — uygulamayı kapatıp açınca gelir', null, null, 6000); return; }
      reloaded = true; location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
      // OCR dosyalarını arka planda önbelleğe al → tarama internetsiz de çalışsın
      if (navigator.onLine !== false && reg.active) reg.active.postMessage('warm-ocr');
    }).catch(() => {});
  }
  // test için dışarıya aç
  window.TM = { get db() { return db; }, render, VERSION };
})();
