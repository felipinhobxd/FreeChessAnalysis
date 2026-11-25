# Livro de Lances · FreeChessAnalysis

Analisador de xadrez em português com Stockfish 19, revisão de partidas e treino a partir dos erros.

## Rodar localmente

Use Node.js 24. Execute `npm start` e abra <http://127.0.0.1:8787/analysis>. No Windows, `abrir-no-windows.bat` inicia o mesmo servidor. Use `npm run build` para a verificação de sintaxe e para preparar a publicação da pasta `dist`.

## Publicar na Vercel

Importe o repositório `felipinhobxd/FreeChessAnalysis`, use a raiz do repositório como Root Directory e selecione o preset **Other**. A configuração em `vercel.json` define a pasta estática `dist`, a rota `/analysis` e os cabeçalhos exigidos pelo Stockfish multithread. O projeto não precisa de instalação de pacotes, variáveis de ambiente, banco de dados ou funções da Vercel.

Na primeira análise, o modo Completo pode carregar cerca de 95 MB. Em navegadores compatíveis, o isolamento de origem habilita várias threads. Se essa compilação estiver indisponível, o site tenta a Completa de uma thread e depois a Lite. O modo Lite também pode ser ativado nas configurações.

Chess.com e Lichess são consultados diretamente pelas APIs públicas quando você busca um usuário. As posições são analisadas no seu navegador, e o arquivo de partidas e as preferências ficam no próprio navegador.

## Revisar e treinar

- Importe um PGN ou FEN, busque uma partida pública ou clique em **Usar exemplo**.
- No **Relatório**, selecione um lance para ver a marca sobre a peça, a avaliação e a comparação entre as continuações. Ao chegar ao xeque-mate de uma partida analisada, o tabuleiro sinaliza o vencedor.
- Em **Puzzles**, jogue a partir de uma posição em que houve erro. Há três vidas por puzzle. Um lance ilegal não gasta vida.
- Use as setas para navegar pelos lances, Espaço para reproduzir, F para girar e G para expandir o tabuleiro. Os sons, a animação e o conjunto de peças são ajustáveis.

## Créditos

- Peças clássicas Cburnett de Colin M. L. Burnett, obtidas no [Lichess](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett) sob GPL v2 ou posterior. A licença acompanha os SVGs em `dist/pieces/classicas`.
- Peças [Chessnut](https://github.com/LexLuengas/chessnut-pieces) de Alexis Luengas, Apache 2.0.
- [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js), GPLv3, e [chess.js 1.4.0](https://github.com/jhlywa/chess.js), BSD 2-Clause.
- Sons sintetizados e animação de mate desenvolvidos para o projeto.
