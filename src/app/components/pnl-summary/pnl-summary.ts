import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioSummary } from '../../models/crypto.models';

@Component({
  selector: 'app-pnl-summary',
  imports: [CommonModule],
  templateUrl: './pnl-summary.html',
  styleUrl: './pnl-summary.scss',
})
export class PnlSummary {
  @Input() portfolio?: PortfolioSummary;

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  formatPercent(value: number): string {
    return value.toFixed(2) + '%';
  }

  formatNumber(value: number, decimals: number = 8): string {
    return value.toFixed(decimals);
  }
}
