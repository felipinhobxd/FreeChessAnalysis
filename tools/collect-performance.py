"""Collect CC0 rated, analyzed games from Lichess. Requires Python and zstandard."""
import argparse
import io
import json
import re
from contextlib import ExitStack
from urllib.request import urlopen
import zstandard

SOURCE = 'https://database.lichess.org/standard/lichess_db_standard_rated_2025-11.pgn.zst'
TAG = re.compile(r'^\[(\w+) "(.+)"\]$')
ANNOTATED = re.compile(r'(?:\d+\.(?:\.\.)?\s*)?([KQRBNOa-h][^\s{]*)\s*\{([^}]+)\}')
EVAL = re.compile(r'\[%eval ([^\]]+)\]')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('speed', choices=('rapid', 'blitz'))
    parser.add_argument('output')
    parser.add_argument('--count', type=int, default=3600)
    parser.add_argument('--archive', help='Optional local copy of the monthly .zst')
    args = parser.parse_args()
    headers = {}
    count = 0
    with ExitStack() as stack:
        source = stack.enter_context(open(args.archive, 'rb') if args.archive else urlopen(SOURCE))
        reader = stack.enter_context(zstandard.ZstdDecompressor().stream_reader(source, read_across_frames=True))
        lines = stack.enter_context(io.TextIOWrapper(reader, encoding='utf-8'))
        output = stack.enter_context(open(args.output, 'w', encoding='utf-8', newline='\n'))
        for line in lines:
            if line.startswith('[Event '):
                headers = {}
            tag = TAG.match(line.rstrip())
            if tag:
                headers[tag[1]] = tag[2]
                continue
            if not line.startswith('1. ') or 'rated ' + args.speed not in headers.get('Event', '').lower():
                continue
            if headers.get('Termination') != 'Normal' or 'BOT' in (headers.get('WhiteTitle'), headers.get('BlackTitle')):
                continue
            moves = []
            for move, note in ANNOTATED.findall(line):
                evaluation = EVAL.search(note)
                if not evaluation:
                    moves = []
                    break
                moves.append([move, evaluation[1]])
            if len(moves) < 30:
                continue
            row = [headers['White'], headers['Black'], int(headers['WhiteElo']), int(headers['BlackElo']),
                   headers['TimeControl'], moves, headers['Site']]
            output.write(json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n')
            count += 1
            if count == args.count:
                break
    if count < args.count:
        raise ValueError(f'Only {count} eligible games in the archive')


if __name__ == '__main__':
    main()
