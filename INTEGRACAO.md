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
- Não há login nem administradores.
- O histórico guarda só 20 envios e some quando a API reinicia.

---

# Endereço estável da API (sem trocar a URL a cada reinicialização)

## Por que o endereço muda
O site não gera o endereço: ele vem do que expõe a API para a internet. Olhe a URL que você copia a cada reinicialização:

| A URL parece com... | Causa |
|---|---|
| `https://algo-aleatorio.trycloudflare.com` | Túnel rápido do Cloudflare (`cloudflared tunnel --url ...`): gera um endereço novo a cada execução, por projeto |
| `https://algo.loca.lt`, `*.serveo.net`, `*.lhr.life` | Túnel gratuito sem endereço fixo |
| `https://algo.ngrok-free.app` mudando | ngrok iniciado sem o domínio fixo da conta (`ngrok http 8000` sem `--url`) ou conta antiga |
| `http://192.168.x.x:8000` | IP da rede local (DHCP): o roteador entrega outro IP ao religar |

Isso não é um defeito do site nem da API.

## Soluções gratuitas
**1. ngrok com o domínio fixo da conta gratuita.** Segundo a documentação do ngrok, cada conta gratuita recebe um domínio fixo ("dev domain", do tipo `nome.ngrok-free.app`); você não escolhe o nome. Passos: ngrok.com > Domains, copie o domínio e rode `ngrok http --url=https://SEU-DOMINIO.ngrok-free.app 8000` (se o comando diferir, use o que a própria página Domains mostra). Cole esse endereço **uma única vez** em `CONFIG.apiUrl` (`js/dados.js`). Limites da conta gratuita citados em fontes consultadas: cerca de 1 GB de tráfego e 20 mil requisições por mês. **Atenção:** com consulta a cada 5 s o site sozinho gasta isso em poucas horas. Aumente `atualizarACadaMs` em `js/dados.js` (por exemplo 30000) ou use a opção 2.

**2. Tailscale Funnel.** Gratuito no plano Personal, endereço fixo `https://NOME-DA-MAQUINA.SUA-REDE.ts.net`, HTTPS automático. Instale o Tailscale no computador da API, ative HTTPS e Funnel no painel de administração e rode `tailscale funnel --bg 8000`. Com `--bg` o compartilhamento continua depois de reiniciar. Portas permitidas: 443, 8443 e 10000.

Para qualquer opção: se o site estiver no GitHub Pages (https), a API também precisa ser https (as duas opções acima são).

## O que mudou no site para ajudar
- **Descoberta automática (opcional):** se preencher `CONFIG.urlFonte` com o endereço de um JSON como `{"url":"https://..."}`, o site, ao perder a API, consulta esse JSON, troca para o endereço novo e tenta de novo. Quem publica o JSON é o computador da API, ao subir o túnel. Fica desligado por padrão.
- **ngrok:** o site envia o cabeçalho `ngrok-skip-browser-warning` quando a URL contém "ngrok", para evitar a página de aviso do plano gratuito.
- **Menos consultas:** o site para de consultar com a aba em segundo plano e pede `/status` só a cada 60 s.

## Indicador de conexão
O aviso escrito foi substituído por uma bolinha no topo da página, ao lado do relógio: verde = API respondendo; vermelha = sem conexão ou sem resposta em 8 s (`timeoutMs`). Ao desconectar, os dados do equipamento somem da tela; ao reconectar, voltam sozinhos.

## Desconectar equipamento
Na página Equipamentos, escolha o equipamento na lista: as informações dele aparecem na hora, sem apertar nada. O botão **Desconectar** (no cartão e em cada linha da tabela) tira o equipamento do site (tela, gráficos e alertas) e pede à API que pare de aceitar os envios dele. Para trazê-lo de volta, use **Reconectar** no quadro "Equipamentos desconectados".

**Importante:** o site sozinho não consegue desligar o ESP32. Para a comunicação ser cortada de verdade, a API precisa ter as rotas abaixo. Sem elas, o site avisa e o ESP32 continua enviando (o site apenas ignora os dados dele).

Acrescente no `main.py` da API:

```python
bloqueados: set[str] = set()

@app.post("/api/v1/equipamentos/{equipamento}/desconectar")
def desconectar_equipamento(equipamento: str):
    bloqueados.add(equipamento)
    return {"equipamento": equipamento, "conectado": False}

@app.post("/api/v1/equipamentos/{equipamento}/reconectar")
def reconectar_equipamento(equipamento: str):
    bloqueados.discard(equipamento)
    return {"equipamento": equipamento, "conectado": True}
```

E no início de `receber_dados_aurora`, **antes** do `try:` (dentro do `try` o erro viraria 500):

```python
    if payload.equipamento in bloqueados:
        raise HTTPException(status_code=403, detail="Equipamento desconectado")
```

A lista `bloqueados` fica na memória: some quando a API reinicia. Os caminhos das rotas podem ser mudados em `CONFIG.rotasEquip` (`js/dados.js`).

---

# Usuários com acesso ao painel
Em **Configurações > Usuários com acesso** é possível cadastrar usuários só com e-mail e senha. A senha não é guardada: só o hash SHA-256. Os cadastros ficam salvos **só no navegador** onde foram feitos, e quem abrir o site em outro computador não os vê.

Por padrão o login continua aberto (`CONFIG.exigirLogin:false` em `js/dados.js`). Com `true` e pelo menos um usuário cadastrado, a tela de login passa a exigir e-mail e senha. **Isso não é segurança de verdade:** o código roda no navegador e pode ser contornado. Segurança real exige login no back-end (rota de login e token), que a API ainda não tem.
