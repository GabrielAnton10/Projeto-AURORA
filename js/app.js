// ============================================================
// AURORA – app.js
// Interface: gráficos, páginas, navegação e ações.
// Depende das variáveis globais definidas em dados.js
// ============================================================
const fmt=t=>!t?'—':new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const tag='<span class="tag">FICTÍCIO</span>';
const $=s=>document.querySelector(s);

function line(series,{h=150,min,max,colors=['#f28c1a','#fdb022','#dc2626'],th}={}){
 const W=600,P=28,all=series.flat();min=min??Math.min(...all);max=max??Math.max(...all);if(max==min)max=min+1;
 const x=i=>P+i*(W-P-6)/(series[0].length-1),y=v=>h-18-(v-min)/(max-min)*(h-30);
 let s=`<svg class="ch" viewBox="0 0 ${W} ${h}">`;
 for(let k=0;k<=3;k++){const v=min+(max-min)*k/3,yy=y(v);s+=`<line x1="${P}" x2="${W-4}" y1="${yy}" y2="${yy}" stroke="var(--bd)"/><text x="2" y="${yy+3}" font-size="9" fill="var(--mut)">${v.toFixed(0)}</text>`}
 if(th!=null)s+=`<line x1="${P}" x2="${W-4}" y1="${y(th)}" y2="${y(th)}" stroke="var(--crit)" stroke-dasharray="4"/>`;
 series.forEach((a,j)=>s+=`<polyline fill="none" stroke="${colors[j%3]}" stroke-width="2" points="${a.map((v,i)=>x(i)+','+y(v)).join(' ')}"/>`);
 return s+`<text x="${P}" y="${h-4}" font-size="9" fill="var(--mut)">−24 h</text><text x="${W-30}" y="${h-4}" font-size="9" fill="var(--mut)">agora</text></svg>`}
function bars(items){const m=Math.max(...items.map(i=>i[1]),1);return items.map(([l,v,c])=>`<div style="margin:8px 0"><div style="display:flex;justify-content:space-between"><span>${l}</span><b>${v}</b></div><div class="bar"><i style="width:${v/m*100}%;background:${c}"></i></div></div>`).join('')}
const cnt=s=>DEV.filter(d=>d.s==s).length,act=()=>ALERTS.filter(a=>a.ativo);
const alertRows=l=>`<div class="tw"><table><tr><th>Data</th><th>Equip.</th><th>Local</th><th>Tipo</th><th>Gravidade</th><th>Descrição</th></tr>${l.map(a=>`<tr><td>${fmt(a.ts)}</td><td>${a.dev.id}</td><td>${a.dev.loc}</td><td>${a.tipo}</td><td><span class="pill ${SC[a.sev]}">${a.sev}</span></td><td style="white-space:normal;min-width:200px">${a.desc}</td></tr>`).join('')||'<tr><td colspan=6>Nenhum registro.</td></tr>'}</table></div>`;
const kpi=(l,v,c)=>`<div class="card kpi ${c}"><span>${l}</span><b>${v}</b></div>`;
const avg=k=>DEV.filter(d=>d.on).map(d=>d.hum).reduce((a,h)=>a.map((v,i)=>v+h[i]/DEV.filter(d=>d.on).length),Array(N).fill(0));

const COLOR={ok:'#22c55e',warn:'#eab308',crit:'#dc2626',off:'#94a3b8'},RANK={crit:3,warn:2,ok:1,off:0};
const areaDevs=a=>DEV.filter(d=>d.area==a),areaSt=a=>areaDevs(a).map(d=>d.s).sort((x,y)=>RANK[y]-RANK[x])[0]||'off';
const pop=a=>`<b>${a.nome}</b><br>${a.det}<br>`+(areaDevs(a).map(d=>`${d.id}: ${SL[d.s]}`).join('<br>')||'Nenhum equipamento ainda');
const SV=(b)=>`<svg width="34" height="34" viewBox="0 0 34 34" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))">${b}</svg>`;
const ICO={ok:SV('<circle cx="17" cy="17" r="12" fill="#22c55e" stroke="#fff" stroke-width="3"/><circle cx="17" cy="17" r="3.5" fill="#06210f"/>'),
 warn:SV('<path d="M17 4 30 28H4Z" fill="#eab308" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M17 12v8" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><circle cx="17" cy="23.5" r="1.6" fill="#111"/>'),
 crit:SV('<path d="M17 4 30 28H4Z" fill="#dc2626" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M17 12v8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="17" cy="23.5" r="1.6" fill="#fff"/>'),
 off:SV('<circle cx="17" cy="17" r="12" fill="#94a3b8" stroke="#fff" stroke-width="3"/><circle cx="17" cy="17" r="4" fill="none" stroke="#1e293b" stroke-width="2"/>')};
const ico=st=>L.divIcon({className:'',html:ICO[st],iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-14]});
function drawMap(){const el=$('#map');
 if(window.L){const m=L.map(el);m.fitBounds(AREAS.map(a=>[a.lat,a.lng]),{padding:[50,50],maxZoom:14});let pin;
  m.on('click',e=>{$('#llat').value=e.latlng.lat.toFixed(5);$('#llng').value=e.latlng.lng.toFixed(5);if(pin)pin.remove();pin=L.marker(e.latlng).addTo(m).bindPopup('Novo local aqui').openPopup()});
  const escuro=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,className:'tiles-dark',attribution:'© OpenStreetMap'}).addTo(m);
  const claro=L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:19,attribution:'© OpenStreetMap © CARTO'});
  const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Imagens © Esri'});
  L.control.layers({'Escuro':escuro,'Claro':claro,'Satélite':sat}).addTo(m);
  AREAS.forEach(a=>L.marker([a.lat,a.lng],{icon:ico(areaSt(a))}).addTo(m).bindPopup(pop(a)));return}
 const W=600,H=440,P=70,la=AREAS.map(a=>a.lat),lo=AREAS.map(a=>a.lng),
  x=a=>P+(a.lng-Math.min(...lo))/(Math.max(...lo)-Math.min(...lo)||1)*(W-2*P),y=a=>P+(Math.max(...la)-a.lat)/(Math.max(...la)-Math.min(...la)||1)*(H-2*P);
 el.innerHTML=`<svg class="ch" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="var(--bd)" opacity=".5"/>`+AREAS.map(a=>{const c=COLOR[areaSt(a)];
  return `<circle cx="${x(a)}" cy="${y(a)}" r="36" fill="${c}" opacity=".25"/><circle cx="${x(a)}" cy="${y(a)}" r="10" fill="${c}" stroke="#fff" stroke-width="2"/><text x="${x(a)}" y="${y(a)+34}" text-anchor="middle" font-size="13" fill="var(--tx)">${a.nome}</text>`}).join('')+
  `<text x="10" y="${H-10}" font-size="10" fill="var(--mut)">Mapa esquemático, sem escala (norte para cima). O mapa real (ruas) carrega ao abrir o projeto no VS Code com Live Server e internet.</text></svg>`}
const PAGES={
dashboard:['Dashboard',()=>`<div class="grid g5">${kpi('Equipamentos',DEV.length,'')+kpi('Normais',cnt('ok'),'ok')+kpi('Com anomalia',cnt('warn')+cnt('crit'),'warn')+kpi('Sem comunicação',cnt('off'),'off')+kpi('Alertas ativos',act().length,'crit')}</div>
<div class="grid g2" style="margin-top:12px"><div class="card"><h3>Umidade média do solo (24 h) ${tag}</h3>${line([avg()],{min:0,max:100,th:85})}</div>
<div class="card"><h3>Situação das barreiras ${tag}</h3>${bars([['Normal',cnt('ok'),'var(--ok)'],['Atenção',cnt('warn'),'var(--warn)'],['Crítico',cnt('crit'),'var(--crit)'],['Sem comunicação',cnt('off'),'var(--off)']])}</div></div>
<div class="card" style="margin-top:12px"><h3>Alertas ativos ${tag}</h3>${alertRows(act().slice(0,5))}</div>`],
monitoramento:['Central de Monitoramento',()=>`<div class="grid g3">${DEV.map(d=>`<div class="card dev ${d.s}"><div style="display:flex;justify-content:space-between"><b>${d.id}</b><span class="pill ${d.s}">${SL[d.s]}</span></div><div style="color:var(--mut)">${d.loc}</div>
<dl><dt>Umidade</dt><dd>${d.on?d.h.toFixed(0)+' %':'—'}</dd><dt>Inclinação</dt><dd>${d.on?d.i.toFixed(1)+' °':'—'}</dd><dt>Temperatura</dt><dd>${d.on?d.t.toFixed(1)+' °C':'—'}</dd><dt>Bateria</dt><dd>${d.on?d.bat+' %':'—'}</dd><dt>Energia solar</dt><dd>${d.solar}</dd><dt>Última comunicação</dt><dd>${fmt(d.last)}</dd></dl>
<div class="bar"><i style="width:${d.bat}%;background:${d.bat<25?'var(--crit)':'var(--ok)'}"></i></div></div>`).join('')}</div>
<p style="color:var(--mut);font-size:12px">Valores fictícios. Em produção, a leitura virá do backend (WebSocket ou atualização periódica).</p>`],
mapa:['Mapa de Risco',()=>`<div class="grid g2"><div class="card"><h3>Áreas de risco monitoradas – Recife ${tag}</h3><div id="map"></div><div style="margin-top:8px;color:var(--mut);font-size:12px">● Normal · ▲ Atenção (amarelo) ou crítico (vermelho) · ○ Sem comunicação</div></div>
<div class="card"><h3>Locais cadastrados (${AREAS.length})</h3>${AREAS.map((a,i)=>{const s=areaSt(a);return `<div style="padding:10px 0;border-bottom:1px solid var(--bd)"><div style="display:flex;justify-content:space-between;gap:8px"><b>${a.nome}${a.novo?' <span class="tag">NOVO</span>':''}</b><span class="pill ${s}">${SL[s]}</span></div><div style="color:var(--mut)">${a.det}</div><div style="margin-top:4px">${areaDevs(a).length} equipamento(s) · <a style="color:var(--acc2)" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=15/${a.lat}/${a.lng}">ver no OpenStreetMap</a>${a.novo?` · <a style="color:var(--crit);cursor:pointer" onclick="delArea(${i})">remover</a>`:''}</div></div>`}).join('')}</div></div>
<div class="card" style="margin-top:12px"><h3>Cadastrar novo local</h3><p style="color:var(--mut);margin:0 0 10px">Digite as coordenadas ou clique no mapa (com internet) para preenchê-las.</p>
<div class="f"><input id="ln" placeholder="Nome do local (ex.: Alto da Telha)"><input id="ld" placeholder="Detalhe (rua, comunidade, referência)"><input id="llat" placeholder="Latitude (ex.: -8.0123)"><input id="llng" placeholder="Longitude (ex.: -34.9123)"><button class="btn" onclick="addArea()">Cadastrar local</button></div></div>
<p style="color:var(--mut);font-size:12px">As quatro áreas iniciais são locais de risco alto ou muito alto citados pela Defesa Civil do Recife; as posições são aproximadas e seus equipamentos e valores são fictícios. Locais novos ficam salvos neste navegador até existir o backend.</p>`,drawMap],
sensores:['Monitoramento dos Sensores',()=>{const d=DEV[cur],ch=(a,k)=>a.filter((v,i)=>i&&Math.abs(v-a[i-1])>k).length;
return `<div class="f"><select onchange="cur=+this.value;go()">${DEV.map((x,i)=>`<option value="${i}" ${i==cur?'selected':''}>${x.id} – ${x.loc}</option>`).join('')}</select></div>
${d.on?'':'<div class="demo">Este equipamento ainda não enviou leituras. Os gráficos ficam vazios até chegarem dados.</div>'}<div class="grid g3"><div class="card"><h3>Umidade do solo (%) ${tag}</h3>${line([d.hum],{min:0,max:100,th:85})}<p style="color:var(--mut)">Variações bruscas (&gt; 6 p.p. entre leituras): <b>${ch(d.hum,6)}</b></p></div>
<div class="card"><h3>Inclinação – acelerômetro (°) ${tag}</h3>${line([d.inc],{colors:['#fdb022'],min:0,max:20,th:12})}<p style="color:var(--mut)">Variações bruscas (&gt; 1,5° entre leituras): <b>${ch(d.inc,1.5)}</b>. Limiar crítico ilustrativo: 12°.</p></div>
<div class="card"><h3>Temperatura (°C) ${tag}</h3>${line([d.tmp],{colors:['#22c55e'],min:15,max:40})}<p style="color:var(--mut)">Mín.: <b>${Math.min(...d.tmp).toFixed(1)} °C</b> · Máx.: <b>${Math.max(...d.tmp).toFixed(1)} °C</b></p></div></div>`}],
alertas:['Sistema de Alertas',()=>`<div class="f"><select onchange="fa=this.value;go()">${['Todos','Normal','Atenção','Risco moderado','Estado crítico'].map(s=>`<option ${s==fa?'selected':''}>${s}</option>`).join('')}</select></div>
<div class="card"><h3>Ativos ${tag}</h3>${alertRows(act().filter(a=>fa=='Todos'||a.sev==fa))}</div><div class="card" style="margin-top:12px"><h3>Ocorrências anteriores ${tag}</h3>${alertRows(ALERTS.filter(a=>!a.ativo&&(fa=='Todos'||a.sev==fa)))}</div>`],
equipamentos:['Gerenciamento de Equipamentos',()=>`<div class="card"><h3>Cadastrar equipamento</h3><div class="f"><input id="ni" placeholder="Identificação (ex.: EQ-009)"><select id="nl">${AREAS.map((a,i)=>`<option value="${i}">${a.nome} – ${a.det}</option>`).join('')}</select><button class="btn" onclick="addDev()">Cadastrar</button></div></div>
<div class="card" style="margin-top:12px"><div class="tw"><table><tr><th>ID</th><th>Local</th><th>Status</th><th>Bateria</th><th>Solar</th><th>Último contato</th><th>Funcionamento</th></tr>${DEV.map(d=>`<tr><td>${d.id}</td><td>${d.loc}</td><td><span class="pill ${d.s}">${SL[d.s]}</span></td><td>${d.bat}%</td><td>${d.solar}</td><td>${fmt(d.last)}</td><td>${d.on?'Online':d.novo?'Aguardando 1ª leitura':'Offline desde '+fmt(d.last)}</td></tr>`).join('')}</table></div></div>`],
historico:['Histórico e Relatórios',()=>{const l=ALERTS.filter(a=>(hf.d=='Todos'||a.dev.id==hf.d)&&(hf.s=='Todos'||a.sev==hf.s)&&(!hf.t||a.ts>=new Date(hf.t).getTime()));
return `<div class="f"><input type="date" value="${hf.t}" onchange="hf.t=this.value;go()"><select onchange="hf.d=this.value;go()"><option>Todos</option>${DEV.map(d=>`<option ${d.id==hf.d?'selected':''}>${d.id}</option>`).join('')}</select><select onchange="hf.s=this.value;go()">${['Todos','Normal','Atenção','Risco moderado','Estado crítico'].map(s=>`<option ${s==hf.s?'selected':''}>${s}</option>`).join('')}</select></div>
<div class="grid g2"><div class="card"><h3>Umidade média ${tag}</h3>${line([avg()],{min:0,max:100})}</div><div class="card"><h3>Ocorrências críticas</h3><b style="font-size:28px">${l.filter(a=>a.sev=='Estado crítico').length}</b></div></div>
<div class="card" style="margin-top:12px"><h3>Histórico de alertas ${tag}</h3>${alertRows(l)}</div>`}],
config:['Configurações e Administradores',()=>`<div class="grid g2"><div class="card"><h3>Administradores ${tag}</h3><div class="tw"><table><tr><th>Nome</th><th>E-mail</th><th>Permissão</th><th>Último acesso</th></tr>${USERS.map(u=>`<tr>${u.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>
<div class="f" style="margin-top:10px"><input id="an" placeholder="Nome"><input id="ae" placeholder="E-mail"><select id="ap"><option>Total</option><option>Leitura + alertas</option><option>Somente leitura</option></select><button class="btn" onclick="addU()">Adicionar</button></div></div>
<div class="card"><h3>Registros de acesso ${tag}</h3>${LOGS.map(x=>`<div style="padding:6px 0;border-bottom:1px solid var(--bd)">${x}</div>`).join('')}</div></div>
<div class="card" style="margin-top:12px"><h3>Preparação para integração real</h3><p style="margin:0;color:var(--mut)">Fonte de dados atual: <b>${CONFIG.source}</b> (fictícia). Fluxo previsto: sensores → microcontrolador (ex.: ESP32) → <code>POST ${CONFIG.apiBase}/readings</code> → backend + banco de dados → este painel. Ao ativar a fonte real, os dados passam a ser marcados como reais e o selo FICTÍCIO deixa de aparecer.</p></div>`]
};
let cur=2,fa='Todos',hf={d:'Todos',s:'Todos',t:''},page='dashboard';
const ICON={dashboard:'▦',monitoramento:'◉',mapa:'⌖',sensores:'〰',alertas:'⚠',equipamentos:'⚙',historico:'🗎',config:'👥'};
function go(){page=PAGES[(location.hash||'').slice(1)]?location.hash.slice(1):'dashboard';
 $('#nav').innerHTML=Object.keys(PAGES).map(k=>`<a class="${k==page?'on':''}" href="#${k}" onclick="sb.classList.remove('open')">${ICON[k]} ${PAGES[k][0].replace('Gerenciamento de ','').replace('Central de ','').replace('Sistema de ','').replace('Monitoramento dos ','')}</a>`).join('');
 $('#ttl').textContent=PAGES[page][0];$('#v').innerHTML=PAGES[page][1]();if(PAGES[page][2])PAGES[page][2]()}
function enter_(e){e.preventDefault();$('#login').classList.add('hide');$('#app').classList.remove('hide');go();return false}
function logout(){$('#app').classList.add('hide');$('#login').classList.remove('hide')}
function addDev(){const i=$('#ni').value.trim(),a=AREAS[+$('#nl').value];if(!i||!a)return;if(DEV.some(d=>d.id==i)){alert('Já existe um equipamento com esse ID.');return}novoEquip(i,a);salvar();go()}
function addArea(){const n=$('#ln').value.trim(),det=$('#ld').value.trim(),la=parseFloat($('#llat').value.replace(',','.')),lo=parseFloat($('#llng').value.replace(',','.'));
 if(!n||isNaN(la)||isNaN(lo)||Math.abs(la)>90||Math.abs(lo)>180){alert('Informe o nome, a latitude e a longitude (números válidos).');return}
 if(AREAS.some(a=>a.nome.toLowerCase()==n.toLowerCase())){alert('Já existe um local com esse nome.');return}
 AREAS.push({nome:n,det:det||'—',lat:la,lng:lo,novo:true});salvar();go()}
function delArea(i){const a=AREAS[i];if(!a||!a.novo)return;const ds=areaDevs(a);if(ds.length&&!confirm('Este local tem '+ds.length+' equipamento(s) cadastrado(s). Remover tudo?'))return;
 ds.forEach(d=>DEV.splice(DEV.indexOf(d),1));AREAS.splice(i,1);salvar();go()}
function addU(){const n=$('#an').value.trim(),e=$('#ae').value.trim();if(!n||!e)return;USERS.push([n,e,$('#ap').value,'nunca']);go()}
addEventListener('hashchange',()=>{if(!$('#app').classList.contains('hide'))go()});
setInterval(()=>{$('#clk').textContent=new Date().toLocaleString('pt-BR')},1000);
