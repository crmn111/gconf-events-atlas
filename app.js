/* GConf Events Atlas */
const D = window.ATLASDATA || {events:[], updated:'', eurRates:{}, eurRatesNote:''};
const CFG = Object.assign({alertsEnabled:false, supabaseUrl:'', subscribeFn:'', viewsEnabled:false, viewsFn:'', claimEmail:'', cartoKey:''}, window.ATLASCONFIG||{});
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CAT = {ai:'AI', tech:'Tech', crypto:'Crypto / Web3'};
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
  if(!A && !B) return 'Dates to be announced';
  if(A && B && A.getTime()===B.getTime()) return fmtDay(a);
  if(A && B && A.getMonth()===B.getMonth() && A.getFullYear()===B.getFullYear()){
    return A.getDate() + '–' + fmtDay(b);
  }
  if(A && B) return fmtDay(a) + ' – ' + fmtDay(b);
  return fmtDay(a||b);
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
  const m = t.match(/(?:from\s+)?(?:[€$£]|EUR|USD|GBP|CHF)\s?[\d.,]+(?:\s?[–-]\s?(?:[€$£]|EUR|USD|GBP|CHF)?\s?[\d.,]+)?/i);
  if(m){ const s=m[0].replace(/\s+/g,' '); return s.length>18?s.slice(0,16)+'…':s; }
  if(/^[€$£]\s?\d/.test(t) && t.length<=18) return t;
  return 'Priced';
}
function hasPin(e){ return e.lat!=null && e.lng!=null; }
function isApprox(e){ return hasPin(e) && e.precise!==true; }
function where(e){ return [e.venue, [e.city, e.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '); }
function catLabel(e){ return CAT[e.category] || e.category || 'Event'; }

const EV = (D.events||[]).slice();
const CITIES = [...new Map(EV.map(e => {
  const key = (e.city||'Unknown') + '|' + (e.country||'');
  return [key, {key, city:e.city||'Unknown', country:e.country||'', n:0}];
})).values()].sort((a,b)=>a.city.localeCompare(b.city));
CITIES.forEach(c => { c.n = EV.filter(e => (e.city||'Unknown')+'|'+(e.country||'')===c.key).length; });
const TOPICS = [...new Set(EV.flatMap(e => e.topics||[]))].sort((a,b)=>a.localeCompare(b));

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
  Slovenia:'SI', Croatia:'HR', Bulgaria:'BG', Lithuania:'LT', Iceland:'IS'
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
const esri = (p,o) => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/'+p+'/MapServer/tile/{z}/{y}/{x}', Object.assign({maxZoom:19, attribution:attrEsri}, o||{}));

const CARTO_STYLES = {
  voyager: 'voyager-gl-style',
  positron: 'positron-gl-style',
  darkmatter: 'dark-matter-gl-style'
};
function esriStandIn(id){
  if(id==='positron') return L.layerGroup([esri('Canvas/World_Light_Gray_Base'), esri('Canvas/World_Light_Gray_Reference')]);
  if(id==='darkmatter') return L.layerGroup([esri('Canvas/World_Dark_Gray_Base'), esri('Canvas/World_Dark_Gray_Reference')]);
  if(id==='satellite') return esri('World_Imagery', {attribution:attrEsriImg});
  return esri('World_Topo_Map'); /* Voyager-like colourful stand-in */
}
function cartoStyleUrl(id){
  const slug = CARTO_STYLES[id];
  let url = 'https://basemaps.cartocdn.com/gl/'+slug+'/style.json';
  if(CARTO_KEY) url += '?key='+encodeURIComponent(CARTO_KEY);
  return url;
}
function makeCartoLayer(id){
  if(id==='satellite') return esriStandIn('satellite');
  if(!(window.maplibregl && L.maplibreGL) || !CARTO_STYLES[id]) return esriStandIn(id);
  return L.maplibreGL({
    style: cartoStyleUrl(id),
    attribution: attrCarto,
    interactive: false
  });
}
function hookCartoFallback(layer, id){
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

function setBasemap(id, opts){
  opts = opts||{};
  if(!id || id===baseId && curBase && !opts.force) {
    $$('#basemaps button').forEach(x => x.classList.toggle('on', x.dataset.b===baseId));
    return;
  }
  if(id!=='voyager' && id!=='positron' && id!=='darkmatter' && id!=='satellite') id='voyager';
  if(curBase){ try{ map.removeLayer(curBase); }catch(_){ } curBase=null; }
  if(!baseCache[id]) baseCache[id] = makeCartoLayer(id);
  curBase = baseCache[id].addTo(map);
  hookCartoFallback(curBase, id);
  baseId = id;
  const wrap = $('#mapwrap');
  if(wrap) wrap.dataset.base = id;
  $$('#basemaps button').forEach(x => x.classList.toggle('on', x.dataset.b===id));
  if(!opts.auto){
    autoBase = false;
    if(id!=='darkmatter') lastLightBase = id;
    try{ localStorage.setItem(BASE_KEY, id); }catch(_){}
  }else{
    autoBase = true;
  }
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
    if(saved==='voyager'||saved==='positron'||saved==='darkmatter'||saved==='satellite'){
      baseId = saved;
      if(saved!=='darkmatter') lastLightBase = saved;
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
$$('#basemaps button').forEach(b => b.onclick = () => setBasemap(b.dataset.b));


const clusters = L.markerClusterGroup({
  showCoverageOnHover:false,
  maxClusterRadius:48,
  spiderfyOnMaxZoom:true,
  disableClusteringAtZoom:12
});
map.addLayer(clusters);

const markers = {};
function popEvent(e){
  const ph = e.photos && e.photos[0];
  return `<div class="pop go" role="link" tabindex="0" onclick="if(!event.target.closest('a'))location.hash='#/event/${esc(e.slug)}'">${ph?`<img src="${esc(ph.thumb||ph.src)}" alt="">`:`<div class="ph-ph sm">${esc(catLabel(e))}</div>`}<div class="pb"><div class="pk">${esc(catLabel(e))} · ${esc(fmtRange(e.start_date,e.end_date))}</div><h3>${esc(e.name)}</h3><div class="pa">${esc(where(e))}</div><div class="pr">${esc(fmtPrice(e))}</div><div class="pbtn"><a class="btn primary vd" href="#/event/${esc(e.slug)}">View details →</a></div>${ph?`<div class="credit">Photo: ${esc(e.photoCredit||ph.credit||'see event page')}</div>`:''}</div></div>`;
}
function evIcon(e){
  return L.divIcon({className:'', html:`<div class="mk ${e.category||'tech'} ${isApprox(e)?'approx':''}"><div class="pill">${esc(pillText(e))}</div></div>`, iconSize:[0,0], iconAnchor:[0,0]});
}

EV.forEach(e => {
  if(e.lat==null || e.lng==null) return;
  const mk = L.marker([e.lat, e.lng], {icon: evIcon(e), title: e.name, riseOnHover:true, keyboard:true});
  mk.bindPopup(popEvent(e), {className:'ppop', maxWidth:300});
  mk.on('click', () => { /* popup opens; detail via hash in popup */ });
  markers[e.slug] = mk;
});

/* ---------- filters ---------- */
const PS = [0,50,100,150,200,250,350,500,750,1000,1500,2000,2500,3000,5000,10000,Infinity];
const PT = PS.length-1;
const addDays = (n) => { const d=new Date(TODAY); d.setDate(d.getDate()+n); return d; };
const iso = d => d.toISOString().slice(0,10);
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
  cats: {ai:true, tech:true, crypto:true},
  when:'any', from:null, to:null,
  cities: new Set(),
  topics: new Set(),
  pmin:0, pmax:PT, unknown:true,
  q:'', sort:'date', cityq:''
};

$('#f-cat').innerHTML = ['ai','tech','crypto'].map(c => {
  const n = EV.filter(e => e.category===c).length;
  return `<button type="button" data-v="${c}" class="on ${c}"><i class="dot ${c}"></i>${esc(CAT[c])} <small>${n}</small></button>`;
}).join('');
$$('#f-cat button').forEach(b => b.onclick = () => {
  const k = b.dataset.v;
  st.cats[k] = !st.cats[k];
  if(!st.cats.ai && !st.cats.tech && !st.cats.crypto){ st.cats[k] = true; }
  b.classList.toggle('on', st.cats[k]);
  render();
});

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
  const list = CITIES.filter(c => !q || (c.city+' '+c.country).toLowerCase().includes(q));
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
renderCities();

if(TOPICS.length){
  $('#f-topic-row').hidden = false;
  const box = $('#f-topic');
  box.classList.add('topics');
  const renderTopics = (expanded) => {
    const shown = expanded ? TOPICS : TOPICS.slice(0, 10);
    const rest = Math.max(0, TOPICS.length - shown.length);
    box.classList.toggle('expanded', !!expanded);
    box.innerHTML = shown.map(t => `<button type="button" data-v="${esc(t)}" class="${st.topics.has(t)?'on':''}">${esc(t)}</button>`).join('')
      + (rest?`<button type="button" class="morebtn" data-more="1">+${rest} more</button>`:'')
      + (expanded && TOPICS.length>10?`<button type="button" class="morebtn" data-more="0">Show fewer</button>`:'');
    $$('#f-topic button').forEach(b => b.onclick = () => {
      if(b.dataset.more){ renderTopics(b.dataset.more==='1'); return; }
      const t = b.dataset.v;
      if(st.topics.has(t)) st.topics.delete(t); else st.topics.add(t);
      b.classList.toggle('on', st.topics.has(t));
      render();
    });
  };
  renderTopics(false);
}

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
  const a = parseDay(e.start_date) || parseDay(e.end_date);
  const b = parseDay(e.end_date) || parseDay(e.start_date);
  if(!a && !b) return true;
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
    if(s==='date-desc') return (y.start_date||'').localeCompare(x.start_date||'') || (x.name||'').localeCompare(y.name||'');
    return (x.start_date||'9999').localeCompare(y.start_date||'9999') || (x.name||'').localeCompare(y.name||'');
  });
  return copy;
}

function cardHtml(e){
  const ph = e.photos && e.photos[0];
  const th = ph ? `style="background-image:url('${esc(ph.thumb||ph.src)}')"` : '';
  return `<article class="card" data-r="event/${esc(e.slug)}"><div class="th" ${th}></div><div class="meta"><span class="tag ${esc(e.category||'')}">${esc(catLabel(e))}</span><h3>${esc(e.name)}</h3><div class="where">${esc(fmtRange(e.start_date,e.end_date))} · ${esc(where(e))}</div><div class="row"><span class="price ${hasPrice(e)?'':'unk'}">${esc(fmtPrice(e))}</span>${isApprox(e)?'<span class="tag">◌ approx.</span>':''}</div></div></article>`;
}

function render(){
  const vis = sortEvents(visibleEvents());
  $('#count').textContent = vis.length + (vis.length===1?' event':' events');
  $('#list').innerHTML = vis.length ? vis.map(cardHtml).join('') : `<div class="empty">${EV.length?'No events match the current filters.':'No upcoming events have been published yet. The research feed is still being compiled.'}</div>`;
  $$('#list .card[data-r]').forEach(c => c.onclick = () => { location.hash = '#/'+c.dataset.r; });

  clusters.clearLayers();
  vis.forEach(e => { const mk = markers[e.slug]; if(mk) clusters.addLayer(mk); });

  const cities = new Set(vis.map(e => e.city).filter(Boolean));
  const priced = vis.filter(hasPrice).length;
  const next = vis.filter(e => parseDay(e.start_date) && parseDay(e.start_date) >= TODAY).sort((a,b)=>(a.start_date||'').localeCompare(b.start_date||''))[0];
  $('#stats').innerHTML = `<div><b>${vis.length}</b><span>Events shown</span></div><div><b>${cities.size}</b><span>Cities</span></div><div><b>${next?fmtDay(next.start_date):'—'}</b><span>${next?'Next event':'Next date'}</span></div>`;
  $('#upd').textContent = D.updated || '—';
  const echo = $('#mapecho');
  const pinned = vis.filter(e => markers[e.slug]).length;
  if(echo){
    if(vis.length && !pinned){ echo.hidden=false; echo.textContent='These events are in the list. Pins appear once a location has been published.'; }
    else echo.hidden=true;
  }
  updateAlertPrefs(vis.length);
  if($('#mapwrap') && $('#mapwrap').classList.contains('timeline-on')) renderTimeline();
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
  const img = (p,i,cls) => `<button type="button" class="gi ${cls||''}" data-i="${i}" aria-label="Open photo ${i+1}"><img src="${esc(p.thumb||p.src)}" data-full="${esc(p.src)}" alt="" loading="${i===0?'eager':'lazy'}"></button>`;
  if(n===1) return `<div class="gal g1">${img(P[0],0,'lead')}</div>`;
  if(n===2) return `<div class="gal g2">${img(P[0],0,'lead')}${img(P[1],1)}</div>`;
  if(n===3) return `<div class="gal g3">${img(P[0],0,'lead')}${img(P[1],1)}${img(P[2],2)}</div>`;
  const rest = P.slice(1);
  return `<div class="gal g4 gc"><div class="gi lead car" data-i="0"></div><div class="gstrip" style="--gn:${Math.min(rest.length,6)}">${rest.map((p,i)=>`<button type="button" class="gt" data-i="${i+1}"><img src="${esc(p.thumb||p.src)}" alt="" loading="lazy"></button>`).join('')}</div></div>`;
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
  const closeTo = /^#\/timeline/.test(location.hash||'') ? '#/timeline' : '#/';
  const close = `<button class="close" type="button" aria-label="Close" onclick="location.hash='${closeTo}'">✕</button>`;
  const gal = galHtml(ph, credit);
  const hero = `<div class="dhero ${esc(e.category||'')}">
    <div class="crumbs">${esc(catLabel(e))} · ${esc(fmtRange(e.start_date,e.end_date))}</div>
    <h2>${esc(e.name)}</h2>
    <div class="loc">${esc(locBits)}${isApprox(e)?' · ◌ approximate pin':(!hasPin(e)?' · pin not yet placed':'')}</div>
    <div class="bigprice">${esc(fmtPrice(e))}${e.currency && hasPrice(e)?`<small>${esc(e.currency)}${e.ticket_url?' · tickets on the organiser site':''}</small>`: (hasPrice(e)?'': '<small>No verified ticket price yet</small>')}</div>
    <div class="htags">${tags}</div>
    ${credit?`<div class="hcredit">Photo: ${ph[0]&&ph[0].page?srcLink(ph[0].page, credit):esc(credit)}</div>`:''}
  </div>`;
  const about = e.notes ? `<div class="dsec"><h4>Notes</h4><p>${esc(e.notes)}</p></div>` : '';
  const attend = e.expected_attendance ? fact('Attendance', e.expected_attendance) : '';
  const facts = `<div class="dsec"><h4>Facts</h4><dl class="facts">
    ${fact('Dates', fmtRange(e.start_date,e.end_date))}
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
  return close + gal + hero + facts + about + claim + srcSec + views;
}

function bindGallery(e){
  const photos = e.photos||[];
  $$('#dbody .gi, #dbody .gt').forEach(el => {
    el.onclick = ev => {
      if(ev.target.closest('.cnav,.cdot')) return;
      if(Date.now()-(window.__galSwipe||0)<450) return;
      const i = +el.dataset.i || 0;
      lbOpen(photos, i, e.name, e.photoCredit||'');
    };
  });
  $$('#dbody img').forEach(im => { im.onload = () => im.classList.add('ld'); if(im.complete) im.classList.add('ld'); });
  const claim = $('#claim-cta');
  if(claim){
    claim.onclick = ev => {
      ev.preventDefault();
      const box = $('#claim-box');
      if(box){ box.hidden = !box.hidden; }
      if(CFG.claimEmail){
        const sub = encodeURIComponent('Claim listing: '+e.name);
        location.href = 'mailto:'+CFG.claimEmail+'?subject='+sub;
      }
    };
  }
  carInit(photos, e.name, e.photoCredit||'');
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
  const tl = $('#timeline');
  if(tl) tl.setAttribute('aria-hidden', v==='timeline' ? 'false' : 'true');
  $$('#viewbar button').forEach(b => b.classList.toggle('on', b.dataset.v===v));
  if(v==='timeline') renderTimeline();
  if(innerWidth<=860 && (v==='timeline' || v==='swipe')) $('#sidebar').classList.add('collapsed');
  if(was==='timeline' && v==='map'){
    setTimeout(() => { try{ map.invalidateSize(); }catch(_){ } }, 60);
  }
}
function monthKey(e){
  const d = parseDay(e.start_date);
  if(!d) return 'tbc';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function monthLabel(key){
  if(key==='tbc') return 'Dates to be announced';
  const [y,m] = key.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('en-GB', {month:'long', year:'numeric'});
}
function renderTimeline(){
  const body = $('#tlbody');
  if(!body) return;
  const list = visibleEvents().slice().sort((a,b) => (a.start_date||'9999').localeCompare(b.start_date||'9999') || (a.name||'').localeCompare(b.name||''));
  if(!list.length){
    body.innerHTML = `<div class="tl-empty">${EV.length?'No events match the current filters.':'No upcoming events have been published yet.'}</div>`;
    return;
  }
  const months = [];
  const gmap = new Map();
  list.forEach(e => {
    const k = monthKey(e);
    if(!gmap.has(k)){ const g={key:k, items:[]}; gmap.set(k,g); months.push(g); }
    gmap.get(k).items.push(e);
  });
  body.innerHTML = months.map(m => {
    const n = m.items.length;
    const items = m.items.map(e => {
      const d = parseDay(e.start_date);
      const day = d ? String(d.getDate()) : '—';
      const wd = d ? d.toLocaleDateString('en-GB', {weekday:'short'}) : '';
      const ph = e.photos && e.photos[0];
      const thumb = ph
        ? `<div class="tl-thumb" style="background-image:url('${esc(ph.thumb||ph.src)}')"></div>`
        : `<div class="tl-thumb ph">${esc(catLabel(e))}</div>`;
      const flag = flagOf(e.country);
      const loc = [e.city, e.country].filter(Boolean).join(', ');
      return `<li class="tl-item ${esc(e.category||'')}">
        <div class="tl-date"><b>${esc(day)}</b>${esc(wd)}</div>
        <span class="tl-dot" aria-hidden="true"></span>
        <article class="tl-card" data-slug="${esc(e.slug)}" tabindex="0" role="link" aria-label="${esc(e.name)}">
          ${thumb}
          <div class="tl-body">
            <div class="tl-meta"><span class="tl-cat ${esc(e.category||'')}">${esc(catLabel(e))}</span><span>${esc(fmtRange(e.start_date,e.end_date))}</span></div>
            <h3>${esc(e.name)}</h3>
            <div class="tl-where">${flag?`<span class="flag" aria-hidden="true">${flag}</span>`:''}<span>${esc(loc||where(e))}</span></div>
            <div class="price ${hasPrice(e)?'':'unk'}">${esc(fmtPrice(e))}</div>
          </div>
        </article>
      </li>`;
    }).join('');
    return `<section class="tl-month">
      <div class="tl-month-h"><b>${esc(monthLabel(m.key))}</b><span>${n} ${n===1?'event':'events'}</span></div>
      <ol class="tl-list">${items}</ol>
    </section>`;
  }).join('');
  $$('#tlbody .tl-card[data-slug]').forEach(c => {
    const go = () => { location.hash = '#/timeline/event/'+c.dataset.slug; };
    c.onclick = ev => { if(!ev.target.closest('a')) go(); };
    c.onkeydown = ev => { if(ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); go(); } };
  });
}
$$('#viewbar button').forEach(b => b.onclick = () => {
  const v = b.dataset.v;
  location.hash = v==='map' ? '#/' : '#/'+v;
});

function route(){
  const hash = location.hash||'#/';
  const onTimeline = /^#\/timeline/.test(hash);
  const onSwipe = /^#\/swipe/.test(hash);
  setMainView(onSwipe ? 'swipe' : onTimeline ? 'timeline' : 'map');
  if(onSwipe){ $('#detail').classList.remove('open'); $('#detail').setAttribute('aria-hidden','true'); openSwipe(); closePrivacy(); return; }
  else closeSwipe(true);
  if(/^#\/privacy/.test(hash)){ $('#privacy').classList.add('open'); $('#privacy').setAttribute('aria-hidden','false'); $('#detail').classList.remove('open'); return; }
  else closePrivacy();
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
    const off = innerWidth>860 ? Math.round(det.getBoundingClientRect().width/2) : 0;
    const pt = map.project(ll,z).subtract([off,0]);
    map.flyTo(map.unproject(pt,z), z, {duration:.7});
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
      <div class="swa">${esc(fmtRange(e.start_date,e.end_date))} · ${esc(where(e))}</div>
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
window.addEventListener('resize', () => { if(SW.open) swLayout(false); });
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
  return RM.matches||CAR.hover||LB.open||document.hidden||!det||!det.classList.contains('open')||!CAR.el||!document.body.contains(CAR.el);
}
function carInit(list,title,credit){
  carStop();
  const gal = lbQ('#dbody .gal'); if(!gal) return;
  const lead = gal.querySelector('.gi.lead'); if(!lead || list.length<2) return;
  Object.assign(CAR,{list,i:0,title,credit,el:lead,acc:0,busy:false,kb:0,hover:false});
  lead.classList.add('car');
  lead.innerHTML = list.map((p,i)=>`<img class="cs ${i===0?'on':''}" src="${esc(p.src)}" alt="" ${i===0?'':'aria-hidden="true"'}>`).join('')
    + `<button class="cnav cprev" type="button" aria-label="Previous photo">‹</button>`
    + `<button class="cnav cnext" type="button" aria-label="Next photo">›</button>`
    + `<div class="cdots">${list.map((_,i)=>`<button type="button" class="cdot ${i===0?'on':''}" data-i="${i}" aria-label="Photo ${i+1}"></button>`).join('')}</div>`
    + `<span class="gcount">1 / ${list.length}</span>`;
  lead.querySelectorAll('img').forEach(im => { im.onload=()=>im.classList.add('ld'); if(im.complete) im.classList.add('ld'); });
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
    if(/^#\/timeline\/event/.test(location.hash)) location.hash='#/timeline';
    else if(/^#\/(event|swipe|privacy)/.test(location.hash)) location.hash='#/';
  }
});

render();
if(EV.some(e => e.lat!=null)){
  try{
    const group = L.featureGroup(Object.values(markers));
    if(!location.hash || location.hash==='#/') map.fitBounds(group.getBounds().pad(0.12), {maxZoom:6, paddingTopLeft:[0,20]});
  }catch(_){}
}
route();
