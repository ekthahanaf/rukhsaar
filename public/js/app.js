/* Rukhsaar Clothes - storefront */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let S = null;
let cart = store.get('rk_cart', []);
let wish = store.get('rk_wish', []);
const I = {
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.600-7 10-7 10z"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  wa: '<svg viewBox="0 0 32 32" width="20" height="20" fill="#fff"><path d="M16 3C9 3 3.400 8.600 3.400 15.500c0 2.400.7 4.700 1.900 6.600L3 29l7.100-2.200c1.800 1 3.800 1.500 5.900 1.500 7 0 12.600-5.600 12.600-12.600S23 3 16 3zm5.700 15.200c-.3-.2-1.800-.9-2.100-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.200c-.2.200-.4.200-.7.100-.3-.2-1.300-.5-2.500-1.500-.9-.8-1.500-1.800-1.700-2.100-.2-.3 0-.5.100-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.700-1-2.300-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.100-.8.400-.3.300-1.100 1.100-1.100 2.600s1.100 3 1.300 3.200c.2.200 2.200 3.400 5.300 4.700.7.300 1.300.5 1.700.7.7.2 1.400.2 1.900.1.600-.1 1.800-.7 2-1.400.3-.7.3-1.300.2-1.400-.1-.1-.3-.2-.6-.4z"/></svg>',
};
const money = (n) => S.settings.currency + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const prod = (id) => S.products.find((p) => p.id === id);
const col = (slug) => S.collections.find((c) => c.slug === slug);
const inCol = (slug) => S.products.filter((p) => (p.collections || []).includes(slug));
const waNum = () => String(S.settings.whatsapp || '').replace(/\D/g, '');
const waLink = (t) => `https://wa.me/${waNum()}?text=${encodeURIComponent(t)}`;

/* ---------- toast / overlay / drawers ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }
function openLayer(id) {
  const el = $('#' + id); el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
  if (id === 'modal' || id === 'drawer' || id === 'menu' || id === 'search') { $('#overlay').classList.add('on'); document.body.classList.add('lock'); }
}
function closeLayers() {
  ['drawer', 'menu', 'modal', 'search'].forEach((id) => { const e = $('#' + id); e.classList.remove('on'); e.setAttribute('aria-hidden', 'true'); });
  $('#overlay').classList.remove('on'); document.body.classList.remove('lock');
}

/* ---------- cart ---------- */
const saveCart = () => { store.set('rk_cart', cart); renderBadges(); };
function cartLines() {
  return cart.map((i) => ({ ...i, p: prod(i.id) })).filter((l) => l.p);
}
function cartSub() { return cartLines().reduce((s, l) => s + l.p.price * l.qty, 0); }
function shippingFor(sub) {
  const st = S.settings; return st.freeShippingOver > 0 && sub >= st.freeShippingOver ? 0 : Number(st.shipping) || 0;
}
function addToCart(id, size, qty) {
  const p = prod(id); if (!p) return;
  const max = p.stock > 0 ? p.stock : 99;
  const l = cart.find((i) => i.id === id && i.size === size);
  if (l) l.qty = Math.min(max, l.qty + qty); else cart.push({ id, size, qty: Math.min(max, qty) });
  saveCart();
}
function renderBadges() {
  const n = cartLines().reduce((s, l) => s + l.qty, 0);
  $$('[data-cartcount]').forEach((b) => { if (b.textContent != n) { b.textContent = n; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } });
  $$('[data-wishcount]').forEach((b) => { b.textContent = wish.length; });
}
function renderDrawer() {
  const ls = cartLines(); const sub = cartSub();
  $('#drawer').innerHTML = `<div class="dr-head"><span>Shopping cart</span><button data-act="close" aria-label="Close">✕</button></div>
  <div class="dr-body">${ls.length ? ls.map((l) => `<div class="citem">
    <a href="#/product/${esc(l.p.id)}" data-act="close"><img src="${esc(l.p.images[0] || '')}" alt=""></a>
    <div><b>${esc(l.p.name)}</b><small>${l.size ? 'Size: ' + esc(l.size) : ''}</small><small>${money(l.p.price)}</small>
      <div class="qty" style="margin-top:8px"><button data-act="cq" data-d="-1" data-id="${esc(l.id)}" data-size="${esc(l.size)}">−</button><input value="${l.qty}" readonly><button data-act="cq" data-d="1" data-id="${esc(l.id)}" data-size="${esc(l.size)}">+</button></div>
      <button class="rm" data-act="rm" data-id="${esc(l.id)}" data-size="${esc(l.size)}">Remove</button></div>
    <b>${money(l.p.price * l.qty)}</b></div>`).join('') : '<div class="empty">Your cart is empty.</div>'}</div>
  ${ls.length ? `<div class="dr-foot"><div class="tot"><span>Subtotal</span><span>${money(sub)}</span></div>
    <small style="display:block;color:var(--muted);margin-bottom:12px">Delivery is calculated at checkout. Cash on delivery.</small>
    <a class="btn" href="#/checkout" data-act="close">Checkout</a></div>` : ''}`;
}
function openCart() { renderDrawer(); openLayer('drawer'); }

/* ---------- product html ---------- */
function card(p, d = 0) {
  const liked = wish.includes(p.id);
  const out = p.stock <= 0;
  return `<article class="card reveal" style="--d:${d}s">
  <div class="ph"><a href="#/product/${esc(p.id)}" style="display:block;height:100%"><img loading="lazy" src="${esc(p.images[0] || '')}" alt="${esc(p.name)}">${p.images[1] ? `<img loading="lazy" src="${esc(p.images[1])}" alt="">` : ''}</a>
    ${out ? '<span class="tag out">Sold out</span>' : p.isNew ? '<span class="tag">New</span>' : ''}
    <div class="acts"><button class="round ${liked ? 'liked' : ''}" data-act="wish" data-id="${esc(p.id)}" aria-label="Wishlist">${I.heart}</button>
    <button class="round" data-act="quick" data-id="${esc(p.id)}" aria-label="Quick view">${I.eye}</button></div></div>
  <div class="quickwrap"><button class="quick" data-act="quick" data-id="${esc(p.id)}">${out ? 'View' : 'Quick add'}</button></div>
  <div class="meta"><div class="vendor">${esc(S.settings.brandName)}</div><a class="pname" href="#/product/${esc(p.id)}">${esc(p.name)}</a>
  <div class="price">${p.comparePrice > p.price ? `<s>${money(p.comparePrice)}</s>` : ''}${money(p.price)}</div></div></article>`;
}
function pdp(p) {
  const imgs = p.images.length ? p.images : [''];
  const out = p.stock <= 0; const sizes = p.sizes || [];
  const low = p.stock > 0 && p.stock <= 10;
  return `<div class="pdp" data-pid="${esc(p.id)}" data-price="${p.price}" data-stock="${p.stock}">
  <div class="gal"><div class="main" data-act="zoom"><img src="${esc(imgs[0])}" alt="${esc(p.name)}"></div>
    ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((u, i) => `<button class="${i ? '' : 'on'}" data-act="thumb" data-src="${esc(u)}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}</div>
  <div class="info"><h1>${esc(p.name)}</h1>
    <div class="desc">${esc(p.description)}</div>
    <dl><dt>Vendor</dt><dd>${esc(S.settings.brandName)}</dd><dt>Availability</dt><dd>${out ? 'Sold out' : 'In stock'}</dd></dl>
    <div class="pr">${p.comparePrice > p.price ? `<s>${money(p.comparePrice)}</s>` : ''}${money(p.price)}</div>
    ${low ? `<div class="lowstock">Please hurry! Only ${p.stock} left in stock</div>` : ''}
    ${sizes.length ? `<div class="lbl">Size: <b class="szl">${esc(sizes[0])}</b></div><div class="chips">${sizes.map((s, i) => `<button class="chip ${i ? '' : 'on'}" data-act="size" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
    <div class="lbl">Quantity:</div>
    <div class="qty"><button data-act="pq" data-d="-1">−</button><input class="qv" value="1" inputmode="numeric"><button data-act="pq" data-d="1">+</button></div>
    <div class="lbl" style="margin-top:12px">Subtotal: <b class="sub" style="color:var(--ink)">${money(p.price)}</b></div>
    <a class="size-link" href="#" data-act="sizeguide">Size guide</a>
    <div class="buyrow"><button class="btn" data-act="add" ${out ? 'disabled' : ''}>${out ? 'Sold out' : 'Add to cart'}</button>
      <button class="round ${wish.includes(p.id) ? 'liked' : ''}" data-act="wish" data-id="${esc(p.id)}" aria-label="Wishlist">${I.heart}</button></div>
    <div class="stack"><button class="btn ghost" data-act="buy" ${out ? 'disabled' : ''}>Buy it now</button>
      <button class="btn wa" data-act="wa-prod">${I.wa} Order on WhatsApp</button></div>
    <div class="perks"><div>Delivery across Pakistan in 4 working days</div><div>Cash on delivery</div><div>48-hour exchange</div></div>
  </div></div>`;
}
function pdpState(root) {
  const r = $('.pdp', root) || root; const id = r.dataset.pid; const p = prod(id);
  const size = ($('.chip.on', r) || {}).dataset ? $('.chip.on', r).dataset.v : '';
  let qty = parseInt($('.qv', r).value, 10) || 1; const max = p.stock > 0 ? p.stock : 99;
  qty = Math.max(1, Math.min(max, qty)); $('.qv', r).value = qty;
  $('.sub', r).textContent = money(p.price * qty);
  return { id, p, size, qty };
}

/* ---------- chrome ---------- */
function logoHTML() {
  const st = S.settings;
  return `<a class="logo" href="#/" aria-label="${esc(st.brandName)}"><span class="mark">${esc((st.brandName || 'R')[0])}</span><span><span class="name">${esc(st.brandName)}</span>${st.brandSub ? `<span class="sub">${esc(st.brandSub)}</span>` : ''}</span></a>`;
}
function navLinks() {
  const cs = S.collections.filter((c) => c.showInTiles);
  return [['#/', 'Home'], ...cs.map((c) => [`#/collection/${c.slug}`, c.name]), ['#/all', 'All Collection'], ['#/contact', 'Contact Us']];
}
function renderChrome() {
  const st = S.settings; const r = document.documentElement.style;
  if (st.colorPrimary) { r.setProperty('--plum', st.colorPrimary); }
  if (st.colorSoft) r.setProperty('--soft', st.colorSoft);
  if (st.colorSand) r.setProperty('--sand', st.colorSand);
  document.title = `${st.brandName} ${st.brandSub || ''}`.trim();
  const an = (st.announcements || []).filter(Boolean);
  const A = $('#announce');
  if (st.announcementOn && an.length) { const row = an.map((t) => `<span>${esc(t)}</span>`).join(''); A.innerHTML = `<div class="track">${row}${row}${row}${row}</div>`; A.style.display = ''; } else A.style.display = 'none';
  $('#header').innerHTML = `<div class="wrap"><button class="hdr-btn burger" data-act="menu" aria-label="Menu">${I.menu}</button>${logoHTML()}
    <div class="hdr-tools"><button class="hdr-btn" data-act="search" aria-label="Search">${I.search}<span class="lbl-t">Search</span></button>
    <a class="hdr-btn" href="#/wishlist" aria-label="Wishlist">${I.heart}<span class="lbl-t">My wish list</span><span class="badge" data-wishcount>0</span></a>
    <button class="hdr-btn" data-act="cart" aria-label="Cart">${I.bag}<span class="lbl-t">Shopping cart</span><span class="badge" data-cartcount>0</span></button></div></div>`;
  const links = navLinks();
  $('#nav').innerHTML = `<ul>${links.map(([h, t]) => `<li><a href="${h}" data-nav="${h}">${esc(t)}</a></li>`).join('')}</ul>`;
  $('#menu').innerHTML = `<div class="dr-head"><span>${esc(st.brandName)}</span><button data-act="close" aria-label="Close">✕</button></div>` + links.map(([h, t]) => `<a href="${h}" data-act="close">${esc(t)}</a>`).join('');
  const soc = st.social || {};
  const socs = [['facebook', 'f'], ['instagram', 'ig'], ['tiktok', 'tt'], ['youtube', 'yt']].filter(([k]) => soc[k]);
  $('#footer').innerHTML = `<div class="cols">
    <div><h4>Useful links</h4><ul><li><a href="#/">Home</a></li><li><a href="#/collection/new">New Arrivals</a></li><li><a href="#/page/privacy">Privacy Policy</a></li></ul></div>
    <div><h4>Information</h4><ul><li><a href="#/contact">Contact Us</a></li><li><a href="#/all">All Collection</a></li></ul></div>
    <div><h4>Customer service</h4><ul><li><a href="#/page/exchange">Exchange Policy</a></li><li><a href="#/page/disclaimer">Product Disclaimer</a></li><li><a href="#/wishlist">My wish list</a></li></ul></div>
    <div><h4>Join the ${esc(st.brandName)} circle</h4><p style="font-size:13px;opacity:.9;margin-bottom:14px">${esc(st.footerNote || '')} New collections and offers on WhatsApp.</p>
      <a class="btn-light" style="font-size:13px;padding:12px 22px;animation:none" href="${waLink('Hi! Please add me to your updates.')}" target="_blank" rel="noopener">Chat on WhatsApp</a>
      <div class="soc">${socs.map(([k, l]) => `<a href="${esc(soc[k])}" target="_blank" rel="noopener" aria-label="${k}">${l}</a>`).join('')}</div></div></div>
    <div class="copy">© ${new Date().getFullYear()} <b>${esc(st.brandName)} ${esc(st.brandSub || '')}</b>. All Rights Reserved.</div>`;
  $('#wa-float').href = waLink(`Hi ${st.brandName}! I need help with an order.`);
  renderBadges(); markNav();
}
function markNav() { const h = location.hash || '#/'; $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === h)); }

/* ---------- pages ---------- */
function secTitle(c, n) { return `<div class="rule-title"><h3>${esc(c.name)}</h3></div><a class="view-all" href="#/collection/${esc(c.slug)}">View All</a>`; }
function lookRow() {
  const items = inCol('festive').slice(0, 6); if (!items.length) return '';
  return `<section class="look reveal"><h2 class="h2">SHOP THE LOOK!</h2><div class="look-row">${items.map((p) => `<a class="look-card" href="#/product/${esc(p.id)}"><div class="im"><img loading="lazy" src="${esc(p.images[0] || '')}" alt="${esc(p.name)}"></div>
    <div class="cap"><img src="${esc(p.images[0] || '')}" alt=""><div><small>${esc(p.name)}</small><b>${money(p.price)}</b></div></div></a>`).join('')}</div></section>`;
}
function home() {
  const st = S.settings; const imgs = (st.heroImages || []).filter((x) => x && x.img);
  let html = `<section class="hero ${st.heroVideo ? 'has-video' : ''}" style="background:${esc(st.heroBg || 'var(--plum)')}">${st.heroVideo ? `<video class="hero-video" src="${esc(st.heroVideo)}" autoplay muted loop playsinline></video>` : ''}
  <div class="wrap"><div class="hero-copy"><div class="hero-eyebrow"><span class="mark">${esc((st.brandName || 'R')[0])}</span><span>${esc(st.tagline || '')}</span></div>
    <div class="season">${esc(st.heroEyebrow || '')}</div><h1>${esc(st.heroTitle || '')}</h1><p>${esc(st.heroText || '')}</p>
    ${st.heroButtonText ? `<a class="btn-light" href="${esc(st.heroButtonLink || '#/all')}">${esc(st.heroButtonText)}</a>` : ''}</div>
    <div class="hero-imgs">${imgs.slice(0, 3).map((x) => `<a href="${esc(x.link || '#/all')}"><img src="${esc(x.img)}" alt=""></a>`).join('')}</div></div></section>`;
  const tiles = S.collections.filter((c) => c.showInTiles);
  if (tiles.length) html += `<section class="sec reveal"><span class="eyebrow">${esc(st.tagline || '')}</span><h2 class="h2">Shop by collection</h2>
    <div class="tiles">${tiles.map((c) => `<a class="tile" href="#/collection/${esc(c.slug)}"><div class="arch"><img loading="lazy" src="${esc(c.image)}" alt=""></div><span>${esc(c.tileLabel || c.name)}</span></a>`).join('')}</div></section>`;
  let shown = 0;
  S.collections.filter((c) => c.showOnHome).forEach((c) => {
    const items = inCol(c.slug); if (!items.length) return;
    html += `<section class="sec reveal wrap">${secTitle(c)}<div class="grid">${items.slice(0, 8).map((p, i) => card(p, (i % 4) * 0.08)).join('')}</div></section>`;
    if (++shown === 4) html += lookRow();
  });
  if (shown < 4) html += lookRow();
  html += kindWords() + highlights();
  return html;
}
function kindWords() {
  const t = S.testimonials || []; if (!t.length) return '';
  return `<section class="kind reveal"><h2 class="h2">Kind words</h2><div class="wrap"><div class="cards">${t.map((x) => `<div class="kcard"><q>${esc(x.text)}</q><small>${esc(x.author)}</small></div>`).join('')}</div></div></section>`;
}
function highlights() {
  const h = (S.settings.highlights || []).filter((x) => x.title);
  return h.length ? `<div class="hl reveal">${h.map((x) => `<div><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div>`).join('')}</div>` : '';
}
function sortProducts(list, how) {
  const a = [...list];
  if (how === 'low') a.sort((x, y) => x.price - y.price); else if (how === 'high') a.sort((x, y) => y.price - x.price);
  else if (how === 'new') a.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  return a;
}
let sortHow = 'feat';
function collectionPage(slug) {
  const c = slug ? col(slug) : null;
  if (slug && !c) return notFound();
  const title = c ? c.name : 'All Collection';
  const list = sortProducts(c ? inCol(slug) : S.products, sortHow);
  return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> › ${esc(title)}</div><div class="page-head"><h1 class="h2">${esc(title)}</h1></div>
  ${!c ? `<div class="chips" style="justify-content:center;margin-bottom:26px">${S.collections.map((x) => `<a class="chip" href="#/collection/${esc(x.slug)}">${esc(x.name)}</a>`).join('')}</div>` : ''}
  <div class="toolbar"><span>${list.length} products</span><select data-act="sort"><option value="feat" ${sortHow === 'feat' ? 'selected' : ''}>Featured</option><option value="new" ${sortHow === 'new' ? 'selected' : ''}>Newest</option><option value="low" ${sortHow === 'low' ? 'selected' : ''}>Price, low to high</option><option value="high" ${sortHow === 'high' ? 'selected' : ''}>Price, high to low</option></select></div>
  ${list.length ? `<div class="grid wide">${list.map((p, i) => card(p, (i % 4) * 0.06)).join('')}</div>` : '<div class="empty">No products here yet.</div>'}</div>` + highlights();
}
function wishlistPage() {
  const list = wish.map(prod).filter(Boolean);
  return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> › My wish list</div><div class="page-head"><h1 class="h2">My wish list</h1></div>
  ${list.length ? `<div class="grid wide">${list.map((p, i) => card(p, i * 0.05)).join('')}</div>` : '<div class="empty">Tap the heart on any product to save it here.</div>'}</div>`;
}
function productPage(id) {
  const p = prod(id); if (!p) return notFound();
  const c = (p.collections || []).map(col).find(Boolean);
  const rel = c ? inCol(c.slug).filter((x) => x.id !== p.id).slice(0, 4) : [];
  return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> › ${c ? `<a href="#/collection/${esc(c.slug)}">${esc(c.name)}</a> › ` : ''}${esc(p.name)}</div>${pdp(p)}
  ${rel.length ? `<section class="sec"><h2 class="h2">You may also like</h2><div class="grid wide" style="margin-top:30px">${rel.map((x, i) => card(x, i * 0.08)).join('')}</div></section>` : ''}</div>` + highlights();
}
function notFound() { return '<div class="empty"><h2 class="h2">Page not found</h2><p style="margin:14px 0 24px">That page is not available.</p><a class="btn" style="max-width:220px;margin:auto" href="#/">Back to home</a></div>'; }
const POLICY = {
  exchange: ['Exchange Policy', 'Not quite the one? Exchange it within 48 hours of delivery. The item must be unworn and in its original condition. Message us on WhatsApp to start an exchange.'],
  privacy: ['Privacy Policy', 'We only use your name, phone number and address to deliver your order and contact you about it. We never sell your information.'],
  disclaimer: ['Product Disclaimer', 'Colours may look slightly different from the photos depending on your screen and lighting. Each suit is stitched to the size you choose.'],
};
function policyPage(k) {
  const x = POLICY[k]; if (!x) return notFound();
  return `<div class="wrap" style="max-width:760px"><div class="crumbs"><a href="#/">Home</a> › ${esc(x[0])}</div><div class="page-head"><h1 class="h2">${esc(x[0])}</h1></div><p style="line-height:1.9;color:#5a4a55;padding-bottom:40px">${esc(x[1])}</p></div>`;
}
function contactPage() {
  const st = S.settings;
  return `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> › Contact Us</div><div class="page-head"><h1 class="h2">Contact us</h1></div>
  <div class="contact"><div><p><b>WhatsApp / Phone</b><br>${esc(st.phone)}</p><p><b>Email</b><br>${esc(st.email)}</p><p><b>Address</b><br>${esc(st.address)}</p>
    <p style="margin-top:20px"><a class="btn wa" href="${waLink('Hi! I have a question.')}" target="_blank" rel="noopener">${I.wa} Chat on WhatsApp</a></p></div>
  <form data-form="contact"><label class="field"><span>Your name</span><input name="name" required></label><label class="field"><span>Message</span><textarea name="msg" rows="5" required></textarea></label>
    <button class="btn" type="submit">Send on WhatsApp</button></form></div></div>`;
}
function checkoutPage() {
  const ls = cartLines();
  if (!ls.length) return '<div class="empty"><h2 class="h2">Your cart is empty</h2><p style="margin:14px 0 24px">Add something you love first.</p><a class="btn" style="max-width:220px;margin:auto" href="#/all">Shop now</a></div>';
  const sub = cartSub(); const ship = shippingFor(sub); const st = S.settings;
  const saved = store.get('rk_cust', {});
  const f = (n, l, ex = '') => `<label class="field"><span>${l}</span><input name="${n}" value="${esc(saved[n] || '')}" ${ex}></label>`;
  return `<div class="wrap"><div class="co"><form data-form="checkout"><h2>Delivery</h2>
    ${f('name', 'Full name', 'required autocomplete="name"')}${f('phone', 'Phone (WhatsApp preferred)', 'required inputmode="tel" autocomplete="tel"')}
    ${f('address', 'Address', 'required autocomplete="street-address"')}<div class="row2">${f('city', 'City', 'required')}${f('email', 'Email (optional)', 'type="email"')}</div>
    <label class="field"><span>Order notes (shirt length 36" or 46", colour, etc.)</span><textarea name="notes" rows="3"></textarea></label>
    <h2 style="margin-top:26px">Shipping method</h2><div class="box-note"><b>Standard delivery</b> — ${ship ? money(ship) : 'Free'}</div>
    <h2>Payment</h2><div class="box-note"><b>Cash on Delivery (COD)</b><br>You only pay after your parcel reaches your doorstep.</div>
    ${st.orderNotice ? `<p style="font-size:13px;color:var(--muted);margin-bottom:16px">${esc(st.orderNotice)}</p>` : ''}
    <div id="coerr" style="color:var(--red);font-size:13px;margin-bottom:10px"></div><button class="btn" type="submit" id="cobtn">Complete order</button></form>
    <aside class="sum">${ls.map((l) => `<div class="li"><img src="${esc(l.p.images[0] || '')}" alt=""><div>${esc(l.p.name)}<small style="display:block;color:var(--muted)">${esc(l.size)} × ${l.qty}</small></div><span>${money(l.p.price * l.qty)}</span></div>`).join('')}
    <div class="ln" style="margin-top:12px"><span>Subtotal</span><span>${money(sub)}</span></div><div class="ln"><span>Shipping</span><span>${ship ? money(ship) : 'Free'}</span></div><div class="ln t"><span>Total</span><span>${money(sub + ship)}</span></div></aside></div></div>`;
}
function thanksPage() {
  const o = store.get('rk_last', null);
  if (!o) return notFound();
  return `<div class="ok"><div class="tick">✓</div><h1>Thank you! Order #${esc(o.number)} received</h1>
  <p style="color:var(--muted);margin-bottom:6px">Total to pay on delivery: <b>${money(o.total)}</b></p>
  <p style="margin-bottom:26px">Tap below to send your order details on WhatsApp so we can confirm it quickly.</p>
  <a class="btn wa" href="${esc(o.whatsappUrl)}" target="_blank" rel="noopener">${I.wa} Send order on WhatsApp</a>
  <a class="btn ghost" style="margin-top:12px" href="#/">Continue shopping</a></div>`;
}

/* ---------- router ---------- */
function render() {
  if (!S) return;
  const h = location.hash || '#/'; const [, a, b] = h.split('/');
  let html;
  if (!a) html = home(); else if (a === 'collection') html = collectionPage(b); else if (a === 'all') html = collectionPage(null);
  else if (a === 'product') html = productPage(b); else if (a === 'checkout') html = checkoutPage(); else if (a === 'thanks') html = thanksPage();
  else if (a === 'contact') html = contactPage(); else if (a === 'wishlist') html = wishlistPage(); else if (a === 'page') html = policyPage(b); else html = notFound();
  $('#modal').innerHTML = '';
  const app = $('#app'); app.style.animation = 'none'; void app.offsetWidth; app.style.animation = ''; app.innerHTML = html;
  markNav(); observe();
}
let io;
function observe() {
  if (!('IntersectionObserver' in window)) { $$('.reveal').forEach((e) => e.classList.add('in')); return; }
  io && io.disconnect();
  io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  $$('.reveal').forEach((e) => io.observe(e));
}
window.addEventListener('hashchange', () => { closeLayers(); render(); window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); });

/* ---------- events ---------- */
function openQuick(id) {
  const p = prod(id); if (!p) return;
  $('#modal').innerHTML = `<div class="box"><button class="x" data-act="close" aria-label="Close">✕</button>${pdp(p)}</div>`;
  openLayer('modal');
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (e.target.id === 'overlay') return closeLayers();
  if (e.target.id === 'modal') return closeLayers();
  if (!t) return;
  const act = t.dataset.act; const root = t.closest('.pdp');
  if (act === 'close') { if (t.tagName === 'A') { closeLayers(); } else { e.preventDefault(); closeLayers(); } return; }
  if (act === 'menu') return openLayer('menu');
  if (act === 'cart') return openCart();
  if (act === 'search') { openSearch(); return; }
  if (act === 'wish') { e.preventDefault(); const id = t.dataset.id; wish = wish.includes(id) ? wish.filter((x) => x !== id) : [...wish, id]; store.set('rk_wish', wish); $$(`[data-act="wish"][data-id="${CSS.escape(id)}"]`).forEach((b) => b.classList.toggle('liked', wish.includes(id))); renderBadges(); toast(wish.includes(id) ? 'Saved to your wish list' : 'Removed from wish list'); if ((location.hash || '').startsWith('#/wishlist')) render(); return; }
  if (act === 'quick') { e.preventDefault(); return openQuick(t.dataset.id); }
  if (act === 'thumb') { $$('.thumbs button', root).forEach((b) => b.classList.remove('on')); t.classList.add('on'); $('.main img', root).src = t.dataset.src; return; }
  if (act === 'zoom') { t.classList.toggle('zoom'); return; }
  if (act === 'size') { $$('.chip', root).forEach((b) => b.classList.remove('on')); t.classList.add('on'); $('.szl', root).textContent = t.dataset.v; return; }
  if (act === 'pq') { const i = $('.qv', root); i.value = (parseInt(i.value, 10) || 1) + Number(t.dataset.d); pdpState(root); return; }
  if (act === 'add') { const s = pdpState(root); addToCart(s.id, s.size, s.qty); closeLayers(); openCart(); return; }
  if (act === 'buy') { const s = pdpState(root); addToCart(s.id, s.size, s.qty); closeLayers(); location.hash = '#/checkout'; return; }
  if (act === 'wa-prod') { const s = pdpState(root); window.open(waLink(`Hi! I want to order:\n${s.p.name}${s.size ? ' (Size ' + s.size + ')' : ''} x${s.qty}\nPrice: ${money(s.p.price * s.qty)}`), '_blank', 'noopener'); return; }
  if (act === 'sizeguide') { e.preventDefault(); $('#modal').innerHTML = `<div class="box" style="max-width:520px"><button class="x" data-act="close">✕</button><h2 class="h2" style="margin-bottom:18px">Size guide</h2><p style="white-space:pre-line;line-height:1.9">${esc(S.settings.sizeGuide)}</p></div>`; openLayer('modal'); return; }
  if (act === 'cq') { const l = cart.find((i) => i.id === t.dataset.id && i.size === t.dataset.size); const p = prod(t.dataset.id); if (l && p) { l.qty = Math.max(1, Math.min(p.stock > 0 ? p.stock : 99, l.qty + Number(t.dataset.d))); saveCart(); renderDrawer(); } return; }
  if (act === 'rm') { cart = cart.filter((i) => !(i.id === t.dataset.id && i.size === t.dataset.size)); saveCart(); renderDrawer(); if ((location.hash || '') === '#/checkout') render(); return; }
});
document.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('qv')) pdpState(e.target.closest('.pdp')); });
document.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.act === 'sort') { sortHow = e.target.value; render(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLayers(); });
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
  const d = Object.fromEntries(new FormData(f));
  if (f.dataset.form === 'contact') { window.open(waLink(`Hi, I am ${d.name}.\n${d.msg}`), '_blank', 'noopener'); return; }
  if (f.dataset.form === 'checkout') {
    const btn = $('#cobtn'); btn.disabled = true; btn.textContent = 'Placing order…'; $('#coerr').textContent = '';
    try {
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: d, items: cart.map((i) => ({ id: i.id, size: i.size, qty: i.qty })) }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not place the order');
      store.set('rk_cust', { name: d.name, phone: d.phone, address: d.address, city: d.city, email: d.email });
      store.set('rk_last', { number: j.order.number, total: j.order.total, whatsappUrl: j.whatsappUrl });
      cart = []; saveCart(); location.hash = '#/thanks';
    } catch (err) { $('#coerr').textContent = err.message; btn.disabled = false; btn.textContent = 'Complete order'; }
  }
});

/* ---------- search ---------- */
function openSearch() {
  $('#search').innerHTML = `<div class="in"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow" style="margin:0">Search</span><button data-act="close" aria-label="Close" style="font-size:20px">✕</button></div>
    <input id="q" placeholder="Search dresses…" autocomplete="off"><div class="sres" id="sres"></div></div>`;
  openLayer('search'); setTimeout(() => $('#q').focus(), 350);
  $('#q').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const r = q ? S.products.filter((p) => p.name.toLowerCase().includes(q) || (p.collections || []).some((c) => (col(c) || {}).name && col(c).name.toLowerCase().includes(q))).slice(0, 8) : [];
    $('#sres').innerHTML = q && !r.length ? '<div class="empty" style="padding:30px">No matches.</div>' : r.map((p) => `<a href="#/product/${esc(p.id)}" data-act="close"><img src="${esc(p.images[0] || '')}" alt=""><span>${esc(p.name)}</span><b>${money(p.price)}</b></a>`).join('');
  });
}

/* ---------- data + live updates ---------- */
async function load() {
  const r = await fetch('/api/site', { cache: 'no-store' }); S = await r.json();
}
let refT;
function liveRefresh() {
  clearTimeout(refT);
  refT = setTimeout(async () => {
    try {
      await load(); renderChrome();
      const h = location.hash || '';
      if (h !== '#/checkout' && !$('#modal').classList.contains('on')) { const y = window.scrollY; render(); window.scrollTo(0, y); $$('.reveal').forEach((x) => x.classList.add('in')); }
      if ($('#drawer').classList.contains('on')) renderDrawer();
    } catch {}
  }, 250);
}
(async function init() {
  try { await load(); } catch { $('#app').innerHTML = '<div class="empty">Could not load the store. Please refresh.</div>'; return; }
  renderChrome(); render();
  window.addEventListener('scroll', () => $('#nav').classList.toggle('stuck', window.scrollY > 140), { passive: true });
  if ('EventSource' in window) { const es = new EventSource('/api/events'); es.addEventListener('update', liveRefresh); }
})();
})();
