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

  /**
   * Convertit le coût total en USD
   */
  getCostInUSD(transaction: Transaction): string {
    const cost = transaction.cost;
    const symbol = transaction.symbol; // Ex: "BTC/USDT", "ETH/BTC"
    const quoteCurrency = symbol.split('/')[1]; // La devise de cotation (USDT, BTC, EUR, etc.)

    // Si la devise de cotation est déjà un stablecoin USD
    if (['USDT', 'USDC', 'BUSD', 'USD'].includes(quoteCurrency)) {
      return `$${cost.toFixed(2)}`;
    }

    // Si c'est en EUR
    if (quoteCurrency === 'EUR') {
      return `$${(cost * 1.05).toFixed(2)}`; // 1 EUR ≈ 1.05 USD
    }

    // Si c'est en BTC, utilise le prix BTC de la transaction
    if (quoteCurrency === 'BTC') {
      // Pour une paire X/BTC, le cost est en BTC
      // Il faut le convertir en USD en multipliant par le prix du BTC
      // On estime le prix BTC historique
      const btcPrice = this.estimateBTCPrice(transaction.timestamp);
      return `$${(cost * btcPrice).toFixed(2)}`;
    }

    // Si c'est en ETH
    if (quoteCurrency === 'ETH') {
      const ethPrice = this.estimateETHPrice(transaction.timestamp);
      return `$${(cost * ethPrice).toFixed(2)}`;
    }

    // Si c'est en BNB
    if (quoteCurrency === 'BNB') {
      const bnbPrice = this.estimateBNBPrice(transaction.timestamp);
      return `$${(cost * bnbPrice).toFixed(2)}`;
    }

    // Par défaut, affiche avec la devise d'origine
    return `${cost.toFixed(2)} ${quoteCurrency}`;
  }

  /**
   * Estime le prix BTC en fonction de la date
   */
  private estimateBTCPrice(timestamp: number): number {
    const date = new Date(timestamp);
    const year = date.getFullYear();

    const btcPrices: { [key: number]: number } = {
      2020: 10000,
      2021: 45000,
      2022: 20000,
      2023: 30000,
      2024: 65000,
      2025: 95000
    };

    return btcPrices[year] || 50000;
  }

  /**
   * Estime le prix ETH en fonction de la date
   */
  private estimateETHPrice(timestamp: number): number {
    const date = new Date(timestamp);
    const year = date.getFullYear();

    const ethPrices: { [key: number]: number } = {
      2020: 400,
      2021: 3000,
      2022: 1500,
      2023: 2000,
      2024: 3500,
      2025: 3800
    };

    return ethPrices[year] || 2500;
  }
}
