import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeService } from '../../services/exchange.service';
import { PnlCalculatorService } from '../../services/pnl-calculator.service';
import { PortfolioSummary, Transaction } from '../../models/crypto.models';
import { PnlSummary } from '../pnl-summary/pnl-summary';
import { TransactionsList } from '../transactions-list/transactions-list';

@Component({
  selector: 'app-portfolio-dashboard',
  imports: [CommonModule, FormsModule, PnlSummary, TransactionsList],
  templateUrl: './portfolio-dashboard.html',
  styleUrl: './portfolio-dashboard.scss',
})
export class PortfolioDashboard implements OnInit {
  isLoading = false;
  portfolio?: PortfolioSummary;
  transactions: Transaction[] = [];
  allTransactions: Transaction[] = [];
  isConnected = false;
  errorMessage = '';
  startDateFilter: string = '';
  todayDate: string = '';

  constructor(
    private exchangeService: ExchangeService,
    private pnlCalculator: PnlCalculatorService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    // Initialise la date d'aujourd'hui pour le max du date picker
    const today = new Date();
    this.todayDate = today.toISOString().split('T')[0];
  }

  ngOnInit() {
    this.exchangeService.isConnected$.subscribe(connected => {
      this.ngZone.run(() => {
        this.isConnected = connected;
        if (!connected) {
          this.portfolio = undefined;
          this.transactions = [];
        }
        this.cdr.detectChanges();
      });
    });

    this.exchangeService.transactions$.subscribe(transactions => {
      console.log('🔔 transactions$ emitted:', transactions.length, 'transactions');
      this.ngZone.run(() => {
        // Stocke toutes les transactions
        this.allTransactions = transactions;
        // Applique le filtre de date
        this.applyDateFilter();
        console.log('Component transactions updated to:', this.transactions.length);
        if (this.transactions.length > 0) {
          console.log('Calculating portfolio...');
          this.calculatePortfolio();
        }
        this.cdr.detectChanges();
        console.log('🔄 Change detection triggered for transactions');
      });
    });
  }

  async onLoadTransactions() {
    console.log('🔘 onLoadTransactions button clicked');
    this.ngZone.run(() => {
      this.isLoading = true;
      this.errorMessage = '';
      console.log('isLoading set to true');
    });

    try {
      console.log('Calling exchangeService.fetchAllTradesProgressive...');
      
      // Utilise la version progressive avec callback
      await this.exchangeService.fetchAllTradesProgressive((progressData) => {
        this.ngZone.run(() => {
          // Les transactions sont déjà émises par le service, on affiche juste la progression
          console.log(`📊 ${progressData.progress}% - Total: ${progressData.total} transactions`);
        });
      });
      
      console.log(`✅ Toutes les transactions ont été chargées`);
    } catch (error: any) {
      console.error('❌ Error loading transactions:', error);
      this.ngZone.run(() => {
        this.errorMessage = error.message || 'Erreur lors du chargement des transactions';
      });
    } finally {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.isLoading = false;
          console.log('isLoading set to false');
        });
      });
    }
  }

  /**
   * Applique le filtre de date sur les transactions
   */
  private applyDateFilter() {
    if (!this.startDateFilter) {
      // Pas de filtre, affiche toutes les transactions
      this.transactions = this.allTransactions;
    } else {
      // Filtre les transactions à partir de la date sélectionnée
      const filterTimestamp = new Date(this.startDateFilter).getTime();
      this.transactions = this.allTransactions.filter(tx => tx.timestamp >= filterTimestamp);
      console.log(`Filtered to ${this.transactions.length} transactions from ${this.startDateFilter}`);
    }
  }

  /**
   * Appelé quand l'utilisateur change la date
   */
  onDateFilterChange() {
    console.log('Date filter changed to:', this.startDateFilter);
    this.applyDateFilter();
    if (this.transactions.length > 0) {
      this.calculatePortfolio();
    } else {
      this.portfolio = undefined;
    }
  }

  /**
   * Réinitialise le filtre de date
   */
  resetDateFilter() {
    this.startDateFilter = '';
    this.applyDateFilter();
    if (this.transactions.length > 0) {
      this.calculatePortfolio();
    }
  }

  private async calculatePortfolio() {
    try {
      // Récupère les prix actuels pour tous les symboles uniques
      const symbols = [...new Set(this.transactions.map(t => t.symbol))];
      const currentPrices = new Map<string, number>();

      for (const symbol of symbols) {
        try {
          const price = await this.exchangeService.fetchCurrentPrice(symbol);
          currentPrices.set(symbol, price);
        } catch (error) {
          console.warn(`Impossible de récupérer le prix pour ${symbol}`);
          currentPrices.set(symbol, 0);
        }
      }

      // Calcule le portfolio
      this.portfolio = this.pnlCalculator.calculatePortfolio(this.transactions, currentPrices);
    } catch (error) {
      console.error('Erreur lors du calcul du portfolio:', error);
    }
  }
}
