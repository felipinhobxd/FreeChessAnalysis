# Áudio do tabuleiro

Este diretório contém os efeitos padrão extraídos de `assets/default/` do repositório [Orivoir/scraping-sound-effects-chess.com](https://github.com/Orivoir/scraping-sound-effects-chess.com/tree/main/assets/default), integrados ao Livro de Lances com autorização para uso neste projeto.

## Mapeamento dos arquivos

| Arquivo | Evento |
| --- | --- |
| `move-self.mp3` | Movimento do lado que está na parte inferior do tabuleiro |
| `move-opponent.mp3` | Movimento do lado oposto |
| `capture.mp3` | Captura de peça |
| `move-check.mp3` | Lance que dá xeque |
| `castle.mp3` | Roque pequeno ou grande |
| `promote.mp3` | Promoção de peão |
| `premove.mp3` | Pré-movimento, disponível para fluxos que o utilizem |
| `illegal.mp3` | Tentativa de lance ilegal |
| `game-start.mp3` | Início/carregamento de uma partida |
| `game-end.mp3` | Fim de partida, empate ou xeque-mate |
| `drawoffer.mp3` | Oferta de empate |
| `tenseconds.mp3` | Aviso de dez segundos no relógio |

## Implementação

A aplicação carrega cada efeito sob demanda e mantém uma única instância de áudio por arquivo. O volume é controlado centralmente pelas configurações do tabuleiro. Os efeitos antigos em camadas e os arquivos Kenney foram removidos.

Os sons de pré-movimento, oferta de empate e contagem regressiva ficam disponíveis no mapeamento, mas só serão reproduzidos quando a interface oferecer esses eventos.
