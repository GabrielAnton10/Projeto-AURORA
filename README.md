# AURORA – Monitoramento Inteligente de Barreiras

Painel de administração. Os dados vêm da API: veja **INTEGRACAO.md** para ligar.

## Como abrir
- VS Code: instale a extensão **Live Server**, clique com o botão direito em `index.html` > *Open with Live Server*.
- Ou dê dois cliques em `index.html`.

## Sensores
- Umidade do solo (%), acelerômetro/inclinação (graus) e temperatura (°C).

## Mapa
A página *Mapa de Risco* usa Leaflet com camadas Ruas, OpenStreetMap e Satélite (precisa de internet; abra com o Live Server, não com duplo clique). Mostra 4 áreas de risco do Recife (Nova Descoberta, Alto José Bonifácio, Ibura e Jordão). Posições aproximadas; equipamentos fictícios. Sem internet, aparece um mapa esquemático.

## Cadastro de locais
Na página *Mapa de Risco* é possível cadastrar novos locais (nome, detalhe, latitude e longitude; com internet dá para clicar no mapa). Na página *Equipamentos* o novo equipamento é ligado a um dos locais. Locais cadastrados no site ficam salvos no navegador (a API ainda não tem rota de locais).

## Estrutura
- `index.html` – estrutura das telas
- `css/style.css` – visual e cores da marca
- `js/dados.js` – configuração da API (`CONFIG`) e leitura dos dados
- `js/app.js` – gráficos, páginas e navegação
- `img/` – logo e símbolo

## Próximos passos
Ligar a API (INTEGRACAO.md) e conferir os dados reais.
