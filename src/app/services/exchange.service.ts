import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { 
  Transaction, 
  ExchangeCredentials, 
  ExchangeBalance 
} from '../models/crypto.models';

@Injectable({
  providedIn: 'root'
})
export class ExchangeService {
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  public transactions$ = this.transactionsSubject.asObservable();

  private electronAPI = (window as any).electronAPI;

  constructor() {
    // Vérifier si l'API Electron est disponible
    console.log('Window object:', window);
    console.log('ElectronAPI available:', !!this.electronAPI);
    console.log('ElectronAPI object:', this.electronAPI);
    
    if (!this.electronAPI) {
      console.error('Electron API not available. Running in browser mode.');
      console.error('Available window properties:', Object.keys(window));
    } else {
      console.log('Electron API successfully loaded!');
    }
  }

  /**
   * Connecte à un exchange avec les credentials fournis
   */
  async connectToExchange(credentials: ExchangeCredentials): Promise<boolean> {
    try {
      console.log('connectToExchange called with:', credentials.name);
      
      if (!this.electronAPI) {
        throw new Error('Electron API not available');
      }

      console.log('Calling electronAPI.exchangeConnect...');
      const result = await this.electronAPI.exchangeConnect(credentials);
      console.log('Result from exchangeConnect:', result);
      
      if (result.success) {
        console.log('✅ Connection successful! Setting isConnected to true');
        this.isConnectedSubject.next(true);
        console.log('Current isConnected value:', this.isConnectedSubject.value);
        return true;
      } else {
        console.error('❌ Connection failed:', result.error);
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error: any) {
      console.error('Erreur de connexion à l\'exchange:', error);
      this.isConnectedSubject.next(false);
      throw error;
    }
  }

  /**
   * Déconnecte de l'exchange
   */
  async disconnect(): Promise<void> {
    if (this.electronAPI) {
      await this.electronAPI.exchangeDisconnect();
    }
    this.isConnectedSubject.next(false);
    this.transactionsSubject.next([]);
  }

  /**
   * Récupère toutes les transactions (trades) de l'exchange
   */
  async fetchAllTrades(symbol?: string, since?: number, limit?: number): Promise<Transaction[]> {
    console.log('fetchAllTrades called with:', { symbol, since, limit });
    
    if (!this.electronAPI) {
      throw new Error('Electron API not available');
    }

    try {
      // Par défaut, récupère les transactions des 5 dernières années
      if (!since) {
        const fiveYearsAgo = Date.now() - (5 * 365 * 24 * 60 * 60 * 1000);
        since = fiveYearsAgo;
        console.log('Setting since to 5 years ago:', new Date(since));
      }
      
      console.log('Calling electronAPI.exchangeFetchTrades...');
      const result = await this.electronAPI.exchangeFetchTrades({ symbol, since, limit });
      console.log('Result from exchangeFetchTrades:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch trades');
      }

      const allTrades = result.data || [];
      console.log(`Received ${allTrades.length} trades from API`);

      // Convertit les trades au format de notre application
      const transactions: Transaction[] = allTrades.map((trade: any) => ({
        id: trade.id,
        timestamp: trade.timestamp,
        datetime: trade.datetime,
        symbol: trade.symbol,
        type: trade.side === 'buy' ? 'buy' : 'sell',
        side: trade.side,
        price: trade.price,
        amount: trade.amount,
        cost: trade.cost,
        fee: {
          cost: trade.fee?.cost || 0,
          currency: trade.fee?.currency || 'USDT'
        },
        exchange: trade.exchange || 'unknown',
        orderId: trade.order
      }));

      console.log('🔔 Emitting transactions to transactionsSubject:', transactions.length);
      this.transactionsSubject.next(transactions);
      console.log('✅ Transactions emitted successfully');
      return transactions;
    } catch (error) {
      console.error('Erreur lors de la récupération des transactions:', error);
      throw error;
    }
  }

  /**
   * Récupère les transactions de manière progressive avec mises à jour en temps réel
   */
  async fetchAllTradesProgressive(onProgress?: (data: { symbol: string; trades: any[]; total: number; progress: number }) => void): Promise<Transaction[]> {
    console.log('fetchAllTradesProgressive called');
    
    if (!this.electronAPI) {
      throw new Error('Electron API not available');
    }

    try {
      const fiveYearsAgo = Date.now() - (5 * 365 * 24 * 60 * 60 * 1000);
      const allTransactions: Transaction[] = [];
      
      // Callback pour les mises à jour progressives
      const progressCallback = (progressData: any) => {
        console.log(`📊 Progress: ${progressData.progress}% - ${progressData.symbol}: ${progressData.trades.length} trades`);
        
        // Convertit et ajoute les nouveaux trades
        const newTransactions: Transaction[] = progressData.trades.map((trade: any) => ({
          id: trade.id,
          timestamp: trade.timestamp,
          datetime: trade.datetime,
          symbol: trade.symbol,
          type: trade.side === 'buy' ? 'buy' : 'sell',
          side: trade.side,
          price: trade.price,
          amount: trade.amount,
          cost: trade.cost,
          fee: {
            cost: trade.fee?.cost || 0,
            currency: trade.fee?.currency || 'USDT'
          },
          exchange: trade.exchange || 'unknown',
          orderId: trade.order
        }));
        
        allTransactions.push(...newTransactions);
        
        // Émet les transactions au fur et à mesure
        this.transactionsSubject.next([...allTransactions]);
        
        // Callback externe
        if (onProgress) {
          onProgress(progressData);
        }
      };
      
      const result = await this.electronAPI.exchangeFetchTradesProgressive(
        { since: fiveYearsAgo, limit: 1000 },
        progressCallback
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch trades');
      }

      console.log(`✅ Total ${allTransactions.length} transactions loaded progressively`);
      return allTransactions;
    } catch (error) {
      console.error('Erreur lors de la récupération progressive:', error);
      throw error;
    }
  }

  /**
   * Récupère les balances de l'exchange
   */
  async fetchBalances(): Promise<ExchangeBalance[]> {
    if (!this.electronAPI) {
      throw new Error('Electron API not available');
    }

    try {
      const result = await this.electronAPI.exchangeFetchBalances();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch balances');
      }

      return result.data || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des balances:', error);
      throw error;
    }
  }

  /**
   * Récupère le prix actuel d'un symbole
   */
  async fetchCurrentPrice(symbol: string): Promise<number> {
    if (!this.electronAPI) {
      throw new Error('Electron API not available');
    }

    try {
      console.log(`Fetching current price for ${symbol}...`);
      const result = await this.electronAPI.exchangeFetchPrice(symbol);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch price');
      }

      console.log(`Current price for ${symbol}: ${result.data}`);
      return result.data || 0;
    } catch (error) {
      console.error(`Erreur lors de la récupération du prix pour ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les exchanges disponibles
   */
  async getAvailableExchanges(): Promise<string[]> {
    if (!this.electronAPI) {
      return ['binance', 'coinbase', 'kraken', 'bybit', 'okx'];
    }
    
    const result = await this.electronAPI.exchangeGetAvailable();
    return result.data || [];
  }
}
