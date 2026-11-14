from collections import deque
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="AURORA - API de Ingestao e ML", version="1.0")

# Armazena o ultimo payload recebido e um historico curto dos ultimos 20 envios
ultimo_payload: dict | None = None
historico_envios: deque[dict] = deque(maxlen=20)


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


@app.get("/")
def home():
    return {
        "status": "online",
        "projeto": "AURORA",
        "total_recebidos_sessao": len(historico_envios),
        "rotas_uteis": ["/docs", "/api/v1/ultimo", "/api/v1/historico"],
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

        # Monta o registro completo que fica visivel nas rotas GET
        registro = {
            "recebido_em": agora,
            "dados": payload.model_dump(),
            "predicao": "aguardando_modelo_real",
        }

        ultimo_payload = registro
        historico_envios.append(registro)

        print(
            f"[{agora}] {payload.equipamento} | "
            f"MPU={payload.mpu_ok} X={payload.inclinacao_x} Y={payload.inclinacao_y} | "
            f"Temp={payload.temperatura}C ({payload.temperatura_ok}) | "
            f"Solo={payload.solo_adc} ({payload.solo_tensao}V) | "
            f"GPS={payload.gps_valido} ({payload.latitude}, {payload.longitude})"
        )

        # Aqui entra o modelo de ML ja treinado quando voce quiser plugar:
        # predicao = modelo.predict([[payload.inclinacao_x, payload.inclinacao_y, payload.temperatura, payload.solo_tensao]])[0]

        return {
            "status": "sucesso",
            "equipamento": payload.equipamento,
            "recebido_em": agora,
            "predicao": "aguardando_modelo_real",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar dados: {str(e)}")