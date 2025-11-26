import { contextBridge, ipcRenderer } from 'electron';

console.log('🔧 Preload script starting...');

// Expose les fonctions IPC de manière sécurisée
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Exchange operations
    exchangeConnect: (credentials: any) => {
      console.log('📡 exchangeConnect called from renderer');
      return ipcRenderer.invoke('exchange:connect', credentials);
    },
    exchangeDisconnect: () => ipcRenderer.invoke('exchange:disconnect'),
    exchangeFetchTrades: async (params: any) => {
      console.log('📡 exchangeFetchTrades called from renderer with:', params);
      const result = await ipcRenderer.invoke('exchange:fetchTrades', params);
      console.log('📨 exchangeFetchTrades response:', result);
      return result;
    },
    exchangeFetchBalances: () => ipcRenderer.invoke('exchange:fetchBalances'),
    exchangeFetchPrice: (symbol: string) => ipcRenderer.invoke('exchange:fetchPrice', symbol),
    exchangeGetAvailable: () => ipcRenderer.invoke('exchange:getAvailable'),
    exchangeFetchTradesProgressive: (params: any, callback: (data: any) => void) => {
      // Écoute les mises à jour progressives
      ipcRenderer.on('exchange:tradesProgress', (_event, data) => callback(data));
      return ipcRenderer.invoke('exchange:fetchTradesProgressive', params);
    },
  });
  console.log('✅ electronAPI successfully exposed to window');
} catch (error) {
  console.error('❌ Error exposing electronAPI:', error);
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOMContentLoaded - Preload script loaded');
});
