import { Capacitor, registerPlugin } from '@capacitor/core';

export type UpdateStatus = 'opened' | 'updated' | 'current' | 'unavailable' | 'error';

export type UpdateResult = {
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

type NativeUpdaterPlugin = {
  updateEverything(): Promise<UpdateResult>;
};

const NativeUpdater = registerPlugin<NativeUpdaterPlugin>('StockfishEngine');

export async function updateEverything(): Promise<UpdateResult> {
  if (window.chessfish?.updateEverything) {
    return window.chessfish.updateEverything();
  }

  if (Capacitor.getPlatform() !== 'web') {
    return NativeUpdater.updateEverything();
  }

  return {
    status: 'unavailable',
    message: 'Updates are available in the macOS and Android apps.'
  };
}
