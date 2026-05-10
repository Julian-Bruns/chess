const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stockfish', {
  start: () => ipcRenderer.invoke('stockfish:start'),
  write: (command) => ipcRenderer.invoke('stockfish:write', command),
  stop: () => ipcRenderer.invoke('stockfish:stop'),
  checkForUpdate: () => ipcRenderer.invoke('stockfish:checkForUpdate'),
  onLine: (callback) => {
    const listener = (_event, line) => callback(line);
    ipcRenderer.on('stockfish:line', listener);
    return () => ipcRenderer.removeListener('stockfish:line', listener);
  },
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('stockfish:status', listener);
    return () => ipcRenderer.removeListener('stockfish:status', listener);
  }
});

contextBridge.exposeInMainWorld('chessfish', {
  updateEverything: () => ipcRenderer.invoke('app:updateEverything')
});
