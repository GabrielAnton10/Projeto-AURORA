// ============================================================
// AURORA – dados.js
// Camada de dados. Hoje: dados FICTÍCIOS (CONFIG.source = "demo").
// Futuramente: trocar por chamadas ao backend (fetch em CONFIG.apiBase).
// Contrato previsto:
//   GET  /api/devices
//   GET  /api/readings?deviceId&from&to
//   GET  /api/alerts
//   POST /api/readings   (ESP32 -> backend)
// ============================================================
const CONFIG={source:'demo',apiBase:'/api'};
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=rng(42),N=48,now=Date.now();
// Áreas reais de risco do Recife (citadas pela Defesa Civil do Recife). Posições APROXIMADAS (centro do bairro).
// Os equipamentos instalados nelas são FICTÍCIOS.
const AREAS=[
 {nome:'Nova Descoberta',det:'Córrego do Beijú / Alto do Cruzeiro',lat:-8.0005,lng:-34.9210},
 {nome:'Alto José Bonifácio',det:'Alto do Brasil',lat:-8.0050,lng:-34.9330},
 {nome:'Ibura',det:'Vila do Sesi / Alto da Bela Vista',lat:-8.1180,lng:-34.9420},
 {nome:'Jordão',det:'Alto da Jaqueira',lat:-8.1350,lng:-34.9500}];
const AREA_DE=[0,0,1,1,2,2,3,3];
// SPEC: [umidade base %, inclinação base °, variação °, bateria %, online]
const SPEC=[[45,3,.6,78,1],[58,4,.8,62,1],[88,9,1,40,1],[74,6,.8,22,1],[40,2.5,.5,90,1],[0,0,0,0,0],[66,5,.8,55,1],[52,3,.6,18,1]];
const DEV=SPEC.map(([b,m,v,bat,on],i)=>{const area=AREAS[AREA_DE[i]];
 const hum=[...Array(N)].map((_,k)=>Math.max(5,Math.min(99,b+(i==2?k*.5:i==3?k*.1:0)-(i==2?10:0)+Math.sin(k/5+i)*6+(R()-.5)*5)));
 const inc=[...Array(N)].map((_,k)=>Math.max(0,m+(i==2&&k>38?4:0)+R()*v*2));
 const tmp=[...Array(N)].map((_,k)=>27+Math.sin((k-8)/7.5)*4+(R()-.5)*1.5);
 const d={id:'EQ-'+String(i+1).padStart(3,'0'),area,loc:area.nome+' – '+area.det,hum,inc,tmp,bat,on,solar:on?(bat>30?'Carregando':'Baixa geração'):'—',last:now-(on?(i*37%9+1)*60000:5*3600000)};
 d.h=on?hum[N-1]:null;d.i=on?inc[N-1]:null;d.t=on?tmp[N-1]:null;
 d.s=on?(d.h>85||d.i>12?'crit':d.h>70||d.i>8||bat<25?'warn':'ok'):'off';return d});
const ALERTS=[
 [2,'Estado crítico','Inclinação elevada','Inclinação de 14,2° com solo saturado.',3,1],
 [2,'Risco moderado','Umidade elevada','Umidade acima de 85% por mais de 4 h.',8,1],
 [3,'Atenção','Umidade em alta','Tendência de crescimento de umidade nas últimas 12 h.',5,1],
 [3,'Atenção','Bateria baixa','Bateria abaixo de 25% com geração solar reduzida.',9,1],
 [7,'Atenção','Bateria baixa','Bateria em 18%.',20,1],
 [5,'Risco moderado','Sem comunicação','Equipamento sem enviar dados há mais de 5 h.',5,1],
 [1,'Normal','Retomada de comunicação','Equipamento voltou a comunicar após queda de sinal.',70,0],
 [6,'Atenção','Variação de umidade','Variação de 18% em 2 h.',96,0],
 [0,'Risco moderado','Variação de inclinação','Variação de 2,6° registrada.',150,0],
 [2,'Estado crítico','Inclinação elevada','Pico de inclinação (13,1°).',220,0]
].map((a,i)=>({n:i+1,dev:DEV[a[0]],sev:a[1],tipo:a[2],desc:a[3],ts:now-a[4]*3600000,ativo:a[5]}));
const SC={'Normal':'ok','Atenção':'warn','Risco moderado':'mod','Estado crítico':'crit'};
const SL={ok:'Normal',warn:'Atenção',crit:'Crítico',off:'Sem comunicação'};
const USERS=[['Administrador Geral','admin@exemplo.com','Total','hoje 08:12'],['Coordenação Técnica','tecnico@exemplo.com','Leitura + alertas','ontem 17:40']];
const LOGS=['hoje 08:12 · admin@exemplo.com · login','ontem 17:40 · tecnico@exemplo.com · login','ontem 17:52 · tecnico@exemplo.com · consulta de relatório'];

// ===== Cadastros feitos pelo administrador (locais e equipamentos novos) =====
// Ficam salvos no navegador (localStorage) enquanto não existe backend. Com o backend, isto vira POST /api/locations e POST /api/devices.
const STORE='aurora_cadastros';
function novoEquip(id,area){DEV.push({id,area,loc:area.nome+' – '+area.det,hum:Array(N).fill(0),inc:Array(N).fill(0),tmp:Array(N).fill(0),bat:0,on:0,solar:'—',last:null,h:null,i:null,t:null,s:'off',novo:true})}
function salvar(){try{localStorage.setItem(STORE,JSON.stringify({areas:AREAS.filter(a=>a.novo),devs:DEV.filter(d=>d.novo).map(d=>({id:d.id,area:d.area.nome}))}))}catch(e){}}
function carregar(){try{const c=JSON.parse(localStorage.getItem(STORE)||'null');if(!c)return;c.areas.forEach(a=>AREAS.push(a));c.devs.forEach(x=>{const a=AREAS.find(y=>y.nome==x.area);if(a)novoEquip(x.id,a)})}catch(e){}}
carregar();
