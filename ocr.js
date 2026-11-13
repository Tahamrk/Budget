/* Ekran görüntüsü okuma (Tesseract, tamamen telefonda çalışır) + Alipay/WeChat ayrıştırıcı */
window.OCR = (() => {
  const BASE = new URL('vendor/tesseract/', location.href).href;
  let worker = null;
  let loading = null;
  let progressCb = null;

  function loadScript(src) {
    return new Promise((res, rej) => {
      if (window.Tesseract) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('OCR motoru yüklenemedi'));
      document.head.appendChild(s);
    });
  }

  async function getWorker() {
    if (worker) return worker;
    if (!loading) {
      loading = (async () => {
        await loadScript(BASE + 'tesseract.min.js');
        const w = await Tesseract.createWorker(['chi_sim', 'eng'], 1, {
          workerPath: BASE + 'worker.min.js',
          corePath: BASE,
          langPath: BASE + 'lang',
          workerBlobURL: false, // worker doğrudan yüklensin → service worker önbelleğinden de çalışır
          logger: m => progressCb && progressCb(m),
        });
        // 11 = seyrek metin: ekranın ortasında tek başına duran büyük tutarı da yakalar
        await w.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '11' });
        worker = w;
        return w;
      })();
    }
    try { return await loading; } catch (e) { loading = null; throw e; }
  }

  /* Görüntüyü küçült, karanlık moddaki ekran görüntülerini tersine çevir */
  function loadImg(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Görüntü açılamadı')); };
      img.src = url;
    });
  }

  function prepare(img, targetW) {
    return new Promise(res => {
      {
        const scale = Math.min(1, targetW / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h), d = id.data;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4 * 97) { sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; }
        const dark = sum / n < 110;
        for (let i = 0; i < d.length; i += 4) {
          let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if (dark) g = 255 - g;
          d[i] = d[i + 1] = d[i + 2] = g;
        }
        ctx.putImageData(id, 0, 0);
        res(c);
      }
    });
  }

  /* Büyük puntolu tutarlar tam boyutta kaçabiliyor; bu yüzden iki farklı ölçekte okunur. */
  async function read(file, onProgress) {
    progressCb = onProgress;
    try {
      const w = await getWorker();
      const img = await loadImg(file);
      const c1 = await prepare(img, 860);
      const { data } = await w.recognize(c1);
      let r = parse(data);
      let amtCanvas = c1;
      if (!r.amount || !r.orig) {
        const c2 = await prepare(img, 460);
        const { data: d2 } = await w.recognize(c2);
        const r2 = parse(d2);
        if (!r.amount && r2.amount) {
          r = Object.assign(parse(data, r2.amount), { ts: r.ts || r2.ts, method: r.method || r2.method, amtLine: r2.amtLine });
          amtCanvas = c2;
        }
        if (!r.orig && r2.orig) Object.assign(r, { orig: r2.orig, desc: r.desc || r2.desc, cat: r.cat || r2.cat });
      }
      // sadece satırda tutardan başka bir şey yoksa tekrar oku; rakam sayısı tutarsa kabul et
      if (r.amtLine && /^[\s+\-¥Y羊\d.,]+$/.test(r.amtLine.text)) {
        const v = await rereadAmount(w, amtCanvas, r.amtLine);
        const digits = n => String(Math.floor(n)).length;
        if (v && digits(v.value) === digits(r.amount)) {
          r.amount = v.value;
          if (v.sign === '+') { r.incoming = true; if (!r.warnings.length) r.warnings.push('Bu bir gelir ya da iade gibi görünüyor.'); }
          if (v.sign === '-') r.incoming = false;
        }
      }
      delete r.amtLine;
      return r;
    } finally { progressCb = null; }
  }

  /* Tutar satırını kırp, ideal boyuta küçült ve sadece rakam modunda tekrar oku.
   * Büyük puntolu rakamlarda (5↔2 gibi) karışmayı önler. */
  async function rereadAmount(w, canvas, line) {
    if (!line.h) return null;
    const s = Math.min(1.5, 26 / line.h);
    const y0 = Math.max(0, line.y - line.h * 0.9), hh = Math.min(canvas.height - y0, line.h * 1.8);
    const c = document.createElement('canvas');
    c.width = Math.round(canvas.width * s) + 40; c.height = Math.round(hh * s) + 40;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(canvas, 0, y0, canvas.width, hh, 20, 20, canvas.width * s, hh * s);
    try {
      await w.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789.,-+¥' });
      const { data } = await w.recognize(c);
      const m = String(data.text || '').replace(/\s/g, '').match(/([+\-]?)¥?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2})/);
      if (!m) return null;
      const v = parseFloat(m[2].replace(/,/g, ''));
      return v > 0 && v < 1e6 ? { value: v, sign: m[1] } : null;
    } catch (_) { return null; }
    finally { await w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '' }); }
  }

  /* ---------------- Ayrıştırma ---------------- */
  const CJK = '㐀-鿿豈-﫿';
  const reCjkGap = new RegExp(`([${CJK}])\\s+(?=[${CJK}])`, 'g');

  function norm(s) {
    return String(s || '')
      .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/[￥]/g, '¥')
      .replace(/[－—–−一](?=\s*\d)/g, '-')
      .replace(reCjkGap, '$1')
      .replace(reCjkGap, '$1')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  function getLines(data) {
    let raw = data.lines;
    if (!raw && data.blocks) {
      raw = [];
      data.blocks.forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => raw.push(l))));
    }
    if (raw && raw.length) {
      const items = raw.map(l => {
        const words = l.words || [];
        const b = l.bbox || { x0: 0, x1: 0, y0: 0, y1: 0 };
        let h = b.y1 - b.y0;
        // kelime yüksekliklerinin medyanı daha güvenilir
        if (words.length) {
          const hs = words.map(w => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
          h = hs[Math.floor(hs.length / 2)];
        }
        return { text: norm(l.text), h, x: b.x0, cy: (b.y0 + b.y1) / 2 };
      }).filter(l => l.text).sort((a, b) => a.cy - b.cy);
      // aynı hizadaki parçaları (örn. "商户全称" ... "瑞幸咖啡") tek satırda birleştir
      const rows = [];
      items.forEach(it => {
        const r = rows[rows.length - 1];
        if (r && Math.abs(it.cy - r.cy) < Math.min(r.h, it.h) * 0.6) { r.parts.push(it); r.h = Math.max(r.h, it.h); }
        else rows.push({ cy: it.cy, h: it.h, parts: [it] });
      });
      return rows.map(r => ({
        text: norm(r.parts.sort((a, b) => a.x - b.x).map(p => p.text).join(' ')),
        h: r.h, y: r.cy,
      }));
    }
    return String(data.text || '').split('\n').map((t, i) => ({ text: norm(t), h: 0, y: i })).filter(l => l.text);
  }

  const reDateFull = /(20\d{2})\s*[-年\/.]\s*(\d{1,2})\s*[-月\/.]\s*(\d{1,2})\s*日?\s*(\d{1,2})\s*[:：]\s*(\d{2})/;
  const reDateMD = /(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(\d{1,2})\s*[:：]\s*(\d{2})/;
  const reDateOnly = /(20\d{2})\s*[-年\/.]\s*(\d{1,2})\s*[-月\/.]\s*(\d{1,2})/;
  const reDateStrip = /20\d{2}\s*[-年\/.]\s*\d{1,2}\s*[-月\/.]\s*\d{1,2}\s*日?|\d{1,2}\s*[:：]\s*\d{2}(\s*[:：]\s*\d{2})?|\d{1,2}月\d{1,2}日/g;
  const reAmount = /([+\-]?)\s*([¥Y羊]?)\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}|\d+\.\d(?!\d))(?![\d%])/g;
  const reAmountBare = /^([+\-]?)\s*[¥Y]\s*(\d{1,6})$/;
  const reDiscount = /优惠|立减|红包抵扣|抵扣|原价|订单金额|余额|积分|手续费|服务费|折扣|券|退款|返现|奖励|满\d|节省|已省/;

  function findAmount(lines) {
    let best = null;
    const maxH = Math.max(1, ...lines.map(l => l.h));
    lines.forEach((l, idx) => {
      const t = l.text.replace(reDateStrip, ' ');
      const cands = [];
      let m;
      reAmount.lastIndex = 0;
      while ((m = reAmount.exec(t))) cands.push({ sign: m[1], cur: m[2], num: m[3] });
      const b = t.trim().match(reAmountBare);
      if (b) cands.push({ sign: b[1], cur: '¥', num: b[2] });
      cands.forEach(c => {
        const v = parseFloat(c.num.replace(/,/g, ''));
        if (!(v > 0) || v > 1e6) return;
        let score = l.h ? l.h / maxH : 0.5;
        if (c.sign === '-' || c.cur) score += 0.35;
        if (c.cur && c.cur !== '¥') score -= 0.1;
        if (reDiscount.test(l.text)) score *= 0.35;
        if (/[A-Za-z]{3,}/.test(l.text)) score *= 0.8;
        if (!best || score > best.score) best = { value: v, sign: c.sign, score, idx };
      });
    });
    return best;
  }

  function findDate(text) {
    const now = new Date();
    let m = text.match(reDateFull);
    if (m) return mk(+m[1], +m[2], +m[3], +m[4], +m[5]);
    m = text.match(reDateMD);
    if (m) {
      let d = mk(now.getFullYear(), +m[1], +m[2], +m[3], +m[4]);
      if (d && d > Date.now() + 864e5) d = mk(now.getFullYear() - 1, +m[1], +m[2], +m[3], +m[4]);
      return d;
    }
    m = text.match(reDateOnly);
    if (m) return mk(+m[1], +m[2], +m[3], 12, 0);
    return null;
    function mk(y, mo, d, h, mi) {
      if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
      const t = new Date(y, mo - 1, d, h, mi).getTime();
      return isNaN(t) ? null : t;
    }
  }

  function findMethod(text) {
    const ali = (text.match(/支付宝|余额宝|花呗|花跑|花贝|收单机构|账单分类|标签和备注|蚂蚁|Alipay|ALIPAY|计入收支|商家订单号|Bill Manage|Transactions? Category|Included in statistics|Recommended for you|View related records|One-? ?step Payment|Auto debit|Order Details|Yu'?e ?Bao|Huabei|Acquir/gi) || []).length;
    const wx = (text.match(/微信|零钱通|零钱|商户全称|当前状态|交易单号|商户单号|WeChat|Weixin|微信支付|Merchant (Full )?Name|Merchant (Transaction|Order) (ID|No)|Current Status|Transaction ID|All ?transactions|Transaction Services|Suspicious|Mini Program|Transactions with|Order No/gi) || []).length;
    if (ali > wx) return 'alipay';
    if (wx > ali) return 'wechat';
    return null;
  }

  const CHROME = /^(支付成功|付款成功|交易成功|支付完成|已支付|账单详情|完成|返回|当前状态|支付时间|付款时间|创建时间|付款方式|支付方式|订单号|交易单号|商户单号|商家订单号|全部账单|账单分类|收单机构|商品说明|标签和备注|计入收支|对此订单有疑问|更多|查看|账单服务|申请电子回单|联系商家|发起群收款|收款方备注|备注|服务|小程序|服务详情|评价|分享)/;
  const LABEL = /(商户全称|收款方全称|收款方(?!备注)|对方账户|商家名称|商户名称|商家(?!订单|服务|优惠)|Full name of(?: payee)?|Payee(?: name)?|Merchant(?: full)? name|Merchant(?!\s*(?:Order|Mini|Transaction))|Counterparty)\s*:?\s*(.+)$/i;
  const GOODS = /(商品说明|商品|订单信息|转账说明|I?tem description|Products?(?: description)?|Goods)\s*:?\s*(.+)$/i;
  const MINI = /(Merchant Mini Program|Mini Program|小程序)\s*:?\s*(.+)$/i;
  const ENG_CHROME = /^(Transactions?\b|All ?transactions|Transaction (Details|successful|Services)|View all|Current\b|Payment\b|Status\b|Auto debit|Products?\b|Merchant\b|Acquirer|Order\b|Bill\b|Translate|Time\b|Method\b)/i;
  // "商家4401004251", "商户_黎庆文" gibi gerçek mağaza adı olmayan yer tutucular
  const isPlaceholder = s => !s || /^(商家|商户)[_\s\-]?[\dA-Za-z]*$/.test(s) || /^商户[_\s\-]/.test(s) || /^(默认商品|商品|订单)$/.test(s);
  const stripJunk = s => s.replace(new RegExp(`^[^${CJK}A-Za-z]*[A-Za-z]{1,3}\\s+(?=[${CJK}])`), '').replace(new RegExp(`^[^${CJK}A-Za-z0-9]+`), '');
  const hasName = s => (s.match(new RegExp(`[${CJK}A-Za-z]`, 'g')) || []).length >= 2;
  const cleanName = s => s.replace(/^[\s>\-·•|:]+|[\s>\-·•|:]+$/g, '').replace(/\s*>\s*$/, '').trim();

  function findMerchant(lines, amtIdx) {
    let title = '', label = '', goods = '', mini = '';
    lines.forEach(l => {
      const mm = l.text.match(MINI);
      if (mm && !mini && hasName(mm[2])) { mini = cleanName(stripJunk(mm[2])); return; }
      const lm = l.text.match(LABEL);
      if (lm && !label && hasName(lm[2]) && !isPlaceholder(cleanName(lm[2]))) label = cleanName(lm[2]);
      const gm = l.text.match(GOODS);
      if (gm && !goods && hasName(gm[2]) && !isPlaceholder(cleanName(gm[2]))) goods = cleanName(gm[2]);
    });
    const ok = l => l && hasName(l.text) && !CHROME.test(l.text) && !ENG_CHROME.test(l.text) && !LABEL.test(l.text) && !GOODS.test(l.text) && !MINI.test(l.text)
      && !/^\d{1,2}:\d{2}/.test(l.text) && l.text.length <= 40;
    if (amtIdx != null) {
      for (let i = amtIdx - 1; i >= Math.max(0, amtIdx - 3); i--) if (ok(lines[i])) { title = cleanName(lines[i].text); break; }
      if (!title) for (let i = amtIdx + 1; i <= Math.min(lines.length - 1, amtIdx + 2); i++) if (ok(lines[i])) { title = cleanName(lines[i].text); break; }
    } else {
      // tutar satırı yoksa: ekranın üst yarısındaki en büyük puntolu isim satırı
      const top = lines.slice(0, Math.max(3, Math.ceil(lines.length / 2))).filter(ok);
      const best = top.sort((a, b) => b.h - a.h)[0];
      if (best && best.h) title = cleanName(best.text);
    }
    if (isPlaceholder(title)) title = '';
    return { title, label, goods, mini };
  }

  /* Sözlük eşleştirme */
  const DICT = (window.MERCHANT_DICT || []).map(([keys, d, c, tier, platform]) => ({
    platform: platform === true,
    keys: keys.split('|').map(k => /^[\x00-\x7F]+$/.test(k)
      ? { k, re: new RegExp(`(^|[^A-Za-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'i') }
      : { k }),
    d, c, tier: platform === 'weak' ? 'w' : tier, // 'w' = zayıf genel kelime (ör. "旗舰店")
  }));

  function matchDict(text) {
    const out = { b: null, g: null, c: null, w: null };
    if (!text) return out;
    DICT.forEach(e => e.keys.forEach(({ k, re }) => {
      const hit = re ? re.test(text) : text.includes(k);
      if (!hit) return;
      const cur = out[e.tier];
      if (!cur || k.length > cur.len) out[e.tier] = { d: e.d, c: e.c, len: k.length, platform: e.platform };
    }));
    return out;
  }

  /* Alipay'in kendi kategori etiketi ("Transactions Category  Transport" / "账单分类 交通出行") */
  const EN_CATS = [
    [/hotel|travel|tour|flight|train/i, 'travel'],
    [/food|dining|restaurant|catering|takeaway|takeout/i, 'food'],
    [/coffee|drink|tea/i, 'coffee'],
    [/transport|taxi|car|commut|parking|fuel/i, 'transport'],
    [/daily|necessit|grocer|supermarket|fresh/i, 'market'],
    [/beauty|hair|cosmetic|salon/i, 'personal'],
    [/medic|health|hospital|pharm/i, 'health'],
    [/top-?\s?up|recharge|bill|utilit|telecom|communication|phone/i, 'bills'],
    [/entertain|leisure|culture|sport|outdoor|movie|game/i, 'fun'],
    [/hous|property|home|rent|furnish|decor/i, 'home'],
    [/cloth|apparel|fashion|accessor|digital|electronic|appliance|mom|kid|baby|shopping/i, 'shopping'],
  ];
  function findCatLabel(lines) {
    for (const l of lines) {
      const m = l.text.match(/(?:Transactions?\s*Category|tions\s*Category|Category)\s*:?\s*([A-Za-z][A-Za-z &\/-]{1,40})/i);
      if (!m) continue;
      const v = m[1].trim();
      if (/please select/i.test(v)) continue;
      const hit = EN_CATS.find(([re]) => re.test(v));
      if (hit) return hit[1];
    }
    return null;
  }

  /* Öncelik: mağaza adı (title) > etiketli satırlar (focused) > tüm ekran (full).
   * Kategori: marka > mağaza adındaki kelime > Alipay'in kendi etiketi > diğerleri */
  function translate(title, focused, full, catLabel) {
    const t = matchDict(title), f = matchDict(focused), a = matchDict(full);
    const brand = t.b || f.b || a.b;
    const generic = t.g || f.g || a.g || t.w || f.w || a.w;
    const catHint = t.c || f.c || a.c;
    // açıklama: mağaza adına en yakın eşleşme kazanır (ör. "二强家东烧烤" → BBQ, ekrandaki "美团点餐" değil)
    const best = t.b || t.g || f.b || f.g || a.b || a.g || t.w || f.w || a.w;
    let desc = (best && best.d) || '';
    // pazar yeri markalarında (Taobao, Tmall, JD…) ne alındığını da ekle: "Tmall · Çocuk giyim"
    if (best === brand && brand && brand.platform && generic && generic.d && generic.d !== brand.d) desc = brand.d + ' · ' + generic.d;
    return {
      desc,
      // kategori: ad içindeki marka > ad içindeki kelime > etiketli satırdaki marka > Alipay'in etiketi > geri kalanı
      cat: (t.b && !t.b.platform && t.b.c) || (t.g && t.g.c) || (f.b && !f.b.platform && f.b.c) || catLabel
        || (catHint && catHint.c) || (a.b && !a.b.platform && a.b.c) || (generic && generic.c) || (brand && brand.c) || null,
    };
  }

  function parse(data, forcedAmount) {
    const lines = getLines(data);
    const full = lines.map(l => l.text).join('\n');
    let amt = findAmount(lines);
    if (!amt && forcedAmount) amt = { value: forcedAmount, sign: '-', idx: null };
    const mer = findMerchant(lines, amt ? amt.idx : null);
    const name = mer.title || mer.mini || mer.label || mer.goods || '';
    const focused = [mer.label, mer.goods, mer.mini].join(' ');
    const tr = translate(name, focused, full, findCatLabel(lines));
    const warnings = [];
    // gelen para mı? (arkadaşın payını gönderdi: "+105.00", "已收款", "Received" …)
    const incoming = !!amt && amt.sign !== '-' && (amt.sign === '+'
      || /已收款|已收钱|收款成功|转账收款|收到转账|已存入零钱|已存入余额|收到的红包|收到红包|Received|Money received|Transfer received|Collected/i.test(full));
    const fromM = full.match(/(?:来自|转账人|付款人|付款方(?!式)|Transfer from|Sent by|From)\s*[:：]?\s*([^\n]{1,24})/i);
    const from = fromM ? cleanName(stripJunk(fromM[1])).slice(0, 20) : '';
    if (!amt) warnings.push('Tutar bulunamadı, elle gir.');
    if (amt && amt.sign === '+') warnings.push('Bu bir gelir ya da iade gibi görünüyor.');
    if (/退款/.test(full)) warnings.push('Ekranda “退款” (iade) geçiyor.');
    return {
      amtLine: amt && amt.idx != null ? { y: lines[amt.idx].y, h: lines[amt.idx].h, text: lines[amt.idx].text } : null,
      amount: amt ? amt.value : 0,
      incoming,
      from,
      ts: findDate(full),
      method: findMethod(full),
      orig: name,
      origAlt: [mer.label, mer.goods].filter(x => x && x !== name).join(' · '),
      desc: tr.desc,
      cat: tr.cat,
      warnings,
      text: full,
    };
  }

  return { read, parse, norm };
})();
