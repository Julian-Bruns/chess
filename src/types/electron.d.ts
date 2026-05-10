export {};

declare global {
  interface Window {
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
