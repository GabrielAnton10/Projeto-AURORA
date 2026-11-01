# Projeto Aurora — Contrato de dados v0.1 (rascunho para aprovação)

Versão do contrato: 0.1.0 · 31/10/2026 · código equivalente: `src/aurora_ml/schema.py`.

**Status:** proposta. Nada aqui afirma que o hardware já envia estes campos. A coluna "Disponibilidade" diz o que ainda precisa ser confirmado pela equipe de hardware (pendências P01 a P06 em `pendencias_e_decisoes.md`).

## 1. Convenções

- **Nomes de campo em inglês**, `snake_case`, com a unidade no sufixo (`_g`, `_dps`, `_c`, `_deg`).
- **Tempo:** UTC, ISO 8601, no relógio do dispositivo. O Grafana pode exibir em America/Recife.
- **Ausente = NULL** (NaN em Python). Nunca substituir por zero.
- **Origem do dado** (`data_source`): `campo` (equipamento no ambiente real), `bancada` (ensaio controlado com dado real) ou `sintetico` (produzido por código). Nunca misturar sem identificar. Dados sintéticos usam `device_id` com prefixo `SIM-`.
- **Dado bruto é preservado.** Variáveis derivadas são calculadas no pipeline, com fórmula, unidade e versão documentadas.
- **Chuva não faz parte do contrato.** Os sensores informados não incluem pluviômetro. Chuva será tratada como contexto externo (com a fonte indicada) se for usada.
- **Sem dado pessoal** em nenhuma tabela.

## 2. Registro de medição (camada bruta)

| Campo | Tipo | Unidade | Nulo? | Disponibilidade | Descrição |
|---|---|---|---|---|---|
| `timestamp` | datetime (UTC) | UTC | não | a confirmar (P03) | Instante da leitura segundo o relógio do dispositivo |
| `device_id` | texto | — | não | a definir (P16) | Identificador estável do dispositivo |
| `accel_x_g`, `accel_y_g`, `accel_z_g` | decimal | g | sim | a confirmar (P03, P05) | Aceleração nos três eixos do sensor |
| `gyro_x_dps`, `gyro_y_dps`, `gyro_z_dps` | decimal | °/s | sim | a confirmar (P03, P05) | Velocidade angular nos três eixos |
| `temperature_c` | decimal | °C | sim | a confirmar (P03) | Temperatura reportada pelo MPU-6050 (leitura interna do módulo; não é temperatura do ar nem do solo) |
| `soil_raw` | inteiro | contagens do conversor (escala pendente) | sim | a confirmar (P01, P06) | Leitura analógica (AO) da HD-38. Só variação relativa; sem calibração não é % de umidade |
| `soil_digital` | inteiro (0 ou 1) | — | sim | a confirmar (P06) | Saída digital (DO) da HD-38. Depende do ajuste do módulo; não é medida contínua; não entra no modelo na v0 |
| `data_source` | texto | `campo`, `bancada`, `sintetico` | não | definido | Origem do dado |
| `quality_flags` | inteiro | máscara de bits | não | definido | 0 = nenhum problema conhecido (ver seção 4) |

## 3. Variáveis derivadas (calculadas no passo 4; ainda não implementadas)

| Campo | Fórmula (versão) | Unidade | Observações |
|---|---|---|---|
| `tilt_x_deg` | `degrees(atan2(accel_y_g, accel_z_g))` (tilt_v1) | ° | Rotação em torno de X (roll). Só vale com o sensor parado: movimento contamina |
| `tilt_y_deg` | `degrees(atan2(-accel_x_g, sqrt(accel_y_g² + accel_z_g²)))` (tilt_v1) | ° | Rotação em torno de Y (pitch) |
| `tilt_delta_deg` | `u = a/‖a‖`; `degrees(atan2(‖u × u_ref‖, u · u_ref))` (tilt_v1) | ° | Ângulo entre a gravidade atual e a de referência; sem sinal. `u_ref` = mediana das acelerações válidas da janela de referência (definição pendente) |
| `soil_delta` | `soil_raw − mediana(soil_raw na janela de referência)` (soil_v1) | contagens | Mesma escala pendente de `soil_raw` |
| `quality_ok` | `quality_flags == 0` | — | Derivado; nunca é fonte de verdade |

Limites que valem para qualquer inclinação calculada: depende da convenção de eixos e da orientação do sensor na instalação (P18); rotação em torno da vertical é invisível ao acelerômetro; deriva térmica, ruído e montagem do suporte não são, por si sós, movimento da encosta; o MPU-6050 não mede deslocamento em profundidade.

## 4. Bits de `quality_flags`

| Valor | Nome | Quem preenche | Significado |
|---|---|---|---|
| 1 | `MISSING_VALUE` | firmware ou validação | Alguma medição ausente |
| 2 | `OUT_OF_RANGE` | validação (passo 3) | Fora da faixa válida configurada (faixa pendente: P01, P05) |
| 4 | `FROZEN_VALUE` | validação (passo 3) | Valores idênticos repetidos; limite de repetições a definir |
| 8 | `DUPLICATE_TIMESTAMP` | validação (passo 3) | Repetição de `device_id` + `timestamp` |
| 16 | `INVALID_TIMESTAMP` | validação (passo 3) | Fora da janela de plausibilidade configurada |
| 32 | `MAINTENANCE_WINDOW` | validação (passo 3) | Dentro de janela do registro de manutenção |
| 64 | `DEVICE_MOVING` | validação (passo 3) | Movimento dinâmico; limites pendentes de ensaio de bancada |

Na versão atual só o bit 1 é preenchido (pelo gerador sintético, imitando o dispositivo). Os demais bits existem no contrato, mas o módulo que os calcula é o passo 3 e ainda não foi escrito. Chegada fora de ordem (entrega atrasada) não está no contrato: depende de P03.

## 5. Registro de manutenção

| Campo | Tipo | Descrição |
|---|---|---|
| `event_id` | texto | Identificador do evento |
| `device_id` | texto | Dispositivo afetado |
| `start_ts`, `end_ts` | datetime (UTC) | Início e fim da intervenção |
| `event_type` | texto | Ex.: `releveling`, `battery_swap`, `cleaning` |
| `resets_reference` | booleano | Verdadeiro se a orientação de referência mudou |
| `notes` | texto | Observações sem dado pessoal |
| `data_source` | texto | `campo`, `bancada` ou `sintetico` |

## 6. Regras de validação (provisórias; serão implementadas no passo 3)

1. `timestamp` em UTC e dentro de uma janela de plausibilidade **configurável** (não fixa no código).
2. Pares `device_id` + `timestamp` repetidos são marcados (`DUPLICATE_TIMESTAMP`), sem apagar o dado bruto. Duplicata com valores diferentes exige decisão da equipe.
3. Valores não finitos viram NULL e `MISSING_VALUE`; nunca zero.
4. Faixas válidas dependem da configuração do MPU-6050 (P05) e do conversor (P01).
5. `soil_digital` só aceita 0 ou 1; `data_source` só aceita os três valores.
6. Falta de leituras ou silêncio do dispositivo gera **evento de telemetria/qualidade**, nunca anomalia física.

## 7. Saída do detector (a definir no passo 5, sem probabilidades de risco)

A saída terá: score do detector (escala documentada), estado do detector, indicadores de qualidade, versão do modelo e momento da análise. Estados propostos para o front-end: "Sem anomalia detectada", "Anomalia a verificar" e "Sem comunicação". O nível "Crítico" **nunca** é atribuído pelo ML (decisão aprovada em 31/10/2026).

## 8. Correspondência com o dicionário em português (documento de definição de dados)

| Dicionário anterior | Contrato v0.1 |
|---|---|
| `ts_dispositivo` | `timestamp` |
| `id_no` | `device_id` |
| `origem_dado` | `data_source` |
| `qualidade` | `quality_flags` |
| `temp_sensor_c` | `temperature_c` |
| `acc_*_mg` | `accel_*_g` (unidade passa de mg para g) |
| `ang_x_graus`, `ang_y_graus` | `tilt_x_deg`, `tilt_y_deg` (agora derivados do acelerômetro) |
| `chuva_mm` | fora do contrato (contexto externo) |
| `evento_campo` | registro de manutenção (seção 5) |
