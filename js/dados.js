// ============================================================
// AURORA – dados.js
// Camada de dados do site, ligada à API FastAPI do projeto.
//   GET /api/v1/status     -> estado da API e da IA
//   GET /api/v1/historico  -> últimos 20 envios do ESP32 (com a análise da IA)
// O ESP32 envia para POST /api/v1/dados (isso é feito pelo ESP32, não pelo site).
// Tudo que o site mostra é montado aqui a partir desses envios.
// ============================================================
const CONFIG={
 apiUrl:'teste',            // endereço da API (sem barra no final)
 rotas:{status:'/api/v1/status',historico:'/api/v1/historico'},
 atualizarACadaMs:5000,                     // atualização automática (5 s)
 // status_risco devolvido pela IA -> cor do site (ok, warn, crit). Se o modelo treinado
 // devolver outros nomes, acrescente aqui. Nome desconhecido vira "warn" (amarelo).
 mapaRisco:{normal:'ok',atencao:'warn',alerta:'crit',sensor_incompleto:'warn'},
 // Limites usados nos gráficos (mesmos valores da análise inicial da API)
 limites:{soloAtencaoV:1.8,soloCriticoV:2.5,inclinacaoAtencao:7,inclinacaoCritica:15,semContatoMin:5}
};

const SL={ok:'Normal',warn:'Atenção',crit:'Crítico',off:'Sem comunicação'};
const SC={'Normal':'ok','Atenção':'warn','Risco moderado':'mod','Estado crítico':'crit'};

// Dados em memória (montados por montar())
const AREAS=[],DEV=[],ALERTS=[],USERS=[],LOGS=[];
let REG=[],IA_MODELO=null;

// ---------- utilitários ----------
const norm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,'_');
const num=v=>v==null||v===''?NaN:+v;
const tempoDe=s=>new Date(String(s).replace(' ','T')).getTime();   // "recebido_em" vem sem fuso (hora do servidor)
const guardar=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const ler=(k,p)=>{try{return JSON.parse(localStorage.getItem(k))||p}catch(e){return p}};

function getApiUrl(){
 try{
  const override=(localStorage.getItem('aurora_api_url')||'').trim().replace(/\/+$/,'');
  return override||CONFIG.apiUrl;
 }catch(e){
  return CONFIG.apiUrl;
 }
}

async function api(rota){
 const baseUrl=getApiUrl();
 const r=await fetch(baseUrl+rota);
 if(!r.ok)throw new Error(r.status+' '+r.statusText+' ('+rota+')');
 return r.json();
}

// Locais cadastrados no site e vínculos equipamento -> local.
// A API ainda não tem rota para isso, então ficam salvos neste navegador (localStorage).
let MANUAIS=ler('aurora_locais',[]),VINCULOS=ler('aurora_vinculos',{});

// ---------- montagem: envios da API -> equipamentos, locais e alertas ----------
function montar(){
 const lim=CONFIG.limites,cor=r=>CONFIG.mapaRisco[norm(r.ia.status_risco)]||'warn';
 const maior=d=>d.mpu_ok?Math.max(Math.abs(d.inclinacao_x??0),Math.abs(d.inclinacao_y??0)):NaN;
 const porEq={};REG.forEach(r=>{(porEq[r.dados.equipamento]=porEq[r.dados.equipamento]||[]).push(r)});
 const areas=MANUAIS.map(a=>({...a,manual:true})),semLocal={id:'sem-local',nome:'Sem local',det:'GPS sem sinal',lat:NaN,lng:NaN};
 const eqs=Object.entries(porEq).map(([id,rs])=>{
  rs.sort((a,b)=>a.t-b.t);const u=rs[rs.length-1],d=u.dados,on=Date.now()-u.t<lim.semContatoMin*60000;
  const gps=[...rs].reverse().find(r=>r.dados.gps_valido&&isFinite(num(r.dados.latitude))&&isFinite(num(r.dados.longitude)));
  let area=areas.find(a=>a.manual&&a.nome==VINCULOS[id]);
  if(!area&&gps){area={id:'gps-'+id,nome:id,det:'posição do GPS',lat:+gps.dados.latitude,lng:+gps.dados.longitude};areas.push(area)}
  if(!area){area=semLocal;if(!areas.includes(semLocal))areas.push(semLocal)}
  return{id,area,loc:area.nome+(area.det&&area.det!='—'?' – '+area.det:''),
   hum:rs.map(r=>num(r.dados.solo_tensao)).filter(isFinite),
   inc:rs.map(r=>maior(r.dados)).filter(isFinite),
   tmp:rs.filter(r=>r.dados.temperatura_ok).map(r=>num(r.dados.temperatura)).filter(isFinite),
   bat:null,solar:'—',on,last:u.t,
   h:on?num(d.solo_tensao):null,i:on?maior(d):null,t:on&&d.temperatura_ok?num(d.temperatura):null,
   x:d.inclinacao_x,y:d.inclinacao_y,sats:d.satelites,gps:!!gps,
   ia:u.ia.status_risco||'—',iaResumo:u.ia.resumo||'',s:on?cor(u):'off'};
 });
 // Alertas: derivados da análise da IA (uma ocorrência a cada mudança de status) e da perda de comunicação
 const alertas=[];
 eqs.forEach(e=>{const rs=porEq[e.id];let ant=null;
  rs.forEach(r=>{const k=norm(r.ia.status_risco);if(k!=ant){ant=k;if(cor(r)!='ok')alertas.push({dev:e,sev:cor(r)=='crit'?'Estado crítico':'Atenção',tipo:r.ia.status_risco||'—',desc:r.ia.resumo||'',ts:r.t,ativo:false,eq:e.id})}});
  const ult=alertas.filter(a=>a.eq==e.id).pop();if(ult&&e.on&&e.s!='ok')ult.ativo=true;
  if(!e.on)alertas.push({dev:e,sev:'Atenção',tipo:'Sem comunicação',desc:'Nenhum envio recebido há mais de '+lim.semContatoMin+' min.',ts:e.last,ativo:true,eq:e.id});
 });
 alertas.sort((a,b)=>b.ts-a.ts).forEach((a,k)=>a.n=k+1);
 AREAS.splice(0,AREAS.length,...areas);DEV.splice(0,DEV.length,...eqs);ALERTS.splice(0,ALERTS.length,...alertas);
}

// ---------- carga dos dados ----------
const SEM_RERENDER=['mapa','equipamentos','config']; // páginas com formulário: não redesenhar sozinhas

function aplicarEstiloBolinha(el,ok){
 el.style.display='inline-block';
 el.style.width='12px';
 el.style.height='12px';
 el.style.minWidth='12px';
 el.style.minHeight='12px';
 el.style.borderRadius='50%';
 el.style.padding='0';
 el.style.fontSize='0';
 el.style.lineHeight='0';
 el.style.backgroundColor=ok?'#16a34a':'#dc2626';
 el.style.boxShadow=ok?'0 0 0 3px rgba(22,163,74,0.22)':'0 0 0 3px rgba(220,38,38,0.22)';
 el.setAttribute('aria-label',ok?'API conectada':'API desconectada');
}

function conn(ok){
 const c=document.querySelector('#conn')||(typeof $==='function'?$('#conn'):null);
 if(!c)return;
 c.textContent='';
 c.className='conn api-led '+(ok?'ok':'err');
 aplicarEstiloBolinha(c,ok);
}

const iaTexto=()=>IA_MODELO==null?'IA: estado desconhecido':IA_MODELO?'IA: modelo treinado carregado':'IA: análise local inicial (regras), sem modelo .pkl';

async function atualizar(primeira){
 try{
  const [st,h]=await Promise.all([api(CONFIG.rotas.status).catch(()=>null),api(CONFIG.rotas.historico)]);
  IA_MODELO=st?st.modelo_local_carregado:null;
  REG=(h.registros||[]).map(r=>({t:tempoDe(r.recebido_em),dados:r.dados,ia:r.ia||{}})).filter(r=>r.dados&&!isNaN(r.t));
  montar();
  conn(true);
  if(primeira||!SEM_RERENDER.includes(page))go();
 }catch(err){
  conn(false);
 }
}