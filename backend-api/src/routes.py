from collections import deque
from datetime import datetime

# from src import telemetria_bp
# from src import aurora_bp
# from src import sensores_bp
# from src import leituras_bp
# from src import monitoramento_bp

from flask import jsonify, request, Flask
from pydantic import BaseModel, ValidationError

app = Flask(__name__)

# Armazenamento em memoria (ajuste o maxlen como preferir)
historico_envios = deque(maxlen=100)
ultimo_payload = None

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
  
@app.route("/", methods = ["GET"])
def home():
    return jsonify(
        {
            "status": "online",
            "projeto": "AURORA",
            "total_recebidos_sessao": len(historico_envios),
            "rotas_uteis": ["/api/v1/ultimo", "/api/v1/historico"],
        }
    )
  
@app.route("/api/v1/ultimo", methods = ["GET"])
def ver_ultimo_dado():
    if ultimo_payload is None:
        return jsonify({"mensagem": "Nenhum dado recebido do ESP32 ainda"})
    return jsonify(ultimo_payload)
 
 
@app.route("/api/v1/historico", methods = ["GET"])
def ver_historico():
    return jsonify(
        {
            "quantidade": len(historico_envios),
            "registros": list(historico_envios),
        }
    )
  
@app.route("/api/v1/dados", methods = ["POST"])
def receber_dados_aurora():
    global ultimo_payload
 
    # Validacao do corpo da requisicao (o que o FastAPI fazia automaticamente)
    corpo = request.get_json(silent=True)
    if corpo is None:
        return jsonify({"erro": "Corpo da requisicao deve ser um JSON valido"}), 400
    try:
        payload = PayloadAurora.model_validate(corpo)
    except ValidationError as e:
        return jsonify({"erro": "Dados invalidos", "detalhes": e.errors(include_url=False, include_context=False)}), 422
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
 
        return (
            jsonify(
                {
                    "status": "sucesso",
                    "equipamento": payload.equipamento,
                    "recebido_em": agora,
                    "predicao": "aguardando_modelo_real",
                }
            ),
            201,
        )
    except Exception as e:
        return jsonify({"erro": f"Erro ao processar dados: {str(e)}"}), 500
 
if __name__ == "__main__":
    # host 0.0.0.0 para o ESP32 conseguir acessar pela rede local
    app.run(host="0.0.0.0", port=8000, debug=True)