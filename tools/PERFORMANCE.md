# Desempenho equivalente

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
