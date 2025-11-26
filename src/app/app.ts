import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ExchangeConnection } from './components/exchange-connection/exchange-connection';
import { PortfolioDashboard } from './components/portfolio-dashboard/portfolio-dashboard';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ExchangeConnection, PortfolioDashboard],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'Crypto Tracker';
}
