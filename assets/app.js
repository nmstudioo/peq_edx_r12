(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const { profiles: ALL, raw: RAW } = window.PEQ_DATA;
const DEV = {
  '711':  { name: 'KZ EDX Pro', rig: 'IEC 711 coupler', icon: 'iem' },
  '5128': { name: 'KZ EDX Pro', rig: 'B&K 5128 fixture', icon: 'iem' },
  spk:    { name: 'Redmi 12', rig: 'Internal speaker', icon: 'ph' }
};
const PAL = ['#4fd8ff', '#d86bff', '#ffb454', '#7be495', '#ff6b8b', '#9aa7ff'];
const FS = 48000, X0 = 20, X1 = 20000;
const S = { dev: '711', id: null, cmp: false, sel: new Set(), lay: { raw: true, res: true, corr: false }, view: 'chart', hl: -1 };
const by = id => ALL.find(p => p.id === id);
const fmtF = f => f >= 1000 ? +(f / 1000).toFixed(2) + ' kHz' : Math.round(f) + ' Hz';
const sg = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

/* ---------- DSP: RBJ biquads at 48 kHz, summed ---------- */
function coef(t, fc, g, q) {
  const w = 2 * Math.PI * fc / FS, c = Math.cos(w), s = Math.sin(w), A = 10 ** (g / 40), al = s / (2 * q), r = 2 * Math.sqrt(A) * al;
  let b0, b1, b2, a0, a1, a2;
  if (t === 'PK') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  else if (t[0] === 'L') { b0 = A * ((A + 1) - (A - 1) * c + r); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - r); a0 = (A + 1) + (A - 1) * c + r; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - r; }
  else { b0 = A * ((A + 1) + (A - 1) * c + r); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - r); a0 = (A + 1) - (A - 1) * c + r; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - r; }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
const cache = new WeakMap();
function corrAt(p, f) {
  let cs = cache.get(p); if (!cs) cache.set(p, cs = p.f.map(([t, fc, g, q]) => coef(t, fc, g, q)));
  const w = 2 * Math.PI * f / FS, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  let db = 0;
  for (const [b0, b1, b2, a1, a2] of cs) {
    const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2), dr = 1 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
    db += 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  }
  return db;
}
function rawAt(dev, f) {
  const r = RAW[dev], n = r.length;
  if (f <= r[0][0]) return r[0][1]; if (f >= r[n - 1][0]) return r[n - 1][1];
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; r[m][0] <= f ? lo = m : hi = m; }
  const t = Math.log(f / r[lo][0]) / Math.log(r[hi][0] / r[lo][0]); return r[lo][1] + (r[hi][1] - r[lo][1]) * t;
}
const grid = (n => Array.from({ length: n }, (_, i) => X0 * 1000 ** (i / (n - 1))))(260);
const curves = (p) => ({ raw: grid.map(f => [f, rawAt(p.dev, f)]), corr: grid.map(f => [f, corrAt(p, f)]), res: grid.map(f => [f, rawAt(p.dev, f) + corrAt(p, f)]) });
function stats(p) {
  const c = grid.map(f => [f, corrAt(p, f)]); let mx = c[0], mn = c[0];
  c.forEach(q => { if (q[1] > mx[1]) mx = q; if (q[1] < mn[1]) mn = q; });
  return { mx, mn };
}

/* ---------- chart ---------- */
const BANDS = [[20, 250, 'Bass'], [250, 2000, 'Mids'], [2000, 6000, 'Presence'], [6000, 20000, 'Treble']];
function drawChart(host, o) {
  const W = Math.max(300, host.clientWidth - 12), H = Math.round(Math.max(250, Math.min(420, W * .48))), m = { l: 38, r: 12, t: 12, b: 30 };
  let lo = 1e9, hi = -1e9; o.series.forEach(s => s.pts.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }));
  const st = hi - lo > 30 ? 10 : hi - lo > 16 ? 5 : 3, y0 = Math.floor((lo - 1) / st) * st, y1 = Math.ceil((hi + 1) / st) * st, L = Math.log10;
  const X = v => m.l + (L(v) - L(X0)) / (L(X1) - L(X0)) * (W - m.l - m.r), Y = v => m.t + (y1 - v) / (y1 - y0) * (H - m.t - m.b);
  host._s = { X, Y, W, m }; host._o = o;
  let g = '';
  BANDS.forEach((b, i) => { if (i % 2 === 0) g += `<rect x="${X(b[0])}" y="${m.t}" width="${X(b[1]) - X(b[0])}" height="${H - m.t - m.b}" fill="var(--tx)" opacity=".025"/>`; g += `<text class="band" x="${(X(b[0]) + X(b[1])) / 2}" y="${m.t + 14}" text-anchor="middle">${b[2]}</text>`; });
  for (let v = y0; v <= y1; v += st) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? 'var(--line2)' : 'var(--line)'}" ${v ? 'stroke-dasharray="2 5"' : ''}/><text x="${m.l - 7}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  [20, 50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4].forEach(v => g += `<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--line)" opacity=".6"/><text x="${X(v)}" y="${H - 9}" text-anchor="middle">${v >= 1e3 ? v / 1e3 + 'k' : v}</text>`);
  const gid = 'a' + Math.random().toString(36).slice(2, 7); let defs = '';
  o.series.forEach((s, i) => {
    const d = s.pts.map((p, j) => (j ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
    if (s.fill) { defs += `<linearGradient id="${gid}${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".28"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`; g += `<path d="${d}L${X(X1)} ${Y(y0)}L${X(X0)} ${Y(y0)}Z" fill="url(#${gid}${i})" ${o.anim ? 'class="swap"' : ''}/>`; }
    g += `<path class="ln ${o.anim && s.main ? 'draw' : ''}" style="--L:1" d="${d}" stroke="${s.color}" stroke-width="${s.w || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} ${s.op ? `opacity="${s.op}"` : ''} ${s.main && o.anim ? `pathLength="1"` : ''}/>`;
  });
  (o.marks || []).forEach((k, i) => { const y = Y(k.y); g += `<g class="mk" data-i="${i}" tabindex="-1"><line x1="${X(k.fc)}" x2="${X(k.fc)}" y1="${Y(0)}" y2="${y}" stroke="${k.col}" opacity=".35"/><circle cx="${X(k.fc)}" cy="${y}" r="${S.hl === i ? 10 : 8}" fill="${k.col}" stroke="var(--bg)" stroke-width="2"/><text x="${X(k.fc)}" y="${y + 3.6}" text-anchor="middle" style="fill:var(--on);font-weight:600;font-size:10px">${i + 1}</text></g>`; });
  g += `<line id="cur" y1="${m.t}" y2="${H - m.b}" stroke="var(--tx)" opacity=".4" style="display:none"/><g id="dots"></g>`;
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label}"><defs>${defs}</defs>${g}<rect id="hit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/></svg><div class="tip"></div>`;
}
function hover(host, clientX) {
  const s = host._s, o = host._o, sv = $('svg', host); if (!s || !sv) return;
  const r = sv.getBoundingClientRect(), x = (clientX - r.left) * s.W / r.width;
  const t = Math.min(1, Math.max(0, (x - s.m.l) / (s.W - s.m.l - s.m.r))), f = X0 * 1000 ** t, tip = $('.tip', host);
  let rows = '', dots = '';
  o.series.forEach(se => { if (se.notip) return; let v = null; const p = se.pts; for (let i = 1; i < p.length; i++) if (p[i][0] >= f) { const a = p[i - 1], b = p[i], u = (f - a[0]) / (b[0] - a[0]); v = a[1] + (b[1] - a[1]) * u; break; } if (v == null) return;
    rows += `<div><span><i style="--c:${se.color}"></i>${se.label}</span><em>${sg(v)} dB</em></div>`; dots += `<circle cx="${s.X(f)}" cy="${s.Y(v)}" r="4.5" fill="${se.color}" stroke="var(--bg)" stroke-width="2"/>`; });
  tip.innerHTML = `<b>${fmtF(f)}</b>${rows}`; tip.style.display = 'block';
  const w = tip.offsetWidth, px = s.X(f) * r.width / s.W; tip.style.left = Math.min(Math.max(4, px - w / 2), host.clientWidth - w - 4) + 'px'; tip.style.top = '30px';
  const c = $('#cur', host); c.setAttribute('x1', s.X(f)); c.setAttribute('x2', s.X(f)); c.style.display = ''; $('#dots', host).innerHTML = dots;
}
function wireChart(host) {
  const hide = () => { const t = $('.tip', host), c = $('#cur', host); if (t) t.style.display = 'none'; if (c) c.style.display = 'none'; const d = $('#dots', host); if (d) d.innerHTML = ''; };
  host.addEventListener('pointermove', e => hover(host, e.clientX));
  host.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') hover(host, e.clientX); });
  host.addEventListener('pointerleave', hide);
  host.addEventListener('click', e => { const k = e.target.closest('.mk'); if (k) { S.hl = S.hl === +k.dataset.i ? -1 : +k.dataset.i; syncHl(); } });
  let w = host.clientWidth; new ResizeObserver(() => { const n = host.clientWidth; if (host._o && n && n !== w) { w = n; host._o.anim = false; drawChart(host, host._o); } }).observe(host);
}
function syncHl() { $$('#ftb tr').forEach((r, i) => r.classList.toggle('hl', i === S.hl)); const h = $('#chart'); if (h && h._o) { h._o.anim = false; drawChart(h, h._o); } }

/* ---------- views ---------- */
const spark = p => { const pts = grid.filter((_, i) => i % 5 === 0).map(f => [f, corrAt(p, f)]); const lo = -10, hi = 8, W = 84, H = 32, L = Math.log10;
  return `<svg class="sp" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${pts.map((q, i) => (i ? 'L' : 'M') + ((L(q[0]) - L(X0)) / 3 * W).toFixed(1) + ' ' + (2 + (hi - Math.max(lo, Math.min(hi, q[1]))) / (hi - lo) * (H - 4)).toFixed(1)).join('')}"/></svg>`; };
const col = p => PAL[ALL.indexOf(p) % PAL.length];
function renderDevs() {
  $('#devs').innerHTML = Object.entries(DEV).map(([k, d]) => `<button class="dev" role="tab" type="button" data-d="${k}" aria-selected="${k === S.dev}">${ic(d.icon)}<span><b>${d.name}</b><small>${d.rig}</small></span><span class="n">${ALL.filter(p => p.dev === k).length}</span></button>`).join('');
}
function renderList() {
  const ps = ALL.filter(p => p.dev === S.dev);
  $('#list').innerHTML = ps.map((p, i) => { const c = S.cmp ? PAL[i % PAL.length] : 'var(--acc)', cur = p.id === S.id;
    return `<li><button class="item${S.cmp && S.sel.has(p.id) ? ' on' : ''}" type="button" data-id="${p.id}" style="--sw:${c}" ${cur ? 'aria-current="true"' : ''}><b>${p.name}</b><small>${p.f.length} bands · ${sg(p.pre)} dB</small>${spark(p)}<span class="tick">${ic('ok')}</span></button></li>`; }).join('');
}
function renderDetail(anim = true) {
  const p = by(S.id), d = $('#detail'), st = stats(p), cv = curves(p);
  d.innerHTML = `<div class="${anim ? 'swap' : ''}">
  <div class="d-head"><div><h2>${p.name}</h2><p>${p.tag}</p><div class="chips"><span class="chip">${DEV[p.dev].name}</span><span class="chip">${DEV[p.dev].rig}</span><span class="chip">${p.f.length} filters</span></div></div>
  <div class="acts"><button class="btn pri" id="cp" type="button">${ic('copy')}<span>Copy preset</span></button><button class="btn" id="dl" type="button">${ic('dl')}<span>.txt</span></button></div></div>
  <dl class="stats"><div><dt>Preamp</dt><dd>${sg(p.pre)}<small>dB</small></dd></div><div><dt>Filters</dt><dd>${p.f.length}</dd></div><div><dt>Biggest lift</dt><dd class="liftv">${st.mx[1] < .3 ? 'None' : sg(st.mx[1]) + `<small>${fmtF(st.mx[0])}</small>`}</dd></div><div><dt>Deepest cut</dt><dd class="cutv">${sg(st.mn[1])}<small>${fmtF(st.mn[0])}</small></dd></div></dl>
  <div class="tools"><div class="seg" id="view" role="group" aria-label="View"><button type="button" data-v="chart" aria-pressed="${S.view === 'chart'}">Interactive</button><button type="button" data-v="img" aria-pressed="${S.view === 'img'}">Reference graph</button></div>
  <div class="lay" id="lay" ${S.view === 'img' ? 'hidden' : ''}>${[['raw', 'Measured', 'var(--mut)', 1], ['res', 'With EQ', 'var(--acc)', 0], ['corr', 'Filters only', 'var(--mg)', 0]].map(([k, l, c, dd]) => `<button type="button" data-l="${k}" aria-pressed="${S.lay[k]}"><i class="${dd ? 'd' : ''}" style="--c:${c}"></i>${l}</button>`).join('')}</div></div>
  ${S.view === 'chart' ? '<div class="chart" id="chart" tabindex="0"></div>' : `<button class="shot" type="button" data-zoom="${p.img}" aria-label="Open graph full size"><img src="assets/img/${p.img}.webp" alt="Frequency response of ${p.name} on ${DEV[p.dev].rig}" width="1600" height="933"><span class="zoom">${ic('max')}Enlarge</span></button>`}
  <p class="foot">${S.view === 'chart' ? 'Predicted: measured response plus the summed filters, preamp excluded. Tap a numbered marker to highlight its row.' : 'Original plot from the profile pack.'}</p>
  <div class="ft"><h3>Filters</h3><div class="tw"><table><thead><tr><th>#</th><th>Type</th><th>Frequency</th><th>Gain</th><th>Q</th></tr></thead><tbody id="ftb">${p.f.map(([t, fc, g, q], i) => { const w = Math.min(50, Math.abs(g) / 12 * 50); return `<tr data-i="${i}"><td>${String(i + 1).padStart(2, '0')}</td><td><span class="ty">${t}</span></td><td>${fmtF(fc)}</td><td><div class="gb"><span><i class="${g < 0 ? 'n' : 'p'}" style="width:${w}%"></i></span><em>${sg(g)}</em></div></td><td>${q.toFixed(2)}</td></tr>`; }).join('')}</tbody></table></div></div></div>`;
  const host = $('#chart'); if (host) { wireChart(host); paint(host, p, cv, anim); }
}
function paint(host, p, cv, anim) {
  const L = S.lay, series = [];
  if (S.cmp && S.sel.size > 1) {
    const ps = ALL.filter(q => q.dev === S.dev); if (L.raw) series.push({ label: 'Measured', color: 'var(--mut)', dash: '5 5', w: 1.6, pts: cv.raw });
    ps.filter(q => S.sel.has(q.id)).forEach(q => series.push({ label: q.name, color: PAL[ps.indexOf(q) % PAL.length], w: q.id === p.id ? 3 : 2, main: q.id === p.id, pts: curves(q)[L.corr ? 'corr' : 'res'] }));
  } else {
    if (L.raw) series.push({ label: 'Measured', color: 'var(--mut)', dash: '5 5', w: 1.6, pts: cv.raw });
    if (L.corr) series.push({ label: 'Filters', color: 'var(--mg)', w: 2, pts: cv.corr, main: !L.res });
    if (L.res) series.push({ label: 'With EQ', color: 'var(--acc)', w: 3, fill: true, main: true, pts: cv.res });
  }
  if (!series.length) { host.innerHTML = '<p class="foot" style="padding:90px 0;text-align:center">Every layer is hidden. Turn one back on above.</p>'; return; }
  const top = L.res ? cv.res : L.corr ? cv.corr : cv.raw;
  const marks = (!S.cmp || S.sel.size < 2) ? p.f.map(([t, fc, g]) => ({ fc, y: (top.find(q => q[0] >= fc) || top[top.length - 1])[1], col: g < 0 ? 'var(--cut)' : 'var(--lift)' })) : [];
  drawChart(host, { series, marks, anim, label: `Predicted frequency response for ${p.name}` });
}
/* ---------- actions ---------- */
const presetText = p => ['Preamp: ' + p.pre.toFixed(1) + ' dB', ...p.f.map(([t, fc, g, q], i) => `Filter ${i + 1}: ON ${t} Fc ${fc} Hz Gain ${g.toFixed(1)} dB Q ${q.toFixed(2)}`)].join('\n') + '\n';
let tt; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2200); };
function flash(btn, txt) { const sp = $('span', btn), u = $('use', btn), o = [sp.textContent, u.getAttribute('href')]; sp.textContent = txt; u.setAttribute('href', '#i-ok'); btn.classList.add('done'); clearTimeout(btn._t); btn._t = setTimeout(() => { sp.textContent = o[0]; u.setAttribute('href', o[1]); btn.classList.remove('done'); }, 1800); }
async function copy(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (x) {} a.remove(); return ok; } }

document.addEventListener('click', async e => {
  const t = e.target;
  let b;
  if (b = t.closest('.dev')) { S.dev = b.dataset.d; const f = ALL.find(p => p.dev === S.dev); S.id = f.id; S.sel = new Set([f.id]); history.replaceState(null, '', '#' + S.id); renderDevs(); renderList(); renderDetail(); return; }
  if (b = t.closest('.item')) { const id = b.dataset.id; if (S.cmp) { S.sel.has(id) && S.sel.size > 1 ? S.sel.delete(id) : S.sel.add(id); if (S.sel.has(id)) S.id = id; else S.id = [...S.sel][0]; } else { S.id = id; S.sel = new Set([id]); } history.replaceState(null, '', '#' + S.id); renderList(); renderDetail(!S.cmp); return; }
  if (b = t.closest('#cp')) { const ok = await copy(presetText(by(S.id))); ok ? (flash(b, 'Copied'), toast('Preset copied. Paste it into Poweramp.')) : toast('Copy failed — use the .txt download.'); return; }
  if (b = t.closest('#dl')) { const p = by(S.id), u = URL.createObjectURL(new Blob([presetText(p)], { type: 'text/plain' })), a = Object.assign(document.createElement('a'), { href: u, download: `${p.id}.txt` }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8e3); flash(b, 'Saved'); return; }
  if (b = t.closest('#view button')) { S.view = b.dataset.v; renderDetail(false); return; }
  if (b = t.closest('#lay button')) { const k = b.dataset.l; S.lay[k] = !S.lay[k]; b.setAttribute('aria-pressed', S.lay[k]); const h = $('#chart'), p = by(S.id); paint(h, p, curves(p), false); return; }
  if (b = t.closest('#ftb tr')) { S.hl = S.hl === +b.dataset.i ? -1 : +b.dataset.i; syncHl(); return; }
  if (b = t.closest('[data-zoom]')) { const d = $('#lb'); $('img', d).src = `assets/img/${b.dataset.zoom}.webp`; d.showModal(); return; }
  if (t.closest('#lb .close') || t === $('#lb')) $('#lb').close();
});
$('#cmpOn').addEventListener('change', e => { S.cmp = e.target.checked; document.body.classList.toggle('comparing', S.cmp); if (S.cmp) S.sel = new Set([S.id]); renderList(); renderDetail(false); if (S.cmp) toast('Tap profiles to overlay them.'); });
$('#theme').addEventListener('click', () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('peq-theme', n); } catch (e) {} const m = $('meta[name=theme-color]'); if (m) m.content = n === 'dark' ? '#0b0d12' : '#f4f5f8'; });
$('#list').addEventListener('keydown', e => { if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return; const it = $$('.item'), i = it.indexOf(document.activeElement); if (i < 0) return; e.preventDefault(); it[Math.max(0, Math.min(it.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus(); });
addEventListener('scroll', () => $('.bar').classList.toggle('stuck', scrollY > 8), { passive: true });
addEventListener('hashchange', () => { const p = by(location.hash.slice(1)); if (p && p.id !== S.id) { S.dev = p.dev; S.id = p.id; S.sel = new Set([p.id]); renderDevs(); renderList(); renderDetail(); } });

/* ---------- boot ---------- */
const h = by(location.hash.slice(1)); const first = h || ALL[0];
S.dev = first.dev; S.id = first.id; S.sel = new Set([first.id]);
renderDevs(); renderList(); renderDetail(true);
})();
