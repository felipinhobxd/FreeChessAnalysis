# Desempenho equivalente

## Rating de partida no Chess.com

O modelo usa partidas públicas de xadrez padrão do Published Data API. O alvo da referência é a qualidade de jogo observada por faixa do rating registrado. O rating oficial do Game Review é um rótulo diferente e não está presente nesse conjunto. A lógica pública do Chess.com compara as jogadas ao desempenho esperado no nível do jogador.

A qualidade do lance vem da perda de chance calculada com Stockfish 19 Lite. A função dá menos peso a posições decididas, mantém o peso integral em perdas que alteram o rumo da partida e descarta lances forçados e o primeiro par de meios-lances. O ajuste em relação ao PGN usa a mediana e o intervalo interquartil da qualidade observada no mesmo ritmo. A evidência de cada partida limita o tamanho do ajuste. A faixa indicativa é uma estimativa de incerteza, sem cobertura probabilística validada para o Game Review oficial.

Para ajustar uma nova amostra, use o conjunto JSON produzido pelo pipeline de precisão. O último argumento do ajuste é opcional e mantém uma partida inteira e seus jogadores fora do treino.

```sh
npm run calibration:collect
npm run calibration:analyze -- --depth 10
node tools/fit-game-rating.mjs .calibration/caps2-analysis.json 187950475324
npm run build
```

A referência foi ajustada em 608 partidas públicas analisadas com Stockfish 19 Lite na profundidade 10. Em validação de cinco grupos sem jogadores em comum entre treino e teste, 1.031 lados receberam estimativa. O ajuste médio foi de −7 pontos no total e −14 pontos nos 403 lados abaixo de 800. Nessa faixa, 1 de 403 estimativas ficou mais de 300 pontos acima do PGN. A partida de referência e seus jogadores foram excluídos do ajuste. Ela mede a tendência de inflar ou reduzir o rating de base. Uma comparação sistemática com o rating oficial de partida exigiria uma amostra de resultados do Game Review em vários níveis.

- [Explicação oficial do Game Rating](https://support.chess.com/en/articles/10773754-how-is-game-rating-calculated-in-game-review)
- [Chess.com Published Data API](https://www.chess.com/terms/chess-com-published-data-api)
- [Partidas públicas de referência publicadas em Ginzoh/chess-review](https://github.com/Ginzoh/chess-review/tree/main/scripts/data)

## Modelo do Lichess

O alvo é o rating informado na partida pública do Lichess. Usamos o rating como referência para estimar um intervalo por jogador a partir das decisões de uma partida. O relatório mantém esse intervalo, o rating do PGN e a precisão em campos próprios.

## Reprodução

```sh
npm install
python -m pip install zstandard==0.25.0
python tools/collect-performance.py rapid rapid.ndjson
python tools/collect-performance.py blitz blitz.ndjson
node tools/fit-performance.mjs rapid.ndjson dist/performance-model.js rapid
node tools/fit-performance.mjs blitz.ndjson dist/blitz-model.js blitz
node tools/check-transfer.mjs rapid.ndjson 4 10
node tools/check-transfer.mjs blitz.ndjson 4 10
npm run build
```

O coletor faz streaming do arquivo mensal até completar o número desejado de partidas. A opção `--archive` usa uma cópia local. O material original é CC0. [Arquivo e licença do Lichess](https://database.lichess.org/)

Os arquivos NDJSON usados no treino têm SHA-256 `9978081a022d3fe43ec2d823e7f2d5c69d5d043d9e7162c7fb84b53243073af3` (rápidas) e `51991a7a88a4d90243638f38508087cfb3b70a9ba9904aa77b9d6a9ac88bae26` (blitz).

## Metodologia

- Usei as primeiras 3.600 partidas elegíveis de cada ritmo no arquivo de novembro de 2025. Critérios de coleta incluem xadrez padrão ranqueado, término normal, sem bots titulados e a partir de 30 meios-lances anotados. É uma amostra de conveniência.
- O SHA-256 do nome em minúsculas atribui cada jogador a treino, calibração ou teste (60/20/20). Para evitar cruzamento de jogadores entre conjuntos, partidas com jogadores em grupos diferentes foram excluídas. Cada lado torna-se uma observação. As características usam somente os lances e as avaliações.
- A regressão ridge usa perda logarítmica em centipawns, perda de chance de vitória, dispersão, decisões com perda pequena ou grande, frequência e perda sob pressão, além de perdas de mates ou de vantagens claras. A pressão é uma aproximação baseada em mudanças de avaliação e lances forçados visíveis na SAN. O conjunto público oferece uma avaliação por posição. A validação das técnicas táticas da revisão usa também as linhas do motor.
- A largura inicial do intervalo vem do percentil de aproximadamente 80% dos resíduos absolutos do grupo de calibração. As pontas são arredondadas para fora em centenas. O Move by Move omite o intervalo quando a posição está fora dos critérios de suporte, a revisão está pendente ou o ritmo é desconhecido/incompatível.

| Ritmo | Lados treino / calibração / teste | Lados com previsão | MAE | RMSE | Viés assinado | Cobertura | MAE da média do treino |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rápidas | 2.550 / 282 / 306 | 300 | 272,12 | 330,32 | −3,84 | 77,67% | 291,27 |
| Blitz | 2.570 / 320 / 280 | 278 | 289,12 | 356,17 | +2,27 | 87,05% | 320,23 |

A checagem de transferência reanalisa as primeiras quatro partidas de teste de cada ritmo com Stockfish 19 Lite, profundidade 10. Em rápidas, houve sete estimativas aceitas (MAE 343,57, RMSE 364,82, viés −51). Em blitz, foram sete (MAE 369,57, RMSE 407,11, viés −213). É uma checagem pequena no mesmo conjunto retido por jogador. São necessárias mais partidas reanalisadas para quantificar a diferença entre o arquivo e a revisão do navegador com maior precisão.

O [Game Review do Chess.com](https://www.chess.com/analysis) e [Chessigma](https://www.chessigma.com/) serviram de referência para a apresentação. A fórmula proprietária do rating de partida não está descrita nas referências consultadas. [Maia Chess](https://github.com/CSSLab/maia-chess) pesquisa a previsão de lances humanos em diferentes níveis e publica código GPL-3.0. O modelo e o código deste repositório foram ajustados separadamente.
