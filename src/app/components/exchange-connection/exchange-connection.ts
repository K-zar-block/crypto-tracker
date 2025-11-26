import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExchangeService } from '../../services/exchange.service';
import { ExchangeCredentials } from '../../models/crypto.models';

@Component({
  selector: 'app-exchange-connection',
  imports: [CommonModule, FormsModule],
  templateUrl: './exchange-connection.html',
  styleUrl: './exchange-connection.scss',
})
export class ExchangeConnection implements OnInit {
  credentials: ExchangeCredentials = {
    name: 'binance',
    apiKey: '',
    apiSecret: '',
    password: '',
    testnet: false
  };

  availableExchanges: string[] = [];
  isConnecting = false;
  isConnected = false;
  errorMessage = '';
  electronApiAvailable = false;

  constructor(
    private exchangeService: ExchangeService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    // Vérifier si l'API Electron est disponible
    this.electronApiAvailable = !!(window as any).electronAPI;
    console.log('Electron API available in component:', this.electronApiAvailable);
    
    if (!this.electronApiAvailable) {
      this.errorMessage = '⚠️ Application doit être lancée via Electron (npm run electron:dev)';
    }
    
    this.availableExchanges = await this.exchangeService.getAvailableExchanges();
    this.exchangeService.isConnected$.subscribe(connected => {
      console.log('🔔 isConnected$ emitted:', connected);
      // Forcer la détection de changement Angular
      this.ngZone.run(() => {
        this.isConnected = connected;
        console.log('Component isConnected updated to:', this.isConnected);
        this.cdr.detectChanges();
        console.log('🔄 Change detection triggered');
      });
    });
  }

  async onConnect() {
    console.log('🔘 onConnect button clicked');
    this.isConnecting = true;
    this.errorMessage = '';

    try {
      console.log('Calling exchangeService.connectToExchange...');
      const result = await this.exchangeService.connectToExchange(this.credentials);
      console.log('✅ connectToExchange returned:', result);
    } catch (error: any) {
      console.error('❌ Error in onConnect:', error);
      this.errorMessage = error.message || 'Erreur de connexion';
    } finally {
      // Utiliser setTimeout pour éviter ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.isConnecting = false;
        console.log('isConnecting set to false');
      });
    }
  }

  async onDisconnect() {
    await this.exchangeService.disconnect();
  }
}
