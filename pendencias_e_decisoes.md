# Projeto Aurora — Pendências e decisões (Etapa 1: Machine Learning)

Versão 0.2 · 31/10/2026 · documento vivo. Regra: nada aqui é preenchido por suposição. "Solução provisória" é sempre configuração substituível.

## 1. Pendências (informação que falta)

| ID | O que falta | Por que importa | Quem pode fornecer | Impacto se faltar | Solução provisória | Status |
|---|---|---|---|---|---|---|
| P01 | Placa controladora, pinos usados e conversor analógico (ADC) | Define a escala e as limitações de `soil_raw` | Hardware | Não dá para fixar a escala nem a faixa válida | `adc_max = 4095` como placeholder no gerador sintético | aberta |
| P02 | Frequência de amostragem e de envio | Define janelas dos atributos e o limite de silêncio | Hardware | Janelas e limite de silêncio arbitrários | `interval_min = 10` (premissa da Prospecção) | aberta |
| P03 | Protocolo e formato real do payload (com um exemplo real); se há entrega atrasada | O contrato precisa bater com o firmware | Hardware | Contrato pode não bater | Contrato v0.1 independente de protocolo | aberta |
| P04 | Capturas reais do MPU-6050 e da HD-38 (mesmo de poucas horas) | Única forma de ter dado `bancada` | Hardware | Nenhuma conclusão sobre os sensores | Seguir só com dado sintético, sem afirmar nada sobre os sensores | aberta |
| P05 | Configuração do MPU-6050: faixa de escala, filtro interno, calibração feita, montagem | Muda conversões, ruído e faixa válida | Hardware | Conversões e faixas podem estar erradas | Valores configuráveis, documentados como ilustrativos | aberta |
| P06 | Ligação da HD-38: alimentação, pino AO, ajuste do DO | Evita leitura incorreta ou dano à entrada | Hardware | Dado do solo não confiável | `soil_digital` fora do modelo | aberta |
| P07 | De onde virá a chuva exibida no front-end (não há pluviômetro nos sensores informados) | O front-end mostra "Chuva (mm/h)" | Equipe | Chuva local seria enganosa | Chuva fica fora do contrato; só contexto externo com fonte indicada | aberta |
| P08 | Código do front-end | Só há capturas | Equipe | Contrato de API da Etapa 2 pode não encaixar | Nenhuma | aberta |
| P11 | Textos do front-end ("Identifica riscos", "Protege vidas", "sem movimentação relevante", "faixa de referência") | Sugerem avaliação de risco e limiares que não existem | Equipe | Comunicação excessiva ao público | Revisar redação (o front-end não foi alterado) | aberta |
| P12 | Alertas por e-mail: validação, base legal e consentimento | E-mail é dado pessoal; alerta ao público exige validação | Equipe e orientador | Risco de privacidade e de comunicação indevida | Envio real desativado; só cadastro simulado (Etapa 2) | aberta |
| P13 | Fonte do telefone e das orientações da Defesa Civil exibidos no front-end | Contato deve ser verificado pela equipe | Equipe | Orientação errada ao público | Nenhuma | aberta |
| P14 | Versão do Python e ambiente fora do Colab | O módulo precisa rodar sem notebook | Equipe | Incompatibilidade | Documentar versões testadas | aberta |
| P15 | Papéis dos cenários e o que cada classe deve gerar no detector | Define como medir acertos e erros | Equipe | Métricas sem critério combinado | Proposta: `physical_candidate` gera evento de anomalia; `quality` e `telemetry` geram evento de qualidade/telemetria; `context_dependent` é discutido | proposta |
| P16 | Número de dispositivos e como será definido o `device_id` | Define se há modelo por dispositivo | Equipe | Escolha entre modelo global e por dispositivo | Um modelo por dispositivo (provisório, ver D07) | aberta |
| P17 | Divisão do prazo entre Etapa 1 e Etapa 2 | Restam cerca de 3 semanas | Equipe | Backend sem tempo | Etapa 1 limitada a cerca de 2 semanas | proposta |
| P18 | Convenção de eixos e orientação do sensor na instalação | `tilt_x_deg` e `tilt_y_deg` dependem dela | Hardware | Inclinação calculada pode corresponder a outro eixo | Convenção provisória em `geometry.py` | aberta |
| P19 | Janela e regra da referência de `tilt_delta_deg` e `soil_delta` (após instalação e após manutenção) | Define o "zero" das variações | Equipe e orientador | Variações sem referência clara | Mediana de uma janela de referência (comprimento a definir) | aberta |
| P20 | Janela de timestamp plausível e comportamento do relógio do dispositivo sem sincronização | Define timestamps inválidos | Hardware | Regra de validação arbitrária | `plausible_min_utc` e `plausible_max_utc` configuráveis | aberta |
| P21 | Limites de `FROZEN_VALUE`, `DEVICE_MOVING` e `OUT_OF_RANGE` | Dependem do ensaio de bancada | Hardware e equipe | Flags sem critério | Definidos após P04 e P05; nada fixado agora | aberta |

## 2. Decisões tomadas

| ID | Decisão | Justificativa | Data |
|---|---|---|---|
| D01 | Preservar o notebook original; alterações vão para novas versões | Rastreabilidade (cópia idêntica em `notebooks/00_...original.ipynb`) | 31/10/2026 |
| D02 | `data_source` ∈ {`campo`, `bancada`, `sintetico`}, nunca misturados sem identificação; dado sintético usa `device_id` com prefixo `SIM-` | Evitar apresentar simulação como medição | 31/10/2026 |
| D03 | Detector: referência estatística simples + Isolation Forest; saída é score, estado e qualidade, nunca probabilidade de deslizamento | O algoritmo não fornece probabilidade geotécnica calibrada | 31/10/2026 |
| D04 | Falta de dado ou de comunicação gera evento de telemetria/qualidade, não anomalia física | Falha de instrumentação não é movimento de encosta | 31/10/2026 |
| D05 | Contrato com nomes em inglês; `quality_flags` é o campo principal e `quality_ok` é derivado | Aprovado pelo responsável | 31/10/2026 |
| D06 | O ML nunca atribui o nível "Crítico"; esse nível fica reservado a avaliação humana fundamentada | Aprovado pelo responsável | 31/10/2026 |
| D07 | Arquitetura preparada para um modelo por dispositivo. **Provisório e revisável**: reavaliar conforme o número de dispositivos e a quantidade de dados disponíveis por dispositivo | Aprovado provisoriamente | 31/10/2026 |
| D08 | Chuva fora do contrato (sem sensor correspondente); só contexto externo, com a fonte indicada | Evitar apresentar dado externo como medição local | 31/10/2026 |
| D09 | Inclinação (`tilt_*`) e deltas são variáveis **derivadas**, calculadas no pipeline com fórmula e versão; o dado bruto é preservado | Reprodutibilidade | 31/10/2026 |
| D10 | Classes dos cenários: `physical_candidate`, `quality`, `telemetry`, `context_dependent`, `normal`. Qualidade e telemetria nunca são candidatas físicas | Separar falha de instrumentação de anomalia física | 31/10/2026 |