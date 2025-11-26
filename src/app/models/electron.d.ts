export interface ElectronAPI {
  exchangeConnect: (credentials: any) => Promise<{ success: boolean; error?: string }>;
  exchangeDisconnect: () => Promise<{ success: boolean }>;
  exchangeFetchTrades: (params: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  exchangeFetchTradesProgressive: (params: any, callback: (data: any) => void) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  exchangeFetchBalances: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  exchangeFetchPrice: (symbol: string) => Promise<{ success: boolean; data?: number; error?: string }>;
  exchangeGetAvailable: () => Promise<{ success: boolean; data?: string[] }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
