import type { EngineTransport, SearchInfo } from './types';

type Waiter = {
  predicate: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export class UciEngine {
  private waiters: Waiter[] = [];
  private started = false;
  private initialized = false;
  private disposers: Array<() => void> = [];
  private lastInfo: SearchInfo = {};
  private searchQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly transport: EngineTransport,
    private readonly onInfo: (info: SearchInfo) => void,
    private readonly onStatus: (status: string) => void
  ) {}

  async start() {
    if (this.initialized) {
      return;
    }

    if (!this.started) {
      this.disposers.push(this.transport.onLine((line) => this.handleLine(line)));
      this.disposers.push(this.transport.onStatus(this.onStatus));
      this.onStatus('starting');
      await this.transport.start();
      this.started = true;
    }

    this.send('uci');
    await this.waitFor((line) => line === 'uciok', 10_000);

    const cores = Math.max(1, Math.min(navigator.hardwareConcurrency || 1, 16));
    const hash = cores >= 8 ? 512 : cores >= 4 ? 256 : 96;
    this.send(`setoption name Threads value ${cores}`);
    this.send(`setoption name Hash value ${hash}`);
    this.send('isready');
    await this.waitFor((line) => line === 'readyok', 10_000);

    this.initialized = true;
    this.onStatus('ready');
  }

  async newGame() {
    await this.start();
    await this.waitForIdleSearch();
    this.send('ucinewgame');
    this.send('isready');
    await this.waitFor((line) => line === 'readyok', 10_000);
  }

  async bestMove(fen: string, movetimeMs: number) {
    const search = this.searchQueue.catch(() => undefined).then(() => this.runBestMove(fen, movetimeMs));
    this.searchQueue = search.catch(() => undefined);
    return search;
  }

  stopSearch() {
    this.send('stop');
  }

  dispose() {
    for (const dispose of this.disposers) {
      dispose();
    }
    this.disposers = [];
    this.transport.stop();
  }

  private async runBestMove(fen: string, movetimeMs: number) {
    await this.start();
    this.lastInfo = {};
    this.onStatus('thinking');

    this.send(`position fen ${fen}`);
    const bestMove = this.waitFor((line) => line.startsWith('bestmove '), Math.max(15_000, movetimeMs + 10_000));
    this.send(`go movetime ${Math.max(50, Math.round(movetimeMs))}`);

    const line = await bestMove;
    this.onStatus('ready');

    const move = line.split(/\s+/)[1];
    if (!move || move === '(none)') {
      throw new Error('Stockfish did not return a playable move');
    }

    return move;
  }

  private waitForIdleSearch() {
    return this.searchQueue.catch(() => undefined);
  }

  private send(command: string) {
    this.transport.send(command);
  }

  private handleLine(rawLine: string) {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    this.resolveWaiters(line);
    if (line.startsWith('info ')) {
      this.lastInfo = {
        ...this.lastInfo,
        ...parseInfo(line)
      };
      this.onInfo(this.lastInfo);
    }
  }

  private waitFor(predicate: (line: string) => boolean, timeoutMs: number) {
    return new Promise<string>((resolve, reject) => {
      const waiter: Waiter = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.waiters = this.waiters.filter((item) => item !== waiter);
          reject(new Error('Timed out waiting for Stockfish'));
        }, timeoutMs)
      };

      this.waiters.push(waiter);
    });
  }

  private resolveWaiters(line: string) {
    for (const waiter of [...this.waiters]) {
      if (!waiter.predicate(line)) {
        continue;
      }

      clearTimeout(waiter.timeout);
      this.waiters = this.waiters.filter((item) => item !== waiter);
      waiter.resolve(line);
    }
  }
}

function parseInfo(line: string): SearchInfo {
  const depth = line.match(/\bdepth\s+(\d+)/);
  const selDepth = line.match(/\bseldepth\s+(\d+)/);
  const nps = line.match(/\bnps\s+(\d+)/);
  const scoreCp = line.match(/\bscore\s+cp\s+(-?\d+)/);
  const scoreMate = line.match(/\bscore\s+mate\s+(-?\d+)/);
  const pv = line.match(/\bpv\s+(.+)$/);

  return {
    depth: depth ? Number(depth[1]) : undefined,
    selDepth: selDepth ? Number(selDepth[1]) : undefined,
    nps: nps ? Number(nps[1]) : undefined,
    score: scoreMate ? `M${scoreMate[1]}` : scoreCp ? `${(Number(scoreCp[1]) / 100).toFixed(2)}` : undefined,
    pv: pv?.[1]
  };
}
