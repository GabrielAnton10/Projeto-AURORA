# Integração do site com a API AURORA

O site lê a API FastAPI do projeto (`main.py`). Tudo que é ligado à API fica em **`js/dados.js`**.

## Como rodar
1. Rode a API: `uvicorn main:app --host 0.0.0.0 --port 8000` (na pasta do `main.py`).
2. Confira em `http://localhost:8000/api/v1/historico` se já há registros.
3. Abra a pasta `aurora` no VS Code e use o Live Server no `index.html`.
4. A faixa no topo do site fica verde ("Conectado à API") e mostra se a IA é o modelo treinado ou a análise inicial.

O endereço da API está em `CONFIG.apiUrl` (`js/dados.js`). Se a API rodar em outro computador, troque `localhost` pelo IP dele.

## O que o site usa da API
| Rota | Uso |
|---|---|
| `GET /api/v1/historico` | Últimos 20 envios: equipamentos, gráficos, alertas, mapa |
| `GET /api/v1/status` | Mostra se o modelo `.pkl` foi carregado |
| `POST /api/v1/dados` | Chamada feita pelo ESP32 (não pelo site) |

## Campos da API -> site
| API | Site |
|---|---|
| `dados.equipamento` | ID do equipamento (cada nome vira um equipamento) |
| `recebido_em` | Data/hora do envio, "última comunicação" |
| `solo_tensao` (V) | Sensor de solo (mostrado em volts, sem conversão para %) |
| `inclinacao_x`, `inclinacao_y` | Inclinação = maior valor absoluto entre X e Y |
| `temperatura` | Temperatura (só quando `temperatura_ok`) |
| `latitude`, `longitude`, `gps_valido`, `satelites` | Posição no mapa e satélites |
| `ia.status_risco` | Cor/status do equipamento |
| `ia.resumo` | Texto no cartão e no alerta |

`status_risco` -> cor: `normal` = verde, `atencao` = amarelo, `alerta` = vermelho, `sensor_incompleto` = amarelo. Para outros nomes (modelo treinado), edite `CONFIG.mapaRisco`. Nome desconhecido vira amarelo.

Sem envio há mais de 5 minutos (`CONFIG.limites.semContatoMin`), o equipamento fica cinza (sem comunicação).

## Limitações da API atual (como o site contorna)
- Não há bateria nem energia solar: o site não mostra esses campos.
- Não há rota de alertas: o site cria os alertas a partir de `ia.status_risco` e da perda de comunicação.
- Não há rota de locais: o site usa o GPS do equipamento, ou locais cadastrados no próprio site (salvos no navegador).
- O histórico guarda só 20 envios e some quando a API reinicia.

## Administradores (login do painel)
Ficam em `api/routes.py` (Flask + SQLite). Todo usuário cadastrado é administrador do painel.
1. Instale: `pip install flask flask-cors`
2. Crie o primeiro administrador (só na primeira vez), dentro da pasta `api`: `python routes.py criar-admin`
3. Rode a API: `python routes.py` (porta 8001) e deixe o terminal aberto.
4. Abra o site, entre com o **e-mail** e a senha. Novos administradores são cadastrados em *Configurações > Administradores* (nome, e-mail, senha e permissão).

O endereço fica em `CONFIG.adminUrl` (`js/dados.js`). Se registrar o blueprint na API principal (`app.register_blueprint(admin_bp)`), deixe `adminUrl: ''` para usar o mesmo endereço de `apiUrl`.

| Rota | Uso |
|---|---|
| `POST /api/v1/admin/login` | Login (`email`, `senha`), devolve o token |
| `POST /api/v1/admin/cadastro` | Cadastra administrador (`nome`, `email`, `senha`, `permissao`) |
| `GET /api/v1/admin/me` | Administrador logado |
| `GET /api/v1/admin/usuarios` | Lista de administradores |
| `DELETE /api/v1/admin/usuarios/<id>` | Remove um administrador (sem botão no site) |
| `GET /api/v1/admin/acessos` | Últimos 50 logins (aceitos e recusados) |

Permissões aceitas: `Total`, `Leitura + alertas`, `Somente leitura` (por enquanto só ficam registradas, não limitam o acesso).
As rotas, exceto o login, exigem `Authorization: Bearer <token>` (válido por 8 h). O banco fica em `api/aurora_admin.db` e a chave dos tokens em `api/.aurora_secret`; nenhum dos dois deve ir para o Git.
