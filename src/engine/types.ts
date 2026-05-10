export type EngineStatus = 'idle' | 'starting' | 'ready' | 'thinking' | 'unavailable' | 'error';

export type SearchInfo = {
  depth?: number;
  selDepth?: number;
  nps?: number;
  score?: string;
  pv?: string;
};

export type EngineTransport = {
  start(): Promise<void>;
  send(command: string): Promise<void> | void;
  stop(): Promise<void> | void;
  onLine(callback: (line: string) => void): () => void;
  onStatus(callback: (status: string) => void): () => void;
};
