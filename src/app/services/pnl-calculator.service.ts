import { Injectable } from '@angular/core';
import { 
  Transaction, 
  Position, 
  RealizedPnL, 
  PortfolioSummary 
} from '../models/crypto.models';

interface AssetPosition {
  amounts: number[];
  costs: number[];
  totalAmount: number;
  totalCost: number;
}

@Injectable({
  providedIn: 'root'
})
export class PnlCalculatorService {

  constructor() { }

  /**
   * Calcule le P&L et le coût de revient pour toutes les transactions
   * Utilise la méthode FIFO (First In, First Out)
   */
  calculatePortfolio(transactions: Transaction[], currentPrices: Map<string, number>): PortfolioSummary {
    // Groupe les transactions par asset
    const assetTransactions = this.groupTransactionsByAsset(transactions);
    
    const positions: Position[] = [];
    const realizedPnLByAsset: RealizedPnL[] = [];
    
    let totalInvested = 0;
    let currentValue = 0;
    let totalUnrealizedPnL = 0;
    let totalRealizedPnL = 0;

    // Calcule pour chaque asset
    for (const [symbol, assetTxs] of assetTransactions) {
      const result = this.calculateAssetPnL(symbol, assetTxs, currentPrices);
      
      if (result.position && result.position.totalAmount > 0) {
        positions.push(result.position);
        totalInvested += result.position.totalInvested;
        currentValue += result.position.currentValue;
        totalUnrealizedPnL += result.position.unrealizedPnL;
      }
      
      if (result.realized) {
        realizedPnLByAsset.push(result.realized);
        totalRealizedPnL += result.realized.totalRealized;
      }
    }

    const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
      totalInvested,
      currentValue,
      totalUnrealizedPnL,
      totalRealizedPnL,
      totalPnL,
      totalPnLPercent,
      positions,
      realizedPnLByAsset
    };
  }

  /**
   * Calcule le P&L pour un asset spécifique
   */
  private calculateAssetPnL(
    symbol: string, 
    transactions: Transaction[], 
    currentPrices: Map<string, number>
  ): { position?: Position; realized?: RealizedPnL } {
    
    const asset = this.extractBaseAsset(symbol);
    const fifoQueue: Array<{ amount: number; cost: number; price: number }> = [];
    
    let totalRealizedPnL = 0;
    let totalSold = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    const realizedTransactions: Transaction[] = [];

    // Traite chaque transaction selon FIFO
    for (const tx of transactions) {
      if (tx.type === 'buy') {
        // Achat: ajoute à la queue FIFO
        const totalCostWithFee = tx.cost + tx.fee.cost;
        fifoQueue.push({
          amount: tx.amount,
          cost: totalCostWithFee,
          price: tx.price
        });
      } else if (tx.type === 'sell') {
        // Vente: retire de la queue FIFO et calcule le P&L
        let remainingToSell = tx.amount;
        let sellRevenue = tx.cost - tx.fee.cost;
        let costBasis = 0;

        while (remainingToSell > 0 && fifoQueue.length > 0) {
          const oldest = fifoQueue[0];
          
          if (oldest.amount <= remainingToSell) {
            // Vend tout le lot
            costBasis += oldest.cost;
            remainingToSell -= oldest.amount;
            fifoQueue.shift();
          } else {
            // Vend une partie du lot
            const ratio = remainingToSell / oldest.amount;
            costBasis += oldest.cost * ratio;
            oldest.amount -= remainingToSell;
            oldest.cost -= oldest.cost * ratio;
            remainingToSell = 0;
          }
        }

        const pnl = sellRevenue - costBasis;
        totalRealizedPnL += pnl;
        totalSold += tx.amount;
        
        if (pnl > 0) {
          totalProfit += pnl;
        } else {
          totalLoss += Math.abs(pnl);
        }
        
        realizedTransactions.push(tx);
      }
    }

    // Calcule la position actuelle (non réalisée)
    let totalAmount = 0;
    let totalInvested = 0;
    
    for (const item of fifoQueue) {
      totalAmount += item.amount;
      totalInvested += item.cost;
    }

    const averageCost = totalAmount > 0 ? totalInvested / totalAmount : 0;
    const currentPrice = currentPrices.get(symbol) || 0;
    const currentValue = totalAmount * currentPrice;
    const unrealizedPnL = currentValue - totalInvested;
    const unrealizedPnLPercent = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;

    const position: Position | undefined = totalAmount > 0 ? {
      symbol,
      asset,
      totalAmount,
      averageCost,
      totalInvested,
      currentPrice,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPercent
    } : undefined;

    const realized: RealizedPnL | undefined = totalRealizedPnL !== 0 ? {
      symbol,
      asset,
      totalRealized: totalRealizedPnL,
      totalSold,
      totalProfit,
      totalLoss,
      profitPercent: totalSold > 0 ? (totalRealizedPnL / (totalSold * averageCost || 1)) * 100 : 0,
      transactions: realizedTransactions
    } : undefined;

    return { position, realized };
  }

  /**
   * Groupe les transactions par asset
   */
  private groupTransactionsByAsset(transactions: Transaction[]): Map<string, Transaction[]> {
    const grouped = new Map<string, Transaction[]>();
    
    for (const tx of transactions) {
      if (!grouped.has(tx.symbol)) {
        grouped.set(tx.symbol, []);
      }
      grouped.get(tx.symbol)!.push(tx);
    }
    
    return grouped;
  }

  /**
   * Extrait l'asset de base du symbole (ex: BTC/USDT -> BTC)
   */
  private extractBaseAsset(symbol: string): string {
    return symbol.split('/')[0];
  }

  /**
   * Calcule le coût de revient moyen pondéré (alternative à FIFO)
   */
  calculateAverageCost(transactions: Transaction[]): number {
    let totalAmount = 0;
    let totalCost = 0;

    for (const tx of transactions) {
      if (tx.type === 'buy') {
        totalAmount += tx.amount;
        totalCost += tx.cost + tx.fee.cost;
      } else if (tx.type === 'sell') {
        // Pour le coût moyen, on retire proportionnellement
        const avgCost = totalAmount > 0 ? totalCost / totalAmount : 0;
        totalAmount -= tx.amount;
        totalCost -= tx.amount * avgCost;
      }
    }

    return totalAmount > 0 ? totalCost / totalAmount : 0;
  }
}
