# Premissas do gerador de dados sintéticos (revisão 2)

Código: `src/aurora_ml/synthetic.py`. **Tudo é simulação.** Os valores abaixo são ilustrativos e substituíveis. Nenhum vem de medição do MPU-6050 nem da HD-38, e nenhum representa limite de segurança ou magnitude esperada de movimento real de encosta. Resultados obtidos nestes dados **não** são evidência de que o sistema detecta movimentos reais.

Tipos de base: **matemática** (consequência geométrica ou cinemática), **convenção** (escolha de representação) e **arbitrária** (valor ou forma escolhido para a simulação aparecer; não é fato sobre os sensores).

## 1. Premissas do modelo

| ID | Premissa | Base | Parâmetros |
|---|---|---|---|
| M1 | Sensor parado mede só a gravidade (1 g); roll e pitch determinam as três componentes | matemática | — |
| M2 | A orientação verdadeira é constante mais uma deriva lenta de passeio aleatório | arbitrária | `tilt_drift_deg_per_step` |
| M3 | Aceleração medida = gravidade + acoplamento linear com a temperatura + ruído branco gaussiano | arbitrária (linear e gaussiano são escolhas; o comportamento real pode ser não linear, ter histerese e variar por unidade) | `accel_noise_g`, `temp_ref_c` e coeficientes por dispositivo |
| M4 | Giroscópio = derivada temporal dos ângulos verdadeiros (aproximação de ângulos pequenos, sem acoplamento entre eixos) + viés constante + ruído branco | matemática (derivada) e arbitrária (viés, ruído) | `gyro_noise_dps` e viés por dispositivo |
| M5 | Eixo Z do giroscópio: só viés e ruído (não há rotação em torno da vertical) | arbitrária | — |
| M6 | Temperatura: ciclo diário seguindo a hora local, clima do dia com memória e ruído. É descrita como "temperatura do chip", mas só imita o ciclo diário; não há relação modelada com a temperatura do ar | arbitrária | `temp_mean_c`, `temp_daily_amp_c`, `temp_noise_c`, `temp_day_ar1`, `temp_day_sd_c`, `local_utc_offset_h` |
| M7 | Umidade: valor base + flutuação lenta (AR(1)) + ruído, arredondado e limitado ao intervalo do conversor. Direção e escala são **placeholders**. Não modela dependência de temperatura, de salinidade, de contato, corrosão nem deriva da sonda | arbitrária | `adc_max`, `soil_noise_counts`, `soil_ar1`, `soil_ar_sd_counts` |
| M8 | `soil_digital`: sem premissa sobre o ajuste do módulo, vale 0 constante (ou, se um limiar for informado, comparação com ele) | convenção | `soil_digital_threshold` |
| M9 | Chuva não é simulada nem entra no contrato (sem sensor correspondente) | convenção | — |
| M10 | Diferenças entre dispositivos (orientação base, coeficientes, viés, ruído) são inventadas, só para exercitar a lógica por dispositivo | arbitrária | `DeviceProfile` |
| M11 | Cada leitura chega no horário certo e na ordem; entrega atrasada não é simulada | convenção | — |
| M12 | O MPU-6050 e a HD-38 falham de forma independente (leitura ausente espalhada) | arbitrária | `p_missing_mpu`, `p_missing_soil` |

## 2. Parâmetros globais

`seed`, `start_utc` (data arbitrária), `n_days`, `train_days` (fronteira treino/teste), `interval_min` (10 min vem da Prospecção como premissa a validar, P02), `plausible_min_utc` e `plausible_max_utc` (janela de timestamp plausível; parâmetro de validação, não fato do firmware), `conflict_accel_sd_g` (desvio usado nas duplicatas conflitantes), `abrupt_transition_min` (duração da transição do cenário brusco).

## 3. Cenários (classe de cada um)

| Cenário | Como é injetado | Classe |
|---|---|---|
| `tilt_abrupt` | Soma ao roll ou ao pitch um platô com subida e descida em `abrupt_transition_min`; **volta ao normal** ao fim (simplificação para marcar começo e fim) | physical_candidate |
| `tilt_gradual` | Soma uma subida e descida suaves (formato seno²) ao roll ou ao pitch | physical_candidate |
| `soil_unusual` | Soma uma subida e descida suaves à umidade; forma arbitrária, não representa infiltração real | physical_candidate |
| `noise_burst` | Ruído de aceleração e giroscópio multiplicado por um fator | quality |
| `frozen_mpu`, `frozen_soil` | Repete a última leitura anterior à falha | quality |
| `spike` | Valores isolados em um eixo do acelerômetro | quality |
| `missing_readings` | Leitura ausente (NaN) em bloco e espalhada; `MISSING_VALUE` ligado | quality |
| `duplicate_timestamps` | Cópias de linhas com o mesmo `timestamp`: metade idênticas, metade com valores diferentes | quality |
| `invalid_timestamps` | `timestamp` substituído por datas fora da janela plausível (1970 e 2099) | quality |
| `comm_gap` | Linhas **removidas** durante um intervalo (inclusive até o fim da série). Não existe como rótulo de linha | telemetry |
| `thermal_variation` | Amplifica o ciclo diário; o acoplamento (M3) faz o acelerômetro acompanhar | context_dependent |
| `maintenance`, `post_maintenance` | Janela de ruído maior e, depois dela, mudança permanente da orientação; gera registro no log de manutenção | context_dependent |

**Separação de classes:** `physical_candidate` significa apenas "cenário construído para parecer uma mudança de orientação ou umidade". Não significa movimento real. Falhas de qualidade e telemetria nunca são classificadas como candidatas físicas. `context_dependent` são casos que exigem decisão ou o registro de manutenção.

## 4. O que NÃO é modelado (limitações)

Quantização do conversor interno; erro de ganho e de offset de fábrica; histerese e não linearidade térmicas; vibração e movimento dinâmico; resposta real da sonda de solo à chuva, à temperatura, à salinidade e ao tempo; corrosão; atraso e ordem de entrega dos pacotes; relógio do dispositivo que perde a hora; chuva; variação entre unidades reais. Por isso o desempenho de qualquer detector nestes dados tende a ser mais otimista do que seria com dados reais.

## 5. Dados de treino

Os cenários caem todos no período de teste, e o período de treino contém só leituras habituais e ausências espalhadas. Isso é conveniência da simulação: dado real de treino vem "sujo".
