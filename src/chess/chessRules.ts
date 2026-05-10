import { Chess, type Move, type Square } from 'chess.js';

export type BoardMove = {
  from: Square;
  to: Square;
  promotion?: 'q' | 'r' | 'b' | 'n';
};

export function legalMovesFor(game: Chess, square: Square) {
  return game.moves({ square, verbose: true }) as Move[];
}

export function promotionChoicesFor(game: Chess, from: Square, to: Square) {
  return legalMovesFor(game, from)
    .filter((move) => move.to === to && move.promotion)
    .map((move) => move.promotion)
    .filter((promotion, index, promotions) => promotion && promotions.indexOf(promotion) === index) as Array<'q' | 'r' | 'b' | 'n'>;
}

export function applyMove(fen: string, move: BoardMove) {
  const next = new Chess(fen);
  const played = next.move(move);

  if (!played) {
    throw new Error(`Illegal move ${move.from}${move.to}`);
  }

  return {
    fen: next.fen(),
    move: played
  };
}

export function applyUciMove(fen: string, uci: string) {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.slice(4, 5) as BoardMove['promotion'];

  return applyMove(fen, {
    from,
    to,
    promotion: promotion || undefined
  });
}

export function squareName(fileIndex: number, rankIndex: number) {
  const files = 'abcdefgh';
  return `${files[fileIndex]}${8 - rankIndex}` as Square;
}
