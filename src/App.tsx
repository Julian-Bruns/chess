import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Download, EllipsisVertical, RotateCcw, Timer } from 'lucide-react';
import { applyMove, applyUciMove, legalMovesFor, promotionChoicesFor, squareName, type BoardMove } from './chess/chessRules';
import { createEngineTransport } from './engine/transport';
import { UciEngine } from './engine/uci';
import type { EngineStatus, SearchInfo } from './engine/types';
import { updateEverything, type UpdateResult } from './platform/updates';

type LastMove = {
  from: Square;
  to: Square;
};

type HistoryMove = LastMove & {
  san: string;
  color: Color;
  moveNumber: number;
};

type HistoryEntry = {
  fen: string;
  move?: HistoryMove;
};

type GameState = {
  entries: HistoryEntry[];
  index: number;
};

type SearchEvaluation = {
  fen: string;
  turn: Color;
  score: string;
};

type SearchContext = SearchEvaluation & {
  mode: 'move' | 'evaluation';
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
const evaluationMoveTimeMs = 350;

function createInitialGameState(): GameState {
  return {
    entries: [{ fen: startFen }],
    index: 0
  };
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [promotion, setPromotion] = useState<PromotionRequest | null>(null);
  const [moveTimeMs, setMoveTimeMs] = useState(1000);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [engineText, setEngineText] = useState('Stockfish');
  const [engineInfo, setEngineInfo] = useState<SearchInfo>({});
  const [evaluations, setEvaluations] = useState<Record<string, SearchEvaluation>>({});
  const [thinking, setThinking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);
  const [updateActionLabel, setUpdateActionLabel] = useState('Install update');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [showEvalBar, setShowEvalBar] = useState(true);

  const activeEntry = gameState.entries[gameState.index] ?? gameState.entries[0];
  const fen = activeEntry.fen;
  const game = useMemo(() => new Chess(fen), [fen]);
  const lastMove = activeEntry.move ? { from: activeEntry.move.from, to: activeEntry.move.to } : null;
  const activeEvaluation = evaluations[fen] ?? null;
  const atFirstMove = gameState.index === 0;
  const atLatestMove = gameState.index >= gameState.entries.length - 1;
  const engineRef = useRef<UciEngine | null>(null);
  const moveTimeRef = useRef(moveTimeMs);
  const searchSerial = useRef(0);
  const currentSearchRef = useRef<SearchContext | null>(null);

  useEffect(() => {
    moveTimeRef.current = moveTimeMs;
  }, [moveTimeMs]);

  useEffect(() => {
    if (!updateNotice || updating) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setUpdateNotice(null), 9000);
    return () => window.clearTimeout(timeout);
  }, [updateNotice, updating]);

  useEffect(() => {
    const transport = createEngineTransport();
    if (!transport) {
      setEngineStatus('unavailable');
      setEngineText('Stockfish bridge unavailable');
      return;
    }

    const engine = new UciEngine(
      transport,
      (info) => {
        setEngineInfo(info);

        const search = currentSearchRef.current;
        if (search && info.score) {
          const evaluation = {
            fen: search.fen,
            turn: search.turn,
            score: info.score
          };
          setEvaluations((current) => {
            const existing = current[search.fen];
            if (existing?.score === evaluation.score && existing.turn === evaluation.turn) {
              return current;
            }

            return {
              ...current,
              [search.fen]: evaluation
            };
          });
        }
      },
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

  const requestPositionEvaluation = useCallback(async (positionFen: string) => {
    if (!showEvalBar) {
      return;
    }

    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    const position = new Chess(positionFen);
    if (position.isGameOver()) {
      return;
    }

    const serial = searchSerial.current + 1;
    searchSerial.current = serial;
    currentSearchRef.current = {
      fen: positionFen,
      turn: position.turn(),
      score: '',
      mode: 'evaluation'
    };
    setAnalyzing(true);
    setEngineInfo({});

    try {
      await engine.bestMove(positionFen, evaluationMoveTimeMs);
      if (searchSerial.current === serial) {
        setEngineStatus('ready');
        setEngineText('ready');
      }
    } catch (error) {
      if (searchSerial.current === serial) {
        setEngineStatus('error');
        setEngineText(error instanceof Error ? error.message : 'Stockfish evaluation failed');
      }
    } finally {
      if (searchSerial.current === serial) {
        currentSearchRef.current = null;
        setAnalyzing(false);
      }
    }
  }, [showEvalBar]);

  useEffect(() => {
    if (!showEvalBar && currentSearchRef.current?.mode === 'evaluation') {
      searchSerial.current += 1;
      engineRef.current?.stopSearch();
      currentSearchRef.current = null;
      setAnalyzing(false);
      setEngineInfo({});
    }
  }, [showEvalBar]);

  useEffect(() => {
    if (
      !showEvalBar ||
      thinking ||
      analyzing ||
      engineStatus !== 'ready' ||
      activeEvaluation ||
      gameState.index === 0 ||
      game.isGameOver() ||
      game.turn() !== 'w'
    ) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void requestPositionEvaluation(fen);
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [activeEvaluation, analyzing, engineStatus, fen, game, gameState.index, requestPositionEvaluation, showEvalBar, thinking]);

  const requestEngineMove = useCallback(async (positionFen: string) => {
    const engine = engineRef.current;
    if (!engine) {
      setEngineStatus('unavailable');
      setEngineText('Stockfish bridge unavailable');
      return;
    }

    const serial = searchSerial.current + 1;
    searchSerial.current = serial;
    currentSearchRef.current = {
      fen: positionFen,
      turn: new Chess(positionFen).turn(),
      score: '',
      mode: 'move'
    };
    setThinking(true);
    setEngineInfo({});

    try {
      const bestMove = await engine.bestMove(positionFen, moveTimeRef.current);
      if (searchSerial.current !== serial) {
        return;
      }

      const applied = applyUciMove(positionFen, bestMove);
      const moveEntry = toHistoryMove(applied.move);
      setGameState((current) => {
        const latestIndex = current.entries.length - 1;
        const latestEntry = current.entries[latestIndex];

        if (searchSerial.current !== serial || current.index !== latestIndex || latestEntry?.fen !== positionFen) {
          return current;
        }

        const entries = [
          ...current.entries,
          {
            fen: applied.fen,
            move: moveEntry
          }
        ];

        return {
          entries,
          index: entries.length - 1
        };
      });
      setEngineStatus('ready');
      setEngineText('ready');
      setThinking(false);
      currentSearchRef.current = null;
    } catch (error) {
      if (searchSerial.current === serial) {
        setEngineStatus('error');
        setEngineText(error instanceof Error ? error.message : 'Stockfish move failed');
      }
    } finally {
      if (searchSerial.current === serial) {
        setThinking(false);
        currentSearchRef.current = null;
      }
    }
  }, []);

  const commitUserMove = useCallback((move: BoardMove) => {
    searchSerial.current += 1;
    engineRef.current?.stopSearch();
    currentSearchRef.current = null;
    setAnalyzing(false);
    setThinking(false);

    const applied = applyMove(fen, move);
    const nextGame = new Chess(applied.fen);
    const moveEntry = toHistoryMove(applied.move);
    setGameState((current) => {
      if (current.entries[current.index]?.fen !== fen) {
        return current;
      }

      const entries = current.entries.slice(0, current.index + 1);
      entries.push({
        fen: applied.fen,
        move: moveEntry
      });

      return {
        entries,
        index: entries.length - 1
      };
    });
    setPromotion(null);
    setEngineInfo({});
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
    currentSearchRef.current = null;
    engineRef.current?.newGame().catch((error: unknown) => {
      setEngineStatus('error');
      setEngineText(error instanceof Error ? error.message : 'Stockfish failed to reset');
    });
    setGameState(createInitialGameState());
    setPromotion(null);
    setEngineInfo({});
    setEvaluations({});
    setThinking(false);
    setAnalyzing(false);
    clearSelection();
  }, [clearSelection]);

  const goToHistoryIndex = useCallback((targetIndex: number) => {
    searchSerial.current += 1;
    engineRef.current?.stopSearch();
    currentSearchRef.current = null;
    setThinking(false);
    setAnalyzing(false);
    setPromotion(null);
    setEngineInfo({});
    clearSelection();

    setGameState((current) => {
      const index = Math.max(0, Math.min(targetIndex, current.entries.length - 1));
      return index === current.index ? current : { ...current, index };
    });
  }, [clearSelection]);

  const goBackMove = useCallback(() => {
    goToHistoryIndex(gameState.index - 1);
  }, [gameState.index, goToHistoryIndex]);

  const goForwardMove = useCallback(() => {
    goToHistoryIndex(gameState.index + 1);
  }, [gameState.index, goToHistoryIndex]);

  const handleUpdate = useCallback(async () => {
    if (updating) {
      return;
    }

    setUpdating(true);
    setUpdateNotice('Checking updates');
    setUpdateActionLabel('Checking updates');

    try {
      const result = await updateEverything();
      const message = result.status === 'current' ? 'You are up to date' : result.message;
      setUpdateNotice(message);
      setUpdateActionLabel(updateLabelForResult(result));
      setEngineText(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      setUpdateNotice(message);
      setUpdateActionLabel('Update failed');
      setEngineText(message);
    } finally {
      setUpdating(false);
    }
  }, [updating]);

  const status = getGameStatus(game, thinking, engineStatus, engineInfo);

  return (
    <main className="app-shell">
      <section className="control-bar" aria-label="Game controls">
        <div className="move-nav">
          <button
            className="icon-button"
            type="button"
            onClick={goBackMove}
            aria-label="Go back one move"
            title="Go back one move"
            disabled={atFirstMove}
          >
            <ChevronLeft size={21} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={goForwardMove}
            aria-label="Go forward one move"
            title="Go forward one move"
            disabled={atLatestMove}
          >
            <ChevronRight size={21} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <div className="top-actions">
          <button className="icon-button" type="button" onClick={resetGame} aria-label="New game" title="New game">
            <RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="options-menu">
            <button
              className="icon-button"
              type="button"
              onClick={() => setOptionsOpen((open) => !open)}
              aria-label="Options"
              aria-expanded={optionsOpen}
              aria-controls="options-panel"
              title="Options"
            >
              <EllipsisVertical size={20} strokeWidth={2.2} aria-hidden="true" />
            </button>
            {optionsOpen ? (
              <div className="options-panel" id="options-panel" aria-label="Options">
                <div className="menu-status" data-state={engineStatus} title={engineText}>
                  {formatEngineInfo(engineStatus, engineInfo)}
                </div>
                <button
                  className="menu-action"
                  type="button"
                  onClick={handleUpdate}
                  disabled={updating}
                  data-busy={updating || undefined}
                >
                  <Download size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{updateActionLabel}</span>
                </button>
                <label className="menu-slider">
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
                <label className="menu-toggle">
                  <span>
                    <ChartNoAxesColumn size={17} strokeWidth={2} aria-hidden="true" />
                    Evaluation bar
                  </span>
                  <input
                    type="checkbox"
                    checked={showEvalBar}
                    onChange={(event) => setShowEvalBar(event.currentTarget.checked)}
                    aria-label="Show evaluation bar"
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="board-stage" data-eval={showEvalBar || undefined} aria-label="Chess board">
        <div className="board-wrap">
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
        </div>
        {showEvalBar ? <EvaluationBar evaluation={activeEvaluation} /> : null}
      </section>

      <MoveHistory entries={gameState.entries} currentIndex={gameState.index} onSelect={goToHistoryIndex} />
      {updateNotice ? <div className="status-toast" role="status">{updateNotice}</div> : null}
      <div className="sr-only" aria-live="polite">{updateNotice ?? status}</div>
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

type MoveHistoryProps = {
  entries: HistoryEntry[];
  currentIndex: number;
  onSelect(index: number): void;
};

function MoveHistory({ entries, currentIndex, onSelect }: MoveHistoryProps) {
  const rows = buildMoveRows(entries);

  return (
    <section className="move-history" aria-label="Move history">
      <ol className="move-list">
        {rows.map((row) => (
          <li className="move-row" key={row.number}>
            <span className="move-number">{row.number}.</span>
            <MoveHistoryButton item={row.white} currentIndex={currentIndex} onSelect={onSelect} />
            <MoveHistoryButton item={row.black} currentIndex={currentIndex} onSelect={onSelect} />
          </li>
        ))}
      </ol>
    </section>
  );
}

type MoveListItem = {
  san: string;
  index: number;
};

type MoveRow = {
  number: number;
  white?: MoveListItem;
  black?: MoveListItem;
};

function MoveHistoryButton({
  item,
  currentIndex,
  onSelect
}: {
  item?: MoveListItem;
  currentIndex: number;
  onSelect(index: number): void;
}) {
  if (!item) {
    return <span className="move-placeholder" aria-hidden="true" />;
  }

  const isActive = currentIndex === item.index;
  return (
    <button
      className="move-chip"
      type="button"
      onClick={() => onSelect(item.index)}
      data-active={isActive || undefined}
      aria-current={isActive ? 'step' : undefined}
    >
      {item.san}
    </button>
  );
}

function EvaluationBar({ evaluation }: { evaluation: SearchEvaluation | null }) {
  const parsed = evaluation ? parseEvaluation(evaluation) : null;
  const whiteShare = parsed ? evaluationShare(parsed.whitePawns) : 50;
  const style = { '--white-share': `${whiteShare}%` } as CSSProperties;

  return (
    <aside className="eval-bar" style={style} aria-label={`Evaluation ${parsed?.label ?? '0.00'}`}>
      <div className="eval-black" aria-hidden="true" />
      <div className="eval-white" aria-hidden="true" />
      <span className="eval-label">{parsed?.label ?? '0.00'}</span>
    </aside>
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

function toHistoryMove(move: Move): HistoryMove {
  return {
    san: move.san,
    from: move.from,
    to: move.to,
    color: move.color,
    moveNumber: Number(move.before.split(/\s+/)[5] ?? '1') || 1
  };
}

function buildMoveRows(entries: HistoryEntry[]) {
  const rows: MoveRow[] = [];

  for (let index = 1; index < entries.length; index += 1) {
    const move = entries[index].move;
    if (!move) {
      continue;
    }

    let row = rows.find((item) => item.number === move.moveNumber);
    if (!row) {
      row = { number: move.moveNumber };
      rows.push(row);
    }

    const item = {
      san: move.san,
      index
    };

    if (move.color === 'w') {
      row.white = item;
    } else {
      row.black = item;
    }
  }

  return rows;
}

function parseEvaluation(evaluation: SearchEvaluation) {
  const rawScore = evaluation.score.trim();
  const mate = rawScore.match(/^M(-?\d+)$/);

  if (mate) {
    const sideMate = Number(mate[1]);
    const whiteMate = evaluation.turn === 'w' ? sideMate : -sideMate;
    return {
      whitePawns: whiteMate >= 0 ? 12 : -12,
      label: `${whiteMate >= 0 ? '+' : '-'}M${Math.abs(whiteMate)}`
    };
  }

  const sidePawns = Number(rawScore);
  if (!Number.isFinite(sidePawns)) {
    return null;
  }

  const whitePawns = evaluation.turn === 'w' ? sidePawns : -sidePawns;
  return {
    whitePawns,
    label: `${whitePawns >= 0 ? '+' : ''}${whitePawns.toFixed(2)}`
  };
}

function evaluationShare(whitePawns: number) {
  const bounded = 50 + Math.tanh(whitePawns / 4) * 45;
  return Math.max(5, Math.min(95, bounded));
}

function updateLabelForResult(result: UpdateResult) {
  if (result.status === 'current' || /\b(current|up to date|no updates?)\b/i.test(result.message)) {
    return 'You are up to date';
  }

  if (result.status === 'opened') {
    return 'Installer opened';
  }

  if (result.status === 'updated') {
    return 'Updated';
  }

  if (result.status === 'unavailable') {
    return 'Update unavailable';
  }

  return 'Install update';
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
