import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createPuzzleTrainerState, preparePuzzle, selectNextPuzzle } from './puzzles/trainer';

describe('App controls', () => {
  afterEach(() => {
    delete window.stockfish;
    vi.restoreAllMocks();
  });

  it('keeps update and timing controls in the options menu', () => {
    const { container } = render(<App />);

    expect(screen.getByRole('button', { name: /options/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /update chessfish/i })).toBeNull();
    expect(container.querySelector('.eval-bar')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /options/i }));

    expect(screen.getByRole('button', { name: /install update/i })).toBeTruthy();
    expect(screen.getByLabelText(/time per stockfish move/i)).toBeTruthy();

    const evalToggle = screen.getByLabelText(/show evaluation bar/i) as HTMLInputElement;
    expect(evalToggle.checked).toBe(true);

    fireEvent.click(evalToggle);
    expect(container.querySelector('.eval-bar')).toBeNull();
  });

  it('records SAN moves and can jump through move history', () => {
    render(<App />);

    const backButton = screen.getByRole('button', { name: /go back one move/i }) as HTMLButtonElement;
    expect(backButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /white pawn on e2/i }));
    fireEvent.click(screen.getByRole('button', { name: 'e4' }));

    const moveHistory = screen.getByLabelText(/move history/i);
    const e4Move = within(moveHistory).getByRole('button', { name: 'e4' });
    expect(e4Move).toBeTruthy();
    expect(backButton.disabled).toBe(false);

    fireEvent.click(backButton);
    expect(screen.getByRole('button', { name: /white pawn on e2/i })).toBeTruthy();

    fireEvent.click(e4Move);
    expect(screen.getByRole('button', { name: /white pawn on e4/i })).toBeTruthy();
  });

  it('starts a puzzle session from the options menu with a chosen Elo', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /options/i }));

    const eloInput = screen.getByLabelText(/starting puzzle elo/i);
    fireEvent.change(eloInput, { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: /play puzzles/i }));

    expect(screen.getByLabelText(/puzzle trainer/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /stockfish game/i })).toBeTruthy();
    expect(container.querySelector('.eval-bar')).toBeNull();
  });

  it('accepts the expected puzzle line and enables the next puzzle action', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1);
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /options/i }));
    fireEvent.change(screen.getByLabelText(/starting puzzle elo/i), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: /play puzzles/i }));

    const selectedPuzzle = selectNextPuzzle(createPuzzleTrainerState(900, 1));
    const prepared = preparePuzzle(selectedPuzzle);
    for (let index = 0; index < prepared.solutionMoves.length; index += 2) {
      playUciMove(container, prepared.solutionMoves[index]);
    }

    expect(screen.getAllByText(/^Solved:/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /next puzzle/i })).toBeTruthy();
  });

  it('lets Stockfish answer a white move while the evaluation bar is enabled', async () => {
    const stockfish = new FakeStockfish();
    window.stockfish = stockfish;

    render(<App />);

    await waitFor(() => expect(stockfish.commands).toContain('ucinewgame'));

    fireEvent.click(screen.getByRole('button', { name: /white pawn on e2/i }));
    fireEvent.click(screen.getByRole('button', { name: 'e4' }));

    await screen.findByRole('button', { name: /black pawn on e5/i });

    expect(stockfish.commands.some((command) => command.startsWith('position fen') && command.includes(' b '))).toBe(true);
  });
});

function playUciMove(container: HTMLElement, uci: string) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  fireEvent.click(squareButton(container, from));
  fireEvent.click(squareButton(container, to));

  const promotion = uci.slice(4, 5);
  if (promotion) {
    fireEvent.click(screen.getByRole('button', { name: `Promote to ${promotionName(promotion)}` }));
  }
}

function squareButton(container: HTMLElement, square: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('.square')).find((item) => {
    const label = item.getAttribute('aria-label') ?? '';
    return label === square || label.endsWith(` on ${square}`);
  });

  expect(button, square).toBeTruthy();
  return button as HTMLButtonElement;
}

function promotionName(piece: string) {
  switch (piece) {
    case 'q':
      return 'queen';
    case 'r':
      return 'rook';
    case 'b':
      return 'bishop';
    case 'n':
      return 'knight';
    default:
      return piece;
  }
}

type LineCallback = (line: string) => void;
type StatusCallback = (status: string) => void;

class FakeStockfish {
  readonly commands: string[] = [];
  private readonly lineCallbacks = new Set<LineCallback>();
  private readonly statusCallbacks = new Set<StatusCallback>();
  private fen = '';
  private pendingSearch: number | null = null;

  async start() {
    this.emitStatus('ready');
    return {};
  }

  async write(command: string) {
    this.commands.push(command);

    if (command === 'uci') {
      queueMicrotask(() => this.emitLine('uciok'));
      return;
    }

    if (command === 'isready') {
      queueMicrotask(() => this.emitLine('readyok'));
      return;
    }

    if (command.startsWith('position fen ')) {
      this.fen = command.slice('position fen '.length);
      return;
    }

    if (command.startsWith('go movetime ')) {
      this.pendingSearch = window.setTimeout(() => {
        const move = this.fen.includes(' b ') ? 'e7e5' : 'g1f3';
        this.emitLine('info depth 1 score cp 20 nps 1000 pv ' + move);
        this.emitLine(`bestmove ${move}`);
        this.pendingSearch = null;
      }, 20);
    }
  }

  async stop() {
    if (this.pendingSearch === null) {
      return;
    }

    window.clearTimeout(this.pendingSearch);
    this.pendingSearch = null;
    this.emitLine('bestmove g1f3');
  }

  async checkForUpdate() {
    return {
      updated: false,
      message: 'You are up to date'
    };
  }

  onLine(callback: LineCallback) {
    this.lineCallbacks.add(callback);
    return () => this.lineCallbacks.delete(callback);
  }

  onStatus(callback: StatusCallback) {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  private emitLine(line: string) {
    for (const callback of this.lineCallbacks) {
      callback(line);
    }
  }

  private emitStatus(status: string) {
    for (const callback of this.statusCallbacks) {
      callback(status);
    }
  }
}
