# Código-fonte dos sons

Os arquivos desta pasta são o código-fonte correspondente do pacote de áudio distribuído no diretório pai.

Para regenerar os WAVs, mantenha `synth_chess_sounds.py` e `fitted_params.py` no mesmo diretório e execute:

```bash
python3 synth_chess_sounds.py
```

O gerador usa apenas a biblioteca padrão do Python. Para gerar também os MP3, instale FFmpeg e deixe o executável disponível no PATH. A licença está em `../LICENSE.txt`.
