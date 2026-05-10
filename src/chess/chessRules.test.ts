import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { applyMove, promotionChoicesFor } from './chessRules';

describe('chess move rules', () => {
  it('supports castling through legal move application', () => {
    const start = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const result = applyMove(start, { from: 'e1', to: 'g1' });
    const game = new Chess(result.fen);

    expect(game.get('g1')?.type).toBe('k');
    expect(game.get('f1')?.type).toBe('r');
  });

  it('supports en passant through legal move application', () => {
    const start = '8/8/8/4Pp2/8/8/8/k6K w - f6 0 1';
    const result = applyMove(start, { from: 'e5', to: 'f6' });
    const game = new Chess(result.fen);

    expect(game.get('f6')?.type).toBe('p');
    expect(game.get('f5')).toBeUndefined();
  });

  it('supports promotion choices and promotion moves', () => {
    const start = '8/P7/8/8/8/8/8/k6K w - - 0 1';
    const game = new Chess(start);

    expect(promotionChoicesFor(game, 'a7', 'a8')).toEqual(['n', 'b', 'r', 'q']);

    const result = applyMove(start, { from: 'a7', to: 'a8', promotion: 'q' });
    const promoted = new Chess(result.fen);

    expect(promoted.get('a8')?.type).toBe('q');
  });
});
