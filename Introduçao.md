# Projeto Aurora — módulo de Machine Learning (Etapa 1, passos 1 e 2)

Estado: **contrato de dados v0.1 + gerador de dados sintéticos revisado + testes**. Ainda não há validação de dados, atributos, detector nem inferência (próximos passos, após aprovação). Nenhuma parte do backend ou do front-end foi tocada.

## Estrutura
```
notebooks/00_etapa1_dados_sinteticos_original.ipynb   (cópia idêntica do original; não editar)
notebooks/01_dados_sinteticos_rev2.ipynb              (usa o módulo; roda no Colab)
src/aurora_ml/   schema.py (contrato), geometry.py (inclinação), synthetic.py (gerador)
tests/           37 testes (unittest)
docs/            contrato_de_dados_v0.1.md, premissas_gerador_sintetico.md, pendencias_e_decisoes.md
```

## Como executar os testes (sem instalar nada além de pandas e numpy)
```
cd aurora
python -m unittest discover -s tests -v
```
Também funciona com `pytest`, se estiver instalado. Versões em que foi testado: Python 3.12, pandas 3.0, numpy 2.4 (ambiente do desenvolvimento; confirmar no Colab).

## Como usar no Colab
1. Envie `aurora_etapa1_passos1-2.zip` e rode `!unzip -q aurora_etapa1_passos1-2.zip -d /content`.
2. Abra `/content/aurora/notebooks/01_dados_sinteticos_rev2.ipynb` e execute de cima para baixo.

## Avisos
Todos os dados gerados são **sintéticos** e os parâmetros são **ilustrativos**. Nada aqui é evidência sobre encostas reais nem sobre o comportamento do MPU-6050 ou da HD-38.