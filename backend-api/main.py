from collections import deque
from datetime import datetime
from pathlib import Path
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = FastAPI(title="AURORA - API de Ingestao, IA e Painel Web", version="1.1")

# Permite que uma pagina web em outro dominio/porta consuma a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Armazena o ultimo registro e um historico curto dos ultimos 20 envios
ultimo_payload: dict | None = None
historico_envios: deque[dict] = deque(maxlen=20)

# Caminho opcional para o modelo exportado do Colab (.pkl ou .joblib)
CAMINHO_MODELO = Path("modelo_aurora.pkl")
modelo_ia = None

if CAMINHO_MODELO.exists():
    try:
        modelo_ia = joblib.load(CAMINHO_MODELO)
        print(f"[IA] Modelo carregado com sucesso de: {CAMINHO_MODELO}")
    except Exception as erro:
        print(f"[IA] Falha ao carregar {CAMINHO_MODELO}: {erro}")


class PayloadAurora(BaseModel):
    equipamento: str
    data: str | None = None
    hora: str | None = None
    data_hora_ok: bool
    inclinacao_x: float | None = None
    inclinacao_y: float | None = None
    mpu_ok: bool
    temperatura: float | None = None
    temperatura_ok: bool
    solo_adc: int
    solo_tensao: float
    gps_valido: bool
    latitude: float | None = None
    longitude: float | None = None
    satelites: int


def analisar_com_ia(payload: PayloadAurora) -> dict:
    """
    Roda o modelo treinado se existir na pasta; caso contrario, faz uma
    avaliacao local inicial com base nos sensores do AURORA.
    """
    if not payload.mpu_ok or not payload.temperatura_ok:
        return {
            "modo": "validacao_sensores",
            "status_risco": "sensor_incompleto",
            "resumo": "Aguardando leitura valida de MPU6050 e DS18B20",
        }

    # 1. Se o modelo exportado do Colab estiver na pasta da API, usa ele
    if modelo_ia is not None:
        features = np.array([[
            payload.inclinacao_x or 0.0,
            payload.inclinacao_y or 0.0,
            payload.temperatura or 0.0,
            payload.solo_tensao,
        ]])
        pred = modelo_ia.predict(features)[0]
        return {
            "modo": "modelo_treinado_local",
            "status_risco": str(pred),
            "resumo": f"Predicao do modelo: {pred}",
        }

    # 2. Fallback local enquanto o arquivo do modelo nao e colocado na pasta
    inc_x = abs(payload.inclinacao_x or 0.0)
    inc_y = abs(payload.inclinacao_y or 0.0)
    maior_inclinacao = max(inc_x, inc_y)

    if maior_inclinacao >= 15.0 or payload.solo_tensao >= 2.5:
        nivel = "alerta"
        resumo = "Inclinacao elevada ou umidade alta detectada"
    elif maior_inclinacao >= 7.0 or payload.solo_tensao >= 1.8:
        nivel = "atencao"
        resumo = "Parametros em faixa de observacao"
    else:
        nivel = "normal"
        resumo = "Parametros estaveis"

    return {
        "modo": "analise_local_inicial",
        "status_risco": nivel,
        "resumo": resumo,
    }


@app.get("/api/v1/status")
def status_api():
    return {
        "status": "online",
        "projeto": "AURORA",
        "modelo_local_carregado": modelo_ia is not None,
        "total_recebidos_sessao": len(historico_envios),
        "rotas_uteis": ["/", "/docs", "/api/v1/ultimo", "/api/v1/historico"],
    }


@app.get("/api/v1/ultimo")
def ver_ultimo_dado():
    if ultimo_payload is None:
        return {"mensagem": "Nenhum dado recebido do ESP32 ainda"}
    return ultimo_payload


@app.get("/api/v1/historico")
def ver_historico():
    return {
        "quantidade": len(historico_envios),
        "registros": list(historico_envios),
    }


@app.post("/api/v1/dados")
def receber_dados_aurora(payload: PayloadAurora):
    global ultimo_payload
    try:
        agora = str(datetime.now())
        dados_dict = payload.model_dump()
        resultado_ia = analisar_com_ia(payload)

        registro = {
            "recebido_em": agora,
            "dados": dados_dict,
            "ia": resultado_ia,
        }

        ultimo_payload = registro
        historico_envios.append(registro)

        print(
            f"[{agora}] {payload.equipamento} | "
            f"X={payload.inclinacao_x} Y={payload.inclinacao_y} | "
            f"Temp={payload.temperatura}C | Solo={payload.solo_tensao}V | "
            f"IA={resultado_ia['status_risco']}"
        )

        return {
            "status": "sucesso",
            "equipamento": payload.equipamento,
            "recebido_em": agora,
            "ia": resultado_ia,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar dados: {str(e)}")


@app.get("/", response_class=HTMLResponse)
def painel_web():
    """Pagina web simples servida pela propria API para visualizar os dados e a IA."""
    return """
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>AURORA - Monitoramento Web</title>
      <style>
        body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px; }
        .card { max-width: 780px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        h1 { margin-top: 0; color: #38bdf8; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 16px; }
        .box { background: #0f172a; padding: 12px; border-radius: 8px; }
        .label { font-size: 12px; color: #94a3b8; }
        .valor { font-size: 18px; font-weight: bold; margin-top: 4px; }
        .ia { margin-top: 16px; padding: 14px; border-radius: 8px; background: #064e3b; }
        pre { background: #0f172a; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Projeto AURORA — Painel Web</h1>
        <p id="meta">Aguardando dados do ESP32...</p>
        <div class="grid">
          <div class="box"><div class="label">Equipamento</div><div class="valor" id="eq">-</div></div>
          <div class="box"><div class="label">Inclinação X / Y</div><div class="valor" id="inc">-</div></div>
          <div class="box"><div class="label">Temperatura</div><div class="valor" id="temp">-</div></div>
          <div class="box"><div class="label">Solo (ADC / V)</div><div class="valor" id="solo">-</div></div>
          <div class="box"><div class="label">GPS</div><div class="valor" id="gps">-</div></div>
          <div class="box"><div class="label">Data / Hora</div><div class="valor" id="dh">-</div></div>
        </div>
        <div class="ia" id="iaBox">
          <div class="label">Análise da IA</div>
          <div class="valor" id="iaStatus">-</div>
          <div id="iaResumo" style="margin-top:4px;">-</div>
        </div>
        <h3>Último JSON recebido</h3>
        <pre id="raw">Nenhum dado ainda</pre>
      </div>
      <script>
        async function atualizar() {
          try {
            const resp = await fetch('/api/v1/ultimo');
            const data = await resp.json();
            if (!data.dados) return;
            const d = data.dados;
            const ia = data.ia || {};
            document.getElementById('meta').textContent = 'Recebido em: ' + data.recebido_em;
            document.getElementById('eq').textContent = d.equipamento;
            document.getElementById('inc').textContent = `${d.inclinacao_x ?? '-'}° / ${d.inclinacao_y ?? '-'}°`;
            document.getElementById('temp').textContent = `${d.temperatura ?? '-'} °C`;
            document.getElementById('solo').textContent = `${d.solo_adc} (${d.solo_tensao} V)`;
            document.getElementById('gps').textContent = d.gps_valido ? `${d.latitude}, ${d.longitude}` : 'Aguardando sinal';
            document.getElementById('dh').textContent = d.data_hora_ok ? `${d.data} ${d.hora}` : 'Aguardando GPS';
            document.getElementById('iaStatus').textContent = (ia.status_risco || '-').toUpperCase();
            document.getElementById('iaResumo').textContent = ia.resumo || '';
            document.getElementById('raw').textContent = JSON.stringify(data, null, 2);
          } catch (e) {
            console.error(e);
          }
        }
        atualizar();
        setInterval(atualizar, 3000);
      </script>
    </body>
    </html>
    """