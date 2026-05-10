import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { Activity, RotateCcw, Timer } from 'lucide-react';
import { applyMove, applyUciMove, legalMovesFor, promotionChoicesFor, squareName, type BoardMove } from './chess/chessRules';
import { createEngineTransport } from './engine/transport';
import { UciEngine } from './engine/uci';
import type { EngineStatus, SearchInfo } from './engine/types';

type LastMove = {
  from: Square;
  to: Square;
};

type PromotionRequest = {
  from: Square;
  to: Square;
  choices: Array<'q' | 'r' | 'b' | 'n'>;
  color: Color;
};

const startFen = new Chess().fen();
const promotionOrder: Array<'q' | 'r' | 'b' | 'n'> = ['q', 'r', 'b', 'n'];
const assetBase = import.meta.env.BASE_URL;

export default function App() {
  const [fen, setFen] = useState(startFen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [promotion, setPromotion] = useState<PromotionRequest | null>(null);
  const [moveTimeMs, setMoveTimeMs] = useState(1000);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [engineText, setEngineText] = useState('Stockfish');
  const [engineInfo, setEngineInfo] = useState<SearchInfo>({});
  const [thinking, setThinking] = useState(false);

  const game = useMemo(() => new Chess(fen), [fen]);
  const engineRef = useRef<UciEngine | null>(null);
  const moveTimeRef = useRef(moveTimeMs);
  const searchSerial = useRef(0);

  useEffect(() => {
    moveTimeRef.current = moveTimeMs;
  }, [moveTimeMs]);

  useEffect(() => {
    const transport = createEngineTransport();
    if (!transport) {
      setEngineStatus('unavailable');
      setEngineText('Stockfish bridge unavailable');
      return;
    }

    const engine = new UciEngine(
      transport,
      setEngineInfo,
      (status) => {
        if (status === 'starting' || status === 'ready' || status === 'thinking') {
          setEngineStatus(status);
        }
        setEngineText(status);
      }
    );

    engineRef.current = engine;
    engine.newGame().catch((error: unknown) => {
      setEngineStatus('error');
      setEngineText(error instanceof Error ? error.message : 'Stockfish failed to start');
    });

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setLegalMoves([]);
  }, []);

  const requestEngineMove = useCallback(async (positionFen: string) => {
    const engine = engineRef.current;
    if (!engine) {
      setEngineStatus('unavailable');
      setEngineText('Stockfish bridge unavailable');
      return;
    }

    const serial = searchSerial.current + 1;
    searchSerial.current = serial;
    setThinking(true);
    setEngineInfo({});

    try {
      const bestMove = await engine.bestMove(positionFen, moveTimeRef.current);
      if (searchSerial.current !== serial) {
        return;
      }

      const applied = applyUciMove(positionFen, bestMove);
      setFen((current) => (current === positionFen ? applied.fen : current));
      setLastMove({ from: applied.move.from, to: applied.move.to });
      setEngineStatus('ready');
      setEngineText('ready');
    } catch (error) {
      if (searchSerial.current === serial) {
        setEngineStatus('error');
        setEngineText(error instanceof Error ? error.message : 'Stockfish move failed');
      }
    } finally {
      if (searchSerial.current === serial) {
        setThinking(false);
      }
    }
  }, []);

  const commitUserMove = useCallback((move: BoardMove) => {
    const applied = applyMove(fen, move);
    const nextGame = new Chess(applied.fen);
    setFen(applied.fen);
    setLastMove({ from: applied.move.from, to: applied.move.to });
    setPromotion(null);
    clearSelection();

    if (!nextGame.isGameOver()) {
      void requestEngineMove(applied.fen);
    }
  }, [clearSelection, fen, requestEngineMove]);

  const handleSquare = useCallback((square: Square) => {
    if (thinking || promotion || game.isGameOver() || game.turn() !== 'w') {
      return;
    }

    const piece = game.get(square);
    const canSelectOwnPiece = piece?.color === game.turn();

    if (!selected) {
      if (canSelectOwnPiece) {
        setSelected(square);
        setLegalMoves(legalMovesFor(game, square));
      }
      return;
    }

    const legalTarget = legalMoves.find((move) => move.to === square);
    if (legalTarget) {
      const choices = promotionChoicesFor(game, selected, square);
      if (choices.length > 0) {
        setPromotion({
          from: selected,
          to: square,
          choices: promotionOrder.filter((choice) => choices.includes(choice)),
          color: game.turn()
        });
        return;
      }

      commitUserMove({ from: selected, to: square });
      return;
    }

    if (canSelectOwnPiece) {
      setSelected(square);
      setLegalMoves(legalMovesFor(game, square));
    } else {
      clearSelection();
    }
  }, [clearSelection, commitUserMove, game, legalMoves, promotion, selected, thinking]);

  const resetGame = useCallback(() => {
    searchSerial.current += 1;
    engineRef.current?.stopSearch();
    engineRef.current?.newGame().catch((error: unknown) => {
      setEngineStatus('error');
      setEngineText(error instanceof Error ? error.message : 'Stockfish failed to reset');
    });
    setFen(startFen);
    setLastMove(null);
    setPromotion(null);
    setEngineInfo({});
    setThinking(false);
    clearSelection();
  }, [clearSelection]);

  const status = getGameStatus(game, thinking, engineStatus, engineInfo);

  return (
    <main className="app-shell">
      <section className="top-bar" aria-label="Game status">
        <div className="engine-pill" data-state={engineStatus}>
          <Activity size={17} strokeWidth={2} aria-hidden="true" />
          <span>{status}</span>
        </div>
        <button className="icon-button" type="button" onClick={resetGame} aria-label="New game" title="New game">
          <RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </section>

      <section className="board-wrap" aria-label="Chess board">
        <ChessBoard
          game={game}
          selected={selected}
          legalMoves={legalMoves}
          lastMove={lastMove}
          onSquare={handleSquare}
        />
        {promotion ? (
          <div className="promotion-menu" role="dialog" aria-label="Choose promotion">
            {promotion.choices.map((piece) => (
              <button
                key={piece}
                type="button"
                onClick={() => commitUserMove({ from: promotion.from, to: promotion.to, promotion: piece })}
                aria-label={`Promote to ${pieceName(piece)}`}
                title={`Promote to ${pieceName(piece)}`}
              >
                <img src={pieceIcon(promotion.color, piece)} alt="" draggable={false} />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="bottom-bar" aria-label="Engine timing">
        <label className="time-control">
          <span>
            <Timer size={17} strokeWidth={2} aria-hidden="true" />
            {formatTime(moveTimeMs)}
          </span>
          <input
            type="range"
            min="100"
            max="30000"
            step="100"
            value={moveTimeMs}
            onChange={(event) => setMoveTimeMs(Number(event.currentTarget.value))}
            aria-label="Time per Stockfish move"
          />
        </label>
        <div className="engine-meta" title={engineText}>
          {formatEngineInfo(engineStatus, engineInfo)}
        </div>
      </section>
    </main>
  );
}

type BoardProps = {
  game: Chess;
  selected: Square | null;
  legalMoves: Move[];
  lastMove: LastMove | null;
  onSquare(square: Square): void;
};

function ChessBoard({ game, selected, legalMoves, lastMove, onSquare }: BoardProps) {
  const legalTargets = new Set(legalMoves.map((move) => move.to));
  const captureTargets = new Set(legalMoves.filter((move) => move.captured).map((move) => move.to));

  return (
    <div className="board">
      {Array.from({ length: 8 }, (_, rankIndex) =>
        Array.from({ length: 8 }, (__, fileIndex) => {
          const square = squareName(fileIndex, rankIndex);
          const piece = game.get(square);
          const isSelected = selected === square;
          const isLegal = legalTargets.has(square);
          const isCapture = captureTargets.has(square);
          const isLastMove = lastMove?.from === square || lastMove?.to === square;
          const isDark = (fileIndex + rankIndex) % 2 === 1;

          return (
            <button
              key={square}
              type="button"
              className="square"
              data-dark={isDark}
              data-selected={isSelected || undefined}
              data-legal={isLegal || undefined}
              data-capture={isCapture || undefined}
              data-last={isLastMove || undefined}
              onClick={() => onSquare(square)}
              aria-label={piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${pieceName(piece.type)} on ${square}` : square}
            >
              {piece ? <img className="piece" src={pieceIcon(piece.color, piece.type)} alt="" draggable={false} /> : null}
            </button>
          );
        })
      )}
    </div>
  );
}

function pieceIcon(color: Color, piece: PieceSymbol) {
  return `${assetBase}pieces/${color}${piece.toUpperCase()}.svg`;
}

function pieceName(piece: PieceSymbol) {
  switch (piece) {
    case 'k':
      return 'king';
    case 'q':
      return 'queen';
    case 'r':
      return 'rook';
    case 'b':
      return 'bishop';
    case 'n':
      return 'knight';
    case 'p':
      return 'pawn';
  }
}

function formatTime(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function getGameStatus(game: Chess, thinking: boolean, engineStatus: EngineStatus, info: SearchInfo) {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? 'Checkmate' : 'Stockfish mated';
  }

  if (game.isDraw()) {
    return 'Draw';
  }

  if (thinking) {
    return info.depth ? `Stockfish d${info.depth}` : 'Stockfish';
  }

  if (engineStatus === 'unavailable') {
    return 'Engine unavailable';
  }

  if (engineStatus === 'error') {
    return 'Engine error';
  }

  return game.turn() === 'w' ? 'White to move' : 'Stockfish';
}

function formatEngineInfo(status: EngineStatus, info: SearchInfo) {
  if (status === 'unavailable') {
    return 'macOS/Android shell';
  }

  if (status === 'error') {
    return 'check engine';
  }

  const parts = [];
  if (info.depth) {
    parts.push(`d${info.depth}`);
  }
  if (info.score) {
    parts.push(info.score);
  }
  if (info.nps) {
    parts.push(`${Math.round(info.nps / 1000).toLocaleString()}k nps`);
  }

  return parts.length > 0 ? parts.join(' ') : status;
}
