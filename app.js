/* ============================================================
   BioStore — منطق التطبيق الكامل
   ============================================================ */

/* ============================================================
   1) التشفير الخفيف للتخزين المحلي
   - XOR مع مفتاح سري + Base64
   - يحمي من التعديل المباشر وليس تشفيراً عسكرياً
   ============================================================ */
const STORAGE_KEY = 'biostore_v1';
const SECRET_KEY = 'BioStore2025#Secure';

/** تطبيق XOR على النص */
function xorTransform(str, key) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

/** تشفير كائن إلى نص Base64 */
function encryptData(obj) {
  try {
    const json = JSON.stringify(obj);
    const xored = xorTransform(json, SECRET_KEY);
    return btoa(unescape(encodeURIComponent(xored)));
  } catch (e) {
    console.error('encrypt error:', e);
    return null;
  }
}

/** فك تشفير نص Base64 إلى كائن */
function decryptData(b64) {
  try {
    const xored = decodeURIComponent(escape(atob(b64)));
    const json = xorTransform(xored, SECRET_KEY);
    return JSON.parse(json);
  } catch (e) {
    console.error('decrypt error:', e);
    return null;
  }
}

/* ============================================================
   2) الحالة العامة للتطبيق
   ============================================================ */
const defaultState = {
  brand: '',
  bio: '',
  avatar: '',
  socials: { telegram: '', whatsapp: '', tiktok: '', instagram: '' },
  products: [],
  links: [],
  accent: '#8b5cf6',
  plan: 'free',
  txid: ''
};

let state = JSON.parse(JSON.stringify(defaultState));

/* ============================================================
   3) أدوات مساعدة
   ============================================================ */

/** توليد معرّف فريد بسيط */
function uid() {
  return 'i_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** تهريب HTML */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** التحقق من صحة رابط http/https فقط */
function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  try {
    const parsed = new URL(u);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch (e) { /* تجاهل */ }
  return '';
}

/** debounce */
function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* ============================================================
   4) نظام الإشعارات (Toast)
   ============================================================ */
const toastWrap = document.getElementById('toastWrap');
const ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

function toast(msg, type = 'info', duration = 3200) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = (ICONS[type] || ICONS.info) + '<span>' + esc(msg) + '</span>';
  toastWrap.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, duration);
}

/* ============================================================
   5) التخزين الآمن
   ============================================================ */
const persist = debounce(function () {
  const enc = encryptData(state);
  if (enc) {
    try {
      localStorage.setItem(STORAGE_KEY, enc);
    } catch (e) {
      console.warn('تعذر الحفظ المحلي:', e);
    }
  }
}, 400);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const dec = decryptData(raw);
    if (dec && typeof dec === 'object') {
      state = Object.assign({}, defaultState, dec);
      state.socials = Object.assign({}, defaultState.socials, dec.socials || {});
      state.products = Array.isArray(dec.products) ? dec.products : [];
      state.links = Array.isArray(dec.links) ? dec.links : [];
    }
  } catch (e) {
    console.warn('تعذر قراءة التخزين المحلي:', e);
  }
}

/* ============================================================
   6) أيقونات المنصات
   ============================================================ */
const SOCIAL_ICONS = {
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0012.05 4a7.94 7.94 0 00-6.9 11.9L4 20l4.2-1.1a7.93 7.93 0 003.85 1h.01a7.94 7.94 0 007.94-7.93 7.87 7.87 0 00-2.4-5.65zM12.06 18.5a6.6 6.6 0 01-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25a6.6 6.6 0 011.02-8.1 6.58 6.58 0 019.32.02 6.6 6.6 0 011.95 4.7 6.62 6.62 0 01-6.6 6.6z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82a4.28 4.28 0 01-1.17-2.82h-3.3v12.4a2.5 2.5 0 11-2.5-2.5c.26 0 .5.04.74.11V9.6a6.3 6.3 0 00-.74-.04 5.9 5.9 0 105.9 5.9V9.1a7.5 7.5 0 004.3 1.36V7.1a4.3 4.3 0 01-3.23-1.28z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2zm0 4.86a4.94 4.94 0 100 9.88 4.94 4.94 0 000-9.88zm0 8.14a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zm6.3-8.34a1.16 1.16 0 11-2.32 0 1.16 1.16 0 012.32 0z"/></svg>'
};

const SOCIAL_META = {
  telegram: { label: 'تليجرام', color: '#229ED9' },
  whatsapp: { label: 'واتساب', color: '#25D366' },
  tiktok: { label: 'تيك توك', color: '#000000' },
  instagram: { label: 'إنستغرام', color: '#E1306C' }
};

/* ============================================================
   7) ربط حقول الإدخال بالحالة
   ============================================================ */
const els = {
  brand: document.getElementById('fBrand'),
  bio: document.getElementById('fBio'),
  avatar: document.getElementById('fAvatar'),
  telegram: document.getElementById('fTelegram'),
  whatsapp: document.getElementById('fWhatsapp'),
  tiktok: document.getElementById('fTiktok'),
  instagram: document.getElementById('fInstagram')
};

function bindInputs() {
  els.brand.addEventListener('input', e => { state.brand = e.target.value; render(); persist(); });
  els.bio.addEventListener('input', e => { state.bio = e.target.value; render(); persist(); });
  els.avatar.addEventListener('input', e => { state.avatar = e.target.value; render(); persist(); });
  els.telegram.addEventListener('input', e => { state.socials.telegram = e.target.value; render(); persist(); });
  els.whatsapp.addEventListener('input', e => { state.socials.whatsapp = e.target.value; render(); persist(); });
  els.tiktok.addEventListener('input', e => { state.socials.tiktok = e.target.value; render(); persist(); });
  els.instagram.addEventListener('input', e => { state.socials.instagram = e.target.value; render(); persist(); });
}

/** تعبئة الحقول من الحالة المحفوظة */
function fillInputs() {
  els.brand.value = state.brand || '';
  els.bio.value = state.bio || '';
  els.avatar.value = state.avatar || '';
  els.telegram.value = state.socials.telegram || '';
  els.whatsapp.value = state.socials.whatsapp || '';
  els.tiktok.value = state.socials.tiktok || '';
  els.instagram.value = state.socials.instagram || '';
}

/* ============================================================
   8) إدارة المنتجات (ديناميكية)
   ============================================================ */
const productsListEl = document.getElementById('productsList');

function renderProductsEditor() {
  productsListEl.innerHTML = '';
  if (state.products.length === 0) {
    productsListEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">لا توجد منتجات بعد. اضغط "إضافة منتج جديد" للبدء.</p>';
    return;
  }
  state.products.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = 'dyn-item';
    item.innerHTML = `
      <div class="dyn-head">
        <span class="dyn-title">منتج #${idx + 1}</span>
        <button class="dyn-del" data-id="${p.id}" title="حذف">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>
      <div class="dyn-inputs">
        <input type="text" class="input" data-field="name" data-id="${p.id}" placeholder="اسم المنتج" value="${esc(p.name)}">
        <div class="row">
          <input type="text" class="input" data-field="price" data-id="${p.id}" placeholder="السعر (مثال: 100$)" value="${esc(p.price)}">
          <input type="url" class="input" data-field="url" data-id="${p.id}" placeholder="رابط الشراء" dir="ltr" value="${esc(p.url)}">
        </div>
      </div>
    `;
    productsListEl.appendChild(item);
  });
}

productsListEl.addEventListener('input', e => {
  const t = e.target;
  if (!t.dataset.field) return;
  const item = state.products.find(p => p.id === t.dataset.id);
  if (!item) return;
  item[t.dataset.field] = t.value;
  render(); persist();
});

productsListEl.addEventListener('click', e => {
  const del = e.target.closest('.dyn-del');
  if (!del) return;
  const id = del.dataset.id;
  state.products = state.products.filter(p => p.id !== id);
  renderProductsEditor();
  render(); persist();
});

document.getElementById('addProductBtn').addEventListener('click', () => {
  state.products.push({ id: uid(), name: '', price: '', url: '' });
  renderProductsEditor();
  render(); persist();
  setTimeout(() => {
    const inputs = productsListEl.querySelectorAll('[data-field="name"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 60);
});

/* ============================================================
   9) إدارة الروابط (ديناميكية)
   ============================================================ */
const linksListEl = document.getElementById('linksList');

function renderLinksEditor() {
  linksListEl.innerHTML = '';
  if (state.links.length === 0) {
    linksListEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">لا توجد روابط بعد. اضغط "إضافة رابط جديد" للبدء.</p>';
    return;
  }
  state.links.forEach((l, idx) => {
    const item = document.createElement('div');
    item.className = 'dyn-item';
    item.innerHTML = `
      <div class="dyn-head">
        <span class="dyn-title">رابط #${idx + 1}</span>
        <button class="dyn-del" data-id="${l.id}" title="حذف">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>
      <div class="dyn-inputs">
        <div class="row">
          <input type="text" class="input" data-field="title" data-id="${l.id}" placeholder="عنوان الرابط" value="${esc(l.title)}">
          <input type="text" class="input" data-field="icon" data-id="${l.id}" placeholder="أيقونة (إيموجي)" value="${esc(l.icon)}" maxlength="4">
        </div>
        <input type="url" class="input" data-field="url" data-id="${l.id}" placeholder="الرابط الكامل (https://...)" dir="ltr" value="${esc(l.url)}">
      </div>
    `;
    linksListEl.appendChild(item);
  });
}

linksListEl.addEventListener('input', e => {
  const t = e.target;
  if (!t.dataset.field) return;
  const item = state.links.find(l => l.id === t.dataset.id);
  if (!item) return;
  item[t.dataset.field] = t.value;
  render(); persist();
});

linksListEl.addEventListener('click', e => {
  const del = e.target.closest('.dyn-del');
  if (!del) return;
  const id = del.dataset.id;
  state.links = state.links.filter(l => l.id !== id);
  renderLinksEditor();
  render(); persist();
});

document.getElementById('addLinkBtn').addEventListener('click', () => {
  state.links.push({ id: uid(), title: '', url: '', icon: '🔗' });
  renderLinksEditor();
  render(); persist();
  setTimeout(() => {
    const inputs = linksListEl.querySelectorAll('[data-field="title"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 60);
});

/* ============================================================
   10) لون التمييز (Pro)
   ============================================================ */
const ACCENT_COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a3e635'];

function renderAccentPicker() {
  const row = document.getElementById('accentRow');
  const lock = document.getElementById('accentLock');
  row.innerHTML = '';

  const isPro = state.plan === 'pro';
  lock.style.display = isPro ? 'none' : 'inline-flex';

  ACCENT_COLORS.forEach(color => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'color-swatch' + (state.accent === color ? ' active' : '');
    sw.style.background = `linear-gradient(135deg, ${color}, ${color}aa)`;
    sw.title = isPro ? color : 'متاح فقط في الباقة الاحترافية';

    sw.addEventListener('click', () => {
      if (!isPro) {
        openUpgradeModal();
        toast('لون التمييز متاح في الباقة الاحترافية فقط', 'info');
        return;
      }
      state.accent = color;
      applyAccent();
      renderAccentPicker();
      render();
      persist();
    });
    row.appendChild(sw);
  });
}

function applyAccent() {
  const c = state.accent || '#8b5cf6';
  const grad = `linear-gradient(135deg, ${c} 0%, #ec4899 100%)`;
  document.documentElement.style.setProperty('--accent', c);
  document.documentElement.style.setProperty('--grad-primary', grad);
}

/* ============================================================
   11) المعاينة الحية
   ============================================================ */
function renderPreview() {
  const pvAvatar = document.getElementById('pvAvatar');
  const avatarUrl = safeUrl(state.avatar);
  if (avatarUrl) {
    pvAvatar.innerHTML = `<img src="${esc(avatarUrl)}" alt="" onerror="this.style.display='none';this.parentElement.textContent='؟';">`;
  } else {
    const initial = (state.brand || '؟').trim().charAt(0) || '؟';
    pvAvatar.textContent = initial;
  }

  document.getElementById('pvBrand').textContent = state.brand || 'اسم العلامة التجارية';
  document.getElementById('pvBio').textContent = state.bio || 'نبذة قصيرة عن علامتك ستظهر هنا...';

  const socialsEl = document.getElementById('pvSocials');
  socialsEl.innerHTML = '';
  Object.keys(SOCIAL_META).forEach(key => {
    const url = safeUrl(state.socials[key]);
    if (!url) return;
    const a = document.createElement('a');
    a.className = 'pv-social';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = SOCIAL_META[key].label;
    a.style.background = SOCIAL_META[key].color + '22';
    a.style.color = SOCIAL_META[key].color;
    a.innerHTML = SOCIAL_ICONS[key];
    socialsEl.appendChild(a);
  });

  const productsEl = document.getElementById('pvProducts');
  productsEl.innerHTML = '';
  const validProducts = state.products.filter(p => p.name.trim() !== '');
  if (validProducts.length > 0) {
    validProducts.forEach(p => {
      const a = document.createElement('a');
      a.className = 'pv-product';
      const url = safeUrl(p.url);
      if (url) {
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        a.href = 'javascript:void(0)';
        a.style.cursor = 'default';
      }
      a.innerHTML = `
        <div class="pv-product-info">
          <div class="pv-product-name">${esc(p.name || 'منتج بدون اسم')}</div>
          ${p.price ? `<div class="pv-product-price">${esc(p.price)}</div>` : ''}
        </div>
        <div class="pv-buy">شراء</div>
      `;
      productsEl.appendChild(a);
    });
  }

  const linksEl = document.getElementById('pvLinks');
  linksEl.innerHTML = '';
  const validLinks = state.links.filter(l => l.title.trim() !== '');
  if (validLinks.length > 0) {
    validLinks.forEach(l => {
      const url = safeUrl(l.url);
      const a = document.createElement('a');
      a.className = 'pv-link';
      if (url) {
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        a.href = 'javascript:void(0)';
        a.style.cursor = 'default';
      }
      a.innerHTML = `
        <span class="icon">${esc(l.icon || '🔗')}</span>
        <span class="text">${esc(l.title || 'رابط بدون عنوان')}</span>
        <span class="arrow">←</span>
      `;
      linksEl.appendChild(a);
    });
  }

  const footerEl = document.getElementById('pvFooter');
  if (state.plan === 'free') {
    footerEl.innerHTML = `
      <a class="pv-watermark" href="#" onclick="return false;">
        تم الإنشاء مجاناً عبر <b>BioStore</b>
      </a>
    `;
  } else {
    footerEl.innerHTML = '';
  }
}

function render() {
  renderPreview();
}

/* ============================================================
   12) تحديث واجهة الباقة
   ============================================================ */
function renderPlanBadge() {
  const badge = document.getElementById('planBadge');
  const text = document.getElementById('planText');
  if (state.plan === 'pro') {
    badge.classList.add('pro');
    text.textContent = 'الباقة الاحترافية ✓';
    document.getElementById('upgradeBtn').style.display = 'none';
  } else {
    badge.classList.remove('pro');
    text.textContent = 'الباقة المجانية';
    document.getElementById('upgradeBtn').style.display = 'inline-flex';
  }
}

/* ============================================================
   13) توليد كود HTML النهائي للتصدير
   ============================================================ */
function buildExportHTML() {
  const accent = state.accent || '#8b5cf6';
  const brand = state.brand || 'اسم العلامة التجارية';
  const bio = state.bio || '';
  const avatarUrl = safeUrl(state.avatar);

  const initial = (brand || '؟').trim().charAt(0) || '؟';
  const avatarHtml = avatarUrl
    ? `<div class="avatar"><img src="${esc(avatarUrl)}" alt="${esc(brand)}"></div>`
    : `<div class="avatar">${esc(initial)}</div>`;

  let socialsHtml = '';
  Object.keys(SOCIAL_META).forEach(key => {
    const url = safeUrl(state.socials[key]);
    if (!url) return;
    socialsHtml += `<a class="social" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${SOCIAL_META[key].label}" style="background:${SOCIAL_META[key].color}22;color:${SOCIAL_META[key].color}">${SOCIAL_ICONS[key]}</a>`;
  });
  if (socialsHtml) socialsHtml = `<div class="socials">${socialsHtml}</div>`;

  let productsHtml = '';
  const validProducts = state.products.filter(p => p.name.trim() !== '');
  if (validProducts.length) {
    productsHtml = '<div class="list">' + validProducts.map(p => {
      const url = safeUrl(p.url);
      const href = url ? `href="${esc(url)}" target="_blank" rel="noopener noreferrer"` : '';
      return `<a class="product" ${href}>
        <div class="p-info">
          <div class="p-name">${esc(p.name || 'منتج بدون اسم')}</div>
          ${p.price ? `<div class="p-price">${esc(p.price)}</div>` : ''}
        </div>
        <div class="p-buy">شراء</div>
      </a>`;
    }).join('') + '</div>';
  }

  let linksHtml = '';
  const validLinks = state.links.filter(l => l.title.trim() !== '');
  if (validLinks.length) {
    linksHtml = '<div class="list">' + validLinks.map(l => {
      const url = safeUrl(l.url);
      const href = url ? `href="${esc(url)}" target="_blank" rel="noopener noreferrer"` : '';
      return `<a class="link" ${href}>
        <span class="li-icon">${esc(l.icon || '🔗')}</span>
        <span class="li-text">${esc(l.title || 'رابط بدون عنوان')}</span>
        <span class="li-arrow">←</span>
      </a>`;
    }).join('') + '</div>';
  }

  const footerHtml = state.plan === 'free'
    ? `<div class="footer"><span class="watermark">تم الإنشاء مجاناً عبر <b>BioStore</b></span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(brand)}</title>
<meta name="description" content="${esc(bio.slice(0, 160))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{
  font-family:'Cairo',system-ui,sans-serif;
  background:#06060c;color:#fff;
  min-height:100vh;padding:40px 16px;
  display:flex;align-items:flex-start;justify-content:center;
  position:relative;overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;
  background:
    radial-gradient(600px circle at 50% -10%, ${accent}40, transparent 55%),
    radial-gradient(500px circle at 100% 100%, #ec489922, transparent 50%),
    radial-gradient(500px circle at 0% 80%, #22d3ee15, transparent 50%);
}
.page{
  width:100%;max-width:480px;position:relative;z-index:1;
  display:flex;flex-direction:column;align-items:center;gap:14px;
  animation:fadeUp .6s cubic-bezier(.34,1.56,.64,1);
}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.avatar{
  width:96px;height:96px;border-radius:50%;
  background:linear-gradient(135deg,${accent},#ec4899);
  display:grid;place-items:center;font-size:38px;font-weight:800;
  overflow:hidden;border:3px solid rgba(255,255,255,.12);
  box-shadow:0 10px 40px ${accent}66;
  flex-shrink:0;
}
.avatar img{width:100%;height:100%;object-fit:cover;display:block}
.brand{font-size:22px;font-weight:800;text-align:center;letter-spacing:-.3px;margin-top:4px}
.bio{font-size:13.5px;color:#9aa0b4;text-align:center;line-height:1.7;max-width:340px;white-space:pre-wrap;word-break:break-word}
.socials{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:4px 0}
.social{
  width:46px;height:46px;border-radius:13px;
  display:grid;place-items:center;text-decoration:none;
  border:1px solid rgba(255,255,255,.08);
  transition:transform .25s;
}
.social:hover{transform:translateY(-3px) scale(1.05)}
.social svg{width:20px;height:20px}
.list{width:100%;display:flex;flex-direction:column;gap:10px;margin-top:6px}
.product{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 16px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.08);border-radius:14px;
  text-decoration:none;color:#fff;transition:all .22s;
}
.product:hover{background:rgba(255,255,255,.08);border-color:${accent}80;transform:translateY(-2px)}
.p-info{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.p-name{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p-price{font-size:12px;color:#22d3ee;font-weight:700}
.p-buy{
  font-size:11.5px;font-weight:800;padding:7px 14px;border-radius:9px;
  background:linear-gradient(135deg,${accent},#ec4899);color:#fff;white-space:nowrap;flex-shrink:0;
  box-shadow:0 4px 14px ${accent}55;
}
.link{
  display:flex;align-items:center;gap:12px;
  padding:14px 16px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.08);border-radius:14px;
  text-decoration:none;color:#fff;font-size:14px;font-weight:600;
  transition:all .22s;
}
.link:hover{background:rgba(255,255,255,.08);border-color:#22d3ee80;transform:translateY(-2px)}
.li-icon{font-size:16px}
.li-text{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.li-arrow{color:#5e6280;font-size:15px}
.footer{margin-top:24px;padding-top:20px;width:100%;text-align:center;border-top:1px solid rgba(255,255,255,.05)}
.watermark{
  display:inline-flex;align-items:center;gap:6px;
  font-size:11px;color:#5e6280;padding:7px 14px;border-radius:999px;
  background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);
  font-weight:600;
}
.watermark b{
  background:linear-gradient(135deg,${accent},#ec4899);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
}
</style>
</head>
<body>
  <main class="page">
    ${avatarHtml}
    <h1 class="brand">${esc(brand)}</h1>
    ${bio ? `<p class="bio">${esc(bio)}</p>` : ''}
    ${socialsHtml}
    ${productsHtml}
    ${linksHtml}
    ${footerHtml}
  </main>
</body>
</html>`;
}

/* ============================================================
   14) نسخ الكود / تحميل الملف
   ============================================================ */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }
}

document.getElementById('copyBtn').addEventListener('click', async () => {
  const html = buildExportHTML();
  const ok = await copyToClipboard(html);
  if (ok) {
    toast('تم نسخ كود HTML بنجاح ✓', 'success');
  } else {
    toast('فشل النسخ — حاول مرة أخرى', 'error');
  }
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  const html = buildExportHTML();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (state.brand || 'biostore').replace(/[^\u0600-\u06FFa-zA-Z0-9_-]/g, '_').slice(0, 40) || 'page';
  a.href = url;
  a.download = safeName + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('تم تحميل الصفحة كملف HTML ✓', 'success');
});

/* ============================================================
   15) مودال الترقية + التحقق من الدفع
   ============================================================ */
const upgradeModal = document.getElementById('upgradeModal');

function openUpgradeModal() {
  upgradeModal.classList.add('show');
  document.body.classList.add('modal-open');
}

function closeUpgradeModal() {
  upgradeModal.classList.remove('show');
  document.body.classList.remove('modal-open');
}

document.getElementById('upgradeBtn').addEventListener('click', openUpgradeModal);
document.getElementById('closeModal').addEventListener('click', closeUpgradeModal);

upgradeModal.addEventListener('click', e => {
  if (e.target === upgradeModal) closeUpgradeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeUpgradeModal();
});

document.getElementById('copyWallet').addEventListener('click', async () => {
  const ok = await copyToClipboard('TGpwcWvbAMCQxjkkPg413uaESRVL2MV7X7');
  toast(ok ? 'تم نسخ عنوان المحفظة ✓' : 'فشل النسخ', ok ? 'success' : 'error');
});

const verifyStatusEl = document.getElementById('verifyStatus');

function showVerifyStatus(type, msg) {
  verifyStatusEl.className = 'verify-status show ' + type;
  verifyStatusEl.innerHTML = (ICONS[type] || ICONS.info) + '<span>' + esc(msg) + '</span>';
}

function isValidTxidFormat(txid) {
  return /^[a-f0-9]{64}$/i.test(txid);
}

async function verifyTransactionOnChain(txid) {
  const MERCHANT = 'TGpwcWvbAMCQxjkkPg413uaESRVL2MV7X7';
  const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  const REQUIRED_AMOUNT = 5 * 1e6;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `https://api.trongrid.io/v1/accounts/${MERCHANT}/transactions/trc20?only_to=true&contract_address=${USDT_CONTRACT}&limit=200`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const list = (json && json.data) || [];

    const found = list.find(tx => (tx.transaction_id || '').toLowerCase() === txid.toLowerCase());

    if (!found) {
      return { ok: false, reason: 'not_found', msg: 'لم يتم العثور على هذه المعاملة في محفظة التاجر. تأكد من TXID أو انتظر تأكيد الشبكة.' };
    }

    const value = parseInt(found.value || '0', 10);
    if (value < REQUIRED_AMOUNT) {
      return { ok: false, reason: 'amount', msg: 'المبلغ المرسل أقل من 5 USDT.' };
    }

    return { ok: true, msg: 'تم التحقق من الدفعة على الشبكة بنجاح!', amount: value / 1e6 };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: null, reason: 'network', msg: 'تعذر الاتصال بالشبكة للتحقق الفوري. تم قبول الصيغة فقط.' };
  }
}

document.getElementById('verifyBtn').addEventListener('click', async () => {
  const txid = (document.getElementById('txidInput').value || '').trim();

  if (!txid) {
    showVerifyStatus('error', 'الرجاء إدخال رقم المعاملة TXID أولاً.');
    return;
  }

  if (!isValidTxidFormat(txid)) {
    showVerifyStatus('error', 'صيغة TXID غير صحيحة. يجب أن يكون 64 حرفاً hexadecimal.');
    return;
  }

  const btn = document.getElementById('verifyBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'جاري التحقق...';
  showVerifyStatus('info', 'جاري التحقق من المعاملة على شبكة Tron...');

  const result = await verifyTransactionOnChain(txid);

  btn.disabled = false;
  btn.innerHTML = originalHtml;

  if (result.ok === true) {
    state.plan = 'pro';
    state.txid = txid;
    renderPlanBadge();
    renderAccentPicker();
    render();
    persist();
    showVerifyStatus('success', '✓ ' + result.msg + ' تم ترقية حسابك بنجاح!');
    toast('مبروك! تمت ترقية حسابك للباقة الاحترافية 🎉', 'success', 4500);
    setTimeout(() => {
      closeUpgradeModal();
      verifyStatusEl.classList.remove('show');
    }, 2200);
  } else if (result.ok === null) {
    state.plan = 'pro';
    state.txid = txid;
    renderPlanBadge();
    renderAccentPicker();
    render();
    persist();
    showVerifyStatus('info', '⚠️ ' + result.msg + ' تم تسجيل الترقية محلياً، وسيتم التحقق النهائي عند الاتصال.');
    toast('تم قبول TXID محلياً — سيتم التحقق الكامل عند توفر الشبكة', 'info', 4500);
    setTimeout(() => {
      closeUpgradeModal();
      verifyStatusEl.classList.remove('show');
    }, 2600);
  } else {
    showVerifyStatus('error', result.msg);
  }
});

/* ============================================================
   16) زر المعاينة العائم (موبايل)
   ============================================================ */
document.getElementById('fabPreview').addEventListener('click', () => {
  const anchor = document.getElementById('previewAnchor');
  anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ============================================================
   17) الإقلاع
   ============================================================ */
function init() {
  loadState();
  fillInputs();
  bindInputs();
  renderProductsEditor();
  renderLinksEditor();
  renderAccentPicker();
  renderPlanBadge();
  applyAccent();
  render();
}

document.addEventListener('DOMContentLoaded', init);
