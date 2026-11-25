# Sons do tabuleiro

Este diretório contém o pacote de áudio usado pelo Livro de Lances.

## Origem e créditos

Os arquivos vêm de [chess-sounds-gen](https://github.com/chessvault-app/chess-sounds-gen), um pacote de sons de interface de xadrez sintetizados do zero, inspirado no caráter do tema padrão do Lichess. Eles **não são cópias dos arquivos de áudio do Chess.com ou do Lichess**.

O pacote inclui efeitos de movimento, captura, seleção, roque, promoção, notificação e encerramento. Os movimentos e as capturas usam variações alternadas para não repetir sempre a mesma gravação.

## Licença e código-fonte

Os arquivos de áudio gerados e o código-fonte correspondente estão sob **GNU GPL-3.0-or-later**. Leia [LICENSE.txt](LICENSE.txt).

O código-fonte usado para gerar os arquivos está incluído em [source/synth_chess_sounds.py](source/synth_chess_sounds.py) e [source/fitted_params.py](source/fitted_params.py). O gerador usa a biblioteca padrão do Python. O FFmpeg pode ser usado para converter os WAVs em MP3.

Projeto de origem: [github.com/chessvault-app/chess-sounds-gen](https://github.com/chessvault-app/chess-sounds-gen).
