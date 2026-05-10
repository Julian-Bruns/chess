export {};

type UpdateStatus = 'opened' | 'updated' | 'current' | 'unavailable' | 'error';

type UpdateResult = {
  status: UpdateStatus;
  message: string;
  releaseTag?: string;
  path?: string;
  engineUpdate?: {
    updated: boolean;
    releaseTag?: string;
    message?: string;
  };
  appUpdate?: {
    status: UpdateStatus;
    message: string;
    releaseTag?: string;
    path?: string;
  };
};

declare global {
  interface Window {
    chessfish?: {
      updateEverything(): Promise<UpdateResult>;
    };
    stockfish?: {
      start(): Promise<{ path?: string; releaseTag?: string }>;
      write(command: string): Promise<void>;
      stop(): Promise<void>;
      checkForUpdate(): Promise<{
        updated: boolean;
        releaseTag?: string;
        message?: string;
      }>;
      onLine(callback: (line: string) => void): () => void;
      onStatus(callback: (status: string) => void): () => void;
    };
  }
}
