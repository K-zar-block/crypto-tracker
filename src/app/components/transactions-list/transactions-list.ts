import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Transaction } from '../../models/crypto.models';

@Component({
  selector: 'app-transactions-list',
  imports: [CommonModule],
  templateUrl: './transactions-list.html',
  styleUrl: './transactions-list.scss',
})
export class TransactionsList {
  private _transactions: Transaction[] = [];

  @Input() 
  set transactions(value: Transaction[]) {
    // Trie du plus récent au plus ancien
    this._transactions = [...value].sort((a, b) => b.timestamp - a.timestamp);
  }
  
  get transactions(): Transaction[] {
    return this._transactions;
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('fr-FR');
  }

  formatNumber(value: number, decimals: number = 8): string {
    return value.toFixed(decimals);
  }

  /**
   * Convertit les frais en USD en estimant la valeur de la devise de frais
   */
  getFeeInUSD(transaction: Transaction): string {
    const feeCost = transaction.fee.cost;
    const feeCurrency = transaction.fee.currency;
    
    if (feeCost === 0) {
      return '$0.00';
    }
    
    // Si les frais sont déjà en USDT, USDC, BUSD, EUR (approximativement $)
    if (['USDT', 'USDC', 'BUSD', 'USD'].includes(feeCurrency)) {
      return `$${feeCost.toFixed(2)}`;
    }
    
    if (feeCurrency === 'EUR') {
      // 1 EUR ≈ 1.05 USD (taux approximatif)
      return `$${(feeCost * 1.05).toFixed(2)}`;
    }
    
    // Pour BTC: utilise le prix de la transaction
    if (feeCurrency === 'BTC') {
      const feeValueUSD = feeCost * transaction.price;
      return `$${feeValueUSD.toFixed(2)}`;
    }
    
    // Pour BNB: estimation à ~600$ (valeur moyenne historique)
    if (feeCurrency === 'BNB') {
      const bnbPrice = this.estimateBNBPrice(transaction.timestamp);
      return `$${(feeCost * bnbPrice).toFixed(2)}`;
    }
    
    // Pour les autres devises, affiche original
    return `${feeCost.toFixed(4)} ${feeCurrency}`;
  }

  /**
   * Estime le prix BNB en fonction de la date de la transaction
   */
  private estimateBNBPrice(timestamp: number): number {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    
    // Prix BNB approximatifs par année
    const bnbPrices: { [key: number]: number } = {
      2022: 300,
      2023: 250,
      2024: 600,
      2025: 650
    };
    
    return bnbPrices[year] || 500;
  }
}
