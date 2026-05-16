import { Chess, type Color, type Square } from 'chess.js';
import { applyUciMove, type BoardMove } from '../chess/chessRules';
import { puzzleBank, type Puzzle } from './puzzleBank';

export type PuzzleRecord = {
  attempts: number;
  correct: number;
  wrong: number;
  leitnerBox: number;
  dueAfterAttempt: number;
  lastSeenIndex: number;
};

export type ThemeStat = {
  attempts: number;
  correct: number;
};

export type PuzzleTrainerState = {
  rating: number;
  startedRating: number;
  attempted: number;
  solved: number;
  missed: number;
  streak: number;
  puzzleIndex: number;
  recentIds: string[];
  records: Record<string, PuzzleRecord>;
  themeStats: Record<string, ThemeStat>;
  seed: number;
};

export type PreparedPuzzle = {
  puzzle: Puzzle;
  startFen: string;
  sideToMove: Color;
  solutionMoves: string[];
};

const minPuzzleRating = Math.min(...puzzleBank.map((puzzle) => puzzle.rating));
const maxPuzzleRating = Math.max(...puzzleBank.map((puzzle) => puzzle.rating));
const reviewGapsByBox = [3, 6, 14, 30, 60];
const recentLimit = 10;
const noiseWeight = 0.28;

export function normalizePuzzleRating(rating: number) {
  if (!Number.isFinite(rating)) {
    return 1200;
  }

  return Math.round(Math.max(minPuzzleRating, Math.min(maxPuzzleRating, rating)));
}

export function createPuzzleTrainerState(startingRating: number, seed = Date.now()): PuzzleTrainerState {
  const rating = normalizePuzzleRating(startingRating);

  return {
    rating,
    startedRating: rating,
    attempted: 0,
    solved: 0,
    missed: 0,
    streak: 0,
    puzzleIndex: 0,
    recentIds: [],
    records: {},
    themeStats: {},
    seed: seed >>> 0
  };
}

export function selectNextPuzzle(state: PuzzleTrainerState) {
  const review = selectReviewPuzzle(state);
  if (review) {
    return review;
  }

  const targetRating = normalizePuzzleRating(state.rating + Math.min(100, state.streak * 22));
  const candidates = candidatesNear(targetRating, state.recentIds);
  const recentThemes = recentTrainingThemes(state);

  return candidates.reduce((best, puzzle) => {
    const score = selectionScore(puzzle, targetRating, state, recentThemes);
    const bestScore = selectionScore(best, targetRating, state, recentThemes);
    return score > bestScore ? puzzle : best;
  }, candidates[0]);
}

export function recordPuzzleServed(state: PuzzleTrainerState, puzzle: Puzzle): PuzzleTrainerState {
  return {
    ...state,
    puzzleIndex: state.puzzleIndex + 1,
    recentIds: [puzzle.id, ...state.recentIds.filter((id) => id !== puzzle.id)].slice(0, recentLimit)
  };
}

export function recordPuzzleAttempt(state: PuzzleTrainerState, puzzle: Puzzle, solved: boolean): PuzzleTrainerState {
  const expected = expectedSolveRate(state.rating, puzzle.rating);
  const kFactor = state.attempted < 15 ? 42 : 28;
  const delta = Math.round(kFactor * ((solved ? 1 : 0) - expected));
  const nextAttempted = state.attempted + 1;
  const previousRecord = state.records[puzzle.id] ?? {
    attempts: 0,
    correct: 0,
    wrong: 0,
    leitnerBox: 0,
    dueAfterAttempt: 0,
    lastSeenIndex: -1
  };
  const nextBox = solved ? Math.min(reviewGapsByBox.length - 1, previousRecord.leitnerBox + 1) : 0;
  const dueAfterAttempt = nextAttempted + reviewGapsByBox[nextBox];

  const nextRecord: PuzzleRecord = {
    attempts: previousRecord.attempts + 1,
    correct: previousRecord.correct + (solved ? 1 : 0),
    wrong: previousRecord.wrong + (solved ? 0 : 1),
    leitnerBox: nextBox,
    dueAfterAttempt,
    lastSeenIndex: state.puzzleIndex
  };

  return {
    ...state,
    rating: normalizePuzzleRating(state.rating + delta),
    attempted: nextAttempted,
    solved: state.solved + (solved ? 1 : 0),
    missed: state.missed + (solved ? 0 : 1),
    streak: solved ? state.streak + 1 : 0,
    records: {
      ...state.records,
      [puzzle.id]: nextRecord
    },
    themeStats: recordThemeStats(state.themeStats, puzzle, solved)
  };
}

export function preparePuzzle(puzzle: Puzzle): PreparedPuzzle {
  const lead = applyUciMove(puzzle.sourceFen, puzzle.moves[0]);
  const game = new Chess(lead.fen);

  return {
    puzzle,
    startFen: lead.fen,
    sideToMove: game.turn(),
    solutionMoves: puzzle.moves.slice(1)
  };
}

export function moveToUci(move: BoardMove) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

export function uciToSan(fen: string, uci: string) {
  const game = new Chess(fen);
  const move = game.move({
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.slice(4, 5) || undefined
  });

  return move?.san ?? uci;
}

export function formatPuzzleThemes(themes: string[]) {
  return trainingThemes(themes).map((theme) => theme.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
}

function selectReviewPuzzle(state: PuzzleTrainerState) {
  const lastFewIds = new Set(state.recentIds.slice(0, 3));
  const due = puzzleBank.filter((puzzle) => {
    const record = state.records[puzzle.id];
    return record && record.wrong > 0 && record.dueAfterAttempt <= state.attempted && !lastFewIds.has(puzzle.id);
  });

  if (due.length === 0) {
    return null;
  }

  return due.reduce((best, puzzle) => {
    const record = state.records[puzzle.id];
    const bestRecord = state.records[best.id];
    const score = (record?.wrong ?? 0) * 2 - (record?.correct ?? 0) - Math.abs(puzzle.rating - state.rating) / 300;
    const bestScore = (bestRecord?.wrong ?? 0) * 2 - (bestRecord?.correct ?? 0) - Math.abs(best.rating - state.rating) / 300;
    return score > bestScore ? puzzle : best;
  }, due[0]);
}

function candidatesNear(targetRating: number, recentIds: string[]) {
  const recent = new Set(recentIds);

  for (const window of [180, 260, 380, 560, 900]) {
    const candidates = puzzleBank.filter((puzzle) => Math.abs(puzzle.rating - targetRating) <= window && !recent.has(puzzle.id));
    if (candidates.length >= 8) {
      return candidates;
    }
  }

  return puzzleBank.filter((puzzle) => !recent.has(puzzle.id));
}

function selectionScore(puzzle: Puzzle, targetRating: number, state: PuzzleTrainerState, recentThemes: Set<string>) {
  const distance = Math.abs(puzzle.rating - targetRating);
  const closeness = 1 - Math.min(distance / 700, 1);
  const quality = puzzle.popularity / 100 + Math.min(Math.log10(Math.max(10, puzzle.plays)) / 4, 1) + (1 - Math.min(puzzle.ratingDeviation / 180, 1));
  const themes = trainingThemes(puzzle.themes);
  const themeNeed = Math.max(0, ...themes.map((theme) => weaknessBonus(state.themeStats[theme])));
  const repeatedThemePenalty = themes.filter((theme) => recentThemes.has(theme)).length * 0.08;
  const record = state.records[puzzle.id];
  const seenPenalty = record ? Math.min(0.7, record.attempts * 0.2) : 0;
  const noise = seededNoise(`${state.seed}:${state.puzzleIndex}:${puzzle.id}`) * noiseWeight;

  return closeness * 3 + quality + themeNeed + noise - repeatedThemePenalty - seenPenalty;
}

function recordThemeStats(themeStats: Record<string, ThemeStat>, puzzle: Puzzle, solved: boolean) {
  const next = { ...themeStats };

  for (const theme of trainingThemes(puzzle.themes)) {
    const existing = next[theme] ?? { attempts: 0, correct: 0 };
    next[theme] = {
      attempts: existing.attempts + 1,
      correct: existing.correct + (solved ? 1 : 0)
    };
  }

  return next;
}

function weaknessBonus(stat: ThemeStat | undefined) {
  if (!stat || stat.attempts < 2) {
    return 0.12;
  }

  const accuracy = stat.correct / stat.attempts;
  return Math.max(0, 0.65 - accuracy);
}

function recentTrainingThemes(state: PuzzleTrainerState) {
  const recent = new Set<string>();

  for (const id of state.recentIds.slice(0, 5)) {
    const puzzle = puzzleBank.find((item) => item.id === id);
    for (const theme of puzzle ? trainingThemes(puzzle.themes) : []) {
      recent.add(theme);
    }
  }

  return recent;
}

function trainingThemes(themes: string[]) {
  return themes.filter((theme) => !['short', 'long', 'opening', 'middlegame', 'endgame', 'master', 'masterVsMaster', 'superGM'].includes(theme));
}

function expectedSolveRate(playerRating: number, puzzleRating: number) {
  return 1 / (1 + 10 ** ((puzzleRating - playerRating) / 400));
}

function seededNoise(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}
