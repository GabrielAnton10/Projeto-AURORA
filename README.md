<<<<<<< HEAD
# AURORA – Monitoramento Inteligente de Barreiras


Protótipo do painel de administração (dados FICTÍCIOS).

## Como abrir
- VS Code: instale a extensão **Live Server**, clique com o botão direito em `index.html` > *Open with Live Server*.
- Ou dê dois cliques em `index.html`.

## Sensores
- Umidade do solo (%), acelerômetro/inclinação (graus) e temperatura (°C).

## Mapa
A página *Mapa de Risco* usa Leaflet com camadas Ruas, OpenStreetMap e Satélite (precisa de internet; abra com o Live Server, não com duplo clique). Mostra 4 áreas de risco do Recife (Nova Descoberta, Alto José Bonifácio, Ibura e Jordão). Posições aproximadas; equipamentos fictícios. Sem internet, aparece um mapa esquemático.

## Cadastro de locais
Na página *Mapa de Risco* é possível cadastrar novos locais (nome, detalhe, latitude e longitude; com internet dá para clicar no mapa). Na página *Equipamentos* o novo equipamento é ligado a um dos locais. Por enquanto os cadastros ficam salvos no navegador (localStorage); com o backend viram `POST /api/locations` e `POST /api/devices`.

## Estrutura
- `index.html` – estrutura das telas
- `css/style.css` – visual e cores da marca
- `js/dados.js` – dados fictícios e configuração (`CONFIG`)
- `js/app.js` – gráficos, páginas e navegação
- `img/` – logo e símbolo

## Próximos passos
Criar o backend (recebe os dados do ESP32, grava no banco, autentica administradores) e trocar `CONFIG.source` de `demo` para `live`.
=======
# Projeto-AURORA
<p align="center">
<img width="1000" height=500" alt="logo unica" src="https://github.com/GabrielAnton10/Projeto-AURORA/blob/main/Imagens/logo%20do%20Aurora.jpeg" />
  
</p>

## Introdução
O projeto Aurora é um equipamento de monitoramento de barreira utilizando inteligência artificial para tratar os dados e    antecipar os deslizamentos.

## Objetivo do Projeto
Este equipamento foi criado com o intuito de prevenir um deslizamento, o AURORA ele faz medições de solo utilizando uma IA para fazer este tratamento dos dados padrões para um possível deslisamento e antecipando uma possível instabilidade da área que ele está medindo.
>>>>>>> origin/site
