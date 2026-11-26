<div align="center">
  <img src="dist/favicon.svg" width="76" alt="Move by Move">
  <h1>Move by Move</h1>
  <p><strong>Análise de xadrez, revisão de partidas e evolução lance a lance.</strong></p>
  <p><a href="https://freechessanalysis.vercel.app/analysis"><strong>♟ Abrir o Move by Move</strong></a></p>
  <p>
    <a href="https://github.com/felipinhobxd/FreeChessAnalysis/actions/workflows/browser-integration.yml"><img src="https://github.com/felipinhobxd/FreeChessAnalysis/actions/workflows/browser-integration.yml/badge.svg" alt="Testes automatizados"></a>
    <a href="https://github.com/official-stockfish/Stockfish"><img src="https://img.shields.io/badge/Engine-Stockfish%2019-779556" alt="Stockfish 19"></a>
    <img src="https://img.shields.io/badge/Idiomas-14-426b50" alt="14 idiomas">
  </p>
</div>

---

## Sobre

O **Move by Move** é uma plataforma gratuita de análise de xadrez que funciona diretamente no navegador. Importe uma partida, investigue as melhores continuações e entenda os momentos que fizeram diferença no jogo.

## Recursos

- **Análise com Stockfish 19:** modo Lite como padrão e modo Full opcional.
- **Revisão da partida:** precisão, classificação dos lances e momentos decisivos.
- **Oportunidades perdidas:** destaque para chances táticas e vantagens que passaram despercebidas.
- **Estimativa de rating:** indicadores de desempenho por jogador.
- **Tabuleiro interativo:** explore variantes, anote posições e pratique alternativas.
- **Importação e exportação:** PGN, FEN, Chess.com e Lichess.
- **Histórico e personalização:** partidas salvas no navegador, sincronização opcional e 14 idiomas.

## Comece a jogar

Acesse **[freechessanalysis.vercel.app/analysis](https://freechessanalysis.vercel.app/analysis)**. Não é necessário instalar nada nem criar uma conta.

## Executar localmente

Para executar uma cópia no computador, instale o [Node.js 24](https://nodejs.org/) e rode:

```bash
git clone https://github.com/felipinhobxd/FreeChessAnalysis.git
cd FreeChessAnalysis
npm install
npm start
```

Depois, abra [http://127.0.0.1:8787/analysis](http://127.0.0.1:8787/analysis).

Para validar o projeto, execute `npm run build`. Os testes de navegador podem ser iniciados com `npm run test:e2e`.

## Sobre as estimativas

As classificações, a precisão e o rating estimado são métricas próprias baseadas na análise do motor. **Não representam a fórmula oficial do Chess.com nem reproduzem seu CAPS2 proprietário.** Consulte a [metodologia e validação](https://freechessanalysis.vercel.app/methodology.html) para entender os critérios e limitações.

## Documentação e créditos

- [Metodologia e validação](https://freechessanalysis.vercel.app/methodology.html)
- [Calibração da precisão](tools/CAPS2-CALIBRATION.md)
- [Benchmark de oportunidades perdidas](tools/MISSED-OPPORTUNITIES-BENCHMARK.md)
- [Desempenho e modelos](tools/PERFORMANCE.md)
- [Créditos e licenças](dist/notices.html)

---

<div align="center">
  <sub>Feito para entender melhor cada lance.</sub>
</div>
