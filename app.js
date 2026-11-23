/* GConf Events Atlas */
const D = window.ATLASDATA || {events:[], updated:'', eurRates:{}, eurRatesNote:''};
const CFG = Object.assign({alertsEnabled:false, supabaseUrl:'', subscribeFn:'', viewsEnabled:false, viewsFn:'', claimEmail:'', cartoKey:''}, window.ATLASCONFIG||{});
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CAT_CONF = {ai:'AI', tech:'Tech', crypto:'Crypto / Web3', education:'Education'};
const CAT_FEST = {music:'Music', arts:'Arts', film:'Film', food:'Food', culture:'Culture', other:'Other'};
const CAT = Object.assign({}, CAT_CONF, CAT_FEST);
const TODAY = new Date(); TODAY.setHours(0,0,0,0);

function parseDay(s){
  if(!s) return null;
  const m = String(s).slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  return new Date(+m[1], +m[2]-1, +m[3]);
}
function fmtDay(s){
  const d = parseDay(s);
  if(!d) return '';
  return d.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
}
function fmtRange(a,b){
  const A = parseDay(a), B = parseDay(b);
  if(!A && !B) return 'Dates TBA';
  if(A && B && A.getTime()===B.getTime()) return fmtDay(a);
  if(A && B && A.getMonth()===B.getMonth() && A.getFullYear()===B.getFullYear()){
    return A.getDate() + '–' + fmtDay(b);
  }
  if(A && B) return fmtDay(a) + ' – ' + fmtDay(b);
  return fmtDay(a||b);
}
function isPostponed(e){
  return String(e && e.status || '').trim().toLowerCase() === 'postponed';
}
function datesTba(e){
  if(isPostponed(e)) return false;
  const status = String(e && e.status || '').trim().toLowerCase();
  if(status === 'dates tba' || status === 'dates tbc') return true;
  return !parseDay(e && e.start_date) && !parseDay(e && e.end_date);
}
function hasDates(e){
  if(isPostponed(e) || datesTba(e)) return false;
  return !!(parseDay(e && e.start_date) || parseDay(e && e.end_date));
}
function fmtEventDates(e){
  if(isPostponed(e)) return 'Postponed';
  return datesTba(e) ? 'Dates TBA' : fmtRange(e.start_date, e.end_date);
}
function statusBadge(e){
  if(isPostponed(e)) return `<span class="tag postponed">Postponed</span>`;
  if(datesTba(e)) return `<span class="tag tba">Dates TBA</span>`;
  return '';
}
function fmtPrice(e){
  if(e.ticket_price_text) return e.ticket_price_text;
  return 'Price not published';
}
function hasPrice(e){ return !!(e.has_price || e.ticket_price_min!=null || e.ticket_price_max!=null || (e.ticket_price_text && !/unknown|not published|tbc|tba|on request/i.test(e.ticket_price_text))); }
function pillText(e){
  if(!hasPrice(e)) return 'TBA';
  const t = fmtPrice(e).replace(/\s+/g,' ').trim();
  if(/^(free|gratis)$/i.test(t) || /^free\b/i.test(t)) return 'Free';
  const m = t.match(/(?:from\s+)?(?:[€$£]|EUR|USD|GBP|CHF|AED|Dhs)\s?[\d.,]+(?:\s?[–-]\s?(?:[€$£]|EUR|USD|GBP|CHF|AED|Dhs)?\s?[\d.,]+)?/i);
  if(m){ const s=m[0].replace(/\s+/g,' '); return s.length>18?s.slice(0,16)+'…':s; }
  if(/^[€$£]\s?\d/.test(t) && t.length<=18) return t;
  return 'Priced';
}
function hasPin(e){ return e.lat!=null && e.lng!=null; }
function isApprox(e){ return hasPin(e) && e.precise!==true; }
function where(e){ return [e.venue, [e.city, e.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '); }
function evKind(e){ return e && e.kind==='festival' ? 'festival' : 'conference'; }
function evRegion(e){
  const r = String((e && e.region) || '').toLowerCase().trim();
  return r || 'europe';
}
function regionLabel(r){
  const known = {europe:'Europe', uae:'UAE', gulf:'Gulf', north_america:'North America'};
  if(known[r]) return known[r];
  return String(r||'').split(/[_-]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(' ') || r;
}
function regionList(){
  const counts = new Map();
  EV.forEach(e => {
    const r = evRegion(e);
    if(r) counts.set(r, (counts.get(r)||0)+1);
  });
  const fromData = (D.regions||[]).filter(r => counts.has(r));
  const preferred = ['europe','uae','gulf','north_america'];
  const ordered = [];
  preferred.forEach(r => { if(counts.has(r)) ordered.push(r); });
  fromData.forEach(r => { if(!ordered.includes(r)) ordered.push(r); });
  [...counts.keys()].filter(r => !ordered.includes(r))
    .sort((a,b)=>regionLabel(a).localeCompare(regionLabel(b)))
    .forEach(r => ordered.push(r));
  return ordered;
}
function isKnownRegion(r){
  return r==='all' || regionList().includes(r);
}
function catLabel(e){ return CAT[e.category] || (e.category ? e.category.charAt(0).toUpperCase()+e.category.slice(1) : 'Event'); }
function catDict(kind){ return (kind||st.kind)==='festival' ? CAT_FEST : CAT_CONF; }
function catKeys(kind){
  kind = kind||st.kind;
  const d = catDict(kind);
  const present = new Set(EV.filter(e => evKind(e)===kind).map(e => e.category));
  const keys = Object.keys(d).filter(k => !present.size || present.has(k));
  present.forEach(k => { if(!keys.includes(k)) keys.push(k); });
  return keys;
}

const EV = (D.events||[]).slice();

/* ---------- theme + flags ---------- */
const THEME_KEY = 'gconf-atlas-theme';
const BASE_KEY = 'gconf-atlas-basemap';
function currentTheme(){
  return document.documentElement.getAttribute('data-theme')==='dark' ? 'dark' : 'light';
}
const ISO = {
  Austria:'AT', Belgium:'BE', 'Czech Republic':'CZ', Czechia:'CZ', Estonia:'EE',
  France:'FR', Germany:'DE', Greece:'GR', Italy:'IT', Latvia:'LV',
  Luxembourg:'LU', Malta:'MT', Netherlands:'NL', 'The Netherlands':'NL',
  Portugal:'PT', Spain:'ES', Switzerland:'CH', 'United Kingdom':'GB', UK:'GB',
  'Great Britain':'GB', Ireland:'IE', Sweden:'SE', Norway:'NO', Denmark:'DK',
  Finland:'FI', Poland:'PL', Hungary:'HU', Romania:'RO', Slovakia:'SK',
  Slovenia:'SI', Croatia:'HR', Bulgaria:'BG', Lithuania:'LT', Iceland:'IS',
  Serbia:'RS', 'United Arab Emirates':'AE', UAE:'AE'
};
function flagOf(country){
  const iso = ISO[country];
  if(!iso) return '';
  return String.fromCodePoint(...[...iso].map(c => 127397 + c.charCodeAt(0)));
}

/* ---------- map ---------- */
const map = L.map('map', {zoomControl:false, minZoom:3, maxZoom:18, worldCopyJump:true}).setView([50.2, 8.5], 4);
L.control.zoom({position:'bottomleft'}).addTo(map);

const CARTO_KEY = String(CFG.cartoKey||'').trim();
const attrCarto = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const attrEsri = 'Tiles &copy; Esri — Esri, TomTom, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors';
const attrEsriImg = 'Tiles &copy; Esri — Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const attrOfm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://openfreemap.org/">OpenFreeMap</a>, <a href="https://openmaptiles.org/">OpenMapTiles</a>';
const attrOtm = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';
const esri = (p,o) => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/'+p+'/MapServer/tile/{z}/{y}/{x}', Object.assign({maxZoom:19, attribution:attrEsri}, o||{}));

const BASEMAPS = {
  voyager: {label:'Voyager', group:'primary', kind:'carto', style:'voyager-gl-style', tone:'light', attr:attrCarto, fallback:'topo', swatch:'#d6e0d8'},
  positron: {label:'Positron', group:'primary', kind:'carto', style:'positron-gl-style', tone:'light', attr:attrCarto, fallback:'lightgray', swatch:'#e8e8e8'},
  darkmatter: {label:'Dark Matter', group:'primary', kind:'carto', style:'dark-matter-gl-style', tone:'dark', attr:attrCarto, fallback:'darkgray', swatch:'#0A0E12'},
  satellite: {label:'Satellite', group:'more', kind:'esri', service:'World_Imagery', tone:'satellite', attr:attrEsriImg, swatch:'#1a3a4a'},
  esri_topo: {label:'Esri Topo', group:'more', kind:'esri', service:'World_Topo_Map', tone:'light', attr:attrEsri, swatch:'#c9d9b8'},
  esri_lightgray: {label:'Light Gray', group:'more', kind:'esri', service:'Canvas/World_Light_Gray_Base', ref:'Canvas/World_Light_Gray_Reference', tone:'light', attr:attrEsri, swatch:'#d8d8d8'},
  esri_darkgray: {label:'Dark Gray', group:'more', kind:'esri', service:'Canvas/World_Dark_Gray_Base', ref:'Canvas/World_Dark_Gray_Reference', tone:'dark', attr:attrEsri, swatch:'#2a2a2a'},
  voyager_nolabels: {label:'Voyager (no labels)', group:'more', kind:'carto', style:'voyager-nolabels-gl-style', tone:'light', attr:attrCarto, fallback:'topo', swatch:'#c9d6c4'},
  darkmatter_nolabels: {label:'Dark Matter (no labels)', group:'more', kind:'carto', style:'dark-matter-nolabels-gl-style', tone:'dark', attr:attrCarto, fallback:'darkgray', swatch:'#11161c'},
  ofm_liberty: {label:'Liberty', group:'more', kind:'ofm', style:'liberty', tone:'light', attr:attrOfm, fallback:'topo', swatch:'#f4efe6'},
  ofm_bright: {label:'Bright', group:'more', kind:'ofm', style:'bright', tone:'light', attr:attrOfm, fallback:'topo', swatch:'#f7f4ee'},
  ofm_positron: {label:'Positron (OFM)', group:'more', kind:'ofm', style:'positron', tone:'light', attr:attrOfm, fallback:'lightgray', swatch:'#ececec'},
  opentopo: {label:'OpenTopoMap', group:'more', kind:'raster', url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', subdomains:'abc', maxZoom:17, tone:'light', attr:attrOtm, swatch:'#c2d6a8'}
};

function esriStandIn(id){
  const m = BASEMAPS[id] || {};
  const fb = m.fallback || id;
  if(fb==='lightgray' || id==='positron' || id==='esri_lightgray' || id==='ofm_positron')
    return L.layerGroup([esri('Canvas/World_Light_Gray_Base'), esri('Canvas/World_Light_Gray_Reference')]);
  if(fb==='darkgray' || id==='darkmatter' || id==='esri_darkgray' || id==='darkmatter_nolabels')
    return L.layerGroup([esri('Canvas/World_Dark_Gray_Base'), esri('Canvas/World_Dark_Gray_Reference')]);
  if(id==='satellite') return esri('World_Imagery', {attribution:attrEsriImg});
  return esri('World_Topo_Map');
}
function cartoStyleUrl(styleSlug){
  let url = 'https://basemaps.cartocdn.com/gl/'+styleSlug+'/style.json';
  if(CARTO_KEY) url += '?key='+encodeURIComponent(CARTO_KEY);
  return url;
}
function makeVectorLayer(styleUrl, attr){
  if(!(window.maplibregl && L.maplibreGL)) return null;
  return L.maplibreGL({ style: styleUrl, attribution: attr, interactive: false });
}
function makeBasemapLayer(id){
  const m = BASEMAPS[id];
  if(!m) return esriStandIn('voyager');
  if(m.kind==='esri'){
    const base = esri(m.service, {attribution:m.attr||attrEsri});
    if(m.ref) return L.layerGroup([base, esri(m.ref, {attribution:m.attr||attrEsri})]);
    return base;
  }
  if(m.kind==='raster'){
    return L.tileLayer(m.url, {maxZoom:m.maxZoom||19, attribution:m.attr, subdomains:m.subdomains||'abc'});
  }
  const styleUrl = m.kind==='ofm'
    ? 'https://tiles.openfreemap.org/styles/'+m.style
    : cartoStyleUrl(m.style);
  const layer = makeVectorLayer(styleUrl, m.attr||attrCarto);
  return layer || esriStandIn(id);
}
function hookVectorFallback(layer, id){
  if(!layer || !layer.getMaplibreMap) return;
  const attach = () => {
    const gl = layer.getMaplibreMap && layer.getMaplibreMap();
    if(!gl || layer._fellBack) return;
    gl.on('error', () => {
      if(layer._fellBack) return;
      const loaded = gl.isStyleLoaded && gl.isStyleLoaded();
      if(loaded) return;
      layer._fellBack = true;
      if(baseId===id && curBase===layer){
        map.removeLayer(layer);
        curBase = esriStandIn(id).addTo(map);
      }
    });
  };
  setTimeout(attach, 0);
}

const baseCache = {};
let curBase = null;
let baseId = 'voyager';
let lastLightBase = 'voyager';
let autoBase = false;

function closeBasemapMore(){
  const menu = $('#bmap-menu');
  const btn = $('#bmap-more');
  if(menu) menu.hidden = true;
  if(btn) btn.setAttribute('aria-expanded','false');
}
function updateBasemapChrome(){
  $$('#basemaps [data-b]').forEach(x => x.classList.toggle('on', x.dataset.b===baseId));
  const moreBtn = $('#bmap-more');
  const meta = BASEMAPS[baseId];
  if(moreBtn){
    const inMore = !!(meta && meta.group==='more');
    moreBtn.classList.toggle('on', inMore);
    const lab = moreBtn.querySelector('.bmap-more-lab');
    if(lab) lab.textContent = inMore ? (meta.label||'More styles') : 'More styles';
  }
}
function setBasemap(id, opts){
  opts = opts||{};
  if(!BASEMAPS[id]) id = 'voyager';
  if(id===baseId && curBase && !opts.force){
    updateBasemapChrome();
    return;
  }
  if(curBase){ try{ map.removeLayer(curBase); }catch(_){ } curBase=null; }
  try{
    if(!baseCache[id]) baseCache[id] = makeBasemapLayer(id);
    curBase = baseCache[id].addTo(map);
    hookVectorFallback(curBase, id);
  }catch(err){
    try{ console.warn('Basemap failed to load', id, err); }catch(_){}
    curBase = null;
    delete baseCache[id];
    try{ curBase = esriStandIn(id).addTo(map); }catch(_){}
  }
  baseId = id;
  const wrap = $('#mapwrap');
  const meta = BASEMAPS[id]||{};
  if(wrap){
    wrap.dataset.base = id;
    wrap.dataset.tone = meta.tone || 'light';
  }
  updateBasemapChrome();
  if(!opts.auto){
    autoBase = false;
    if(id==='voyager' || id==='positron') lastLightBase = id;
    try{ localStorage.setItem(BASE_KEY, id); }catch(_){}
  }else{
    autoBase = true;
  }
  closeBasemapMore();
}

function applyTheme(t, opts){
  opts = opts||{};
  if(t!=='dark' && t!=='light') t='light';
  document.documentElement.setAttribute('data-theme', t);
  const meta = $('#theme-color');
  if(meta) meta.content = t==='dark' ? '#0A0E12' : '#F3F5F7';
  $$('#theme button').forEach(b => b.classList.toggle('on', b.dataset.t===t));
  if(opts.persist!==false){ try{ localStorage.setItem(THEME_KEY, t); }catch(_){ } }
  if(opts.swapBasemap!==false){
    if(t==='dark' && (baseId==='voyager' || baseId==='positron')){
      lastLightBase = baseId;
      setBasemap('darkmatter', {auto:true});
    }else if(t==='light' && baseId==='darkmatter' && autoBase){
      setBasemap(lastLightBase||'voyager', {auto:true});
    }
  }
}

(function initChromePrefs(){
  try{
    const saved = localStorage.getItem(BASE_KEY);
    if(saved && BASEMAPS[saved]){
      baseId = saved;
      if(saved==='voyager'||saved==='positron') lastLightBase = saved;
    }
  }catch(_){}
  let start = baseId;
  if(currentTheme()==='dark' && (start==='voyager'||start==='positron')){
    lastLightBase = start;
    start = 'darkmatter';
    autoBase = true;
  }
  baseId = ''; /* force first add */
  setBasemap(start, {auto:autoBase, persist:false});
  applyTheme(currentTheme(), {persist:false, swapBasemap:false});
})();

$$('#theme button').forEach(b => b.onclick = () => applyTheme(b.dataset.t, {fromUserClick:true}));
(function bindBasemapChrome(){
  const box = $('#basemaps');
  if(!box) return;
  box.addEventListener('click', ev => {
    const more = ev.target.closest && ev.target.closest('#bmap-more');
    if(more){
      ev.preventDefault();
      ev.stopPropagation();
      const menu = $('#bmap-menu');
      if(!menu) return;
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      more.setAttribute('aria-expanded', willOpen?'true':'false');
      return;
    }
    const b = ev.target.closest && ev.target.closest('[data-b]');
    if(b && b.dataset.b) setBasemap(b.dataset.b);
  });
  document.addEventListener('click', ev => {
    const root = $('#basemaps');
    if(root && ev.target && !root.contains(ev.target)) closeBasemapMore();
  });
  document.addEventListener('keydown', ev => {
    if(ev.key==='Escape') closeBasemapMore();
  });
})();


function clusterIcon(cluster){
  const n = cluster.getChildCount();
  const s = String(n);
  const d = s.length;
  const size = d<=1 ? 36 : d===2 ? 44 : d===3 ? 54 : 64;
  const kind = n<10 ? 'small' : n<50 ? 'medium' : 'large';
  const fs = d<=2 ? 13 : d===3 ? 12 : 11;
  return L.divIcon({
    html: `<div class="mkc-inner" style="font-size:${fs}px"><span>${s}</span></div>`,
    className: `marker-cluster marker-cluster-${kind} mkc mkc-${d}`,
    iconSize: L.point(size, size),
    iconAnchor: L.point(size/2, size/2)
  });
}
const clusters = L.markerClusterGroup({
  showCoverageOnHover:false,
  maxClusterRadius:52,
  spiderfyOnMaxZoom:true,
  disableClusteringAtZoom:12,
  iconCreateFunction: clusterIcon
});
map.addLayer(clusters);

const markers = {};
function popEvent(e){
  const ph = e.photos && e.photos[0];
  return `<div class="pop">${ph?`<img src="${esc(ph.thumb||ph.src)}" alt="">`:`<div class="ph-ph sm">${esc(catLabel(e))}</div>`}<div class="pb"><div class="pk">${esc(catLabel(e))} · ${esc(fmtEventDates(e))}</div><h3>${esc(e.name)}</h3><div class="pa">${esc(where(e))}</div><div class="pr">${esc(fmtPrice(e))}</div>${ph?`<div class="credit">Photo: ${esc(e.photoCredit||ph.credit||'see event page')}</div>`:''}</div></div>`;
}
function popupPad(){
  const desk = innerWidth>860;
  const inset = 14;
  if(!desk){
    return {topLeft: L.point(16, 72), bottomRight: L.point(16, 48)};
  }
  const layoutW = (el) => {
    if(!el) return 0;
    const s = getComputedStyle(el);
    if(s.display==='none') return 0;
    return el.offsetWidth||0;
  };
  const det = $('#detail');
  const open = det && det.classList.contains('open');
  const strip = $('#timeline');
  const side = $('#sidebar');
  const leftEl = (strip && getComputedStyle(strip).display!=='none') ? strip : side;
  const Lw = layoutW(leftEl);
  const Rw = open ? layoutW(det) : 0;
  return {
    topLeft: L.point(Math.round((Lw?inset+Lw:0)+16), 88),
    bottomRight: L.point(Math.round((Rw?inset+Rw:0)+16), 48)
  };
}
function panForOpenPopup(){
  const popup = map._popup;
  if(!popup || !popup.isOpen || !popup.isOpen()) return;
  const pad = popupPad();
  popup.options.autoPan = true;
  popup.options.autoPanPaddingTopLeft = pad.topLeft;
  popup.options.autoPanPaddingBottomRight = pad.bottomRight;
  try{ if(popup._adjustPan) popup._adjustPan(); }catch(_){}
}
function openEventFromPin(e){
  const onTimeline = /^#\/timeline/.test(location.hash||'');
  const h = (onTimeline ? '#/timeline/event/' : '#/event/') + e.slug;
  if((location.hash||'')!==h) location.hash = h;
  setTimeout(panForOpenPopup, 50);
  setTimeout(panForOpenPopup, 320);
  setTimeout(panForOpenPopup, 780);
}
function evIcon(e){
  const label = pillText(e);
  const w = Math.ceil(Math.max(40, 22 + [...String(label)].length * 7.6));
  const h = 36;
  return L.divIcon({
    className:'mk-icon',
    html:`<div class="mk ${e.category||'tech'} ${isApprox(e)?'approx':''}"><div class="pill">${esc(label)}</div></div>`,
    iconSize:L.point(w,h),
    iconAnchor:L.point(Math.round(w/2), h)
  });
}

EV.forEach(e => {
  if(e.lat==null || e.lng==null) return;
  const mk = L.marker([e.lat, e.lng], {icon: evIcon(e), title: e.name, riseOnHover:true, keyboard:true});
  mk.bindPopup(popEvent(e), {className:'ppop', maxWidth:300, autoPan:true, autoPanPaddingTopLeft:[16,80], autoPanPaddingBottomRight:[16,40]});
  mk.bindTooltip(e.name, {direction:'top', opacity:0.95, className:'pin-tip', sticky:false, offset:[0,-10]});
  mk.on('click', () => openEventFromPin(e));
  markers[e.slug] = mk;
});

/* ---------- filters ---------- */
const PS = [0,50,100,150,200,250,350,500,750,1000,1500,2000,2500,3000,5000,10000,Infinity];
const PT = PS.length-1;
const addDays = (n) => { const d=new Date(TODAY); d.setDate(d.getDate()+n); return d; };
const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const WHEN = [
  {id:'any', label:'Any dates', from:null, to:null},
  {id:'30', label:'Next 30 days', from:iso(TODAY), to:iso(addDays(30))},
  {id:'90', label:'Next 90 days', from:iso(TODAY), to:iso(addDays(90))},
  {id:'180', label:'Next 6 months', from:iso(TODAY), to:iso(addDays(183))},
  {id:'2026', label:'2026', from:'2026-01-01', to:'2026-12-31'},
  {id:'2027', label:'2027', from:'2027-01-01', to:'2027-12-31'},
  {id:'custom', label:'Custom', from:null, to:null}
];

const st = {
  kind:'conference',
  region:'all',
  cats: {ai:true, tech:true, crypto:true},
  when:'any', from:null, to:null,
  cities: new Set(),
  topics: new Set(),
  pmin:0, pmax:PT, unknown:true,
  q:'', sort:'date', cityq:''
};
try{
  const k = localStorage.getItem('gconf-atlas-kind');
  if(k==='festival'||k==='conference') st.kind = k;
}catch(_){}

function kindPool(){
  return EV.filter(e => evKind(e)===st.kind && (st.region==='all' || evRegion(e)===st.region));
}
function cityList(){
  const pool = kindPool();
  const map = new Map();
  pool.forEach(e => {
    const key = (e.city||'Unknown')+'|'+(e.country||'');
    if(!map.has(key)) map.set(key, {key, city:e.city||'Unknown', country:e.country||'', n:0});
    map.get(key).n++;
  });
  return [...map.values()].sort((a,b)=>a.city.localeCompare(b.city));
}
function topicList(){
  return [...new Set(kindPool().flatMap(e => e.topics||[]))].sort((a,b)=>a.localeCompare(b));
}

function renderCatChips(){
  const keys = catKeys(st.kind);
  if(!keys.some(k => st.cats[k])) keys.forEach(k => st.cats[k] = true);
  const pool = EV.filter(e => evKind(e)===st.kind);
  $('#f-cat').innerHTML = keys.map(c => {
    const n = pool.filter(e => e.category===c).length;
    const lab = catDict()[c] || (c.charAt(0).toUpperCase()+c.slice(1));
    return `<button type="button" data-v="${esc(c)}" class="${st.cats[c]?'on':''} ${esc(c)}"><i class="dot ${esc(c)}"></i>${esc(lab)} <small>${n}</small></button>`;
  }).join('');
  $$('#f-cat button').forEach(b => b.onclick = () => {
    const k = b.dataset.v;
    st.cats[k] = !st.cats[k];
    if(!catKeys().some(c => st.cats[c])) st.cats[k] = true;
    b.classList.toggle('on', st.cats[k]);
    render();
  });
}

function updateKindbar(){
  const bar = $('#kindbar');
  if(!bar) return;
  $$('#kindbar button').forEach(b => {
    const on = b.dataset.k===st.kind;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on?'true':'false');
  });
  const nc = $('#kind-n-conference'), nf = $('#kind-n-festival');
  if(nc) nc.textContent = EV.filter(e => evKind(e)==='conference').length;
  if(nf) nf.textContent = EV.filter(e => evKind(e)==='festival').length;
}
function updateRegionChrome(){
  $$('#f-region button').forEach(b => b.classList.toggle('on', b.dataset.r===st.region));
  $$('#regions button').forEach(b => b.classList.toggle('on', st.region!=='all' && b.dataset.r===st.region));
}
function setKind(k){
  if(k!=='festival') k='conference';
  if(st.kind===k) return;
  st.kind = k;
  st.cities.clear();
  st.topics.clear();
  st.cityq = '';
  const q = $('#f-cityq'); if(q) q.value='';
  st.cats = Object.fromEntries(catKeys(k).map(c => [c, true]));
  if(st.region!=='all' && !EV.some(e => evKind(e)===k && evRegion(e)===st.region)){
    st.region = 'all';
  }
  try{ localStorage.setItem('gconf-atlas-kind', k); }catch(_){}
  updateKindbar();
  updateRegionChrome();
  renderCatChips();
  renderTopics();
  renderCities();
  renderLegend();
  render();
  fitToVisible();
  const m = (location.hash||'').match(/event\/([^/]+)/);
  if(m){
    const ev = EV.find(x => x.slug===decodeURIComponent(m[1]));
    if(ev && evKind(ev)!==k){
      const next = /^#\/timeline/.test(location.hash) ? '#/timeline' : (/^#\/swipe/.test(location.hash) ? '#/swipe' : '#/');
      if(location.hash!==next) location.hash = next;
    }
  }
}
function setRegion(r, opts){
  opts = opts||{};
  if(r!=='all' && !isKnownRegion(r)) r='all';
  const changed = st.region!==r;
  st.region = r;
  if(changed){ st.cities.clear(); st.topics.clear(); }
  updateRegionChrome();
  if(changed){ renderCities(); renderTopics(); render(); }
  if(opts.fit!==false) fitToVisible();
}

function regionBoundsOf(r){
  const ptsFor = (pred) => EV.filter(e => hasPin(e) && pred(e)).map(e => [e.lat, e.lng]);
  if(!r || r==='all'){
    const pts = ptsFor(() => true);
    if(pts.length) return L.latLngBounds(pts).pad(0.18);
    return L.latLngBounds([[21,-12],[71,58]]);
  }
  const pts = ptsFor(e => evRegion(e)===r);
  if(pts.length>=2) return L.latLngBounds(pts).pad(0.2);
  if(pts.length===1) return L.latLngBounds(pts).pad(0.6);
  if(r==='europe') return L.latLngBounds([[34,-12],[71,32]]);
  if(r==='uae') return L.latLngBounds([[22.6,51.5],[26.6,56.6]]);
  return regionBoundsOf('all');
}
function renderRegionChips(){
  const regions = regionList();
  const f = $('#f-region');
  if(f){
    f.innerHTML = `<button type="button" data-r="all">All regions</button>` +
      regions.map(r => `<button type="button" data-r="${esc(r)}">${esc(regionLabel(r))}</button>`).join('');
  }
  const jump = $('#regions');
  if(jump){
    jump.innerHTML = regions.map(r => `<button type="button" data-r="${esc(r)}">${esc(regionLabel(r))}</button>`).join('');
    jump.hidden = regions.length < 2;
  }
  updateRegionChrome();
}
function fitToVisible(){
  const pins = visibleEvents().map(e => markers[e.slug]).filter(Boolean);
  const pad = innerWidth>860 ? {paddingTopLeft:[20,40], paddingBottomRight:[40,20]} : {padding:[60,24,40,24]};
  try{
    if(pins.length){
      const group = L.featureGroup(pins);
      map.fitBounds(group.getBounds().pad(0.14), Object.assign({maxZoom: pins.length<4?8:6, animate:true}, pad));
    }else{
      const b = regionBoundsOf(st.region);
      map.fitBounds(b, Object.assign({maxZoom: st.region!=='all' && pins.length<4?8:4, animate:true}, pad));
    }
  }catch(_){}
}

function renderLegend(){
  const box = $('#legend');
  if(!box) return;
  const keys = catKeys();
  const d = catDict();
  box.innerHTML = `<button class="lgx" type="button" onclick="this.parentNode.classList.toggle('min')" aria-label="Collapse legend">–</button>
    <div class="lg-title">Legend</div>
    ${keys.map(k => `<div><i class="pin-s ${esc(k)}"></i>${esc(d[k]||k)}</div>`).join('')}
    <div class="muted">Dashed pin ring = approximate location</div>`;
}

$('#f-when').innerHTML = WHEN.map(w => `<button type="button" data-v="${w.id}" class="${w.id==='any'?'on':''}">${w.label}</button>`).join('');
function applyWhen(id){
  st.when = id;
  const w = WHEN.find(x => x.id===id);
  const custom = id==='custom';
  $('#f-custom').hidden = !custom;
  if(!custom && w){ st.from = w.from; st.to = w.to; }
  $$('#f-when button').forEach(x => x.classList.toggle('on', x.dataset.v===id));
  render();
}
$$('#f-when button').forEach(b => b.onclick = () => applyWhen(b.dataset.v));
$('#f-from').onchange = e => { st.from = e.target.value || null; st.when='custom'; render(); };
$('#f-to').onchange = e => { st.to = e.target.value || null; st.when='custom'; render(); };

function cityChip(c){
  const on = !st.cities.size || st.cities.has(c.key);
  return `<button type="button" data-v="${esc(c.key)}" class="${on && st.cities.size?'on':''}">${esc(c.city)}${c.country?`, ${esc(c.country)}`:''} <small>${c.n}</small></button>`;
}
function renderCities(){
  const q = st.cityq;
  const list = cityList().filter(c => !q || (c.city+' '+c.country).toLowerCase().includes(q));
  const allOn = st.cities.size===0;
  $('#f-city').innerHTML = `<button type="button" data-v="" class="${allOn?'on':''}">All cities</button>` + list.map(cityChip).join('');
  $$('#f-city button').forEach(b => b.onclick = () => {
    const k = b.dataset.v;
    if(!k){ st.cities.clear(); }
    else if(st.cities.has(k)) st.cities.delete(k);
    else st.cities.add(k);
    renderCities(); render();
  });
}
$('#f-cityq').oninput = e => { st.cityq = e.target.value.trim().toLowerCase(); renderCities(); };

st.cats = Object.fromEntries(catKeys(st.kind).map(c => [c, true]));
updateKindbar();
updateRegionChrome();
renderCatChips();
renderLegend();
$$('#kindbar button').forEach(b => b.onclick = () => setKind(b.dataset.k));
(function bindRegionChrome(){
  const on = ev => {
    const b = ev.target.closest && ev.target.closest('button[data-r]');
    if(b) setRegion(b.dataset.r, {fit:true});
  };
  const f = $('#f-region'), jump = $('#regions');
  if(f) f.addEventListener('click', on);
  if(jump) jump.addEventListener('click', on);
})();

let topicsExpanded = false;
function renderTopics(){
  const TOPICS = topicList();
  const row = $('#f-topic-row');
  const box = $('#f-topic');
  if(!row || !box) return;
  if(!TOPICS.length){ row.hidden = true; box.innerHTML=''; return; }
  row.hidden = false;
  box.classList.add('topics');
  const shown = topicsExpanded ? TOPICS : TOPICS.slice(0, 10);
  const rest = Math.max(0, TOPICS.length - shown.length);
  box.classList.toggle('expanded', !!topicsExpanded);
  box.innerHTML = shown.map(t => `<button type="button" data-v="${esc(t)}" class="${st.topics.has(t)?'on':''}">${esc(t)}</button>`).join('')
    + (rest?`<button type="button" class="morebtn" data-more="1">+${rest} more</button>`:'')
    + (topicsExpanded && TOPICS.length>10?`<button type="button" class="morebtn" data-more="0">Show fewer</button>`:'');
  $$('#f-topic button').forEach(b => b.onclick = () => {
    if(b.dataset.more){ topicsExpanded = b.dataset.more==='1'; renderTopics(); return; }
    const t = b.dataset.v;
    if(st.topics.has(t)) st.topics.delete(t); else st.topics.add(t);
    b.classList.toggle('on', st.topics.has(t));
    render();
  });
}

renderCities();
renderTopics();

const pmn = $('#f-pmin'), pmx = $('#f-pmax');
function fmtEur(n){ return n===Infinity ? '€3k+' : n>=1000 ? '€'+(n/1000).toString().replace(/\.0$/,'')+'k' : '€'+n; }
function pv(){
  const a=+pmn.value, b=+pmx.value, lo=PS[a], hi=PS[b];
  $('#pval').textContent = (a===0&&b===PT)?'Any':(a===0?'≤ '+fmtEur(hi):b===PT?fmtEur(lo)+'+':fmtEur(lo)+' – '+fmtEur(hi));
  $('#dfill').style.left = (a/PT*100)+'%';
  $('#dfill').style.right = (100-b/PT*100)+'%';
  $$('#f-preset button').forEach(x => {
    const [pa,pb] = x.dataset.p.split(',').map(Number);
    const ia = PS.findIndex((v,i)=> (i===PT?Infinity:v) >= pa);
    const ib = pb>=10000 ? PT : PS.findIndex((v,i)=> v>=pb);
    x.classList.toggle('on', ia===a && (ib<0?PT:ib)===b);
  });
}
function setP(a,b){ st.pmin=a; st.pmax=b; pmn.value=a; pmx.value=b; pv(); render(); }
pmn.oninput = () => { let a=+pmn.value; if(a>+pmx.value-1){ a=Math.max(0,+pmx.value-1); pmn.value=a; } setP(a,+pmx.value); };
pmx.oninput = () => { let b=+pmx.value; if(b<+pmn.value+1){ b=Math.min(PT,+pmn.value+1); pmx.value=b; } setP(+pmn.value,b); };
$$('#f-preset button').forEach(x => x.onclick = () => {
  const [pa,pb] = x.dataset.p.split(',').map(Number);
  let a=0; for(let i=0;i<=PT;i++) if(PS[i]>=pa){ a=i; break; }
  let b=PT; for(let i=0;i<=PT;i++) if(PS[i]>=pb){ b=i; break; }
  if(pb>=999999) b=PT;
  setP(a,b);
});
$('#f-unknown').onchange = e => { st.unknown=e.target.checked; render(); };
$('#uval').textContent = '('+EV.filter(e=>!hasPrice(e)).length+')';
if(D.eurRatesNote){ const n=$('#prate-note'); n.hidden=false; n.textContent=D.eurRatesNote; }
pv();

$('#q').oninput = e => { st.q=e.target.value.trim().toLowerCase(); render(); };
$('#sort').onchange = e => { st.sort=e.target.value; render(); };

function overlapsDate(e){
  if(!st.from && !st.to) return true;
  if(datesTba(e) || isPostponed(e)) return false;
  const a = parseDay(e.start_date) || parseDay(e.end_date);
  const b = parseDay(e.end_date) || parseDay(e.start_date);
  if(!a && !b) return false;
  const from = st.from ? parseDay(st.from) : null;
  const to = st.to ? parseDay(st.to) : null;
  if(from && b && b < from) return false;
  if(to && a && a > to) return false;
  return true;
}
function priceOk(e){
  if(!hasPrice(e)) return st.unknown;
  const lo = e.price_eur_min!=null ? e.price_eur_min : e.ticket_price_min;
  const hi = e.price_eur_max!=null ? e.price_eur_max : e.ticket_price_max;
  if(lo==null && hi==null) return st.unknown;
  const min = lo!=null?lo:(hi||0);
  const max = hi!=null?hi:(lo||0);
  return min <= PS[st.pmax] && max >= PS[st.pmin];
}
function visibleEvents(){
  const q = st.q;
  return EV.filter(e => {
    if(evKind(e)!==st.kind) return false;
    if(st.region!=='all' && evRegion(e)!==st.region) return false;
    if(!st.cats[e.category]) return false;
    if(!overlapsDate(e)) return false;
    if(st.cities.size){
      const key = (e.city||'Unknown')+'|'+(e.country||'');
      if(!st.cities.has(key)) return false;
    }
    if(st.topics.size){
      const ts = e.topics||[];
      if(![...st.topics].some(t => ts.includes(t))) return false;
    }
    if(!priceOk(e)) return false;
    if(q){
      const hay = [e.name,e.city,e.country,e.venue,e.organizer,e.industry,(e.topics||[]).join(' '),e.notes].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}
function sortEvents(a){
  const s = st.sort;
  const copy = a.slice();
  const minP = e => e.price_eur_min!=null?e.price_eur_min:(e.ticket_price_min!=null?e.ticket_price_min:9e12);
  const maxP = e => e.price_eur_max!=null?e.price_eur_max:(e.ticket_price_max!=null?e.ticket_price_max:0);
  copy.sort((x,y) => {
    if(s==='name') return (x.name||'').localeCompare(y.name||'');
    if(s==='city') return (x.city||'').localeCompare(y.city||'') || (x.name||'').localeCompare(y.name||'');
    if(s==='price') return minP(x)-minP(y);
    if(s==='price-desc') return maxP(y)-maxP(x);
    if(s==='date-desc') return (y.start_date||'0000').localeCompare(x.start_date||'0000') || (x.name||'').localeCompare(y.name||'');
    return (x.start_date||'9999').localeCompare(y.start_date||'9999') || (x.name||'').localeCompare(y.name||'');
  });
  return copy;
}

function leadPhoto(e){
  const ph = e && e.photos && e.photos[0];
  if(ph && (ph.thumb || ph.src)){
    return { thumb: ph.thumb || ph.src, full: ph.src || ph.thumb };
  }
  return null;
}
function cardThumbHtml(e){
  const ph = leadPhoto(e);
  const cat = esc(e.category||'');
  if(!ph){
    return `<div class="th ph ${cat}" aria-hidden="true"><span>${esc(catLabel(e))}</span></div>`;
  }
  return `<div class="th ${cat}"><img data-src="${esc(ph.thumb)}" data-full="${esc(ph.full)}" alt="" decoding="async"></div>`;
}
function cardHtml(e){
  return `<article class="card" data-r="event/${esc(e.slug)}">${cardThumbHtml(e)}<div class="meta"><span class="tag ${esc(e.category||'')}">${esc(catLabel(e))}</span>${statusBadge(e)}<h3>${esc(e.name)}</h3><div class="where">${esc(fmtEventDates(e))} · ${esc(where(e))}</div><div class="row"><span class="price ${hasPrice(e)?'':'unk'}">${esc(fmtPrice(e))}</span>${isApprox(e)?'<span class="tag">◌ approx.</span>':''}</div></div></article>`;
}

let listThumbObs = null;
function bindListThumbs(){
  if(listThumbObs){ listThumbObs.disconnect(); listThumbObs=null; }
  const fail = (img) => {
    const wrap = img.closest('.th');
    const card = img.closest('.card');
    const slug = ((card && card.dataset.r) || '').replace(/^event\//,'');
    const ev = EV.find(x => x.slug===slug);
    if(wrap){
      wrap.classList.add('ph');
      if(ev) wrap.classList.add(ev.category||'');
      if(!wrap.querySelector('span')){
        const s=document.createElement('span');
        s.textContent = ev ? catLabel(ev) : 'Event';
        wrap.appendChild(s);
      }
    }
    img.remove();
  };
  const load = (img) => {
    if(!img || img.dataset.ok || img.dataset.busy) return;
    img.dataset.busy = '1';
    const thumb = img.dataset.src;
    const full = img.dataset.full || thumb;
    const apply = (url, last) => {
      img.onload = () => { img.dataset.ok='1'; img.classList.add('ld'); delete img.dataset.busy; };
      img.onerror = () => {
        if(!last && full && full!==url) apply(full, true);
        else fail(img);
      };
      img.src = url;
    };
    if(!thumb){ fail(img); return; }
    apply(thumb, !full || full===thumb);
  };
  /* Native loading=lazy is unreliable in a nested sidebar scroller
     (#app does not scroll, only #sidebar does). Load list thumbs
     immediately; they are small -t.jpg files. */
  $$('#list .th img[data-src]').forEach(load);
}
function bindMediaFallback(sel){
  $$(sel).forEach(img => {
    if(img.dataset.fb) return;
    img.dataset.fb='1';
    img.addEventListener('error', function onerr(){
      const full = img.dataset.full;
      if(full && !img.dataset.triedFull){
        img.dataset.triedFull='1';
        img.src = full;
        return;
      }
      img.removeEventListener('error', onerr);
      const hero = img.closest('.tl-hero, .th, .swimg');
      if(hero){ hero.classList.add('ph'); hero.classList.remove('hasphoto'); }
      img.remove();
    });
  });
}


function emptyMessage(){
  const kindAll = EV.filter(e => evKind(e)===st.kind);
  if(!kindAll.length){
    return st.kind==='festival'
      ? 'Festival listings are still being compiled.'
      : 'No upcoming events have been published yet. The research feed is still being compiled.';
  }
  if(st.region!=='all' && !kindAll.some(e => evRegion(e)===st.region)){
    return 'No '+regionLabel(st.region)+' listings have been published yet for this view.';
  }
  return 'No events match the current filters.';
}
function render(){
  const vis = sortEvents(visibleEvents());
  $('#count').textContent = vis.length + (vis.length===1?' event':' events');
  $('#list').innerHTML = vis.length ? vis.map(cardHtml).join('') : `<div class="empty">${emptyMessage()}</div>`;
  $$('#list .card[data-r]').forEach(c => c.onclick = () => { location.hash = '#/'+c.dataset.r; });

  clusters.clearLayers();
  vis.forEach(e => { const mk = markers[e.slug]; if(mk) clusters.addLayer(mk); });

  const cities = new Set(vis.map(e => e.city).filter(Boolean));
  const priced = vis.filter(hasPrice).length;
  const next = vis.filter(e => parseDay(e.start_date) && parseDay(e.start_date) >= TODAY).sort((a,b)=>(a.start_date||'').localeCompare(b.start_date||''))[0];
  $('#stats').innerHTML = `<div><b>${vis.length}</b><span>Events shown</span></div><div><b>${cities.size}</b><span>Cities</span></div><div><b>${next?fmtDay(next.start_date):'—'}</b><span>${next?'Next event':'Next date'}</span></div>`;
  $('#upd').textContent = D.updated || '—';
  if(D.scope && !window._scopeApplied){
    window._scopeApplied = true;
    const titleBits = String(D.scope).replace(/^Conferences and festivals in /i, '');
    if(titleBits){
      document.title = 'GConf Events Atlas · Conferences and festivals in ' + titleBits;
      const mapEl = $('#map');
      if(mapEl) mapEl.setAttribute('aria-label', 'Map of events in ' + titleBits);
      const desc = document.querySelector('meta[name="description"]');
      if(desc) desc.setAttribute('content', 'A map of upcoming conferences and festivals in '+titleBits+'. Every fact is cited. Built by GConf AI.');
      document.querySelectorAll('footer.foot').forEach(foot => {
        foot.innerHTML = foot.innerHTML.replace(/upcoming conferences and festivals in [^.<]+/, 'upcoming conferences and festivals in '+titleBits);
      });
      const eyebrow = document.querySelector('.brand .eyebrow');
      if(eyebrow) eyebrow.textContent = '↳ GConf.ai · ' + titleBits;
    }
  }
  const echo = $('#mapecho');
  const pinned = vis.filter(e => markers[e.slug]).length;
  if(echo){
    if(vis.length && !pinned){ echo.hidden=false; echo.textContent='These events are in the list. Pins appear once a location has been published.'; }
    else echo.hidden=true;
  }
  const u = $('#uval');
  if(u) u.textContent = '('+kindPool().filter(e=>!hasPrice(e)).length+')';
  updateAlertPrefs(vis.length);
  if(PLAY.on && !PLAY.paused) playPause();
  if($('#mapwrap') && $('#mapwrap').classList.contains('timeline-on')){ renderTimeline(); bindMediaFallback('#tlbody img'); }
  if(PLAY.on) playReconcile();
}

/* ---------- detail ---------- */
function srcLink(u, label){
  if(!u) return esc(label||'');
  return `<a class="srclink" href="${esc(u)}" target="_blank" rel="noopener">${esc(label||u)} ↗</a>`;
}
function galHtml(photos, credit){
  const P = photos||[];
  if(!P.length) return '';
  const n = P.length;
  const img = (p,i,cls) => `<button type="button" class="gi ${cls||''}" data-i="${i}" aria-label="Open photo ${i+1}"><img class="ld" src="${esc(p.thumb||p.src)}" data-full="${esc(p.src)}" alt="" loading="eager"></button>`;
  if(n===1) return `<div class="gal g1">${img(P[0],0,'lead')}</div>`;
  if(n===2) return `<div class="gal g2">${img(P[0],0,'lead')}${img(P[1],1)}</div>`;
  if(n===3) return `<div class="gal g3">${img(P[0],0,'lead')}${img(P[1],1)}${img(P[2],2)}</div>`;
  const rest = P.slice(1);
  const leadSrc = esc(P[0].src || P[0].thumb || '');
  return `<div class="gal g4 gc"><div class="gi lead car" data-i="0"><img class="cs on ld" src="${leadSrc}" alt=""></div><div class="gstrip" style="--gn:${Math.min(rest.length,6)}">${rest.map((p,i)=>`<button type="button" class="gt" data-i="${i+1}"><img src="${esc(p.thumb||p.src)}" alt="" loading="lazy"></button>`).join('')}</div></div>`;
}
function fact(label, value, url){
  if(value==null || value==='') return '';
  const v = url ? srcLink(url, value) : esc(String(value));
  return `<dt>${esc(label)}</dt><dd>${v}</dd>`;
}
function viewEvent(e){
  const ph = e.photos||[];
  const credit = e.photoCredit || (ph[0] && ph[0].credit) || '';
  const locBits = [e.venue, e.city, e.country].filter(Boolean).join(' · ');
  const cat = catLabel(e);
  const topicTags = (e.topics||[]).filter(t => t.toLowerCase()!==cat.toLowerCase() && t.toLowerCase()!==(e.category||''));
  const tags = [cat].concat(topicTags).map(t=>`<span>${esc(t)}</span>`).join('');
  const close = `<button class="close" type="button" aria-label="Close" onclick="atlasCloseDetail()">✕</button>`;
  const gal = galHtml(ph, credit);
  const hero = `<div class="dhero ${esc(e.category||'')}">
    <div class="crumbs">${esc(catLabel(e))} · ${statusBadge(e) || esc(fmtEventDates(e))}</div>
    <h2>${esc(e.name)}</h2>
    <div class="loc">${esc(locBits)}${isApprox(e)?' · ◌ approximate pin':(!hasPin(e)?' · pin not yet placed':'')}</div>
    <div class="bigprice">${esc(fmtPrice(e))}${e.currency && hasPrice(e)?`<small>${esc(e.currency)}${e.ticket_url?' · tickets on the organiser site':''}</small>`: (hasPrice(e)?'': '<small>No verified ticket price yet</small>')}</div>
    <div class="htags">${tags}</div>
    ${credit?`<div class="hcredit">Photo: ${ph[0]&&ph[0].page?srcLink(ph[0].page, credit):esc(credit)}</div>`:''}
  </div>`;
  const about = e.notes ? `<div class="dsec"><h4>Notes</h4><p>${esc(e.notes)}</p></div>` : '';
  const attend = e.expected_attendance ? fact('Attendance', e.expected_attendance) : '';
  const facts = `<div class="dsec"><h4>Facts</h4><dl class="facts">
    ${fact('Dates', fmtEventDates(e))}
    ${fact('City', [e.city,e.country].filter(Boolean).join(', '))}
    ${fact('Venue', e.venue)}
    ${fact('Organiser', e.organizer)}
    ${fact('Format', e.format)}
    ${attend}
    ${fact('Tickets', hasPrice(e)?fmtPrice(e):'Not published', e.ticket_url || e.price_source_url)}
    ${fact('Website', e.website_url ? e.website_url.replace(/^https?:\/\//,'').replace(/\/$/,'') : '', e.website_url)}
  </dl>${isApprox(e)?`<p class="approx-note">The map pin is approximate. The exact venue location was not published with enough precision to place a verified point.</p>`:(!hasPin(e)?`<p class="note">A map pin will appear once a location has been published.</p>`:'')}</div>`;
  const claim = `<div class="dsec claim"><h4>Organisers</h4>
    <p>This listing is researched from public sources. If you run this event, you can claim it and correct the record. This button does not send outreach.</p>
    <div class="cta-row">
      <a class="btn primary xl" id="claim-cta" href="#/event/${esc(e.slug)}/claim">Organisers: claim this listing</a>
    </div>
    <div id="claim-box" hidden>
      <p>Claims are not open yet. This form is a placeholder and does not send anything. Official contact details will come from the GConf fact sheet.</p>
      <label class="flab" for="claim-email">Your work email</label>
      <input id="claim-email" type="email" disabled placeholder="you@organiser.com">
      <label class="flab" for="claim-note">What should we correct?</label>
      <textarea id="claim-note" rows="3" disabled placeholder="Dates, venue, ticket price, photos…" style="width:100%;margin:6px 0 10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--input);color:var(--ink);font:inherit"></textarea>
      <button type="button" class="btn primary" disabled>Submit claim (not yet active)</button>
    </div>
  </div>`;
  const srcs = (e.sources||[]).map(s => {
    const lab = s.label||s.url||'Source';
    const field = (s.field && String(s.field).toLowerCase()!==String(lab).toLowerCase()) ? s.field : '';
    return `<li>${field?`<span class="field">${esc(field)}</span>`:''}${s.url?srcLink(s.url, lab):esc(lab)}</li>`;
  }).join('');
  const srcSec = `<div class="dsec"><h4>Sources</h4>${srcs?`<ul class="src-list">${srcs}</ul>`:'<p>No source URLs were attached to this record.</p>'}${e.website_url?`<p style="margin-top:10px"><a class="btn cyan block" href="${esc(e.website_url)}" target="_blank" rel="noopener">Visit event website ↗</a></p>`:''}</div>`;
  const views = `<div class="dsec" id="views-stub"><p class="note">A privacy-friendly view count will appear here once the backend is live. It is not active on this version.</p></div>`;
  const powered = `<p class="powered-by"><a href="https://gconf.ai" target="_blank" rel="noopener"><img class="logo-on-light" src="img/brand/gconf-logo-ink.svg" alt=""> <img class="logo-on-dark" src="img/brand/gconf-logo-dark.svg" alt=""> <span>Powered by GConf</span></a></p>`;
  return close + gal + hero + facts + about + claim + srcSec + views + powered;
}

function detailPane(root){
  if(root && root.nodeType===1) return root;
  const body = document.getElementById('dbody');
  if(!body) return document;
  return body.querySelector('.dswap-pane.dswap-in.dswap-show')
    || body.querySelector('.dswap-pane.dswap-in')
    || body.querySelector('.dswap-pane:not(.dswap-out)')
    || body;
}
function markImgLoaded(im){
  if(!im) return;
  const done = () => im.classList.add('ld');
  if(im.complete) done();
  else im.addEventListener('load', done, {once:true});
  im.addEventListener('error', done, {once:true});
  if(im.decode) im.decode().then(done).catch(()=>{});
}
function bindGallery(e, root){
  const pane = detailPane(root);
  const photos = e.photos||[];
  pane.querySelectorAll('.gi, .gt').forEach(el => {
    el.onclick = ev => {
      if(ev.target.closest('.cnav,.cdot')) return;
      if(Date.now()-(window.__galSwipe||0)<450) return;
      const i = +el.dataset.i || 0;
      lbOpen(photos, i, e.name, e.photoCredit||'');
    };
  });
  pane.querySelectorAll('img').forEach(markImgLoaded);
  const claim = pane.querySelector('#claim-cta') || document.getElementById('claim-cta');
  if(claim){
    claim.onclick = ev => {
      ev.preventDefault();
      const box = (pane.querySelector('#claim-box') || document.getElementById('claim-box'));
      if(box){ box.hidden = !box.hidden; }
      if(CFG.claimEmail){
        const sub = encodeURIComponent('Claim listing: '+e.name);
        location.href = 'mailto:'+CFG.claimEmail+'?subject='+sub;
      }
    };
  }
  carInit(photos, e.name, e.photoCredit||'', pane);
  stubViews(e);
}

function stubViews(e){
  if(!CFG.viewsEnabled || !CFG.viewsFn) return;
  // Optional privacy-friendly counter; only posts once backend exists.
  fetch(CFG.viewsFn, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({slug:e.slug})}).catch(()=>{});
}


/* ---------- views + timeline ---------- */
let lastMainView = 'map';
function setMainView(v){
  const wrap = $('#mapwrap');
  const was = lastMainView;
  lastMainView = v;
  if(wrap){
    wrap.classList.toggle('timeline-on', v==='timeline');
  }
  const appEl = $('#app');
  if(appEl) appEl.classList.toggle('timeline-on', v==='timeline');
  const tl = $('#timeline');
  if(tl) tl.setAttribute('aria-hidden', v==='timeline' ? 'false' : 'true');
  $$('#viewbar button').forEach(b => b.classList.toggle('on', b.dataset.v===v));
  if(v==='timeline') renderTimeline();
  if(innerWidth<=860 && (v==='timeline' || v==='swipe')) $('#sidebar').classList.add('collapsed');
  if(v==='timeline' || (was==='timeline' && v!=='timeline')){
    try{ map.invalidateSize({animate:false}); }catch(_){}
    setTimeout(() => {
      try{
        map.invalidateSize({animate:false});
        /* Do not steal the camera once play/tour has started — fitToVisible
           was cancelling the zoom-out / great-circle framing. */
        if(PLAY.on) return;
        if(v==='timeline' || v==='map') fitToVisible();
      }catch(_){}
    }, 80);
  }
  if(was==='timeline' && v!=='timeline'){
    if(PLAY.on) playExit({silent:true});
  }
  return was!==v;
}
function monthKey(e){
  const d = parseDay(e.start_date);
  if(!d) return 'tbc';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function monthParts(key){
  if(key==='tbc') return {name:'Dates TBA', year:'', short:'TBA', kicker:'Schedule'};
  const [y,m] = key.split('-').map(Number);
  const d = new Date(y, m-1, 1);
  return {
    name: d.toLocaleDateString('en-GB', {month:'long'}),
    year: String(y),
    short: d.toLocaleDateString('en-GB', {month:'short'}),
    kicker: 'Month'
  };
}
function tlIcon(cat){
  if(cat==='crypto') return `<svg class="tl-ico" viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="#CFF55A" stroke-width="2.2" d="M24 6 40 16v16L24 42 8 32V16L24 6z"/><path fill="none" stroke="#1FA9C6" stroke-width="2" d="M24 16 34 22v12l-10 6-10-6V22l10-6z"/></svg>`;
  if(cat==='tech') return `<svg class="tl-ico" viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="14" width="20" height="20" rx="3" fill="none" stroke="#CFF55A" stroke-width="2.2"/><path stroke="#CFF55A" stroke-width="2" d="M24 8v6M24 34v6M8 24h6M34 24h6"/><circle cx="24" cy="24" r="3.5" fill="#CFF55A"/></svg>`;
  if(cat==='ai') return `<svg class="tl-ico" viewBox="0 0 48 48" aria-hidden="true"><path fill="#8FE3F2" d="M24 6l3.2 10.2L37 16.8 29.8 23l2.7 10.4L24 28.2 15.5 33.4 18.2 23 11 16.8l9.8-0.6z"/></svg>`;
  if(cat==='education') return `<svg class="tl-ico" viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="#B8C0FF" stroke-width="2.2" d="M8 16 24 10l16 6v18L24 40 8 34V16z"/><path fill="none" stroke="#B8C0FF" stroke-width="2" d="M24 10v30M8 16l16 6 16-6"/></svg>`;
  return `<svg class="tl-ico" viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="2.2" d="M10 34c6-14 22-14 28 0"/><circle cx="18" cy="18" r="3" fill="#fff"/><circle cx="30" cy="16" r="3" fill="#fff"/><circle cx="24" cy="22" r="2.5" fill="#fff"/></svg>`;
}
function startsOnOrAfterToday(e){
  const a = parseDay(e.start_date);
  return !a || a.getTime() >= TODAY.getTime();
}
function eventCoversToday(e){
  const a = parseDay(e.start_date), b = parseDay(e.end_date)||a;
  return !!(a && b && a.getTime()<=TODAY.getTime() && TODAY.getTime()<=b.getTime());
}

let tlRevealObs = null, tlMonthObs = null;
function tlDisconnect(){
  if(tlRevealObs){ tlRevealObs.disconnect(); tlRevealObs=null; }
  if(tlMonthObs){ tlMonthObs.disconnect(); tlMonthObs=null; }
}
function todayMarkerHtml(){
  return `<li class="tl-item tl-today">
    <span class="tl-dot" aria-hidden="true"></span>
    <div class="tl-today-label"><span>Today</span><time datetime="${esc(iso(TODAY))}">${esc(fmtDay(iso(TODAY)))}</time></div>
  </li>`;
}
function eventCardHtml(e, side, imgPri){
  const tba = datesTba(e);
  const d = parseDay(e.start_date);
  const day = d ? String(d.getDate()) : (tba ? 'TBA' : '—');
  const wd = d ? d.toLocaleDateString('en-GB', {weekday:'short'}) : '';
  const mon = d ? d.toLocaleDateString('en-GB', {month:'short'}) : '';
  const ph = e.photos && e.photos[0];
  const cat = e.category||'tech';
  const flag = flagOf(e.country);
  const loc = [e.city, e.country].filter(Boolean).join(', ');
  const attend = e.expected_attendance ? String(e.expected_attendance).trim() : '';
  const img = ph
    ? `<img src="${esc(ph.thumb||ph.src)}" alt="" loading="${imgPri?'eager':'lazy'}" decoding="async">`
    : tlIcon(cat);
  const dateBlock = tba
    ? `<div class="tl-dateblock tba"><b>TBA</b><span>Dates</span></div>`
    : `<div class="tl-dateblock"><b>${esc(day)}</b><span>${esc(wd)}${mon?' '+mon:''}</span></div>`;
  const chips = [
    tba ? `<span class="tl-chip tba">Dates TBA</span>` : '',
    `<span class="tl-chip price ${hasPrice(e)?'':'unk'}">${esc(pillText(e))}</span>`,
    attend ? `<span class="tl-chip attend">${esc(attend)}</span>` : ''
  ].filter(Boolean).join('');
  return `<li class="tl-item tl-card-item ${esc(cat)} side-${side}">
    <span class="tl-dot" aria-hidden="true"></span>
    <article class="tl-card" data-slug="${esc(e.slug)}" tabindex="0" role="link" aria-label="${esc(e.name)}">
      <div class="tl-hero ${ph?'hasphoto':'ph'} ${esc(cat)}">${img}${ph?'<div class="tl-hero-shade"></div>':''}${dateBlock}<span class="tl-cat ${esc(cat)}">${esc(catLabel(e))}</span></div>
      <div class="tl-body">
        <div class="tl-range">${esc(fmtEventDates(e))}</div>
        <h3>${esc(e.name)}</h3>
        <div class="tl-where">${flag?`<span class="flag" aria-hidden="true">${flag}</span>`:''}<span>${esc(loc||where(e))}</span></div>
        <div class="tl-chips">${chips}</div>
      </div>
    </article>
  </li>`;
}
const TL_SPINE_BLEND = 56;
function tlSpineEnsure(){
  $$('#tlbody .tl-list').forEach(list => {
    if(list.querySelector(':scope > .tl-spine')) return;
    const el = document.createElement('div');
    el.className = 'tl-spine';
    el.setAttribute('aria-hidden','true');
    el.innerHTML = '<i class="tl-spine-fill"></i>';
    list.insertBefore(el, list.firstChild);
  });
}
function tlSpineAnchor(){
  if(typeof PLAY!=='undefined' && PLAY.on){
    const now = document.querySelector('#tlbody .tl-item.tl-now .tl-dot') || document.querySelector('#tlbody .tl-item.tl-now');
    if(now) return now;
  }
  return document.querySelector('#tlbody .tl-item.tl-today .tl-dot') || document.querySelector('#tlbody .tl-item.tl-today');
}
function tlSpineUpdate(opts){
  opts = opts||{};
  const body = document.getElementById('tlbody');
  if(!body) return;
  tlSpineEnsure();
  const reduce = (typeof playReduced==='function' && playReduced()) || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const tween = !!(opts.tween && !reduce);
  const anchor = tlSpineAnchor();
  const ar = anchor ? anchor.getBoundingClientRect() : null;
  const mid = ar ? (ar.top + ar.height/2) : null;
  $$('#tlbody .tl-list').forEach(list => {
    const spine = list.querySelector(':scope > .tl-spine');
    const fill = spine && spine.querySelector('.tl-spine-fill');
    if(!fill) return;
    spine.classList.toggle('tween', tween);
    const lr = list.getBoundingClientRect();
    let h = 0;
    if(mid==null){
      h = 0;
    }else{
      const y = mid - lr.top;
      if(y <= 0) h = 0;
      else h = Math.min(lr.height, y + TL_SPINE_BLEND/2);
    }
    fill.style.height = Math.max(0, Math.round(h)) + 'px';
  });
}
addEventListener('resize', () => {
  if(document.getElementById('mapwrap') && document.getElementById('mapwrap').classList.contains('timeline-on')){
    tlSpineUpdate({tween:false});
  }
});

function renderTimeline(){
  const body = $('#tlbody');
  const scrub = $('#tlscrub');
  if(!body) return;
  tlDisconnect();
  const list = visibleEvents().filter(e => !isPostponed(e)).slice().sort((a,b) => (a.start_date||'9999').localeCompare(b.start_date||'9999') || (a.name||'').localeCompare(b.name||''));
  if(!list.length){
    body.innerHTML = `<div class="tl-empty">${emptyMessage()}</div>`;
    if(scrub){ scrub.hidden=true; scrub.innerHTML=''; }
    return;
  }
  const months = [];
  const gmap = new Map();
  list.forEach(e => {
    const k = monthKey(e);
    if(!gmap.has(k)){ const g={key:k, items:[]}; gmap.set(k,g); months.push(g); }
    gmap.get(k).items.push(e);
  });
  let todayPlaced = false;
  const todayMonth = TODAY.getFullYear()+'-'+String(TODAY.getMonth()+1).padStart(2,'0');
  let side = 'l';
  let imgLeft = 4;
  const html = months.map(m => {
    const n = m.items.length;
    const parts = monthParts(m.key);
    let items = '';
    if(!todayPlaced && m.key==='tbc'){
      items += todayMarkerHtml();
      todayPlaced = true;
    }
    if(!todayPlaced && m.key!=='tbc' && m.key > todayMonth){
      items += todayMarkerHtml();
      todayPlaced = true;
    }
    m.items.forEach(e => {
      if(!todayPlaced && m.key!=='tbc' && (eventCoversToday(e) || startsOnOrAfterToday(e))){
        items += todayMarkerHtml();
        todayPlaced = true;
      }
      items += eventCardHtml(e, side, imgLeft>0);
      if(imgLeft>0) imgLeft--;
      side = side==='l' ? 'r' : 'l';
    });
    const year = parts.year ? `<div class="tl-year">${esc(parts.year)}</div>` : '';
    return `<section class="tl-month" id="tl-m-${esc(m.key)}" data-m="${esc(m.key)}">
      <header class="tl-month-h">
        <div><div class="tl-kicker">${esc(parts.kicker)}</div><h2 class="tl-name">${esc(parts.name)}</h2>${year}</div>
        <div class="tl-count"><b>${n}</b> ${n===1?'event':'events'}</div>
      </header>
      <ol class="tl-list">${items}</ol>
    </section>`;
  }).join('');
  if(!todayPlaced){
    body.innerHTML = html + `<ol class="tl-list tl-list-end">${todayMarkerHtml()}</ol>`;
  } else body.innerHTML = html;

  if(scrub){
    scrub.hidden = false;
    scrub.innerHTML = months.map((m,i) => {
      const p = monthParts(m.key);
      const lab = p.year ? `${p.short} ${p.year.slice(2)}` : p.short;
      return `<button type="button" data-m="${esc(m.key)}" class="${i===0?'on':''}" aria-current="${i===0?'true':'false'}"><span>${esc(lab)}</span><small>${m.items.length}</small></button>`;
    }).join('');
  }

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = $('#timeline');
  if(!reduce){
    tlRevealObs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if(en.isIntersecting){ en.target.classList.add('tl-in'); tlRevealObs.unobserve(en.target); }
      });
    }, {root, threshold:0.08, rootMargin:'0px 0px -6% 0px'});
    $$('#tlbody .tl-item.tl-card-item').forEach(el => tlRevealObs.observe(el));
  }else{
    $$('#tlbody .tl-item.tl-card-item').forEach(el => el.classList.add('tl-in'));
  }

  const buttons = $$('#tlscrub [data-m]');
  const setOn = key => buttons.forEach(b => {
    const on = b.dataset.m===key;
    b.classList.toggle('on', on);
    b.setAttribute('aria-current', on?'true':'false');
  });
  if(months.length){
    tlMonthObs = new IntersectionObserver(entries => {
      const vis = entries.filter(e => e.isIntersecting).sort((a,b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
      if(vis[0]) setOn(vis[0].target.dataset.m);
    }, {root, threshold:[0.15,0.35], rootMargin:'-15% 0px -50% 0px'});
    $$('#tlbody .tl-month').forEach(sec => tlMonthObs.observe(sec));
  }
  buttons.forEach(b => b.onclick = () => {
    const el = document.getElementById('tl-m-'+b.dataset.m);
    if(el) el.scrollIntoView({behavior: reduce?'auto':'smooth', block:'start'});
  });
  $$('#tlbody .tl-card[data-slug]').forEach(c => {
    const go = () => {
      if(PLAY.on){
        playPause();
        const idx = PLAY.list.findIndex(x => x.slug===c.dataset.slug);
        if(idx>=0) playShow(idx, {replace:true});
        else {
          const ev = EV.find(x => x.slug===c.dataset.slug);
          if(ev) playOpenPanel(ev);
        }
        return;
      }
      location.hash = '#/timeline/event/'+c.dataset.slug;
    };
    c.onclick = ev => { if(!ev.target.closest('a')) go(); };
    c.onkeydown = ev => { if(ev.key==='Enter' || (ev.key===' ' && !PLAY.on)){ ev.preventDefault(); go(); } };
  });
  if(PLAY.on) playMarkCard();
  tlSpineUpdate({tween:false});
}
$$('#viewbar button').forEach(b => b.onclick = () => {
  const v = b.dataset.v;
  if(v==='timeline' && /^#\/timeline/.test(location.hash||'')) return;
  location.hash = v==='map' ? '#/' : '#/'+v;
});


/* ---------- timeline presentation ---------- */
const PLAY_BASE = 7000;
const PLAY = {
  on:false, paused:true, i:0, list:[], speed:1,
  t0:0, elapsed:0, dur:PLAY_BASE, raf:0,
  prog:false, navigating:false, suppressAuto:false,
  swapT:0, swapClear:0
};
try{
  const sp = parseFloat(localStorage.getItem('gconf-atlas-play-speed')||'');
  if(sp===0.5||sp===1||sp===1.5||sp===2) PLAY.speed = sp;
}catch(_){}
function playReduced(){
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function playEvents(){
  return visibleEvents().filter(hasDates).slice().sort((a,b) => (a.start_date||'9999').localeCompare(b.start_date||'9999') || (a.name||'').localeCompare(b.name||''));
}
function playMapVisible(){
  return !!(PLAY.on && $('#map'));
}

/* Cinematic map tour during presentation.
   Pitch/bearing are not used: MapLibre can do them, but Leaflet pins, the
   ripple and the route arc live in Leaflet's 2D overlay and would drift.
   The flight itself is a zoom-out / great-circle / zoom-in, with a dashed
   route and a pulsing pin — premium without breaking alignment. */
const TOUR = { arcs:[], ripple:null, pin:null, raf:0, timers:[], prev:null, path:null, growing:null };

function tourPane(){
  if(!map.getPane('tour')){
    map.createPane('tour');
    const p = map.getPane('tour');
    p.style.zIndex = 650;
    p.style.pointerEvents = 'none';
  }
  return map.getPane('tour');
}
function tourClearTimers(){
  TOUR.timers.forEach(id => clearTimeout(id));
  TOUR.timers = [];
  if(TOUR.raf){ cancelAnimationFrame(TOUR.raf); TOUR.raf=0; }
  try{ map.stop(); }catch(_){}
  flySfxStop(true);
}
function tourLater(fn, ms){
  const id = setTimeout(fn, ms);
  TOUR.timers.push(id);
  return id;
}
function tourClearGraphics(){
  tourClearTimers();
  TOUR.arcs.forEach(l => { try{ map.removeLayer(l); }catch(_){} });
  TOUR.arcs = [];
  if(TOUR.growing){ try{ map.removeLayer(TOUR.growing); }catch(_){} TOUR.growing=null; }
  if(TOUR.ripple){ try{ map.removeLayer(TOUR.ripple); }catch(_){} TOUR.ripple=null; }
  if(TOUR.pin){ try{ map.removeLayer(TOUR.pin); }catch(_){} TOUR.pin=null; }
  if(TOUR.plane){ try{ map.removeLayer(TOUR.plane); }catch(_){} TOUR.plane=null; }
  TOUR.path = null;
  TOUR.prev = null;
}
function tourTeardown(){
  tourClearGraphics();
  const wrap = $('#mapwrap'), app = $('#app'), cap = $('#tourcaption');
  if(wrap) wrap.classList.remove('play-tour');
  if(app) app.classList.remove('play-tour');
  if(cap){ cap.hidden = true; cap.setAttribute('aria-hidden','true'); }
  try{ map.invalidateSize({animate:false}); }catch(_){}
}
function tourPrep(){
  const wrap = $('#mapwrap'), app = $('#app');
  if(wrap) wrap.classList.add('play-tour');
  if(app) app.classList.add('play-tour');
  tourPane();
  try{ map.invalidateSize({animate:false}); }catch(_){}
}
function tourPadding(){
  const desk = innerWidth>860;
  const det = $('#detail');
  const stripEl = $('#timeline');
  const sideEl = $('#sidebar');
  /* Use layout width (offsetWidth), not getBoundingClientRect, so a mid-slide
     transform on the floating detail card cannot shrink the map padding and
     frame the airplane under the panel. */
  const layoutW = (el) => {
    if(!el) return 0;
    const s = getComputedStyle(el);
    if(s.display==='none') return 0;
    return el.offsetWidth||0;
  };
  if(!desk){
    const open = det && det.classList.contains('open');
    return {
      left: 0,
      right: 12,
      top: 70,
      bottom: (open ? Math.min(det.offsetHeight||0, innerHeight*0.54) : 0) + 86
    };
  }
  const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset')) || 14;
  const leftEl = (stripEl && getComputedStyle(stripEl).display!=='none') ? stripEl : sideEl;
  const Lw = layoutW(leftEl);
  const Rw = (det && det.classList.contains('open')) ? layoutW(det) : 0;
  const left = Lw ? Math.round(inset + Lw) + 8 : 14;
  const right = Rw ? Math.round(inset + Rw) + 8 : 14;
  return { left, right, top: 70, bottom: 108 };
}
function tourFocus(ll, z){
  const pad = tourPadding();
  const size = map.getSize();
  const ox = (pad.left - pad.right)/2;
  const oy = (pad.top - pad.bottom)/2;
  return map.unproject(map.project(ll, z).subtract([ox, oy]), z);
}
function tourZoom(e){
  if(!e || e.lat==null) return 5;
  return e.precise===true ? 13 : 11;
}
function lerpGc(a, b, steps){
  const toRad = Math.PI/180, toDeg = 180/Math.PI;
  const lat1=a.lat*toRad, lon1=a.lng*toRad, lat2=b.lat*toRad, lon2=b.lng*toRad;
  const d = 2*Math.asin(Math.min(1, Math.sqrt(Math.pow(Math.sin((lat2-lat1)/2),2) + Math.cos(lat1)*Math.cos(lat2)*Math.pow(Math.sin((lon2-lon1)/2),2))));
  if(!(d>1e-8)) return [a, b];
  const pts=[];
  const n = Math.max(8, steps|0);
  for(let i=0;i<=n;i++){
    const f=i/n, A=Math.sin((1-f)*d)/Math.sin(d), B=Math.sin(f*d)/Math.sin(d);
    const x=A*Math.cos(lat1)*Math.cos(lon1)+B*Math.cos(lat2)*Math.cos(lon2);
    const y=A*Math.cos(lat1)*Math.sin(lon1)+B*Math.cos(lat2)*Math.sin(lon2);
    const z=A*Math.sin(lat1)+B*Math.sin(lat2);
    pts.push(L.latLng(Math.atan2(z,Math.sqrt(x*x+y*y))*toDeg, Math.atan2(y,x)*toDeg));
  }
  return pts;
}
function tourCaption(e){
  const cap = $('#tourcaption');
  if(!cap) return;
  if(!e){ cap.hidden = true; cap.setAttribute('aria-hidden','true'); return; }
  const loc = [e.city, e.country].filter(Boolean).join(', ') || 'Location to be published';
  const flag = typeof flagOf==='function' ? flagOf(e.country) : '';
  const kicker = (PLAY.i+1)+' of '+PLAY.list.length;
  const k = $('#tourkicker'), c = $('#tourcity'), d = $('#tourdate'), n = $('#tourname');
  if(k) k.textContent = kicker + (e.lat==null ? ' · Pin not published' : '');
  if(c) c.textContent = (flag ? flag+' ' : '') + loc;
  if(d) d.textContent = e ? fmtEventDates(e) : '';
  if(n) n.textContent = e.name || '';
  cap.hidden = false;
  cap.setAttribute('aria-hidden','false');
  cap.classList.remove('in');
  void cap.offsetWidth;
  cap.classList.add('in');
}
function tourDropPin(e, reduce){
  if(TOUR.ripple){ try{ map.removeLayer(TOUR.ripple); }catch(_){} TOUR.ripple=null; }
  if(TOUR.pin){ try{ map.removeLayer(TOUR.pin); }catch(_){} TOUR.pin=null; }
  if(!e || e.lat==null || e.lng==null) return;
  const ll = L.latLng(e.lat, e.lng);
  const pin = L.marker(ll, {
    pane:'tour',
    interactive:false,
    keyboard:false,
    zIndexOffset:2000,
    icon: L.divIcon({
      className:'tour-marker',
      html:`<span class="tour-pin ${esc(e.category||'')} ${reduce?'reduced':''}"><i></i></span>`,
      iconSize:[28,28],
      iconAnchor:[14,14]
    })
  }).addTo(map);
  const ripple = L.marker(ll, {
    pane:'tour',
    interactive:false,
    keyboard:false,
    zIndexOffset:1990,
    icon: L.divIcon({
      className:'tour-ripple-wrap',
      html:`<span class="tour-ripple ${reduce?'reduced':''}"></span><span class="tour-ripple delay ${reduce?'reduced':''}"></span>`,
      iconSize:[120,120],
      iconAnchor:[60,60]
    })
  }).addTo(map);
  TOUR.pin = pin;
  TOUR.ripple = ripple;
  flySfxChime();
}
function tourArcStyle(opts){
  opts = opts||{};
  return {
    pane:'tour',
    color: opts.color || '#CFF55A',
    weight: opts.weight || 2.5,
    opacity: opts.opacity==null ? 0.95 : opts.opacity,
    dashArray: '10 12',
    lineCap:'round',
    lineJoin:'round',
    className: 'tour-arc' + (opts.past ? ' past' : '') + (opts.animate ? ' run' : ''),
    interactive:false
  };
}
function tourDrawPast(pts, reduce){
  TOUR.arcs.forEach(l => {
    try{ l.setStyle({opacity:0.28, weight:2, className:'tour-arc past'}); }catch(_){}
  });
  // cap stored arcs
  while(TOUR.arcs.length>8){
    const old = TOUR.arcs.shift();
    try{ map.removeLayer(old); }catch(_){}
  }
}
function tourEase(t){
  return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
}
function tourSameHop(a, b){
  if(!a || !b) return true;
  try{ return map.distance(a, b) < 45000; }catch(_){ return false; }
}
function tourPointOnPath(pts, t){
  if(!pts || !pts.length) return null;
  if(t<=0) return { ll:pts[0], i:0 };
  if(t>=1) return { ll:pts[pts.length-1], i:pts.length-1 };
  const dists=[0];
  let total=0;
  for(let i=1;i<pts.length;i++){
    total += map.distance(pts[i-1], pts[i]);
    dists.push(total);
  }
  if(total<=0) return { ll:pts[0], i:0 };
  const target=t*total;
  for(let i=1;i<pts.length;i++){
    if(dists[i]>=target){
      const span=dists[i]-dists[i-1]||1;
      const f=(target-dists[i-1])/span;
      const a=pts[i-1], b=pts[i];
      return { ll:L.latLng(a.lat+(b.lat-a.lat)*f, a.lng+(b.lng-a.lng)*f), i, a, b };
    }
  }
  return { ll:pts[pts.length-1], i:pts.length-1 };
}
const TOUR_PLANE_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#CFF55A" stroke="#12181F" stroke-width="2.2" stroke-linejoin="round" d="M32 4c1.6 0 2.7 1.2 3.1 3.6L39 28l18 7.2v4.2L39 36.2 36.6 52l8 5.2V61L32 57.2 19.4 61v-3.8l8-5.2L25 36.2 7 39.4v-4.2L25 28l3.9-20.4C29.3 5.2 30.4 4 32 4z"/></svg>';

function tourFramePath(pts, duration){
  const bounds = L.latLngBounds(pts);
  const pad = tourPadding();
  map.fitBounds(bounds.pad(0.2), {
    paddingTopLeft:[pad.left+20, pad.top+16],
    paddingBottomRight:[pad.right+20, pad.bottom+24],
    maxZoom:8,
    animate:true,
    duration:(duration||600)/1000,
    easeLinearity:0.35
  });
}

/* Play-mode flight sound is synthesised in the browser with the Web Audio
   API (filtered noise plus a low oscillator). No third-party recording is used. */
const FLYSFX_KEY = 'gconf-atlas-play-sound';
const FLYSFX_HINT_KEY = 'gconf-atlas-play-sound-hint';
const FLYSFX = { on:false, ctx:null, master:null, nodes:null, flew:false, t0:0, dur:0, hintT:0, hinted:false, hinting:false };
try{ FLYSFX.on = localStorage.getItem(FLYSFX_KEY)==='1'; }catch(_){}
try{ FLYSFX.hinted = localStorage.getItem(FLYSFX_HINT_KEY)==='1'; }catch(_){}

function flySfxUnlock(){
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return null;
  if(!FLYSFX.ctx){
    FLYSFX.ctx = new AC();
    FLYSFX.master = FLYSFX.ctx.createGain();
    FLYSFX.master.gain.value = 1;
    FLYSFX.master.connect(FLYSFX.ctx.destination);
  }
  if(FLYSFX.ctx.state==='suspended'){
    try{ FLYSFX.ctx.resume(); }catch(_){}
  }
  return FLYSFX.ctx;
}
function flySfxStop(immediate){
  const ctx = FLYSFX.ctx;
  const pack = FLYSFX.nodes;
  FLYSFX.nodes = null;
  if(immediate) FLYSFX.flew = false;
  if(!pack || !ctx) return;
  const now = ctx.currentTime;
  try{
    pack.gain.gain.cancelScheduledValues(now);
    if(immediate){
      pack.gain.gain.setValueAtTime(0, now);
      pack.stop();
    }else{
      const cur = pack.gain.gain.value;
      pack.gain.gain.setValueAtTime(cur, now);
      pack.gain.gain.linearRampToValueAtTime(0, now+0.08);
      setTimeout(() => { try{ pack.stop(); }catch(_){} }, 120);
    }
  }catch(_){ try{ pack.stop(); }catch(_){ } }
}
function flySfxStartWhoosh(durationMs){
  flySfxStop(true);
  if(!FLYSFX.on || playReduced() || !PLAY.on) return;
  const ctx = flySfxUnlock();
  if(!ctx) return;
  const dur = Math.max(0.8, (durationMs||1600)/1000);
  const now = ctx.currentTime;
  const attack = Math.min(0.4, dur*0.18);
  const release = Math.min(0.5, dur*0.22);
  const peak = 0.055;
  const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<len;i++) data[i] = (Math.random()*2-1)*0.85;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 400;
  filter.Q.value = 0.75;
  filter.frequency.setValueAtTime(260, now);
  filter.frequency.linearRampToValueAtTime(640, now+dur*0.45);
  filter.frequency.linearRampToValueAtTime(300, now+dur);
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 1;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 82;
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = 41;
  const oscGain = ctx.createGain();
  oscGain.gain.value = 0.32;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 16;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.12;
  lfo.connect(lfoGain);
  lfoGain.connect(noiseGain.gain);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now+attack);
  const hold = Math.max(attack, dur-release);
  gain.gain.setValueAtTime(peak, now+hold);
  gain.gain.linearRampToValueAtTime(0, now+dur);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(gain);
  osc.connect(oscGain);
  osc2.connect(oscGain);
  oscGain.connect(gain);
  gain.connect(FLYSFX.master);
  noise.start(now);
  osc.start(now);
  osc2.start(now);
  lfo.start(now);
  const stopAt = now+dur+0.05;
  try{ noise.stop(stopAt); osc.stop(stopAt); osc2.stop(stopAt); lfo.stop(stopAt); }catch(_){}
  FLYSFX.nodes = {
    gain, noise, osc, osc2, lfo,
    stop(){
      ['noise','osc','osc2','lfo'].forEach(k => { try{ this[k].stop(); }catch(_){} });
      try{ noise.disconnect(); filter.disconnect(); noiseGain.disconnect(); osc.disconnect(); osc2.disconnect(); oscGain.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect(); }catch(_){}
    }
  };
  FLYSFX.flew = true;
  FLYSFX.t0 = performance.now();
  FLYSFX.dur = durationMs||1600;
}
function flySfxChime(){
  if(!FLYSFX.on || playReduced() || !FLYSFX.flew) return;
  FLYSFX.flew = false;
  const ctx = flySfxUnlock();
  if(!ctx) return;
  const now = ctx.currentTime;
  [523.25, 783.99].forEach((f,i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    const start = now + i*0.045;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.04, start+0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start+0.55);
    o.connect(g);
    g.connect(FLYSFX.master);
    o.start(start);
    o.stop(start+0.6);
  });
}
function flySfxPlaceHint(tip, btn){
  if(!tip || !btn) return;
  const r = btn.getBoundingClientRect();
  const dock = $('#playdock') || $('#playbar');
  const br = dock ? dock.getBoundingClientRect() : r;
  tip.style.position = 'fixed';
  tip.style.left = Math.round(r.left + r.width/2) + 'px';
  tip.style.top = 'auto';
  tip.style.bottom = Math.round(Math.max(8, innerHeight - Math.min(r.top, br.top) + 10)) + 'px';
  tip.style.transform = 'translateX(-50%)';
  tip.style.zIndex = '1100';
}
function flySfxDismissHint(persist){
  const btn = $('#playsound');
  if(btn) btn.classList.remove('hint');
  document.querySelectorAll('.play-sound-hint').forEach(el => el.remove());
  if(FLYSFX.hintT){ clearTimeout(FLYSFX.hintT); FLYSFX.hintT=0; }
  FLYSFX.hinting = false;
  if(persist){
    FLYSFX.hinted = true;
    try{ localStorage.setItem(FLYSFX_HINT_KEY, '1'); }catch(_){}
  }
}
function flySfxMaybeHint(){
  if(FLYSFX.hinted || FLYSFX.hinting || playReduced() || !PLAY.on) return;
  const btn = $('#playsound');
  const bar = $('#playbar');
  if(!btn || (bar && bar.hidden)) return;
  FLYSFX.hinting = true;
  let tip = document.querySelector('.play-sound-hint');
  if(!tip){
    tip = document.createElement('span');
    tip.className = 'play-sound-hint';
    tip.setAttribute('role','status');
    tip.textContent = 'Flight sound';
    document.body.appendChild(tip);
  }
  flySfxPlaceHint(tip, btn);
  btn.classList.add('hint');
  if(FLYSFX.hintT) clearTimeout(FLYSFX.hintT);
  FLYSFX.hintT = setTimeout(() => flySfxDismissHint(true), 4200);
}
function flySfxToggle(){
  FLYSFX.on = !FLYSFX.on;
  try{ localStorage.setItem(FLYSFX_KEY, FLYSFX.on?'1':'0'); }catch(_){}
  flySfxDismissHint(true);
  if(FLYSFX.on){
    flySfxUnlock();
    if(TOUR.plane && PLAY.on && !playReduced()){
      const elapsed = FLYSFX.t0 ? (performance.now()-FLYSFX.t0) : 0;
      const remain = Math.max(600, (FLYSFX.dur||1600)-elapsed);
      flySfxStartWhoosh(remain);
    }
  }else{
    flySfxStop(true);
  }
  playUpdateChrome();
}
function flySfxUpdateChrome(){
  const btn = $('#playsound');
  if(!btn) return;
  btn.classList.toggle('on', !!FLYSFX.on);
  btn.setAttribute('aria-pressed', FLYSFX.on?'true':'false');
  btn.setAttribute('aria-label', FLYSFX.on?'Sound on':'Sound off');
  btn.title = FLYSFX.on?'Sound on':'Sound off';
  const lab = btn.querySelector('.play-sound-lab');
  if(lab) lab.textContent = 'Sound';
}

function tourFlyPlane(pts, duration, done){
  if(TOUR.plane){ try{ map.removeLayer(TOUR.plane); }catch(_){} TOUR.plane=null; }
  if(TOUR.growing){ try{ map.removeLayer(TOUR.growing); }catch(_){} TOUR.growing=null; }
  if(!pts || pts.length<2){ if(done) done(); return; }
  const line = L.polyline([pts[0]], tourArcStyle({animate:true})).addTo(map);
  TOUR.growing = line;
  const plane = L.marker(pts[0], {
    pane:'tour',
    interactive:false,
    keyboard:false,
    zIndexOffset:3000,
    icon: L.divIcon({
      className:'tour-plane-wrap',
      html:'<div class="tour-plane">'+TOUR_PLANE_SVG+'</div>',
      iconSize:[52,52],
      iconAnchor:[26,26]
    })
  }).addTo(map);
  TOUR.plane = plane;
  flySfxStartWhoosh(duration);
  const t0 = performance.now();
  let lastAng = null;
  const step = (now) => {
    const raw = Math.min(1, (now-t0)/Math.max(240, duration));
    const t = tourEase(raw);
    const pos = tourPointOnPath(pts, t);
    const ahead = tourPointOnPath(pts, Math.min(1, t+0.03));
    plane.setLatLng(pos.ll);
    const p1 = map.latLngToLayerPoint(pos.ll);
    const p2 = map.latLngToLayerPoint(ahead.ll);
    let ang = Math.atan2(p2.y-p1.y, p2.x-p1.x)*180/Math.PI + 90;
    if(lastAng!=null){
      while(ang-lastAng>180) ang-=360;
      while(ang-lastAng<-180) ang+=360;
      ang = lastAng + (ang-lastAng)*0.4;
    }
    lastAng = ang;
    const el = plane.getElement && plane.getElement();
    const inner = el && el.querySelector('.tour-plane');
    if(inner) inner.style.transform = 'rotate('+ang+'deg)';
    const n = Math.max(2, Math.floor(t*(pts.length-1))+1);
    line.setLatLngs(pts.slice(0, n));
    if(raw<1 && PLAY.on){ TOUR.raf = requestAnimationFrame(step); }
    else {
      TOUR.raf = 0;
      line.setLatLngs(pts);
      TOUR.arcs.push(line);
      TOUR.growing = null;
      if(inner) inner.classList.add('landed');
      tourLater(() => {
        if(TOUR.plane){ try{ map.removeLayer(TOUR.plane); }catch(_){} TOUR.plane=null; }
        if(done) done();
      }, 160);
    }
  };
  TOUR.raf = requestAnimationFrame(step);
}
function tourTo(e){
  tourClearTimers();
  if(TOUR.plane){ try{ map.removeLayer(TOUR.plane); }catch(_){} TOUR.plane=null; }
  tourCaption(e);
  const reduce = playReduced();
  const has = e && e.lat!=null && e.lng!=null;
  const ll = has ? L.latLng(e.lat, e.lng) : null;
  const prev = TOUR.prev;
  if(!has){
    tourDropPin(null, reduce);
    TOUR.prev = null;
    return;
  }
  const z = tourZoom(e);
  const dest = tourFocus(ll, z);
  let path = null;
  let dist = 0;
  if(prev && (prev.lat!==ll.lat || prev.lng!==ll.lng)){
    dist = map.distance(prev, ll);
    const steps = Math.max(20, Math.min(80, Math.round(dist/30000)));
    path = lerpGc(prev, ll, steps);
    tourDrawPast(path, reduce);
  }
  const finish = () => { tourDropPin(e, reduce); TOUR.prev = ll; };
  try{ map.stop(); }catch(_){}
  if(reduce){
    if(path && path.length>1){
      const line = L.polyline(path, tourArcStyle({animate:false, opacity:0.55})).addTo(map);
      TOUR.arcs.push(line);
    }
    map.setView(dest, z, {animate:false});
    finish();
    return;
  }
  const zoomDur = Math.max(700, Math.min(1200, 900/(PLAY.speed||1)));
  const hop = !path || path.length<2 || tourSameHop(prev, ll);
  if(hop){
    if(path && path.length>1){
      const line = L.polyline(path, tourArcStyle({animate:false, opacity:0.5, weight:2})).addTo(map);
      TOUR.arcs.push(line);
    }
    map.flyTo(dest, z, {duration: Math.max(500, zoomDur*0.7)/1000, easeLinearity:0.3});
    tourLater(finish, Math.max(500, zoomDur*0.7));
    return;
  }
  const frameDur = Math.max(420, Math.min(720, 560/(PLAY.speed||1)));
  const flyDur = Math.max(1200, Math.min(2400, 900+dist/650)) / (PLAY.speed||1);
  tourFramePath(path, frameDur);
  tourLater(() => {
    tourFlyPlane(path, flyDur, () => {
      map.flyTo(dest, z, {duration: zoomDur/1000, easeLinearity:0.25});
      tourLater(finish, zoomDur);
    });
  }, frameDur);
}

function atlasCloseDetail(){
  if(PLAY.on){
    playPause();
    const e = PLAY.list[PLAY.i];
    playSetHash(e ? e.slug : '', true);
    const det=$('#detail');
    det.classList.remove('open'); det.setAttribute('aria-hidden','true');
    const body=$('#dbody'); if(body) body.innerHTML='';
    carStop();
    return;
  }
  location.hash = /^#\/timeline/.test(location.hash||'') ? '#/timeline' : '#/';
}
window.atlasCloseDetail = atlasCloseDetail;

function playSetHash(slug, replace){
  const h = slug ? '#/timeline/play/'+slug : '#/timeline/play';
  if((location.hash||'')===h) return;
  PLAY.navigating = true;
  if(replace) history.replaceState(null, '', h);
  else location.hash = h;
  setTimeout(() => { PLAY.navigating = false; }, 40);
}

function playFill(p){
  const el = $('#playfill');
  if(el) el.style.width = (Math.max(0, Math.min(1, p))*100)+'%';
}
function playUpdateChrome(){
  const e = PLAY.list[PLAY.i];
  const pos = $('#playpos'), title = $('#playtitle'), tog = $('#playtoggle');
  if(pos) pos.textContent = PLAY.list.length ? (PLAY.i+1)+' / '+PLAY.list.length : '–';
  if(title) title.textContent = e ? e.name : '';
  const playing = PLAY.on && !PLAY.paused;
  if(tog){
    tog.textContent = playing ? '❚❚' : '▶';
    tog.setAttribute('aria-label', playing ? 'Pause presentation' : 'Play presentation');
    tog.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
  $$('#playbar .play-speeds button').forEach(b => b.classList.toggle('on', parseFloat(b.dataset.sp)===PLAY.speed));
  flySfxUpdateChrome();
  const dock = $('#playdock'), bar = $('#playbar'), btn = $('#tlplay'), app = $('#app');
  if(app) app.classList.toggle('play-on', PLAY.on);
  if(dock) dock.hidden = !PLAY.on;
  if(bar) bar.hidden = !PLAY.on;
  if(btn) btn.hidden = PLAY.on;
  if(PLAY.on) flySfxMaybeHint();
}

function playMarkCard(){
  $$('#tlbody .tl-now').forEach(el => el.classList.remove('tl-now'));
  const e = PLAY.list[PLAY.i];
  if(!e || !PLAY.on) return;
  const card = document.querySelector('#tlbody .tl-card[data-slug="'+CSS.escape(e.slug)+'"]');
  if(!card) return;
  card.classList.add('tl-now');
  const item = card.closest('.tl-item');
  if(item) item.classList.add('tl-now');
  tlSpineUpdate({tween:true});
  playArmProg(playReduced() ? 80 : 900);
  const reduce = playReduced();
  const scroller = $('#timeline');
  if(scroller && item){
    const s = scroller.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    const top = scroller.scrollTop + (r.top + r.height/2) - (s.top + s.height/2);
    try{ scroller.scrollTo({top, behavior: reduce?'auto':'smooth'}); }catch(_){ scroller.scrollTop = top; }
  }
}

function playSwapClearTimers(){
  if(PLAY.swapT){ clearTimeout(PLAY.swapT); PLAY.swapT=0; }
  if(PLAY.swapClear){ clearTimeout(PLAY.swapClear); PLAY.swapClear=0; }
}
function playWrapDetailPane(body){
  let pane = body.querySelector('.dswap-pane:not(.dswap-out)');
  if(pane) return pane;
  if(!body.innerHTML.trim()) return null;
  pane = document.createElement('div');
  pane.className = 'dswap-pane dswap-show';
  while(body.firstChild) pane.appendChild(body.firstChild);
  body.appendChild(pane);
  return pane;
}
function playOpenPanel(e){
  const det = $('#detail');
  const body = $('#dbody');
  det.classList.add('open'); det.setAttribute('aria-hidden','false');
  if(innerWidth<=860) $('#sidebar').classList.add('collapsed');
  playSwapClearTimers();
  const reduce = playReduced();
  const current = playWrapDetailPane(body);
  if(current && current.dataset.slug===e.slug && current.classList.contains('dswap-show')){
    bindGallery(e, current);
    updateAlertPrefs(undefined, e);
    return;
  }
  try{ carStop(); }catch(_){}
  body.querySelectorAll('.dswap-pane.dswap-out').forEach(el => el.remove());
  const incoming = document.createElement('div');
  incoming.className = 'dswap-pane dswap-in' + (reduce?' reduce':'');
  incoming.dataset.slug = e.slug||'';
  incoming.innerHTML = viewEvent(e);
  if(current){
    current.classList.add('dswap-out');
    current.classList.remove('dswap-show');
    current.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  }
  body.appendChild(incoming);
  const arm = () => {
    incoming.classList.add('dswap-show');
    bindGallery(e, incoming);
    updateAlertPrefs(undefined, e);
  };
  /* Visual only: never delay tourTo / play timing for the swap.
     Incoming uses a CSS animation-delay so the outgoing pane covers the gap. */
  arm();
  if(current){
    const outMs = reduce ? 180 : 250;
    PLAY.swapClear = setTimeout(() => {
      PLAY.swapClear=0;
      if(current.parentNode) current.remove();
    }, outMs + (reduce ? 220 : 350) + 40);
  }
}

function playShow(i, opts){
  opts = opts||{};
  if(!PLAY.list.length){ playExit({silent:true}); return; }
  i = Math.max(0, Math.min(PLAY.list.length-1, i));
  PLAY.i = i;
  PLAY.elapsed = 0;
  PLAY.dur = PLAY_BASE / (PLAY.speed||1);
  PLAY.t0 = 0;
  const e = PLAY.list[i];
  playOpenPanel(e);
  playMarkCard();
  playUpdateChrome();
  playFill(0);
  playSetHash(e.slug, opts.replace!==false);
  tourClearTimers();
  try{ map.invalidateSize({animate:false}); }catch(_){}
  tourLater(() => tourTo(e), 60);
}

function playSyncGallery(){
  if(playReduced() || !PLAY.on || PLAY.paused) return;
  const n = (CAR.list||[]).length;
  if(n<2 || !CAR.el) return;
  const step = Math.max(1800, Math.min(3000, PLAY.dur / n));
  const idx = Math.floor(PLAY.elapsed / step) % n;
  if(idx!==CAR.i) carGo(idx, true);
}

function playTick(now){
  if(!PLAY.on || PLAY.paused){ PLAY.raf=0; return; }
  if(!PLAY.t0) PLAY.t0 = now - PLAY.elapsed;
  PLAY.elapsed = now - PLAY.t0;
  const p = Math.min(1, PLAY.elapsed / PLAY.dur);
  playFill(p);
  playSyncGallery();
  if(p>=1){
    if(PLAY.i >= PLAY.list.length-1){
      playPause();
      playFill(1);
      return;
    }
    playShow(PLAY.i+1, {replace:true});
    PLAY.t0 = performance.now();
    PLAY.elapsed = 0;
  }
  PLAY.raf = requestAnimationFrame(playTick);
}

function playResume(){
  if(!PLAY.on || !PLAY.list.length) return;
  PLAY.paused = false;
  PLAY.dur = PLAY_BASE / (PLAY.speed||1);
  PLAY.t0 = performance.now() - PLAY.elapsed;
  if(TOUR.plane && FLYSFX.on && !playReduced()){
    const elapsed = FLYSFX.t0 ? (performance.now()-FLYSFX.t0) : 0;
    const remain = Math.max(500, (FLYSFX.dur||1600)-elapsed);
    flySfxStartWhoosh(remain);
  }
  playUpdateChrome();
  if(!PLAY.raf) PLAY.raf = requestAnimationFrame(playTick);
}
function playPause(){
  if(!PLAY.on) return;
  if(PLAY.raf){ cancelAnimationFrame(PLAY.raf); PLAY.raf=0; }
  if(!PLAY.paused && PLAY.t0) PLAY.elapsed = performance.now() - PLAY.t0;
  PLAY.paused = true;
  flySfxStop(true);
  playUpdateChrome();
}
function playToggle(){
  if(!PLAY.on){ playEnter({auto:true}); return; }
  if(PLAY.paused) playResume(); else playPause();
}
function playStep(d){
  if(!PLAY.on) return;
  const ni = PLAY.i + d;
  if(ni<0 || ni>=PLAY.list.length) return;
  const wasPaused = PLAY.paused;
  playShow(ni, {replace:true});
  if(!wasPaused) playResume();
}
function playSetSpeed(s){
  s = parseFloat(s);
  if(!(s===0.5||s===1||s===1.5||s===2)) return;
  const frac = PLAY.dur ? (PLAY.elapsed / PLAY.dur) : 0;
  PLAY.speed = s;
  PLAY.dur = PLAY_BASE / s;
  PLAY.elapsed = frac * PLAY.dur;
  if(!PLAY.paused) PLAY.t0 = performance.now() - PLAY.elapsed;
  try{ localStorage.setItem('gconf-atlas-play-speed', String(s)); }catch(_){}
  playUpdateChrome();
}

function playSelectedSlug(opts){
  opts = opts||{};
  if(opts.slug) return opts.slug;
  const h = location.hash||'';
  const m = h.match(/^#\/(?:timeline\/(?:play|event)\/|event\/)([^/?#]+)/);
  if(m){ try{ return decodeURIComponent(m[1]); }catch(_){ return m[1]; } }
  const card = document.querySelector('#tlbody .tl-card.tl-now[data-slug]');
  if(card && card.dataset.slug) return card.dataset.slug;
  return '';
}
function playEnter(opts){
  opts = opts||{};
  if(PLAY.navigating && PLAY.on && !opts.force) return;
  if(PLAY.raf){ cancelAnimationFrame(PLAY.raf); PLAY.raf=0; }
  tourClearTimers();
  PLAY.prog = false; clearTimeout(PLAY.progT);
  PLAY.list = playEvents();
  if(!PLAY.list.length) return;
  const slug = playSelectedSlug(opts);
  let i = 0;
  if(slug){
    const j = PLAY.list.findIndex(e => e.slug===slug);
    if(j>=0) i=j;
  }
  PLAY.on = true;
  PLAY.i = i;
  PLAY.elapsed = 0;
  PLAY.t0 = 0;
  PLAY.suppressAuto = false;
  document.getElementById('app').classList.add('play-on');
  tourPrep();
  /* Seed the previous hop from the current map view so the first flight
     leaves wherever the user is looking, even after Stop (which nulls
     TOUR.prev) or a mid-timeline card click that never panned the map. */
  try{
    const here = map.getCenter();
    TOUR.prev = here ? L.latLng(here.lat, here.lng) : null;
  }catch(_){ TOUR.prev = null; }
  playShow(i, {replace:true});
  const shouldPlay = opts.auto!==false && !playReduced() && !opts.paused;
  if(shouldPlay) playResume();
  else playPause();
}

function playExit(opts){
  opts = opts||{};
  if(!PLAY.on && !document.getElementById('app').classList.contains('play-on')) return;
  if(PLAY.raf){ cancelAnimationFrame(PLAY.raf); PLAY.raf=0; }
  playSwapClearTimers();
  flySfxDismissHint(false);
  PLAY.on = false;
  PLAY.paused = true;
  PLAY.elapsed = 0;
  PLAY.t0 = 0;
  PLAY.suppressAuto = true;
  playFill(0);
  $$('#tlbody .tl-now').forEach(el => el.classList.remove('tl-now'));
  document.getElementById('app').classList.remove('play-on');
  tlSpineUpdate({tween:true});
  tourTeardown();
  playUpdateChrome();
  const bar=$('#playbar'); if(bar) bar.hidden=true;
  const btn=$('#tlplay'); if(btn) btn.hidden=false;
  if(!opts.keepDetail){
    const det=$('#detail');
    if(det && !opts.silent){
      /* keep open only if asked */
    }
    if(!opts.keepDetail && det){
      det.classList.remove('open'); det.setAttribute('aria-hidden','true');
      const body=$('#dbody'); if(body && !opts.keepDetail) body.innerHTML='';
      carStop();
    }
  }
  if(!opts.silent && !opts.keepHash){
    const h = location.hash||'';
    if(/^#\/timeline\/play/.test(h)){
      PLAY.navigating = true;
      const e = PLAY.list[PLAY.i];
      history.replaceState(null, '', opts.keepDetail && e ? '#/timeline/event/'+e.slug : '#/timeline');
      setTimeout(() => { PLAY.navigating = false; }, 40);
    }
  }
}

function playReconcile(){
  if(!PLAY.on) return;
  const slug = (PLAY.list[PLAY.i]||{}).slug;
  PLAY.list = playEvents();
  if(!PLAY.list.length){ playExit({silent:true}); return; }
  const j = slug ? PLAY.list.findIndex(e => e.slug===slug) : 0;
  PLAY.i = j>=0 ? j : 0;
  playShow(PLAY.i, {replace:true});
  playPause();
}

function playArmProg(ms){
  PLAY.prog = true;
  clearTimeout(PLAY.progT);
  const settle = Math.max(80, ms||200);
  const bump = () => {
    clearTimeout(PLAY.progT);
    PLAY.progT = setTimeout(() => { PLAY.prog = false; }, settle);
  };
  bump();
  const tl = $('#timeline');
  if(tl && !tl._progBound){
    tl._progBound = true;
    const onScroll = () => { if(PLAY.prog) bump(); };
    tl.addEventListener('scroll', onScroll, {passive:true, capture:true});
    tl.addEventListener('scrollend', () => { if(PLAY.prog) bump(); }, {passive:true});
  }
}
function playUserInteract(ev){
  if(!PLAY.on || PLAY.paused) return;
  if(PLAY.prog) return;
  if(ev && ev.target && ev.target.closest && ev.target.closest('#playbar,#playdock,#playbrand,#tlplay,.playbar,.play-brand,.playdock,.panel-resizer,.logo,.tl-brand')) return;
  /* Programmatic scrollTo in playMarkCard also fires 'scroll'. Ignore those
     leftovers (they outlast a fixed timeout on Safari / macOS) so autoplay
     and the airplane tour keep running. Wheel, pointer and touch still pause. */
  if(ev && ev.type==='scroll') return;
  playPause();
}

(function bindPlayChrome(){
  const playBtn = $('#tlplay');
  if(playBtn) playBtn.onclick = () => playEnter({auto:true, force:true});
  $('#playtoggle').onclick = () => playToggle();
  $('#playprev').onclick = () => playStep(-1);
  $('#playnext').onclick = () => playStep(1);
  $('#playstop').onclick = () => playExit({});
  const snd = $('#playsound');
  if(snd) snd.onclick = () => flySfxToggle();
  $$('#playbar .play-speeds button').forEach(b => b.onclick = () => playSetSpeed(b.dataset.sp));
  const tl = $('#timeline');
  if(tl){
    tl.addEventListener('wheel', ev => playUserInteract(ev), {passive:true});
    tl.addEventListener('touchmove', ev => playUserInteract(ev), {passive:true});
    tl.addEventListener('pointerdown', ev => {
      if(ev.target && ev.target.closest && ev.target.closest('.tl-card, .tl-scrub, .tl-scroll')) playUserInteract(ev);
    });
  }
  const det = $('#detail');
  if(det) det.addEventListener('scroll', ev => playUserInteract(ev), {passive:true});
  const side = $('#sidebar');
  if(side){
    side.addEventListener('scroll', ev => playUserInteract(ev), {passive:true});
    side.addEventListener('click', ev => {
      if(ev.target.closest('button,input,a,label,.chip,.card')) playUserInteract(ev);
    });
  }
  const mob = $('#mobtoggle');
  if(mob) mob.addEventListener('click', () => { if(PLAY.on && !PLAY.paused) playPause(); });
  document.addEventListener('keydown', ev => {
    if(!PLAY.on) return;
    const tag = (ev.target && ev.target.tagName || '').toLowerCase();
    if(tag==='input' || tag==='textarea' || ev.target.isContentEditable) return;
    if(LB.open) return;
    if(ev.key===' ' || ev.code==='Space'){ ev.preventDefault(); playToggle(); }
    else if(ev.key==='ArrowRight'){ ev.preventDefault(); playStep(1); }
    else if(ev.key==='ArrowLeft'){ ev.preventDefault(); playStep(-1); }
    else if(ev.key==='Escape'){
      ev.preventDefault();
      if(!PLAY.paused) playPause();
      else playExit({});
    }
  });
})();

function route(){
  let hash = location.hash||'';
  if(!hash || hash==='#'){
    history.replaceState(null, '', '#/timeline');
    hash = '#/timeline';
  }
  const onTimeline = /^#\/timeline/.test(hash);
  const onSwipe = /^#\/swipe/.test(hash);
  const playMatch = hash.match(/^#\/timeline\/play(?:\/([^/]+))?\/?$/);
  const entered = setMainView(onSwipe ? 'swipe' : onTimeline ? 'timeline' : 'map');
  if(onSwipe){ if(PLAY.on) playExit({silent:true, keepHash:true}); $('#detail').classList.remove('open'); $('#detail').setAttribute('aria-hidden','true'); openSwipe(); closePrivacy(); return; }
  else closeSwipe(true);
  if(/^#\/privacy/.test(hash)){ if(PLAY.on) playExit({silent:true, keepHash:true}); $('#privacy').classList.add('open'); $('#privacy').setAttribute('aria-hidden','false'); $('#detail').classList.remove('open'); return; }
  else closePrivacy();
  if(playMatch){
    if(PLAY.navigating && PLAY.on) return;
    playEnter({slug: playMatch[1] ? decodeURIComponent(playMatch[1]) : '', auto: !playReduced(), force: !PLAY.on});
    return;
  }
  if(PLAY.on && !PLAY.navigating){
    if(/^#\/timeline\/event\//.test(hash)){
      playExit({keepDetail:true, keepHash:true, silent:true});
    }else{
      playExit({silent:true, keepHash:true});
    }
  }
  if(entered && onTimeline && !playMatch && !/^#\/timeline\/event/.test(hash) && !playReduced() && !PLAY.suppressAuto){
    playEnter({auto:true});
    return;
  }
  if(!onTimeline) PLAY.suppressAuto = false;
  if(/^#\/alerts\/confirmed/.test(hash)){
    const n = $('#alert-confirmed');
    if(!n) $('#alerts-soon').insertAdjacentHTML('afterend', '<p class="note" id="alert-confirmed">Your subscription is confirmed.</p>');
  }
  const m = hash.match(/^#\/(?:timeline\/)?event\/([^/]+)(\/claim)?/);
  const det = $('#detail');
  if(!m){
    det.classList.remove('open'); det.setAttribute('aria-hidden','true'); det.querySelector('#dbody').innerHTML='';
    carStop();
    updateAlertPrefs();
    return;
  }
  const slug = decodeURIComponent(m[1]);
  const e = EV.find(x => x.slug===slug);
  if(!e){ location.hash = onTimeline ? '#/timeline' : '#/'; return; }
  $('#dbody').innerHTML = viewEvent(e);
  det.classList.add('open'); det.setAttribute('aria-hidden','false');
  if(m[2]){ const box=$('#claim-box'); if(box) box.hidden=false; }
  bindGallery(e);
  updateAlertPrefs(undefined, e);
  const ll = (e.lat!=null && e.lng!=null) ? L.latLng(e.lat, e.lng) : null;
  if(ll && !onTimeline){
    const z = Math.max(map.getZoom(), 10);
    const dest = (typeof tourFocus==='function') ? tourFocus(ll, z) : ll;
    map.flyTo(dest, z, {duration:.7});
    const after = () => { panForOpenPopup(); map.off('moveend', after); };
    map.on('moveend', after);
    setTimeout(panForOpenPopup, 780);
  }else{
    setTimeout(panForOpenPopup, 320);
  }
  if(innerWidth<=860) $('#sidebar').classList.add('collapsed');
}

function closePrivacy(){ $('#privacy').classList.remove('open'); $('#privacy').setAttribute('aria-hidden','true'); }
$('#privclose').onclick = () => { location.hash = '#/'; };

/* ---------- swipe ---------- */
const SW = {i:0, n:3, list:[], sort:'date', open:false};
window.SW = SW;
const swN = () => { const w=innerWidth; return w<640?1:w<1024?2:w<1440?3:w<1900?4:5; };
function swList(){
  const a = visibleEvents().slice();
  if(SW.sort==='price') a.sort((x,y)=>(x.price_eur_min!=null?x.price_eur_min:9e12)-(y.price_eur_min!=null?y.price_eur_min:9e12));
  else if(SW.sort==='price-desc') a.sort((x,y)=>(y.price_eur_max||0)-(x.price_eur_max||0));
  else a.sort((x,y)=>(x.start_date||'9999').localeCompare(y.start_date||'9999'));
  return a;
}
function swCard(e,k){
  const ph = e.photos && e.photos[0];
  return `<article class="swc ${esc(e.category||'')}" data-k="${k}">
    <div class="swimg" ${ph?`data-src="${esc(ph.src)}" style="background-image:url('${esc(ph.thumb||ph.src)}')"`:''}>${ph?'':`<span class="swph">${esc(catLabel(e))}<small>No photo published</small></span>`}
      <span class="swtier">${esc(catLabel(e))}</span>
      ${isApprox(e)?'<span class="swapprox">◌ approx. pin</span>':''}
    </div>
    <div class="swb">
      <h3>${esc(e.name)}</h3>
      <div class="swa">${esc(fmtEventDates(e))} · ${esc(where(e))} ${statusBadge(e)}</div>
      <div class="swp">${esc(fmtPrice(e))}</div>
      <dl>
        <div><dt>Organiser</dt><dd>${esc(e.organizer||'—')}</dd></div>
        <div><dt>Venue</dt><dd>${esc(e.venue||e.city||'—')}</dd></div>
      </dl>
      <div class="swbtnrow"><a class="btn primary" href="#/event/${esc(e.slug)}">View details →</a></div>
    </div>
  </article>`;
}
function swBuild(){
  SW.list = swList();
  $('#swtrack').innerHTML = SW.list.map(swCard).join('') || '<div class="swempty">No events match the current filters.</div>';
  $$('#swtrack .swc').forEach(c => c.onclick = ev => {
    if(ev.target.closest('a') || Date.now()-(SW.drag||0)<400) return;
    const e = SW.list[+c.dataset.k];
    if(e) location.hash = '#/event/'+e.slug;
  });
  swLayout(false);
}
function swLayout(anim){
  SW.n = swN();
  const t = $('#swtrack');
  t.style.setProperty('--n', SW.n);
  const tot = SW.list.length;
  if(SW.i > Math.max(0, tot-1)) SW.i = Math.max(0, tot-SW.n);
  if(SW.i % SW.n) SW.i = Math.floor(SW.i/SW.n)*SW.n;
  t.classList.toggle('anim', !!anim);
  t.style.transform = `translateX(${-100*(SW.i/SW.n)}%)`;
  const last = tot? Math.min(tot, SW.i+SW.n) : 0;
  $('#swpos').textContent = tot? `${SW.i+1}–${last} of ${tot}` : '0';
  $('#swprev').disabled = SW.i<=0;
  $('#swnext').disabled = SW.i+SW.n>=tot;
}
function swStep(d){
  const tot = SW.list.length;
  const ni = SW.i + d*SW.n;
  if(ni<0 || ni>=tot) return swLayout(true);
  SW.i = ni; swLayout(true);
}
function openSwipe(){
  const o = $('#swipe');
  if(!SW.open){ SW.open=true; SW.i=0; o.classList.add('open'); o.setAttribute('aria-hidden','false'); document.body.classList.add('swiping'); }
  swBuild();
}
function closeSwipe(fromRoute){
  if(!SW.open) return;
  SW.open=false;
  const o=$('#swipe'); o.classList.remove('open'); o.setAttribute('aria-hidden','true');
  document.body.classList.remove('swiping');
  if(!fromRoute && /^#\/swipe/.test(location.hash)) location.hash='#/';
}
$('#swclose').onclick = () => { location.hash='#/'; };
$('#swprev').onclick = () => swStep(-1);
$('#swnext').onclick = () => swStep(1);
$$('#swsort button').forEach(b => b.onclick = () => {
  SW.sort = b.dataset.s;
  $$('#swsort button').forEach(x => x.classList.toggle('on', x===b));
  SW.i=0; swBuild();
});
document.addEventListener('keydown', e => {
  if(!SW.open) return;
  if(e.key==='ArrowRight'){ e.preventDefault(); swStep(1); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); swStep(-1); }
});
window.addEventListener('resize', () => {
  if(typeof applyPanelWidths==='function') applyPanelWidths({});
  if(SW.open) swLayout(false);
  if(PLAY.on){
    try{ map.invalidateSize({animate:false}); }catch(_){}
  }
});
(function(){
  const vp = $('#swview');
  let x0=null,y0=0,dx=0,lock=null,w=0;
  vp.addEventListener('touchstart', e => { const t=e.touches[0]; x0=t.clientX; y0=t.clientY; dx=0; lock=null; w=vp.clientWidth; $('#swtrack').classList.remove('anim'); }, {passive:true});
  vp.addEventListener('touchmove', e => {
    if(x0==null) return;
    const t=e.touches[0]; const ddx=t.clientX-x0, ddy=t.clientY-y0;
    if(lock==null && (Math.abs(ddx)>8||Math.abs(ddy)>8)) lock = Math.abs(ddx)>Math.abs(ddy)?'x':'y';
    if(lock==='x'){ dx=ddx; $('#swtrack').style.transform = `translateX(${-100*(SW.i/SW.n) + (dx/w)*100/1}%)`; e.preventDefault(); }
  }, {passive:false});
  vp.addEventListener('touchend', () => {
    if(x0==null) return; x0=null;
    if(lock==='x') SW.drag=Date.now();
    if(lock==='x' && Math.abs(dx)>Math.min(60,w*.18)) swStep(dx<0?1:-1);
    else swLayout(true);
  });
})();

/* ---------- lightbox ---------- */
const lbQ = s => document.querySelector(s);
const LB = {open:false, list:[], i:0, title:'', credit:''};
(function(){
  const d = document.createElement('div');
  d.id='lb'; d.setAttribute('aria-hidden','true');
  d.innerHTML = `<button class="lbx" type="button" aria-label="Close">✕</button>
    <div class="lbstage"><img id="lbimg" alt=""></div>
    <button class="lbnav lbp" type="button" aria-label="Previous">‹</button>
    <button class="lbnav lbn" type="button" aria-label="Next">›</button>
    <div class="lbbar"><span id="lbcount"></span><span id="lbtitle"></span><span id="lbcred"></span></div>`;
  document.body.appendChild(d);
  d.querySelector('.lbx').onclick = lbClose;
  d.querySelector('.lbp').onclick = () => lbGo(-1);
  d.querySelector('.lbn').onclick = () => lbGo(1);
  d.addEventListener('click', e => { if(e.target===d || e.target.classList.contains('lbstage')) lbClose(); });
  let x0=null,y0=0;
  d.addEventListener('touchstart', e => { const t=e.touches[0]; x0=t.clientX; y0=t.clientY; }, {passive:true});
  d.addEventListener('touchend', e => {
    if(x0==null) return;
    const t=e.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0; x0=null;
    if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.2) lbGo(dx<0?1:-1);
  });
  window.addEventListener('keydown', e => {
    if(!LB.open) return;
    if(e.key==='ArrowRight') lbGo(1);
    else if(e.key==='ArrowLeft') lbGo(-1);
    else if(e.key==='Escape'){ e.preventDefault(); lbClose(); }
  });
})();
function lbShow(){
  const x = LB.list[LB.i]; if(!x) return;
  const im = lbQ('#lbimg');
  im.classList.remove('ld');
  im.alt = `${LB.title} · photo ${LB.i+1}`;
  im.onload = () => im.classList.add('ld');
  im.src = x.src || x.thumb;
  lbQ('#lbcount').textContent = `${LB.i+1} / ${LB.list.length}`;
  lbQ('#lbtitle').textContent = LB.title||'';
  const page = x.page, credit = x.credit || LB.credit || '';
  lbQ('#lbcred').innerHTML = credit ? (page?`Photo: <a href="${esc(page)}" target="_blank" rel="noopener">${esc(credit)} ↗</a>`:`Photo: ${esc(credit)}`) : (page?`<a href="${esc(page)}" target="_blank" rel="noopener">Photo source ↗</a>`:'');
  const n = LB.list.length;
  lbQ('.lbp').style.display = lbQ('.lbn').style.display = n<2?'none':'';
  const nxt = LB.list[(LB.i+1)%n], prv = LB.list[(LB.i-1+n)%n];
  if(nxt){ const a=new Image(); a.src=nxt.src||nxt.thumb; }
  if(prv && prv!==nxt){ const a=new Image(); a.src=prv.src||prv.thumb; }
}
function lbOpen(list,i,title,credit){
  if(!list.length) return;
  Object.assign(LB,{list,i:i||0,title:title||'',credit:credit||'',open:true});
  const d=lbQ('#lb'); d.classList.add('open'); d.setAttribute('aria-hidden','false');
  document.body.classList.add('lbopen');
  lbShow();
}
function lbClose(){
  if(!LB.open) return;
  LB.open=false;
  const d=lbQ('#lb'); d.classList.remove('open'); d.setAttribute('aria-hidden','true');
  document.body.classList.remove('lbopen');
}
function lbGo(d){ const n=LB.list.length; if(n<2) return; LB.i=(LB.i+d+n)%n; lbShow(); }
addEventListener('hashchange', lbClose);

/* ---------- lead photo carousel ---------- */
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const CAR = {list:[],i:0,t:null,el:null,acc:0,hover:false,busy:false,kb:0,title:'',credit:''};
const CAR_MS=3000, CAR_TICK=100;
function carStop(){ if(CAR.t){ clearInterval(CAR.t); CAR.t=null; } CAR.el=null; CAR.list=[]; CAR.busy=false; }
function carPaused(){
  const det=document.getElementById('detail');
  return RM.matches||CAR.hover||LB.open||document.hidden||!det||!det.classList.contains('open')||!CAR.el||!document.body.contains(CAR.el)||PLAY.on;
}
function carInit(list,title,credit,root){
  carStop();
  const pane = detailPane(root);
  const gal = pane.querySelector('.gal') || lbQ('#dbody .gal'); if(!gal) return;
  const lead = gal.querySelector('.gi.lead'); if(!lead || list.length<2) return;
  Object.assign(CAR,{list,i:0,title,credit,el:lead,acc:0,busy:false,kb:0,hover:false});
  lead.classList.add('car');
  lead.innerHTML = list.map((p,i)=>`<img class="cs${i===0?' on ld':''}" src="${esc(p.src)}" alt="" ${i===0?'':'aria-hidden="true"'}>`).join('')
    + `<button class="cnav cprev" type="button" aria-label="Previous photo">‹</button>`
    + `<button class="cnav cnext" type="button" aria-label="Next photo">›</button>`
    + `<div class="cdots">${list.map((_,i)=>`<button type="button" class="cdot ${i===0?'on':''}" data-i="${i}" aria-label="Photo ${i+1}"></button>`).join('')}</div>`
    + `<span class="gcount">1 / ${list.length}</span>`;
  lead.querySelectorAll('img').forEach(markImgLoaded);
  lead.querySelector('.cprev').onclick = ev => { ev.stopPropagation(); carGo(CAR.i-1); };
  lead.querySelector('.cnext').onclick = ev => { ev.stopPropagation(); carGo(CAR.i+1); };
  lead.querySelectorAll('.cdot').forEach(b => b.onclick = ev => { ev.stopPropagation(); carGo(+b.dataset.i); });
  lead.onclick = ev => {
    if(ev.target.closest('.cnav,.cdot')) return;
    if(Date.now()-(CAR.swiped||0)<450) return;
    lbOpen(CAR.list, CAR.i, CAR.title, CAR.credit);
  };
  lead.addEventListener('mouseenter', () => { CAR.hover=true; });
  lead.addEventListener('mouseleave', () => { CAR.hover=false; });
  let x0=null,y0=0;
  lead.addEventListener('touchstart', ev => { const t=ev.touches[0]; x0=t.clientX; y0=t.clientY; }, {passive:true});
  lead.addEventListener('touchend', ev => {
    if(x0==null) return;
    const t=ev.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0; x0=null;
    if(Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)*1.2){ CAR.swiped=Date.now(); window.__galSwipe=CAR.swiped; carGo(CAR.i+(dx<0?1:-1)); }
  }, {passive:true});
  carPreload(1);
  if(!RM.matches){ CAR.t = setInterval(() => { if(carPaused()) return; CAR.acc+=CAR_TICK; if(CAR.acc>=CAR_MS) carGo(CAR.i+1, true); }, CAR_TICK); }
}
function carPreload(k){ const n=CAR.list.length; const x=CAR.list[(k%n+n)%n]; if(x){ const im=new Image(); im.decoding='async'; im.src=x.src; } }
function carGo(k, auto){
  const n=CAR.list.length; if(n<2||!CAR.el) return;
  k=(k%n+n)%n; CAR.acc=0; if(k===CAR.i||CAR.busy) return;
  CAR.busy=true; CAR.kb=(CAR.kb+1)%4;
  const imgs=[...CAR.el.querySelectorAll('img.cs')];
  imgs.forEach((im,i) => {
    im.classList.toggle('on', i===k);
    im.classList.toggle('kb0', i===k && CAR.kb===0);
    im.classList.toggle('kb1', i===k && CAR.kb===1);
    im.classList.toggle('kb2', i===k && CAR.kb===2);
    im.classList.toggle('kb3', i===k && CAR.kb===3);
  });
  CAR.el.querySelectorAll('.cdot').forEach((b,i)=>b.classList.toggle('on', i===k));
  const gc=CAR.el.querySelector('.gcount'); if(gc) gc.textContent=`${k+1} / ${n}`;
  const thumbs=document.querySelectorAll('#dbody .gt'); thumbs.forEach((t,i)=>t.classList.toggle('on', i+1===k || (k===0&&i===-1)));
  CAR.i=k; carPreload(k+1);
  setTimeout(()=>{ CAR.busy=false; }, auto?850:200);
}
document.addEventListener('visibilitychange', () => { if(!document.hidden) CAR.acc=0; });

/* ---------- alerts (disabled until config flag) ---------- */
function updateAlertPrefs(_n, ev){
  const parts = [];
  const cats = Object.keys(st.cats).filter(k=>st.cats[k]).map(k=>CAT[k]);
  if(cats.length && cats.length<3) parts.push(cats.join(', '));
  if(st.cities.size) parts.push([...st.cities].map(k=>k.split('|')[0]).join(', '));
  if(st.from||st.to) parts.push((st.from||'…')+' to '+(st.to||'…'));
  $('#alert-prefs').textContent = parts.length
    ? 'Current filters: '+parts.join(' · ')+'.'
    : 'Uses the filters currently set on the map (all upcoming events in scope).';
  const lab = $('#org-event-label');
  lab.textContent = ev ? '('+ev.name+')' : ev===undefined && /^#\/event\//.test(location.hash) ? '' : '(open an event to name its organiser)';
}
function setupAlerts(){
  const form = $('#alert-form');
  const box = $('#alerts');
  const enabled = !!(CFG.alertsEnabled && CFG.supabaseUrl && CFG.subscribeFn);
  box.classList.toggle('disabled', !enabled);
  $('#alerts-soon').hidden = enabled;
  $('#alert-form').hidden = !enabled;
  $$('#alert-form input, #alert-submit').forEach(el => { el.disabled = !enabled; });
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const msg = $('#alert-msg');
    if(!enabled){ msg.textContent = 'Alerts are not collecting addresses yet.'; return; }
    const email = $('#alert-email').value.trim();
    const consent = $('#alert-consent').checked;
    const share = $('#org-consent').checked;
    if(!email){ msg.textContent='Enter an email address.'; return; }
    if(!consent){ msg.textContent='Please tick the alerts consent box to receive emails.'; return; }
    const body = {
      email,
      alert_consent: consent,
      organiser_share: share,
      event_slug: (location.hash.match(/^#\/event\/([^/]+)/)||[])[1]||'',
      filters: {
        categories: Object.keys(st.cats).filter(k=>st.cats[k]),
        cities: [...st.cities],
        topics: [...st.topics],
        from: st.from, to: st.to,
        pmin: PS[st.pmin], pmax: PS[st.pmax]===Infinity?null:PS[st.pmax],
        unknown: st.unknown,
        q: st.q
      }
    };
    try{
      const url = CFG.subscribeFn.startsWith('http') ? CFG.subscribeFn : (CFG.supabaseUrl.replace(/\/$/,'')+'/functions/v1/subscribe');
      const res = await fetch(url, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
      const data = await res.json().catch(()=>({}));
      msg.textContent = res.ok ? (data.message || 'Check your inbox to confirm.') : (data.error || 'Could not subscribe.');
    }catch(err){ msg.textContent = 'Could not reach the alerts service.'; }
  });
}
setupAlerts();

/* ---------- chrome ---------- */
$('#mobtoggle').onclick = () => $('#sidebar').classList.toggle('collapsed');
window.addEventListener('hashchange', route);
document.addEventListener('keydown', e => {
  if(e.key==='Escape'){
    if(LB.open) return;
    if(PLAY.on) return;
    if(/^#\/timeline\/event/.test(location.hash)) location.hash='#/timeline';
    else if(/^#\/(event|swipe|privacy)/.test(location.hash)) location.hash='#/';
  }
});

render();
if(location.hash==='#/') fitToVisible();


/* Desktop floating-panel widths: shared default, drag to resize, persist. */
const PANEL_KEY_L = 'gconf-atlas-left-width';
const PANEL_KEY_R = 'gconf-atlas-right-width';
const PANEL_MIN = 320;
const MAP_MIN = 280;

function panelInset(){
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset'));
  return isFinite(v) && v>=0 ? v : 14;
}
function panelDefault(){
  const vw = innerWidth;
  const inset = panelInset();
  const raw = Math.min(560, Math.max(320, vw * 0.36));
  const maxBoth = Math.floor((vw - inset*2 - MAP_MIN) / 2);
  return Math.round(Math.max(200, Math.min(raw, maxBoth)));
}
function panelMaxFor(otherW){
  const inset = panelInset();
  return Math.max(200, Math.floor(innerWidth - inset*2 - MAP_MIN - (otherW||0)));
}
function readStoredPanel(key){
  try{
    const n = parseFloat(localStorage.getItem(key));
    if(isFinite(n) && n>=200) return n;
  }catch(_){}
  return null;
}
function applyPanelWidths(opts){
  opts = opts||{};
  const app = $('#app');
  if(!app) return null;
  if(innerWidth<=860){
    ['--leftw','--rightw','--sbw','--tourstrip','--dw','--playdw'].forEach(k => app.style.removeProperty(k));
    return null;
  }
  const def = panelDefault();
  let L = opts.left!=null ? opts.left : (opts.resetLeft ? def : (readStoredPanel(PANEL_KEY_L) ?? def));
  let R = opts.right!=null ? opts.right : (opts.resetRight ? def : (readStoredPanel(PANEL_KEY_R) ?? def));
  L = Math.round(Math.max(Math.min(PANEL_MIN, panelMaxFor(R)), Math.min(L, panelMaxFor(R))));
  R = Math.round(Math.max(Math.min(PANEL_MIN, panelMaxFor(L)), Math.min(R, panelMaxFor(L))));
  L = Math.round(Math.max(Math.min(PANEL_MIN, panelMaxFor(R)), Math.min(L, panelMaxFor(R))));
  app.style.setProperty('--leftw', L+'px');
  app.style.setProperty('--rightw', R+'px');
  /* --sbw/--dw/--playdw are defined on :root as var(--leftw/--rightw); setting
     only --leftw on #app would leave :root's --sbw resolving the default. */
  app.style.setProperty('--sbw', L+'px');
  app.style.setProperty('--tourstrip', L+'px');
  app.style.setProperty('--dw', R+'px');
  app.style.setProperty('--playdw', R+'px');
  if(opts.persist){
    try{
      if(opts.left!=null) localStorage.setItem(PANEL_KEY_L, String(L));
      if(opts.right!=null) localStorage.setItem(PANEL_KEY_R, String(R));
    }catch(_){}
  }
  if(opts.resetLeft){ try{ localStorage.removeItem(PANEL_KEY_L); }catch(_){} }
  if(opts.resetRight){ try{ localStorage.removeItem(PANEL_KEY_R); }catch(_){} }
  if(typeof map!=='undefined' && map && opts.invalidate!==false){
    try{ map.invalidateSize({animate:false}); }catch(_){}
  }
  return {L, R};
}

function bindPanelResizers(){
  applyPanelWidths({invalidate:false});
  $$('.panel-resizer').forEach(h => {
    let dragging=false, startX=0, startW=0, side='left';
    const widthOf = (s) => {
      const el = s==='left'
        ? (($('#timeline') && getComputedStyle($('#timeline')).display!=='none') ? $('#timeline') : $('#sidebar'))
        : $('#detail');
      return el && el.getBoundingClientRect().width || panelDefault();
    };
    const onDown = ev => {
      if(innerWidth<=860) return;
      if(ev.pointerType==='mouse' && ev.button!==0) return;
      ev.preventDefault();
      side = h.dataset.side==='right' ? 'right' : 'left';
      startW = widthOf(side);
      startX = ev.clientX;
      dragging = true;
      document.body.classList.add('resizing-panels');
      h.classList.add('on');
      try{ h.setPointerCapture(ev.pointerId); }catch(_){}
    };
    const onMove = ev => {
      if(!dragging) return;
      const dx = ev.clientX - startX;
      const w = side==='left' ? startW + dx : startW - dx;
      if(side==='left') applyPanelWidths({left:w, invalidate:false});
      else applyPanelWidths({right:w, invalidate:false});
    };
    const endDrag = ev => {
      if(!dragging) return;
      dragging=false;
      document.body.classList.remove('resizing-panels');
      h.classList.remove('on');
      const cur = getComputedStyle($('#app'));
      const L = parseFloat(cur.getPropertyValue('--leftw'));
      const R = parseFloat(cur.getPropertyValue('--rightw'));
      if(side==='left') applyPanelWidths({left:L, persist:true});
      else applyPanelWidths({right:R, persist:true});
    };
    h.addEventListener('pointerdown', onDown);
    h.addEventListener('pointermove', onMove);
    h.addEventListener('pointerup', endDrag);
    h.addEventListener('pointercancel', endDrag);
    h.addEventListener('dblclick', ev => {
      ev.preventDefault();
      if(h.dataset.side==='right') applyPanelWidths({resetRight:true, persist:false});
      else applyPanelWidths({resetLeft:true, persist:false});
    });
    h.addEventListener('keydown', ev => {
      if(ev.key!=='ArrowLeft' && ev.key!=='ArrowRight' && ev.key!=='Enter') return;
      ev.preventDefault();
      if(ev.key==='Enter'){
        if(h.dataset.side==='right') applyPanelWidths({resetRight:true});
        else applyPanelWidths({resetLeft:true});
        return;
      }
      const dir = ev.key==='ArrowRight' ? 1 : -1;
      const step = ev.shiftKey ? 40 : 16;
      const w = widthOf(h.dataset.side==='right'?'right':'left');
      const next = w + (h.dataset.side==='right' ? -dir : dir)*step;
      if(h.dataset.side==='right') applyPanelWidths({right:next, persist:true});
      else applyPanelWidths({left:next, persist:true});
    });
  });
}


bindPanelResizers();
renderRegionChips();
route();
