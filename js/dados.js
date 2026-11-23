// ============================================================
// AURORA – dados.js
// Camada de dados do site, ligada à API FastAPI do projeto.
//   GET /api/v1/status     -> estado da API e da IA
//   GET /api/v1/historico  -> últimos 20 envios do ESP32 (com a análise da IA)
// O ESP32 envia para POST /api/v1/dados (isso é feito pelo ESP32, não pelo site).
// Tudo que o site mostra é montado aqui a partir desses envios.
// ============================================================
const CONFIG={
 apiUrl:'http://localhost:8000',            // endereço da API (sem barra no final)
 rootas:{status:'/api/v1/status',historico:'/api/v1/historico'},
 // Rotas opcionais para a API parar de aceitar os envios de um equipamento (veja INTEGRACAO.md). {id} vira o nome do equipamento.
 rotasEquip:{desconectar:'/api/v1/equipamentos/{id}/desconectar',reconectar:'/api/v1/equipamentos/{id}/reconectar'},
 atualizarACadaMs:5000,                     // atualização automática (5 s)
 exigirLogin:false,                        // true = o login passa a exigir um usuario cadastrado em Configuracoes (so neste navegador; seguranca real exige back-end)
 timeoutMs:8000,                           // sem resposta em 8 s = API desconectada
 urlFonte:'',                               // (opcional) endereço de um JSON {"url":"https://..."} com a URL atual da API
 // status_risco devolvido pela IA -> cor do site (ok, warn, crit). Se o modelo treinado
 // devolver outros nomes, acrescente aqui. Nome desconhecido vira "warn" (amarelo).
 mapaRisco:{normal:'ok',atencao:'warn',alerta:'crit',sensor_incompleto:'warn'},
 // Limites usados nos gráficos (mesmos valores da análise inicial da API)
 limites:{soloAtencaoV:1.8,soloCriticoV:2.5,inclinacaoAtencao:7,inclinacaoCritica:15,semContatoMin:5}
};

try{localStorage.removeItem('aurora_api_url')}catch(e){}   // limpa endereco salvo por versoes anteriores: vale sempre CONFIG.apiUrl

const SL={ok:'Normal',warn:'Atenção',crit:'Crítico',off:'Sem comunicação'};
const SC={'Normal':'ok','Atenção':'warn','Risco moderado':'mod','Estado crítico':'crit'};

// Dados em memória (montados por montar())
const AREAS=[],DEV=[],ALERTS=[],USERS=[],LOGS=[];
let REG=[],IA_MODELO=null;

// ---------- utilitários ----------
const norm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,'_');
const num=v=>v==null||v===''?NaN:+v;
const tempoDe=s=>new Date(String(s).replace(' ','T')).getTime();   // "recebido_em" vem sem fuso (hora do servidor)
async function api(rota,tentou){
 const h={};if(/ngrok/i.test(CONFIG.apiUrl))h['ngrok-skip-browser-warning']='1';   // evita a página de aviso do ngrok gratuito
 const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),CONFIG.timeoutMs);
 try{const r=await fetch(CONFIG.apiUrl+rota,{headers:h,signal:ac.signal});if(!r.ok)throw new Error(r.status+' '+r.statusText+' ('+rota+')');return await r.json()}
 catch(err){
  if(!tentou&&CONFIG.urlFonte&&await descobrirUrl())return api(rota,true);   // endereço mudou? busca o novo e tenta de novo
  throw err.name=='AbortError'?new Error('a API não respondeu a tempo'):err}
 finally{clearTimeout(tm)}
}
async function descobrirUrl(){
 try{const r=await fetch(CONFIG.urlFonte+(CONFIG.urlFonte.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});
  const u=String((await r.json()).url||'').replace(/\/+$/,'');
  if(u&&u!=CONFIG.apiUrl){CONFIG.apiUrl=u;return true}}catch(e){}
 return false}
// POST sem corpo (usado em desconectar/reconectar). Devolve true se a API aceitou.
async function apiPost(rota){
 const h={};if(/ngrok/i.test(CONFIG.apiUrl))h['ngrok-skip-browser-warning']='1';
 const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),CONFIG.timeoutMs);
 try{const r=await fetch(CONFIG.apiUrl+rota,{method:'POST',headers:h,signal:ac.signal});return r.ok}
 catch(e){return false}
 finally{clearTimeout(tm)}
}
const guardar=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const ler=(k,p)=>{try{return JSON.parse(localStorage.getItem(k))||p}catch(e){return p}};

// Locais cadastrados no site e vínculos equipamento -> local.
// A API ainda não tem rota para isso, então ficam salvos neste navegador (localStorage).
let MANUAIS=ler('aurora_locais',[]),VINCULOS=ler('aurora_vinculos',{}),IGNORADOS=ler('aurora_ignorados',[]),CADASTRADOS=ler('aurora_equipamentos',[]);
// Usuarios com acesso ao painel (cadastrados em Configuracoes). A API ainda nao tem login, entao ficam salvos neste navegador.
let USUARIOS=ler('aurora_usuarios',[]);
async function hashSenha(email,senha){   // a senha nunca e guardada: so o hash SHA-256
 const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('aurora:'+email+':'+senha));
 return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')} // IGNORADOS = equipamentos desvinculados do site

// ---------- montagem: envios da API -> equipamentos, locais e alertas ----------
function montar(){
 const lim=CONFIG.limites,cor=r=>CONFIG.mapaRisco[norm(r.ia.status_risco)]||'warn';
 const maior=d=>d.mpu_ok?Math.max(Math.abs(d.inclinacao_x??0),Math.abs(d.inclinacao_y??0)):NaN;
 const porEq={};REG.forEach(r=>{if(IGNORADOS.includes(r.dados.equipamento))return;(porEq[r.dados.equipamento]=porEq[r.dados.equipamento]||[]).push(r)});
 const areas=MANUAIS.map(a=>({...a,manual:true})),semLocal={id:'sem-local',nome:'Sem local',det:'GPS sem sinal',lat:NaN,lng:NaN};
 const eqs=Object.entries(porEq).map(([id,rs])=>{
  rs.sort((a,b)=>a.t-b.t);const u=rs[rs.length-1],d=u.dados,on=Date.now()-u.t<lim.semContatoMin*60000;
  const gps=[...rs].reverse().find(r=>r.dados.gps_valido&&isFinite(num(r.dados.latitude))&&isFinite(num(r.dados.longitude)));
  let area=areas.find(a=>a.manual&&a.nome==VINCULOS[id]);
  if(!area&&gps){area={id:'gps-'+id,nome:id,det:'posição do GPS',lat:+gps.dados.latitude,lng:+gps.dados.longitude};areas.push(area)}
  if(!area){area=semLocal;if(!areas.includes(semLocal))areas.push(semLocal)}
  return{id,area,loc:area.nome+(area.det&&!['—','-'].includes(area.det)?' – '+area.det:''),
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
 // Equipamentos cadastrados no site que ainda nao enviaram dados: aparecem como "aguardando 1a leitura"
 CADASTRADOS.forEach(id=>{if(porEq[id]||IGNORADOS.includes(id))return;
  let area=areas.find(a=>a.manual&&a.nome==VINCULOS[id]);if(!area){area=semLocal;if(!areas.includes(semLocal))areas.push(semLocal)}
  eqs.push({id,area,loc:area.nome+(area.det&&!['—','-'].includes(area.det)?' – '+area.det:''),hum:[],inc:[],tmp:[],bat:null,solar:'—',on:false,last:null,h:null,i:null,t:null,x:null,y:null,sats:0,gps:false,ia:'-',iaResumo:'',s:'off',cadastrado:true})});
 AREAS.splice(0,AREAS.length,...areas);DEV.splice(0,DEV.length,...eqs);ALERTS.splice(0,ALERTS.length,...alertas);
}

// ---------- carga dos dados ----------
const SEM_RERENDER=['mapa','config']; // páginas com formulário: não redesenhar sozinhas
// Bolinha de conexao (verde = API respondendo, vermelha = sem conexao). Se o index.html/css nao tiverem a bolinha, ela e criada aqui.
function garantirBolinha(){
 if(!document.querySelector('#dot-api-css')){const st=document.createElement('style');st.id='dot-api-css';
  st.textContent='.dot-api{display:inline-block;flex:none;width:12px;height:12px;border-radius:50%;margin-right:10px;vertical-align:middle;background:var(--crit,#dc2626);box-shadow:0 0 8px var(--crit,#dc2626)}.dot-api.ok{background:var(--ok,#22c55e);box-shadow:0 0 8px var(--ok,#22c55e)}.relogio-api{display:inline-flex;align-items:center;white-space:nowrap}';
  document.head.appendChild(st)}
 const clk=document.querySelector('#clk');
 let c=document.querySelector('#conn');
 if(!c){c=document.createElement('span');c.id='conn'}
 if(clk&&clk.parentNode){
  // a bolinha fica sempre colada ao relogio, no canto superior direito
  if(c.nextSibling!==clk){
   let w=clk.parentNode;
   if(w.className!=='relogio-api'){const wr=document.createElement('span');wr.className='relogio-api';w.insertBefore(wr,clk);wr.appendChild(clk);w=wr}
   w.insertBefore(c,clk)}
 }else if(!c.parentNode){c.style.cssText='position:fixed;top:14px;right:14px;z-index:20';(document.body||document.documentElement).appendChild(c)}
 return c}
function conn(ok){const c=garantirBolinha();c.textContent='';c.className='dot-api'+(ok?' ok':'');c.setAttribute('role','status');c.setAttribute('aria-label',ok?'API conectada':'API desconectada')}
document.addEventListener('DOMContentLoaded',()=>conn(false));   // comeca vermelha ate a API responder
let CONECTADO=null,ULT_STATUS=0;
const iaTexto=()=>IA_MODELO==null?'IA: estado desconhecido':IA_MODELO?'IA: modelo treinado carregado':'IA: análise local inicial (regras), sem modelo .pkl';

async function atualizar(primeira){
 if(document.hidden&&!primeira)return;                       // aba em segundo plano: não consulta a API
 try{
  const precisaStatus=Date.now()-ULT_STATUS>60000;           // /status só a cada 60 s
  const [st,h]=await Promise.all([precisaStatus?api(CONFIG.rotas.status).catch(()=>null):null,api(CONFIG.rotas.historico)]);
  if(precisaStatus){IA_MODELO=st?st.modelo_local_carregado:null;ULT_STATUS=Date.now()}
  REG=(h.registros||[]).map(r=>({t:tempoDe(r.recebido_em),dados:r.dados,ia:r.ia||{}})).filter(r=>r.dados&&!isNaN(r.t));
  montar();conn(true);
  const mudou=CONECTADO!==true;CONECTADO=true;
  const editando=document.activeElement&&/^(SELECT|INPUT|TEXTAREA)$/.test(document.activeElement.tagName); // nao redesenha enquanto voce mexe num campo
  if(primeira||mudou||(!SEM_RERENDER.includes(page)&&!editando))go();
 }catch(err){
  console.warn('[AURORA] API indisponível ('+CONFIG.apiUrl+'): '+err.message);
  conn(false);
  const mudou=CONECTADO!==false;CONECTADO=false;
  if(mudou){REG=[];IA_MODELO=null;ULT_STATUS=0;montar();go()}   // API caiu: limpa os dados da tela
 }
}
