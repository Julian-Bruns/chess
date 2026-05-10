import { Capacitor, registerPlugin } from '@capacitor/core';
import type { EngineTransport } from './types';

type NativeLine = {
  line: string;
};

type NativeStatus = {
  status: string;
};

type NativeStockfishPlugin = {
  start(): Promise<void>;
  write(options: { command: string }): Promise<void>;
  stop(): Promise<void>;
  checkForUpdate?(): Promise<{ updated: boolean; releaseTag?: string; message?: string }>;
  addListener(eventName: 'line', callback: (event: NativeLine) => void): Promise<{ remove(): Promise<void> }>;
  addListener(eventName: 'status', callback: (event: NativeStatus) => void): Promise<{ remove(): Promise<void> }>;
};

const NativeStockfish = registerPlugin<NativeStockfishPlugin>('StockfishEngine');

class ElectronTransport implements EngineTransport {
  async start() {
    await window.stockfish?.checkForUpdate();
    await window.stockfish?.start();
  }

  send(command: string) {
    return window.stockfish?.write(command);
  }

  stop() {
    return window.stockfish?.stop();
  }

  onLine(callback: (line: string) => void) {
    return window.stockfish?.onLine(callback) ?? (() => undefined);
  }

  onStatus(callback: (status: string) => void) {
    return window.stockfish?.onStatus(callback) ?? (() => undefined);
  }
}

class CapacitorTransport implements EngineTransport {
  private lineRemovers: Array<() => void> = [];
  private statusRemovers: Array<() => void> = [];

  async start() {
    await NativeStockfish.checkForUpdate?.();
    await NativeStockfish.start();
  }

  send(command: string) {
    return NativeStockfish.write({ command });
  }

  stop() {
    return NativeStockfish.stop();
  }

  onLine(callback: (line: string) => void) {
    let active = true;
    NativeStockfish.addListener('line', (event) => {
      if (active) {
        callback(event.line);
      }
    }).then((handle) => {
      this.lineRemovers.push(() => void handle.remove());
    });

    return () => {
      active = false;
      const remover = this.lineRemovers.pop();
      remover?.();
    };
  }

  onStatus(callback: (status: string) => void) {
    let active = true;
    NativeStockfish.addListener('status', (event) => {
      if (active) {
        callback(event.status);
      }
    }).then((handle) => {
      this.statusRemovers.push(() => void handle.remove());
    });

    return () => {
      active = false;
      const remover = this.statusRemovers.pop();
      remover?.();
    };
  }
}

export function createEngineTransport(): EngineTransport | null {
  if (window.stockfish) {
    return new ElectronTransport();
  }

  if (Capacitor.getPlatform() !== 'web') {
    return new CapacitorTransport();
  }

  return null;
}
