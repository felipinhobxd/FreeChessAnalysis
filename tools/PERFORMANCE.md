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

A referência atualmente empacotada foi ajustada em 608 partidas públicas analisadas com Stockfish 19 Lite na profundidade 10. O relatório histórico anterior registrou 1.031 lados com estimativa e ajuste médio de −7 pontos; esse número descreve apenas a distribuição do ajuste aplicado ao rating informado no PGN. Ele não mede erro contra o rating oficial do Game Review. A validação foi reforçada para testar, em jogadores totalmente separados, se a curva por rating prevê a qualidade derivada do Stockfish melhor que uma mediana fixa por ritmo. A atualização da referência agora exige ao menos 500 lados de treino, 120 lados retidos, 60 jogadores retidos e 30 lados por ritmo, além de melhora de MAE sem regressão relevante em Blitz ou Rapid. O relatório é sempre salvo em `dist/chesscom-rating-validation.json`; a referência de produção só é substituída quando esses critérios passam.

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

Os arquivos NDJSON usados na calibração histórica têm SHA-256 `9978081a022d3fe43ec2d823e7f2d5c69d5d043d9e7162c7fb84b53243073af3` (rápidas) e `51991a7a88a4d90243638f38508087cfb3b70a9ba9904aa77b9d6a9ac88bae26` (blitz).


## Validação e integridade dos conjuntos

O ajuste de Blitz/Rapid usa agora o mesmo classificador de tempo do aplicativo (base + 40 × incremento): no Lichess, Bullet abaixo de 180 s, Blitz de 180 s até antes de 480 s, Rapid de 480 s até antes de 1.500 s e Classical a partir de 1.500 s. Isso evita que partidas de 8 a 10 minutos sejam treinadas como Blitz e estimadas como Rapid. O ajuste deve ser refeito com os NDJSON originais para atualizar os coeficientes publicados. Os modelos já empacotados não foram alterados sem reprocessar essa amostra.

O script de ajuste só publica um novo arquivo quando o teste por jogadores separados tem pelo menos 30 previsões, melhora MAE e RMSE em relação à previsão constante e apresenta cobertura entre 72% e 88% para a faixa calibrada no conjunto de calibração. O relatório também mostra o tamanho dos conjuntos e o número de partidas descartadas por cruzarem grupos de jogadores.

Para a referência Chess.com, o ajuste agora reserva 20% dos jogadores para holdout e exclui partidas que cruzam treino e holdout. Os resultados do script medem a distribuição do ajuste aplicado ao rating do PGN, não o erro em relação ao Game Rating oficial: a API pública não fornece esse rating oficial como rótulo de treino. Portanto, esses diagnósticos não comprovam a precisão do rating previsto pelo Game Review.

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


### O que a validação do Chess.com realmente mede

O conjunto público contém avaliações do Stockfish por posição e uma precisão por partida, mas não contém o rating oficial calculado pelo Game Review. Por isso, a referência de rating valida somente se a qualidade de jogo derivada do motor varia de maneira previsível com o rating registrado e o ritmo. Os diagnósticos de ajuste ao rating do PGN são mantidos separados e não são chamados de MAE de rating oficial. A referência existente permanece ativa quando o holdout por jogador é pequeno, não cobre os dois ritmos ou não melhora uma linha de base simples.

O coletor de CAPS2 também registra uma conta como concluída somente depois de obter seu índice de arquivos com sucesso. Respostas temporárias de rede deixam a conta elegível para nova tentativa, evitando que uma falha interrompa permanentemente a coleta.
