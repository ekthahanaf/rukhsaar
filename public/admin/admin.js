/* Rukhsaar Clothes - admin panel */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let D = null, tab = 'orders', defaultPw = false, es = null;
const seenOrders = new Set();
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { showLogin(); throw new Error('Please log in'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j;
}
const money = (n) => (D.settings.currency || 'Rs.') + ' ' + Number(n).toLocaleString('en-US');
const waTo = (phone, text) => {
  let n = String(phone).replace(/\D/g, ''); if (n.startsWith('0')) n = '92' + n.slice(1);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
};
async function upload(files) {
  const fd = new FormData(); [...files].forEach((f) => fd.append('files', f));
  const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Upload failed'); return j.urls;
}
function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.setValueAtTime(.2, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .6); o.start(); o.stop(c.currentTime + .6); } catch {} }

/* ---------- login ---------- */
function showLogin() {
  if (es) { es.close(); es = null; }
  $('#root').innerHTML = `<form class="login" id="lf"><h1>Rukhsaar Admin</h1><p>Log in to manage your store.</p>
  <label class="f"><span>Password</span><input type="password" id="pw" autofocus required></label><div id="le" style="color:var(--red);margin-bottom:10px"></div><button class="btn" style="width:100%">Log in</button></form>`;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    try { const j = await api('POST', '/api/admin/login', { password: $('#pw').value }); defaultPw = j.defaultPassword; await start(); }
    catch (err) { $('#le').textContent = err.message; }
  };
}

/* ---------- shell ---------- */
async function start() {
  D = await api('GET', '/api/admin/data');
  const me = await api('GET', '/api/admin/me'); defaultPw = me.defaultPassword;
  D.orders.forEach((o) => seenOrders.add(o.id));
  draw();
  if (es) es.close();
  es = new EventSource('/api/admin/events');
  es.addEventListener('order', async () => { await refresh(true); });
  es.addEventListener('update', () => refresh(false));
}
let refT;
function refresh(isOrder) {
  clearTimeout(refT);
  return new Promise((res) => { refT = setTimeout(async () => {
    try {
      const old = new Set(D.orders.map((o) => o.id));
      D = await api('GET', '/api/admin/data');
      const fresh = D.orders.filter((o) => !old.has(o.id) && !seenOrders.has(o.id));
      fresh.forEach((o) => seenOrders.add(o.id));
      if (fresh.length) { beep(); toast(`New order #${fresh[0].number} from ${fresh[0].customer.name}`); document.title = '(1) New order! - Admin'; }
      if (!$('.modal')) draw();
    } catch {} res();
  }, 200); });
}
const newCount = () => D.orders.filter((o) => o.status === 'new').length;
function draw() {
  const tabs = [['orders', 'Orders'], ['products', 'Products'], ['collections', 'Collections'], ['site', 'Banner & Site'], ['reviews', 'Reviews'], ['account', 'Account']];
  $('#root').innerHTML = `<div class="top"><b>Rukhsaar Admin</b><span class="sp"></span><a href="/" target="_blank">View website ↗</a><button id="lo">Log out</button></div>
  <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'orders' && newCount() ? `<span class="dot">${newCount()}</span>` : ''}</button>`).join('')}</div>
  <main>${defaultPw ? '<div class="warn"><b>Change your password.</b> You are still using the first password (admin123). Go to the Account tab.</div>' : ''}<div id="view"></div></main>`;
  $('#lo').onclick = async () => { await fetch('/api/admin/logout', { method: 'POST' }); showLogin(); };
  $$('.tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.tab; document.title = 'Admin - Rukhsaar Clothes'; draw(); });
  ({ orders: vOrders, products: vProducts, collections: vCollections, site: vSite, reviews: vReviews, account: vAccount })[tab]();
}

/* ---------- orders ---------- */
const STATUS = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
function vOrders() {
  const o = D.orders; const v = $('#view');
  v.innerHTML = `<div class="bar"><h2>Orders (${o.length})</h2><span class="sp"></span><small style="color:var(--mut)">New orders appear here instantly with a sound.</small></div>` + (o.length ? o.map((x) => {
    const c = x.customer; const when = new Date(x.createdAt).toLocaleString();
    const msg = `Hi ${c.name}, thank you for your order #${x.number} at Rukhsaar. Total ${money(x.total)} (cash on delivery). Please confirm your address: ${c.address}, ${c.city}.`;
    return `<div class="card order ${x.status}" data-id="${x.id}"><div class="row"><b>#${x.number}</b> <span class="tag ${x.status === 'new' ? 'red' : x.status === 'delivered' ? 'ok' : x.status === 'cancelled' ? 'gr' : ''}">${x.status}</span><span class="sp" style="flex:1"></span><small>${esc(when)}</small></div>
    <div class="items">${x.items.map((i) => `<div><img src="${esc(i.image)}" alt=""><span>${esc(i.name)} ${i.size ? '(' + esc(i.size) + ')' : ''} × ${i.qty}</span></div>`).join('')}</div>
    <p><b>${esc(c.name)}</b> · ${esc(c.phone)}${c.email ? ' · ' + esc(c.email) : ''}<br>${esc(c.address)}, ${esc(c.city)}${c.notes ? `<br><i>Note: ${esc(c.notes)}</i>` : ''}</p>
    <p>Subtotal ${money(x.subtotal)} + delivery ${money(x.shipping)} = <b>${money(x.total)}</b> (COD)</p>
    <div class="row" style="margin-top:10px;flex-wrap:wrap"><select data-st style="width:auto">${STATUS.map((s) => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <a class="btn w s" target="_blank" rel="noopener" href="${esc(waTo(c.phone, msg))}">WhatsApp customer</a><a class="btn g s" href="tel:${esc(c.phone)}">Call</a><button class="btn d s" data-del>Delete</button></div></div>`;
  }).join('') : '<div class="card">No orders yet. When a customer places an order it will show up here live.</div>');
  $$('[data-st]', v).forEach((s) => s.onchange = async () => { try { await api('PUT', '/api/admin/orders/' + s.closest('.card').dataset.id, { status: s.value }); toast('Status updated'); } catch (e) { toast(e.message); } });
  $$('[data-del]', v).forEach((b) => b.onclick = async () => { if (!confirm('Delete this order?')) return; await api('DELETE', '/api/admin/orders/' + b.closest('.card').dataset.id); });
}

/* ---------- products ---------- */
function vProducts() {
  const v = $('#view'); let q = '';
  const list = () => D.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  v.innerHTML = `<div class="bar"><h2>Products (${D.products.length})</h2><span class="sp"></span><input id="pq" placeholder="Search…" style="width:200px"><button class="btn" id="np">+ Add product</button></div><div class="plist" id="pl"></div>`;
  const fill = () => {
    $('#pl').innerHTML = list().map((p) => `<div class="item" data-id="${esc(p.id)}"><img src="${esc(p.images[0] || '')}" alt=""><div><b>${esc(p.name)}</b> ${p.hidden ? '<span class="tag gr">Hidden</span>' : ''}${p.isNew ? '<span class="tag">New</span>' : ''}${p.stock <= 0 ? '<span class="tag red">Sold out</span>' : ''}<br><small>${money(p.price)} · stock ${p.stock} · ${esc((p.collections || []).map((s) => (D.collections.find((c) => c.slug === s) || {}).name || s).join(', '))}</small></div>
      <div class="row"><button class="btn g s" data-edit>Edit</button><button class="btn d s" data-rm>Delete</button></div></div>`).join('') || '<div class="card">No products.</div>';
    $$('[data-edit]').forEach((b) => b.onclick = () => productForm(D.products.find((p) => p.id === b.closest('.item').dataset.id)));
    $$('[data-rm]').forEach((b) => b.onclick = async () => { const p = D.products.find((x) => x.id === b.closest('.item').dataset.id); if (confirm(`Delete "${p.name}"?`)) { await api('DELETE', '/api/admin/products/' + p.id); toast('Deleted'); } });
  };
  fill(); $('#pq').oninput = (e) => { q = e.target.value; fill(); }; $('#np').onclick = () => productForm(null);
}
function modal(html) { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="box">${html}</div>`; document.body.appendChild(m); m.addEventListener('mousedown', (e) => { if (e.target === m && !m.dataset.keep) m.remove(); }); return m; }
function imageList(m, imgs, sel) {
  const box = $(sel, m);
  const paint = () => {
    box.innerHTML = imgs.map((u, i) => `<div class="im"><img src="${esc(u)}" alt=""><div><button type="button" data-l="${i}">◀</button><button type="button" data-x="${i}">remove</button><button type="button" data-r="${i}">▶</button></div></div>`).join('') + `<label class="up">+ Upload<input type="file" accept="image/*" multiple hidden></label>`;
    $$('[data-x]', box).forEach((b) => b.onclick = () => { imgs.splice(+b.dataset.x, 1); paint(); });
    $$('[data-l]', box).forEach((b) => b.onclick = () => { const i = +b.dataset.l; if (i > 0) { [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]]; paint(); } });
    $$('[data-r]', box).forEach((b) => b.onclick = () => { const i = +b.dataset.r; if (i < imgs.length - 1) { [imgs[i + 1], imgs[i]] = [imgs[i], imgs[i + 1]]; paint(); } });
    $('input[type=file]', box).onchange = async (e) => { try { toast('Uploading…'); imgs.push(...await upload(e.target.files)); paint(); toast('Uploaded'); } catch (er) { toast(er.message); } };
  };
  paint();
}
function productForm(p) {
  const isNew = !p; p = p || { name: '', price: '', comparePrice: 0, stock: 10, description: '', images: [], sizes: ['XS', 'S', 'M', 'L', 'XL'], collections: [], isNew: true, hidden: false };
  const imgs = [...p.images]; const allSizes = ['XS', 'S', 'M', 'L', 'XL'];
  const extra = (p.sizes || []).filter((s) => !allSizes.includes(s)).join(', ');
  const m = modal(`<h2>${isNew ? 'Add product' : 'Edit product'}</h2><form id="pf">
  <label class="f"><span>Name</span><input name="name" value="${esc(p.name)}" required></label>
  <div class="grid3"><label class="f"><span>Price (Rs.)</span><input name="price" type="number" min="0" value="${esc(p.price)}" required></label>
  <label class="f"><span>Old price (optional, shows crossed out)</span><input name="comparePrice" type="number" min="0" value="${esc(p.comparePrice || 0)}"></label>
  <label class="f"><span>Stock</span><input name="stock" type="number" min="0" value="${esc(p.stock)}"></label></div>
  <label class="f"><span>Description</span><textarea name="description" rows="4">${esc(p.description)}</textarea></label>
  <div class="f"><span style="display:block;font-size:12px;color:var(--mut);font-weight:600;margin-bottom:6px">Photos (first photo is the main one)</span><div class="imgs" id="il"></div></div>
  <div class="f"><span style="display:block;font-size:12px;color:var(--mut);font-weight:600;margin-bottom:6px">Sizes</span>${allSizes.map((s) => `<label class="chk"><input type="checkbox" name="sz" value="${s}" ${(p.sizes || []).includes(s) ? 'checked' : ''}> ${s}</label>`).join('')}
  <input name="szx" placeholder="Other sizes, comma separated (optional)" value="${esc(extra)}" style="margin-top:6px"></div>
  <div class="f"><span style="display:block;font-size:12px;color:var(--mut);font-weight:600;margin-bottom:6px">Show in collections</span>${D.collections.map((c) => `<label class="chk"><input type="checkbox" name="col" value="${esc(c.slug)}" ${(p.collections || []).includes(c.slug) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div>
  <label class="chk"><input type="checkbox" name="isNew" ${p.isNew ? 'checked' : ''}> Show “New” tag</label><label class="chk"><input type="checkbox" name="hidden" ${p.hidden ? 'checked' : ''}> Hide from website</label>
  <div class="row" style="margin-top:16px"><button class="btn">Save</button><button type="button" class="btn g" id="cx">Cancel</button></div></form>`);
  imageList(m, imgs, '#il');
  $('#cx', m).onclick = () => m.remove();
  $('#pf', m).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; const fd = new FormData(f);
    const sizes = [...fd.getAll('sz'), ...String(fd.get('szx') || '').split(',').map((s) => s.trim()).filter(Boolean)];
    const body = { name: fd.get('name'), price: fd.get('price'), comparePrice: fd.get('comparePrice'), stock: fd.get('stock'), description: fd.get('description'), images: imgs, sizes, collections: fd.getAll('col'), isNew: f.isNew.checked, hidden: f.hidden.checked };
    try { await api(isNew ? 'POST' : 'PUT', '/api/admin/products' + (isNew ? '' : '/' + p.id), body); m.remove(); toast('Saved. The website is updated.'); } catch (er) { toast(er.message); }
  };
}

/* ---------- collections ---------- */
function vCollections() {
  const v = $('#view');
  v.innerHTML = `<div class="bar"><h2>Collections</h2><span class="sp"></span><button class="btn" id="nc">+ Add collection</button></div><p class="hint">These appear in the menu, the round “Shop by collection” tiles and as sections on the home page. Use ▲ ▼ to change their order.</p>` +
    D.collections.map((c, i) => `<div class="card row" data-id="${esc(c.id)}"><img src="${esc(c.image)}" style="width:50px;height:70px;object-fit:cover;border-radius:25px 25px 3px 3px;background:var(--soft)" alt=""><div style="flex:1"><b>${esc(c.name)}</b><br><small>${(D.products.filter((p) => (p.collections || []).includes(c.slug))).length} products ${c.showOnHome ? '· on home page' : ''} ${c.showInTiles ? '· in menu/tiles' : ''}</small></div>
    <button class="btn g s" data-up ${i === 0 ? 'disabled' : ''}>▲</button><button class="btn g s" data-dn ${i === D.collections.length - 1 ? 'disabled' : ''}>▼</button><button class="btn g s" data-edit>Edit</button><button class="btn d s" data-rm>Delete</button></div>`).join('');
  const move = async (id, d) => { const ids = D.collections.map((c) => c.id); const i = ids.indexOf(id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; await api('POST', '/api/admin/collections-order', { ids }); };
  $$('[data-up]').forEach((b) => b.onclick = () => move(b.closest('.card').dataset.id, -1));
  $$('[data-dn]').forEach((b) => b.onclick = () => move(b.closest('.card').dataset.id, 1));
  $$('[data-edit]').forEach((b) => b.onclick = () => colForm(D.collections.find((c) => c.id === b.closest('.card').dataset.id)));
  $$('[data-rm]').forEach((b) => b.onclick = async () => { const c = D.collections.find((x) => x.id === b.closest('.card').dataset.id); if (confirm(`Delete collection "${c.name}"? Products stay, only the collection is removed.`)) await api('DELETE', '/api/admin/collections/' + c.id); });
  $('#nc').onclick = () => colForm(null);
}
function colForm(c) {
  const isNew = !c; c = c || { name: '', tileLabel: '', image: '', showOnHome: true, showInTiles: true }; const img = [c.image].filter(Boolean);
  const m = modal(`<h2>${isNew ? 'Add collection' : 'Edit collection'}</h2><form id="cf"><div class="grid2"><label class="f"><span>Name</span><input name="name" value="${esc(c.name)}" required></label>
  <label class="f"><span>Short label under the tile</span><input name="tileLabel" value="${esc(c.tileLabel || '')}"></label></div>
  <div class="f"><span style="display:block;font-size:12px;color:var(--mut);font-weight:600;margin-bottom:6px">Tile photo (tall photo works best)</span><div class="imgs" id="il"></div></div>
  <label class="chk"><input type="checkbox" name="showOnHome" ${c.showOnHome ? 'checked' : ''}> Show section on home page</label><label class="chk"><input type="checkbox" name="showInTiles" ${c.showInTiles ? 'checked' : ''}> Show in menu and round tiles</label>
  <div class="row" style="margin-top:16px"><button class="btn">Save</button><button type="button" class="btn g" id="cx">Cancel</button></div></form>`);
  imageList(m, img, '#il');
  // only one image allowed
  const keepOne = new MutationObserver(() => { while (img.length > 1) img.shift(); }); keepOne.observe($('#il', m), { childList: true });
  $('#cx', m).onclick = () => m.remove();
  $('#cf', m).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const body = { name: f.name.value, tileLabel: f.tileLabel.value, image: img[img.length - 1] || '', showOnHome: f.showOnHome.checked, showInTiles: f.showInTiles.checked };
    try { await api(isNew ? 'POST' : 'PUT', '/api/admin/collections' + (isNew ? '' : '/' + c.id), body); m.remove(); toast('Saved'); } catch (er) { toast(er.message); }
  };
}

/* ---------- banner & site ---------- */
function vSite() {
  const s = D.settings; const v = $('#view');
  const hi = [0, 1, 2].map((i) => (s.heroImages || [])[i] || { img: '', link: '' });
  const hl = [0, 1, 2, 3].map((i) => (s.highlights || [])[i] || { title: '', sub: '' });
  v.innerHTML = `<form id="sf">
  <h3 class="sec">Home banner</h3>
  <div class="grid2"><label class="f"><span>Small line (e.g. Winter Collection 2026)</span><input name="heroEyebrow" value="${esc(s.heroEyebrow)}"></label><label class="f"><span>Big title</span><input name="heroTitle" value="${esc(s.heroTitle)}"></label></div>
  <label class="f"><span>Text under title</span><textarea name="heroText" rows="2">${esc(s.heroText)}</textarea></label>
  <div class="grid3"><label class="f"><span>Button text (empty = no button)</span><input name="heroButtonText" value="${esc(s.heroButtonText)}"></label><label class="f"><span>Button link</span><input name="heroButtonLink" value="${esc(s.heroButtonLink)}" placeholder="#/collection/winter"></label><label class="f"><span>Banner colour</span><input type="color" name="heroBg" value="${esc(s.heroBg || '#5b2a4b')}" style="height:38px;padding:2px"></label></div>
  <div class="f"><span style="display:block;font-size:12px;color:var(--mut);font-weight:600;margin-bottom:6px">Three banner photos (tall photos). Click a photo box to replace it.</span><div class="grid3" id="hi">${hi.map((h, i) => `<div class="card"><div class="imgs"><label class="up" style="width:100%;height:auto;min-height:130px;overflow:hidden;padding:0">${h.img ? `<img data-hp="${i}" src="${esc(h.img)}" style="width:100%;height:190px;object-fit:cover">` : '+ Upload'}<input type="file" accept="image/*" hidden data-hf="${i}"></label></div><label class="f" style="margin-top:8px"><span>Link when clicked</span><input data-hl="${i}" value="${esc(h.link || '')}" placeholder="#/collection/winter"></label></div>`).join('')}</div></div>
  <div class="f"><span style="display:block;font-size:12px;color:var(--mut);font-weight:600;margin-bottom:6px">Banner video (optional: replaces the 3 photos with a video background)</span>
    <div class="row"><input name="heroVideo" id="hv" value="${esc(s.heroVideo || '')}" placeholder="/uploads/… or paste a video link"><label class="btn g s" style="white-space:nowrap">Upload video<input type="file" accept="video/mp4,video/webm" hidden id="hvf"></label><button type="button" class="btn d s" id="hvc">Remove</button></div></div>
  <h3 class="sec">Top scrolling message bar</h3><label class="chk"><input type="checkbox" name="announcementOn" ${s.announcementOn ? 'checked' : ''}> Show message bar</label>
  <label class="f"><span>Messages (one per line)</span><textarea name="announcements" rows="4">${esc((s.announcements || []).join('\n'))}</textarea></label>
  <h3 class="sec">Orders &amp; WhatsApp</h3>
  <div class="grid3"><label class="f"><span>Your WhatsApp number (with country code, e.g. 923001234567)</span><input name="whatsapp" value="${esc(s.whatsapp)}"></label><label class="f"><span>Delivery charges (Rs.)</span><input type="number" min="0" name="shipping" value="${esc(s.shipping)}"></label><label class="f"><span>Free delivery above (Rs., 0 = never)</span><input type="number" min="0" name="freeShippingOver" value="${esc(s.freeShippingOver)}"></label></div>
  <label class="f"><span>Note shown on checkout</span><input name="orderNotice" value="${esc(s.orderNotice || '')}"></label>
  <h3 class="sec">Brand &amp; contact</h3>
  <div class="grid3"><label class="f"><span>Brand name</span><input name="brandName" value="${esc(s.brandName)}"></label><label class="f"><span>Small word under name</span><input name="brandSub" value="${esc(s.brandSub || '')}"></label><label class="f"><span>Tagline</span><input name="tagline" value="${esc(s.tagline || '')}"></label>
  <label class="f"><span>Phone</span><input name="phone" value="${esc(s.phone)}"></label><label class="f"><span>Email</span><input name="email" value="${esc(s.email)}"></label><label class="f"><span>Address</span><input name="address" value="${esc(s.address)}"></label></div>
  <div class="grid3"><label class="f"><span>Main colour</span><input type="color" name="colorPrimary" value="${esc(s.colorPrimary || '#5b2a4b')}" style="height:38px;padding:2px"></label><label class="f"><span>Soft colour (menu bar)</span><input type="color" name="colorSoft" value="${esc(s.colorSoft || '#f8e6e4')}" style="height:38px;padding:2px"></label><label class="f"><span>Sand colour (reviews)</span><input type="color" name="colorSand" value="${esc(s.colorSand || '#e8d8c6')}" style="height:38px;padding:2px"></label></div>
  <h3 class="sec">Four info points (under reviews)</h3>
  <div class="grid2">${hl.map((h, i) => `<div class="card"><label class="f"><span>Title</span><input data-ht="${i}" value="${esc(h.title)}"></label><label class="f" style="margin:0"><span>Sub text</span><input data-hs="${i}" value="${esc(h.sub)}"></label></div>`).join('')}</div>
  <h3 class="sec">Social links (leave empty to hide)</h3>
  <div class="grid2"><label class="f"><span>Facebook</span><input name="facebook" value="${esc((s.social || {}).facebook || '')}"></label><label class="f"><span>Instagram</span><input name="instagram" value="${esc((s.social || {}).instagram || '')}"></label><label class="f"><span>TikTok</span><input name="tiktok" value="${esc((s.social || {}).tiktok || '')}"></label><label class="f"><span>YouTube</span><input name="youtube" value="${esc((s.social || {}).youtube || '')}"></label></div>
  <h3 class="sec">Size guide text</h3><label class="f"><textarea name="sizeGuide" rows="3">${esc(s.sizeGuide || '')}</textarea></label>
  <button class="btn" style="padding:12px 30px">Save changes</button></form>`;
  const hiv = hi.map((h) => ({ ...h }));
  $$('[data-hf]').forEach((inp) => inp.onchange = async () => { try { toast('Uploading…'); const [u] = await upload(inp.files); hiv[+inp.dataset.hf].img = u; const lab = inp.closest('label'); lab.querySelector('img') ? (lab.querySelector('img').src = u) : (lab.insertAdjacentHTML('afterbegin', `<img src="${esc(u)}" style="width:100%;height:190px;object-fit:cover">`), lab.firstChild.nextSibling && lab.childNodes.forEach((n) => { if (n.nodeType === 3) n.remove(); })); toast('Uploaded. Press Save changes.'); } catch (e) { toast(e.message); } });
  $('#hvf').onchange = async (e) => { try { toast('Uploading video…'); const [u] = await upload(e.target.files); $('#hv').value = u; toast('Uploaded. Press Save changes.'); } catch (er) { toast(er.message); } };
  $('#hvc').onclick = () => { $('#hv').value = ''; };
  $('#sf').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const g = (n) => f[n].value;
    const body = {
      heroEyebrow: g('heroEyebrow'), heroTitle: g('heroTitle'), heroText: g('heroText'), heroButtonText: g('heroButtonText'), heroButtonLink: g('heroButtonLink'), heroBg: g('heroBg'), heroVideo: g('heroVideo').trim(),
      heroImages: hiv.map((h, i) => ({ img: h.img, link: $(`[data-hl="${i}"]`).value })),
      announcementOn: f.announcementOn.checked, announcements: g('announcements').split('\n').map((x) => x.trim()).filter(Boolean),
      whatsapp: g('whatsapp').replace(/[^\d]/g, ''), shipping: Number(g('shipping')) || 0, freeShippingOver: Number(g('freeShippingOver')) || 0, orderNotice: g('orderNotice'),
      brandName: g('brandName'), brandSub: g('brandSub'), tagline: g('tagline'), phone: g('phone'), email: g('email'), address: g('address'),
      colorPrimary: g('colorPrimary'), colorSoft: g('colorSoft'), colorSand: g('colorSand'),
      highlights: [0, 1, 2, 3].map((i) => ({ title: $(`[data-ht="${i}"]`).value, sub: $(`[data-hs="${i}"]`).value })),
      social: { facebook: g('facebook'), instagram: g('instagram'), tiktok: g('tiktok'), youtube: g('youtube') }, sizeGuide: g('sizeGuide'),
    };
    try { await api('PUT', '/api/admin/settings', body); toast('Saved. The website is updated.'); } catch (er) { toast(er.message); }
  };
}

/* ---------- reviews ---------- */
function vReviews() {
  const v = $('#view'); const t = D.testimonials;
  v.innerHTML = `<div class="bar"><h2>Customer reviews (“Kind words”)</h2><span class="sp"></span><button class="btn" id="nt">+ Add review</button></div><p class="hint">Only add real words from your customers. If there are no reviews, the section is hidden on the website.</p>` +
    t.map((x) => `<div class="card" data-id="${esc(x.id)}"><label class="f"><span>Review</span><textarea rows="2" data-tx>${esc(x.text)}</textarea></label><div class="row"><input data-au value="${esc(x.author)}" placeholder="Name e.g. RUKHSAAR CUSTOMER"><button class="btn s" data-save>Save</button><button class="btn d s" data-rm>Delete</button></div></div>`).join('');
  $$('[data-save]').forEach((b) => b.onclick = async () => { const c = b.closest('.card'); try { await api('PUT', '/api/admin/testimonials/' + c.dataset.id, { text: $('[data-tx]', c).value, author: $('[data-au]', c).value }); toast('Saved'); } catch (e) { toast(e.message); } });
  $$('[data-rm]').forEach((b) => b.onclick = async () => { if (confirm('Delete this review?')) await api('DELETE', '/api/admin/testimonials/' + b.closest('.card').dataset.id); });
  $('#nt').onclick = async () => { await api('POST', '/api/admin/testimonials', { text: 'New review text', author: 'RUKHSAAR CUSTOMER' }); };
}

/* ---------- account ---------- */
function vAccount() {
  $('#view').innerHTML = `<div class="card" style="max-width:420px"><h2 style="margin-bottom:12px">Change password</h2><form id="pw"><label class="f"><span>Current password</span><input type="password" name="c" required></label><label class="f"><span>New password (6+ characters)</span><input type="password" name="n" minlength="6" required></label><button class="btn">Change password</button></form></div>`;
  $('#pw').onsubmit = async (e) => { e.preventDefault(); try { await api('POST', '/api/admin/password', { current: e.target.c.value, next: e.target.n.value }); defaultPw = false; toast('Password changed'); draw(); } catch (er) { toast(er.message); } };
}

/* ---------- boot ---------- */
(async () => { try { await start(); } catch { showLogin(); } })();
})();
