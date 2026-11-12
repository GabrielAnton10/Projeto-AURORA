from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(title="API de Coleta e ML - Equipamento", version="1.0")

# Definimos o formato (schema) exato do JSON que o equipamento vai mandar.
# Ajuste os campos (temperatura, vibracao, etc.) conforme os sensores do seu hardware.
class LeituraSensores(BaseModel):
    equipamento_id: str
    temperatura: float
    vibracao: float
    timestamp: str | None = None

@app.get("/")
def home():
    return {"status": "online", "mensagem": "API rodando com sucesso!"}

# Rota POST para receber os dados do equipamento
@app.post("/api/v1/dados")
def receber_dados(leitura: LeituraSensores):
    try:
        # Aqui é onde os dados entram. Por enquanto, vamos apenas imprimí-los 
        # no terminal e retornar uma confirmação de sucesso.
        print(f"[{datetime.now()}] Dado recebido do equipamento {leitura.equipamento_id}:")
        print(f" - Temperatura: {leitura.temperatura}°C")
        print(f" - Vibração: {leitura.vibracao}")

        # Amanhã (Dia 2), encaixaremos o modelo de Machine Learning aqui!
        
        return {
            "status": "sucesso",
            "mensagem": "Dados recebidos e processados com sucesso",
            "dados_recebidos": leitura
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")