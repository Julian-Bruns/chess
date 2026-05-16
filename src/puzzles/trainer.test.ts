import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { puzzleBank } from './puzzleBank';
import { createPuzzleTrainerState, preparePuzzle, recordPuzzleAttempt, recordPuzzleServed, selectNextPuzzle } from './trainer';

describe('puzzle trainer', () => {
  it('serves legal Lichess puzzle lines from the player position', () => {
    for (const puzzle of puzzleBank) {
      const prepared = preparePuzzle(puzzle);
      const game = new Chess(prepared.startFen);

      for (const uci of prepared.solutionMoves) {
        const move = game.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.slice(4, 5) || undefined
        });
        expect(move, `${puzzle.id} ${uci}`).toBeTruthy();
      }
    }
  });

  it('moves puzzle rating up for a solve and down for a miss', () => {
    const state = createPuzzleTrainerState(1200, 1);
    const puzzle = selectNextPuzzle(state);
    const served = recordPuzzleServed(state, puzzle);
    const solved = recordPuzzleAttempt(served, puzzle, true);
    const missed = recordPuzzleAttempt(served, puzzle, false);

    expect(solved.rating).toBeGreaterThan(served.rating);
    expect(missed.rating).toBeLessThan(served.rating);
  });
});
