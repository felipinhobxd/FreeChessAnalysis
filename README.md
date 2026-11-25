<div align="center">
  <img src="dist/favicon.svg" alt="" width="72" height="72" />
  <h1>Livro de Lances</h1>
  <p><strong>Análise de xadrez no navegador, com Stockfish 19.</strong></p>
  <p>Revise partidas, entenda decisões críticas e transforme erros em oportunidades de treino.</p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-24.x-3c873a?logo=node.js&logoColor=white" alt="Node.js 24.x" />
    <img src="https://img.shields.io/badge/Engine-Stockfish%2019-779556" alt="Stockfish 19" />
    <img src="https://img.shields.io/badge/Idioma-Portugu%C3%AAs%20(BR)-426b50" alt="Português do Brasil" />
    <img src="https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel" alt="Compatível com Vercel" />
  </p>
  <p><a href="https://github.com/felipinhobxd/FreeChessAnalysis">Repositório</a> · <a href="https://github.com/felipinhobxd/FreeChessAnalysis/issues">Problemas e sugestões</a></p>
</div>

---

## Visão geral

**Livro de Lances (FreeChessAnalysis)** é um analisador de xadrez em português. Ele permite importar partidas ou posições, acompanhar avaliações do Stockfish, revisar os lances e praticar a partir de erros encontrados.

A aplicação é estática e executa a análise no navegador. Não exige conta, servidor próprio, banco de dados ou chaves de API para as funções principais.

## Recursos

| Área | O que você pode fazer |
| --- | --- |
| **Importação** | Colar ou carregar arquivos PGN, analisar posições FEN e buscar partidas públicas pelo nome de usuário no Chess.com ou Lichess. |
| **Análise ao vivo** | Consultar avaliação do Stockfish 19, linhas de continuação e múltiplas variantes. Ajustar profundidade e quantidade de linhas. |
| **Revisão da partida** | Avaliar os lances, consultar classificações, comparar a jogada realizada com a melhor continuação, estimar o rating de cada jogador e analisar variantes editadas sem alterar a linha original. |
| **Treino** | Resolver puzzles gerados a partir de imprecisões, erros e erros graves encontrados na revisão, com navegação livre pelo histórico e exibição do último lance do adversário. Cada desafio começa com três vidas. |
| **Tabuleiro** | Mover peças por seleção ou arrastar e soltar com destinos legais destacados, desenhar setas vermelhas por padrão e setas em L para movimentos de cavalo, navegar pelo histórico com animações, girar o tabuleiro e abrir o modo de tela cheia. |
| **Exportação** | Copiar PGN ou FEN, baixar a partida em PGN, criar um link compartilhável ou salvar a partida no arquivo local. |
| **Personalização** | Usar Cburnett como conjunto padrão ou escolher outros temas, configurar o motor, ajustar parâmetros de análise, ativar ou silenciar sons, controlar o volume e escolher a velocidade das animações. Os efeitos usam variações locais para movimentos e capturas. |

As classificações e os percentuais de precisão são estimativas calculadas a partir das avaliações do motor. Não representam uma classificação oficial do Chess.com, Lichess ou de outra plataforma.

## Começar a usar

### Requisitos

- Node.js **24.x**.
- Navegador moderno com suporte a módulos JavaScript, WebAssembly e Web Workers.
- Conexão com a internet para carregar o Stockfish na primeira análise e consultar partidas públicas.

### Executar localmente

Clone o repositório e entre na pasta:

```bash
git clone https://github.com/felipinhobxd/FreeChessAnalysis.git
cd FreeChessAnalysis
```

Inicie o servidor local:

```bash
npm start
```

Abra [http://127.0.0.1:8787/analysis](http://127.0.0.1:8787/analysis).

Não é necessário executar `npm install`: o projeto não declara dependências npm. No Windows, também é possível iniciar o servidor e abrir o navegador com:

```text
abrir-no-windows.bat
```

### Verificar o projeto

```bash
npm run build
```

O comando executa verificações de sintaxe nos módulos JavaScript da aplicação e no servidor local. Ele não recompila os arquivos de `dist/`: essa pasta contém os arquivos estáticos publicados.

## Publicar na Vercel

O repositório já inclui `vercel.json` com as configurações de build, publicação, rota de análise e cabeçalhos necessários ao isolamento de origem.

1. Importe **felipinhobxd/FreeChessAnalysis** na Vercel.
2. Defina a raiz do projeto como `./`.
3. Escolha o preset **Other**.
4. Configure **Build Command** como `npm run build`.
5. Configure **Output Directory** como `dist`.
6. Deixe o comando de instalação vazio. Não há variáveis de ambiente obrigatórias.

A rota principal também está disponível em `/analysis`.

### Sobre o Stockfish

O motor é carregado sob demanda pelo navegador. O **Stockfish 19 Lite é o modo padrão**, oferecendo inicialização mais leve para as análises do dia a dia. O modo **Completo** continua disponível em **Ajustes → Modo do Stockfish** para quem deseja mais força de análise e aceita baixar aproximadamente **95 MB** na primeira utilização. Em navegadores e implantações compatíveis com isolamento de origem, a compilação completa pode usar várias threads.

Os cabeçalhos `Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy` configurados em `vercel.json` ajudam a habilitar os recursos necessários à execução multithread. Preferências salvas no formato antigo são migradas uma vez para o novo padrão Lite.

## Como usar

1. Abra a aba **Importar**.
2. Escolha uma origem: **PGN**, **FEN**, **Chess.com** ou **Lichess**.
3. Cole o conteúdo, carregue um arquivo PGN ou informe o nome de usuário para buscar partidas públicas.
4. Inicie a análise. A aba **Variantes** mostra as continuações calculadas pelo Stockfish.
5. Abra **Revisão** e selecione **Revisar** para analisar os lances da partida.
6. Selecione um lance no histórico para consultar sua classificação, a avaliação antes e depois da jogada e a linha recomendada.
7. Use **Puzzles** para praticar posições identificadas durante a revisão.

### Controles do tabuleiro

| Controle | Ação |
| --- | --- |
| **← / →** | Voltar ou avançar um lance |
| **Home / End** | Ir ao início ou ao fim da linha |
| **Espaço** | Iniciar ou pausar a reprodução automática |
| **F** | Girar o tabuleiro |
| **G** | Ativar ou sair da tela cheia |
| **Botão direito + arraste** | Desenhar uma seta entre duas casas |
| **Clique direito** | Marcar ou desmarcar uma casa com um círculo |
| **Shift / Ctrl / Alt + botão direito** | Desenhar em azul / vermelho / amarelo (verde é a cor padrão) |
| **Clique esquerdo** | Limpar as marcações do tabuleiro |
| **Clique ou arraste** | Selecionar e movimentar peças |

Os atalhos de teclado são aplicados quando o foco não está em campos de texto, seletores ou outros controles interativos.

## Dados e privacidade

- A lógica do tabuleiro, a revisão e a análise do Stockfish são executadas no navegador.
- A aplicação não possui backend próprio nem banco de dados.
- A busca por partidas públicas consulta diretamente as APIs do Chess.com e do Lichess.
- Preferências e partidas salvas ficam no armazenamento local do navegador (`localStorage`). O arquivo local mantém até 50 partidas.
- O link compartilhável codifica a partida ou posição no fragmento da URL. Compartilhe o link apenas quando desejar disponibilizar esse conteúdo.
- Os arquivos do Stockfish são obtidos sob demanda de CDNs externos; por isso, a primeira inicialização do motor depende de conexão com a internet.

## Estrutura do projeto

```text
.
├── dist/
│   ├── index.html       # Interface principal
│   ├── style.css        # Estilos da aplicação
│   ├── app.js           # Fluxos da interface e análise
│   ├── board-ui.js      # Ícones, sons e efeitos do tabuleiro
│   ├── coach.js         # Explicações e lógica de treino
│   ├── engine.js        # Integração com Stockfish
│   ├── pieces/          # Conjuntos de peças e licenças
│   └── notices.html     # Créditos e licenças
├── serve.mjs            # Servidor para desenvolvimento local
├── abrir-no-windows.bat # Inicializador para Windows
├── package.json         # Scripts e versão do Node.js
└── vercel.json          # Configuração de publicação
```

## Créditos e licenças

O projeto reúne recursos próprios e componentes de terceiros:

- **Ateliê:** conjunto padrão de peças, marca e pictogramas desenvolvidos para o Livro de Lances.
- **Cburnett:** peças de Colin M. L. Burnett, disponibilizadas pelo [Lichess](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett), sob GPL versão 2 ou posterior. A licença acompanha os arquivos em `dist/pieces/classicas/`.
- **Chessnut:** peças de Alexis Luengas, sob [Apache License 2.0](https://github.com/LexLuengas/chessnut-pieces).
- **Stockfish.js 19.0.1:** motor de xadrez distribuído sob [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.html).
- **chess.js 1.4.0:** biblioteca de regras e movimentação, sob [BSD 2-Clause](https://github.com/jhlywa/chess.js).

- **Sons do tabuleiro:** amostras Kenney Impact Sounds e Interface Sounds, CC0 1.0, combinadas em efeitos próprios para movimento, captura, roque, xeque, promoção e fim de partida. Créditos em `dist/sounds/kenney/README.md`.

Consulte também a página de [créditos e licenças da aplicação](dist/notices.html) e os arquivos de licença distribuídos com os respectivos recursos.

---

<div align="center">
  <sub>Feito para estudar melhor cada lance. ♟</sub>
</div>
