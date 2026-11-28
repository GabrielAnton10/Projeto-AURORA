// ============================================================
// AURORA - app.js
// ============================================================

const fmt = t => !t ? '-' : new Date(t).toLocaleString('pt-BR', {
 day: '2-digit',
 month: '2-digit',
 hour: '2-digit',
 minute: '2-digit'
});
const tag = '';
const f = (v, n, u) => v == null || isNaN(v) ? '-' : (+v).toFixed(n) + u;
const vazio = t => '<div class="card" style="color:var(--mut)">' + t + '</div>';
const $ = s => document.querySelector(s);
const escH = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// remove acentos para comparar textos (ex.: 'Atencao' x 'Atenção')
const nz = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function line(series, opts) {
 const o = opts || {};
 const h = o.h || 150;
 const colors = o.colors || ['#f28c1a', '#fdb022', '#dc2626'];
 const th = o.th;
 if (!series[0] || series[0].length < 2) {
  return '<p style="color:var(--mut);margin:0">Sem leituras ainda.</p>';
 }
 const W = 600;
 const P = 28;
 const all = series.flat();
 let min = o.min != null ? o.min : Math.min(...all);
 let max = o.max != null ? o.max : Math.max(...all);
 if (max == min) max = min + 1;
 const x = i => P + i * (W - P - 6) / (series[0].length - 1);
 const y = v => h - 18 - (v - min) / (max - min) * (h - 30);

 let s = '<svg class="ch" viewBox="0 0 ' + W + ' ' + h + '">';
 for (let k = 0; k <= 3; k++) {
  const v = min + (max - min) * k / 3;
  const yy = y(v);
  s += '<line x1="' + P + '" x2="' + (W - 4) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--bd)"/>';
  s += '<text x="2" y="' + (yy + 3) + '" font-size="9" fill="var(--mut)">' + v.toFixed(0) + '</text>';
 }
 if (th != null) {
  s += '<line x1="' + P + '" x2="' + (W - 4) + '" y1="' + y(th) + '" y2="' + y(th) + '" stroke="var(--crit)" stroke-dasharray="4"/>';
 }
 series.forEach((a, j) => {
  const pts = a.map((v, i) => x(i) + ',' + y(v)).join(' ');
  s += '<polyline fill="none" stroke="' + colors[j % 3] + '" stroke-width="2" points="' + pts + '"/>';
 });
 s += '<text x="' + P + '" y="' + (h - 4) + '" font-size="9" fill="var(--mut)">-24 h</text>';
 s += '<text x="' + (W - 30) + '" y="' + (h - 4) + '" font-size="9" fill="var(--mut)">agora</text>';
 return s + '</svg>';
}

function bars(items) {
 const m = Math.max(...items.map(i => i[1]), 1);
 return items.map(item => {
  const w = (item[1] / m) * 100;
  return '<div style="margin:8px 0"><div style="display:flex;justify-content:space-between"><span>' + item[0] + '</span><b>' + item[1] + '</b></div><div class="bar"><i style="width:' + w + '%;background:' + item[2] + '"></i></div></div>';
 }).join('');
}

const cnt = s => DEV.filter(d => d.s == s).length;
const act = () => ALERTS.filter(a => a.ativo);

const alertRows = l => {
 const rows = l.map(a =>
  '<tr><td>' + fmt(a.ts) + '</td><td>' + a.dev.id + '</td><td>' + a.dev.loc + '</td><td>' + a.tipo + '</td><td><span class="pill ' + SC[a.sev] + '">' + a.sev + '</span></td><td style="white-space:normal;min-width:200px">' + a.desc + '</td></tr>'
 ).join('');
 return '<div class="tw"><table><tr><th>Data</th><th>Equip.</th><th>Local</th><th>Tipo</th><th>Gravidade</th><th>Descricao</th></tr>' + (rows || '<tr><td colspan=6>Nenhum registro.</td></tr>') + '</table></div>';
};

const kpi = (l, v, c) => '<div class="card kpi ' + c + '"><span>' + l + '</span><b>' + v + '</b></div>';

const avg = () => {
 const ds = DEV.filter(d => d.on && d.hum.length > 1);
 if (!ds.length) return [];
 const n = Math.min(...ds.map(d => d.hum.length));
 return [...Array(n)].map((_, i) => ds.reduce((t, d) => t + d.hum[d.hum.length - n + i], 0) / ds.length);
};

const COLOR = { ok: '#22c55e', warn: '#eab308', crit: '#dc2626', off: '#94a3b8' };
const RANK = { crit: 3, warn: 2, ok: 1, off: 0 };
const areaDevs = a => DEV.filter(d => d.area == a);
const areaSt = a => areaDevs(a).map(d => d.s).sort((x, y) => RANK[y] - RANK[x])[0] || 'off';
const pop = a => '<b>' + a.nome + '</b><br>' + a.det + '<br>' + (areaDevs(a).map(d => d.id + ': ' + SL[d.s]).join('<br>') || 'Nenhum equipamento ainda');
const SV = b => '<svg width="34" height="34" viewBox="0 0 34 34" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))">' + b + '</svg>';
const ICO = {
 ok: SV('<circle cx="17" cy="17" r="12" fill="#22c55e" stroke="#fff" stroke-width="3"/><circle cx="17" cy="17" r="3.5" fill="#06210f"/>'),
 warn: SV('<path d="M17 4 30 28H4Z" fill="#eab308" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M17 12v8" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><circle cx="17" cy="23.5" r="1.6" fill="#111"/>'),
 crit: SV('<path d="M17 4 30 28H4Z" fill="#dc2626" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M17 12v8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="17" cy="23.5" r="1.6" fill="#fff"/>'),
 off: SV('<circle cx="17" cy="17" r="12" fill="#94a3b8" stroke="#fff" stroke-width="3"/><circle cx="17" cy="17" r="4" fill="none" stroke="#1e293b" stroke-width="2"/>')
};
const ico = st => L.divIcon({ className: '', html: ICO[st], iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -14] });
const PA = () => AREAS.filter(a => isFinite(a.lat) && isFinite(a.lng));

function drawMap() {
 const el = $('#map');
 if (!PA().length) {
  el.innerHTML = '<p style="padding:20px;color:var(--mut)">Nenhum local com coordenadas cadastrado ainda.</p>';
  return;
 }
 if (window.L) {
  const m = L.map(el);
  m.fitBounds(PA().map(a => [a.lat, a.lng]), { padding: [50, 50], maxZoom: 14 });
  let pin;
  m.on('click', e => {
   $('#llat').value = e.latlng.lat.toFixed(5);
   $('#llng').value = e.latlng.lng.toFixed(5);
   if (pin) pin.remove();
   pin = L.marker(e.latlng).addTo(m).bindPopup('Novo local aqui').openPopup();
  });
  const escuro = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
   maxZoom: 19,
   className: 'tiles-dark',
   attribution: '© OpenStreetMap'
  }).addTo(m);
  const claro = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
   subdomains: 'abcd',
   maxZoom: 19,
   attribution: '© OpenStreetMap © CARTO'
  });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
   maxZoom: 18,
   attribution: 'Imagens © Esri'
  });
  L.control.layers({ Escuro: escuro, Claro: claro, Satelite: sat }).addTo(m);
  PA().forEach(a => L.marker([a.lat, a.lng], { icon: ico(areaSt(a)) }).addTo(m).bindPopup(pop(a)));
  return;
 }
 const W = 600;
 const H = 440;
 const P = 70;
 const la = PA().map(a => a.lat);
 const lo = PA().map(a => a.lng);
 const x = a => P + (a.lng - Math.min(...lo)) / (Math.max(...lo) - Math.min(...lo) || 1) * (W - 2 * P);
 const y = a => P + (Math.max(...la) - a.lat) / (Math.max(...la) - Math.min(...la) || 1) * (H - 2 * P);
 const circles = PA().map(a => {
  const c = COLOR[areaSt(a)];
  return '<circle cx="' + x(a) + '" cy="' + y(a) + '" r="36" fill="' + c + '" opacity=".25"/><circle cx="' + x(a) + '" cy="' + y(a) + '" r="10" fill="' + c + '" stroke="#fff" stroke-width="2"/><text x="' + x(a) + '" y="' + (y(a) + 34) + '" text-anchor="middle" font-size="13" fill="var(--tx)">' + a.nome + '</text>';
 }).join('');
 el.innerHTML = '<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="var(--bd)" opacity=".5"/>' + circles + '<text x="10" y="' + (H - 10) + '" font-size="10" fill="var(--mut)">Mapa esquematico, sem escala.</text></svg>';
}

const PAGES = {
 dashboard: ['Dashboard', () => {
  const g5 = '<div class="grid g5">' +
   kpi('Equipamentos', DEV.length, '') +
   kpi('Normais', cnt('ok'), 'ok') +
   kpi('Com anomalia', cnt('warn') + cnt('crit'), 'warn') +
   kpi('Sem comunicacao', cnt('off'), 'off') +
   kpi('Alertas ativos', act().length, 'crit') +
   '</div>';
  const g2 = '<div class="grid g2" style="margin-top:12px">' +
   '<div class="card"><h3>Tensao media do sensor de solo (V) - ultimos envios</h3>' + line([avg()], { min: 0, max: 3.3, th: CONFIG.limites.soloCriticoV }) + '</div>' +
   '<div class="card"><h3>Situacao das barreiras ' + tag + '</h3>' + bars([
    ['Normal', cnt('ok'), 'var(--ok)'],
    ['Atencao', cnt('warn'), 'var(--warn)'],
    ['Critico', cnt('crit'), 'var(--crit)'],
    ['Sem comunicacao', cnt('off'), 'var(--off)']
   ]) + '</div>' +
   '</div>';
  const al = '<div class="card" style="margin-top:12px"><h3>Alertas ativos ' + tag + '</h3>' + alertRows(act().slice(0, 5)) + '</div>';
  return g5 + g2 + al;
 }],

 monitoramento: ['Central de Monitoramento', () => {
  if (!DEV.length) return vazio('Nenhum dado recebido ainda. Ligue o ESP32 (ou envie um POST em /api/v1/dados) e aguarde o primeiro envio.');
  return '<div class="grid g3">' + DEV.map(d =>
   '<div class="card dev ' + d.s + '">' +
   '<div style="display:flex;justify-content:space-between"><b>' + d.id + '</b><span class="pill ' + d.s + '">' + SL[d.s] + '</span></div>' +
   '<div style="color:var(--mut)">' + d.loc + '</div>' +
   '<dl>' +
   '<dt>Solo (tensao)</dt><dd>' + f(d.h, 2, ' V') + '</dd>' +
   '<dt>Inclinacao</dt><dd>' + f(d.i, 1, ' °') + '</dd>' +
   '<dt>Inclinacao X / Y</dt><dd>' + (d.on && d.x != null ? d.x + '° / ' + d.y + '°' : '-') + '</dd>' +
   '<dt>Temperatura</dt><dd>' + f(d.t, 1, ' °C') + '</dd>' +
   '<dt>Analise da IA</dt><dd>' + d.ia + '</dd>' +
   '<dt>GPS</dt><dd>' + (d.gps ? d.sats + ' satelites' : 'Sem sinal') + '</dd>' +
   '<dt>Ultima comunicacao</dt><dd>' + fmt(d.last) + '</dd>' +
   '</dl>' +
   '<div style="color:var(--mut);margin-top:8px">' + d.iaResumo + '</div>' +
   '</div>'
  ).join('') + '</div>';
 }],

 mapa: ['Mapa de Risco', () => {
  const itens = AREAS.map((a, i) => {
   const s = areaSt(a);
   const link = isFinite(a.lat) ? ' · <a style="color:var(--acc2)" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=' + a.lat + '&mlon=' + a.lng + '#map=15/' + a.lat + '/' + a.lng + '">ver no OpenStreetMap</a>' : '';
   const rem = a.manual ? ' · <a style="color:var(--crit);cursor:pointer" onclick="delLocal(' + i + ')">remover</a>' : '';
   return '<div style="padding:10px 0;border-bottom:1px solid var(--bd)"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + a.nome + '</b><span class="pill ' + s + '">' + SL[s] + '</span></div><div style="color:var(--mut)">' + a.det + '</div><div style="margin-top:4px">' + areaDevs(a).length + ' equipamento(s)' + link + rem + '</div></div>';
  }).join('');
  return '<div class="grid g2">' +
   '<div class="card"><h3>Areas de risco monitoradas - Recife ' + tag + '</h3><div id="map"></div><div style="margin-top:8px;color:var(--mut);font-size:12px">● Normal · ▲ Atencao (amarelo) ou critico (vermelho) · ○ Sem comunicacao</div></div>' +
   '<div class="card"><h3>Locais cadastrados (' + AREAS.length + ')</h3>' + itens + '</div>' +
   '</div>' +
   '<div class="card" style="margin-top:12px"><h3>Cadastrar novo local</h3><p style="color:var(--mut);margin:0 0 10px">Digite as coordenadas ou clique no mapa (com internet) para preenche-las. Os locais ficam salvos neste navegador.</p><div class="f"><input id="ln" placeholder="Nome do local (ex.: Alto da Telha)"><input id="ld" placeholder="Detalhe (rua, comunidade, referencia)"><input id="llat" placeholder="Latitude (ex.: -8.0123)"><input id="llng" placeholder="Longitude (ex.: -34.9123)"><button class="btn" onclick="addArea()">Cadastrar local</button></div></div>';
 }, drawMap],

 sensores: ['Monitoramento dos Sensores', () => {
  if (!DEV.length) return vazio('Nenhum dado recebido ainda. Ligue o ESP32 e aguarde o primeiro envio.');
  const d = DEV[cur] || DEV[0];
  const L = CONFIG.limites;
  const ch = (a, k) => a.filter((v, i) => i && Math.abs(v - a[i - 1]) > k).length;
  const sel = '<div class="f"><select onchange="cur=+this.value;go()">' +
   DEV.map((x, i) => '<option value="' + i + '" ' + (i == cur ? 'selected' : '') + '>' + x.id + ' - ' + x.loc + '</option>').join('') +
   '</select></div>';
  const aviso = d.on ? '' : '<div class="demo">Este equipamento esta sem comunicacao. Os graficos mostram os ultimos envios recebidos.</div>';
  const card1 = '<div class="card"><h3>Solo - tensao do sensor (V)</h3>' + line([d.hum], { min: 0, max: 3.3, th: L.soloCriticoV }) + '<p style="color:var(--mut)">Variacoes bruscas (> 0,3 V entre leituras): <b>' + ch(d.hum, .3) + '</b>. Na regra inicial da API, tensao acima de ' + L.soloCriticoV + ' V indica umidade alta.</p></div>';
  const card2 = '<div class="card"><h3>Inclinacao - acelerometro (°)</h3>' + line([d.inc], { colors: ['#fdb022'], min: 0, max: Math.max(20, ...d.inc), th: L.inclinacaoCritica }) + '<p style="color:var(--mut)">Maior valor entre X e Y. Ultima leitura: X = <b>' + (d.x ?? '-') + '°</b>, Y = <b>' + (d.y ?? '-') + '°</b>. Variacoes bruscas (> 1,5°): <b>' + ch(d.inc, 1.5) + '</b>.</p></div>';
  const card3 = '<div class="card"><h3>Temperatura (°C)</h3>' + line([d.tmp], { colors: ['#22c55e'] }) + '<p style="color:var(--mut)">Min.: <b>' + (d.tmp.length ? Math.min(...d.tmp).toFixed(1) : '-') + ' °C</b> · Max.: <b>' + (d.tmp.length ? Math.max(...d.tmp).toFixed(1) : '-') + ' °C</b></p></div>';
  return sel + aviso + '<div class="grid g3">' + card1 + card2 + card3 + '</div>';
 }],

 alertas: ['Sistema de Alertas', () => {
  const opts = ['Todos', 'Normal', 'Atencao', 'Risco moderado', 'Estado critico']
   .map(s => '<option ' + (s == fa ? 'selected' : '') + '>' + s + '</option>').join('');
  const ok = a => fa == 'Todos' || nz(a.sev) == nz(fa);
  return '<div class="f"><select onchange="fa=this.value;go()">' + opts + '</select></div>' +
   '<p style="color:var(--mut);margin:0 0 12px;font-size:12.5px">Os alertas sao gerados a partir da analise da IA nos ultimos envios (a API guarda so os 20 mais recentes) e da perda de comunicacao.</p>' +
   '<div class="card"><h3>Ativos ' + tag + '</h3>' + alertRows(act().filter(ok)) + '</div>' +
   '<div class="card" style="margin-top:12px"><h3>Ocorrencias anteriores ' + tag + '</h3>' + alertRows(ALERTS.filter(a => !a.ativo && ok(a))) + '</div>';
 }],

 equipamentos: ['Gerenciamento de Equipamentos', () => {
  const sel = DEV.find(d => d.id === selEq) || DEV[0];
  if (sel) selEq = sel.id;
  const opts = DEV.map(d => '<option value="' + d.id + '" ' + (sel && d.id === sel.id ? 'selected' : '') + '>' + d.id + '</option>').join('');
  const coord = sel && sel.area && isFinite(sel.area.lat) ? sel.area.lat.toFixed(5) + ', ' + sel.area.lng.toFixed(5) : '-';
  const info = sel
   ? '<div class="dev" style="border:0;margin-top:14px"><dl>' +
     '<dt>Status</dt><dd><span class="pill ' + sel.s + '">' + SL[sel.s] + '</span></dd>' +
     '<dt>Local</dt><dd>' + sel.loc + '</dd>' +
     '<dt>Funcionamento</dt><dd>' + (sel.on ? 'Online' : sel.last ? 'Offline desde ' + fmt(sel.last) : 'Aguardando 1a leitura') + '</dd>' +
     '<dt>Ultima comunicacao</dt><dd>' + fmt(sel.last) + '</dd>' +
     '<dt>Analise da IA</dt><dd>' + sel.ia + '</dd>' +
     '<dt>Solo (tensao)</dt><dd>' + f(sel.h, 2, ' V') + '</dd>' +
     '<dt>Inclinacao</dt><dd>' + f(sel.i, 1, ' °') + '</dd>' +
     '<dt>Inclinacao X / Y</dt><dd>' + (sel.on && sel.x != null ? sel.x + '° / ' + sel.y + '°' : '-') + '</dd>' +
     '<dt>Temperatura</dt><dd>' + f(sel.t, 1, ' °C') + '</dd>' +
     '<dt>GPS</dt><dd>' + (sel.gps ? sel.sats + ' satelites (' + coord + ')' : 'Sem sinal') + '</dd>' +
     '</dl></div>'
   : '<p style="color:var(--mut);margin:14px 0 0">Nenhum equipamento conectado no momento. Quando o ESP32 enviar dados a API, ele aparece aqui.</p>';
  const rows = DEV.map(d =>
   '<tr><td>' + d.id + '</td><td>' + d.loc + '</td><td><span class="pill ' + d.s + '">' + SL[d.s] + '</span></td><td>' + d.ia + '</td><td>' + (d.gps ? d.sats + ' satelites' : 'Sem sinal') + '</td><td>' + fmt(d.last) + '</td><td>' + (d.on ? 'Online' : d.last ? 'Offline desde ' + fmt(d.last) : 'Aguardando 1a leitura') + '</td><td><button class="btn s" onclick="desconectar(\'' + d.id + '\')">Desconectar</button>' + (CADASTRADOS.includes(d.id) ? ' <button class="btn s" onclick="excluirEquip(\'' + d.id + '\')">Excluir cadastro</button>' : '') + '</td></tr>'
  ).join('');
  const desc = IGNORADOS.length
   ? '<div class="card" style="margin-top:12px"><h3>Equipamentos desconectados</h3><p style="color:var(--mut);margin:0 0 10px">O site ignora estes equipamentos (sem tela, graficos ou alertas) ate voce reconecta-los.</p><div class="f">' +
     IGNORADOS.map(id => '<span style="display:flex;gap:8px;align-items:center">' + id + '<button class="btn s" onclick="reconectar(\'' + id + '\')">Reconectar</button></span>').join('') +
     '</div></div>'
   : '';
  const esc = t => String(t).replace(/"/g, '&quot;');
  const locsOpts = '<option value="">Usar a posicao do GPS</option>' + MANUAIS.map(a => '<option ' + (a.nome === rascunhoEq.loc ? 'selected' : '') + '>' + a.nome + '</option>').join('');
  const cad = '<div class="card"><h3>Cadastrar novo equipamento</h3><p style="color:var(--mut);margin:0 0 10px">Use o mesmo nome que o ESP32 envia no campo <b>equipamento</b>. Ate enviar o primeiro dado, ele aparece como "aguardando 1a leitura". O local e opcional (cadastre locais na pagina Mapa de Risco).</p><div class="f"><input id="ne" placeholder="ID do equipamento (ex.: AURORA_V1_Firmware)" value="' + esc(rascunhoEq.id) + '" oninput="rascunhoEq.id=this.value"><select id="nl" onchange="rascunhoEq.loc=this.value">' + locsOpts + '</select><button class="btn" onclick="cadastrarEquip()">Cadastrar</button></div></div>';
  return cad + '<div class="card" style="margin-top:12px"><h3>Equipamento</h3><p style="color:var(--mut);margin:0 0 10px">Escolha o equipamento para ver as informacoes. <b>Desconectar</b> corta a comunicacao dele com o site: ele deixa de aparecer e de gerar alertas.</p><div class="f"><select id="ve" onchange="selEq=this.value;go()">' + opts + '</select>' + (sel ? '<button class="btn s" onclick="desconectar()">Desconectar</button>' : '') + '</div>' + info + '</div>' +
   '<div class="card" style="margin-top:12px"><div class="tw"><table><tr><th>ID</th><th>Local</th><th>Status</th><th>Analise da IA</th><th>GPS</th><th>Ultimo contato</th><th>Funcionamento</th><th></th></tr>' + (rows || '<tr><td colspan=8>Nenhum equipamento enviou dados ainda.</td></tr>') + '</table></div></div>' + desc;
 }],

 historico: ['Historico e Relatorios', () => {
  const l = ALERTS.filter(a =>
   (hf.d == 'Todos' || a.dev.id == hf.d) &&
   (!hf.t || a.ts >= new Date(hf.t + 'T00:00:00').getTime())
  );
  const opts = '<option>Todos</option>' + DEV.map(d => '<option ' + (d.id == hf.d ? 'selected' : '') + '>' + d.id + '</option>').join('');
  return '<div class="f"><input type="date" value="' + hf.t + '" onchange="hf.t=this.value;go()"><select onchange="hf.d=this.value;go()">' + opts + '</select></div>' +
   '<div class="grid g2"><div class="card"><h3>Tensao media do sensor de solo (V)</h3>' + line([avg()], { min: 0, max: 3.3 }) + '</div><div class="card"><h3>Ocorrencias criticas</h3><b style="font-size:28px">' + l.filter(a => nz(a.sev) == 'Estado critico').length + '</b></div></div>' +
   '<div class="card" style="margin-top:12px"><h3>Historico de alertas ' + tag + '</h3>' + alertRows(l) + '</div>';
 }],

 config: ['Configuracoes', () =>
  '<div class="grid g2">' +
  '<div class="card"><h3>Administradores</h3><div class="tw"><table><tr><th>Nome</th><th>E-mail</th><th>Permissão</th><th>Último acesso</th></tr><tbody id="admT">' + linhasAdmins() + '</tbody></table></div>' +
  '<div class="f" style="margin-top:10px"><input id="an" placeholder="Nome"><input id="ae" placeholder="E-mail"><input id="as" type="password" placeholder="Senha" autocomplete="new-password"><select id="ap"><option>Total</option><option>Leitura + alertas</option><option>Somente leitura</option></select><button class="btn" onclick="addU()">Adicionar</button></div></div>' +
  '<div class="card"><h3>Registros de acesso</h3><div id="logs">' + linhasLogs() + '</div></div>' +
  '</div>' +
  '<div class="card" style="margin-top:12px"><h3>Conexao com a API</h3><p style="margin:0 0 8px;color:var(--mut)">Endereco: <b>' + CONFIG.apiUrl + '</b><br>Rotas: ' + Object.values(CONFIG.rotas).join(' · ') + '<br>Atualizacao a cada ' + (CONFIG.atualizarACadaMs / 1000) + ' s<br>' + iaTexto() + '</p><p style="margin:0;color:var(--mut)">Para mudar o endereco, as rotas ou os limites, edite <code>js/dados.js</code>.</p></div>',
  carregarAdmins
 ]
};

let cur = 0;
let fa = 'Todos';
let hf = { d: 'Todos', s: 'Todos', t: '' };
let page = 'dashboard';
let selEq = '';
let rascunhoEq = { id: '', loc: '' };   // guarda o que voce digitou no cadastro de equipamento entre as atualizacoes

const ICON = {
 dashboard: '▦',
 monitoramento: '◉',
 mapa: '⌖',
 sensores: '〰',
 alertas: '⚠',
 equipamentos: '⚙',
 historico: '🗎',
 config: '👥'
};

function go() {
 page = PAGES[(location.hash || '').slice(1)] ? location.hash.slice(1) : 'dashboard';
 $('#nav').innerHTML = Object.keys(PAGES).map(k => {
  const nome = PAGES[k][0]
   .replace('Gerenciamento de ', '')
   .replace('Central de ', '')
   .replace('Sistema de ', '')
   .replace('Monitoramento dos ', '');
  return '<a class="' + (k == page ? 'on' : '') + '" href="#' + k + '" onclick="sb.classList.remove(\'open\')">' + ICON[k] + ' ' + nome + '</a>';
 }).join('');
 $('#ttl').textContent = PAGES[page][0];
 $('#v').innerHTML = PAGES[page][1]();
 if (PAGES[page][2]) PAGES[page][2]();
}

let timer;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function abrirPainel() {
 $('#login').classList.add('hide');
 $('#app').classList.remove('hide');
 go();
 atualizar(true);
 clearInterval(timer);
 timer = setInterval(() => atualizar(false), CONFIG.atualizarACadaMs);
}

// Login: confere e-mail e senha na API de administradores (api/routes.py)
async function enter_(e) {
 e.preventDefault();
 const btn = $('#login .btn');
 btn.disabled = true;
 try {
  await adminLogin($('#u').value.trim(), $('#p').value);
  $('#p').value = '';
  abrirPainel();
 } catch (err) {
  alert(err.message);
 } finally {
  btn.disabled = false;
 }
 return false;
}

function logout() {
 clearInterval(timer);
 adminSair();
 $('#app').classList.add('hide');
 $('#login').classList.remove('hide');
}

// Clique na logo: volta para o inicio (Dashboard) e atualiza a pagina (como o F5).
// Continua logado porque o token fica salvo em sessionStorage (veja iniciarLogin).
function irInicio() {
 location.hash = 'dashboard';
 location.reload();
}

// Sessao expirada ou administrador removido: volta para o login
function sessaoExpirada(err) {
 if (err && err.status === 401) {
  logout();
  alert('Sua sessao expirou. Entre novamente.');
  return true;
 }
 return false;
}

// Ao recarregar a pagina, continua logado se o token ainda for valido
async function iniciarLogin() {
 if (CONFIG.pularLogin) return abrirPainel();   // modo teste: entra sem login (js/dados.js)
 if (await adminSessao()) abrirPainel();
}

// ---------- pagina Configuracoes: administradores (dados da API) ----------
const linhasAdmins = () => USERS.map(u =>
 '<tr><td>' + esc(u.nome) + '</td><td>' + esc(u.email) + '</td><td>' + esc(u.permissao) + '</td><td>' + (u.ultimo_login ? fmt(u.ultimo_login) : 'nunca') + '</td></tr>'
).join('') || '<tr><td colspan=4 style="color:var(--mut)">Carregando...</td></tr>';

const linhasLogs = () => LOGS.map(x =>
 '<div style="padding:6px 0;border-bottom:1px solid var(--bd)">' + fmt(x.em) + ' · ' + esc(x.email) + ' · ' + (x.sucesso ? 'login' : 'login recusado') + '</div>'
).join('') || '<div style="color:var(--mut)">Nenhum acesso registrado.</div>';

async function carregarAdmins() {
 try {
  await adminCarregarUsuarios();
 } catch (err) {
  if (!sessaoExpirada(err) && $('#admT')) $('#admT').innerHTML = '<tr><td colspan=4>' + esc(err.message) + '</td></tr>';
  return;
 }
 if ($('#admT')) $('#admT').innerHTML = linhasAdmins();
 if ($('#logs')) $('#logs').innerHTML = linhasLogs();
}

async function addU() {
 const n = $('#an').value.trim();
 const e = $('#ae').value.trim();
 const s = $('#as').value;
 if (!n || !e || !s) {
  alert('Preencha nome, e-mail e senha.');
  return;
 }
 try {
  await adminCadastrar({ nome: n, email: e, senha: s, permissao: $('#ap').value });
  ['#an', '#ae', '#as'].forEach(id => $(id).value = '');
  carregarAdmins();
 } catch (err) {
  if (!sessaoExpirada(err)) alert(err.message);
 }
}

function addArea() {
 const n = $('#ln').value.trim();
 const det = $('#ld').value.trim();
 const la = parseFloat($('#llat').value.replace(',', '.'));
 const lo = parseFloat($('#llng').value.replace(',', '.'));

 if (!n || isNaN(la) || isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
  alert('Informe o nome, a latitude e a longitude (numeros validos).');
  return;
 }
 if (AREAS.some(a => a.nome.toLowerCase() == n.toLowerCase())) {
  alert('Ja existe um local com esse nome.');
  return;
 }

 MANUAIS.push({ id: 'm-' + Date.now(), nome: n, det: det || '-', lat: la, lng: lo });
 guardar('aurora_locais', MANUAIS);
 montar();
 go();
}

function delLocal(i) {
 const a = AREAS[i];
 if (!a || !a.manual) return;
 const ds = areaDevs(a);
 if (ds.length && !confirm('Ha ' + ds.length + ' equipamento(s) vinculado(s) a este local. Remover mesmo assim?')) return;

 MANUAIS = MANUAIS.filter(m => m.nome != a.nome);
 Object.keys(VINCULOS).forEach(k => {
  if (VINCULOS[k] == a.nome) delete VINCULOS[k];
 });
 guardar('aurora_locais', MANUAIS);
 guardar('aurora_vinculos', VINCULOS);
 montar();
 go();
}

// "Desconectar": corta a comunicacao do equipamento com o site e pede a API que pare de aceitar os envios dele (se ela tiver a rota)
async function desconectar(id) {
 id = id || selEq || (DEV[0] && DEV[0].id);
 if (!id) {
  alert('Nenhum equipamento conectado no momento.');
  return;
 }
 if (!confirm('Desconectar ' + id + '? Ele deixa de aparecer no site e de gerar alertas, e a API deixa de aceitar os envios dele (se tiver a rota de bloqueio).')) return;
 if (!IGNORADOS.includes(id)) IGNORADOS.push(id);
 delete VINCULOS[id];
 guardar('aurora_ignorados', IGNORADOS);
 guardar('aurora_vinculos', VINCULOS);
 montar();
 go();
 const ok = await apiPost(CONFIG.rotasEquip.desconectar.replace('{id}', encodeURIComponent(id)));
 if (!ok) alert('Equipamento desconectado do site. Mas a API nao confirmou o bloqueio (a rota ainda nao existe nela, ou ela esta fora do ar), entao o ESP32 continua enviando dados a ela. Veja o guia INTEGRACAO.md.');
}

// Cadastrar equipamento: guarda o ID (e o local, se escolhido) neste navegador. Quando o ESP32 enviar dados com esse nome, eles aparecem normalmente.
function cadastrarEquip() {
 const id = rascunhoEq.id.trim();
 const loc = rascunhoEq.loc;
 if (!id) {
  alert('Informe o ID do equipamento (o mesmo nome que o ESP32 envia no campo "equipamento").');
  return;
 }
 if (CADASTRADOS.includes(id)) {
  alert('Este equipamento ja esta cadastrado. Para refazer, use "Excluir cadastro" na tabela.');
  return;
 }
 if (IGNORADOS.includes(id)) {
  alert('Este equipamento esta desconectado. Use "Reconectar" no quadro de equipamentos desconectados.');
  return;
 }
 CADASTRADOS.push(id);
 if (loc) VINCULOS[id] = loc;
 guardar('aurora_equipamentos', CADASTRADOS);
 guardar('aurora_vinculos', VINCULOS);
 rascunhoEq = { id: '', loc: '' };
 selEq = id;
 montar();
 go();
}

function excluirEquip(id) {
 if (!confirm('Excluir o cadastro de ' + id + '? Se ele estiver enviando dados a API, continuara aparecendo automaticamente, sem o local escolhido.')) return;
 CADASTRADOS = CADASTRADOS.filter(x => x != id);
 delete VINCULOS[id];
 guardar('aurora_equipamentos', CADASTRADOS);
 guardar('aurora_vinculos', VINCULOS);
 montar();
 go();
}

async function reconectar(id) {
 IGNORADOS = IGNORADOS.filter(x => x != id);
 guardar('aurora_ignorados', IGNORADOS);
 montar();
 go();
 await apiPost(CONFIG.rotasEquip.reconectar.replace('{id}', encodeURIComponent(id)));
 atualizar(true);
}

addEventListener('hashchange', () => {
 if (!$('#app').classList.contains('hide')) go();
});

setInterval(() => {
 $('#clk').textContent = new Date().toLocaleString('pt-BR');
}, 1000);

// Depois de atualizar a pagina (F5 ou clique na logo), continua no painel se o token ainda for valido
iniciarLogin();
