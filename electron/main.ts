import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as ccxt from 'ccxt';

let mainWindow: BrowserWindow | null;
let exchangeInstance: any = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../src/assets/icon.png')
  });

  // En développement, charge depuis le serveur Angular
  // En production, charge depuis les fichiers compilés
  const isDev = process.argv.includes('--dev');
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '../dist/crypto-tracker/browser/index.html'),
        protocol: 'file:',
        slashes: true
      })
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup IPC handlers pour les appels API
function setupIpcHandlers() {
  // Connexion à l'exchange
  ipcMain.handle('exchange:connect', async (event, credentials) => {
    try {
      const ExchangeClass = (ccxt as any)[credentials.name.toLowerCase()];
      if (!ExchangeClass) {
        throw new Error(`Exchange ${credentials.name} not supported`);
      }

      exchangeInstance = new ExchangeClass({
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret,
        password: credentials.password,
        enableRateLimit: true,
        options: {
          defaultType: 'spot'
        }
      });

      if (credentials.testnet) {
        exchangeInstance.setSandboxMode(true);
      }

      // Test de connexion - utilise loadMarkets() qui fonctionne pour tous les exchanges
      // Cette méthode ne nécessite pas de permissions spéciales contrairement à fetchBalance()
      await exchangeInstance.loadMarkets();

      // Optionnel: tente fetchBalance() pour validation supplémentaire
      // Mais ignore l'erreur si les permissions ne sont pas suffisantes (cas Kraken)
      try {
        await exchangeInstance.fetchBalance();
      } catch (balanceError: any) {
        console.log('Balance check skipped (permissions may be limited):', balanceError.message);
        // Continue quand même - les API keys sont valides même sans permission de balance
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Déconnexion
  ipcMain.handle('exchange:disconnect', async () => {
    exchangeInstance = null;
    return { success: true };
  });

  // Récupérer toutes les transactions
  ipcMain.handle('exchange:fetchTrades', async (event, params) => {
    console.log('📥 IPC handler exchange:fetchTrades called with:', params);

    if (!exchangeInstance) {
      console.log('❌ No exchange instance connected');
      return { success: false, error: 'Not connected to any exchange' };
    }

    try {
      const { symbol, since, limit } = params;
      const exchangeName = exchangeInstance.id.toLowerCase();
      console.log(`Fetching trades for exchange: ${exchangeName}, symbol: ${symbol || 'all'}`);
      let allTrades: any[] = [];

      if (symbol) {
        console.log(`Fetching trades for specific symbol: ${symbol} since ${since ? new Date(since) : 'beginning'}`);
        const trades = await exchangeInstance.fetchMyTrades(symbol, since, limit);
        allTrades = trades;
        console.log(`Found ${trades.length} trades for ${symbol}`);
      } else {
        // Stratégie différente selon l'exchange
        if (exchangeName === 'kraken') {
          console.log('Using Kraken symbol-based approach...');

          // Récupère les marchés
          const markets = await exchangeInstance.loadMarkets();
          const marketSymbols = Object.keys(markets);

          // Liste des cryptos populaires pour Kraken
          const popularAssets = [
            'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK',
            'UNI', 'ATOM', 'LTC', 'XLM', 'ALGO', 'FIL', 'TRX', 'ETC',
            'AAVE', 'SAND', 'MANA', 'NEAR', 'FLOW', 'FTM',
            'XTZ', 'CHZ', 'ENJ', 'CRV', 'ZIL', 'BAT',
            'COMP', 'SUSHI', 'YFI', 'SNX', 'MKR', 'WAVES', 'DOGE', 'SHIB'
          ];

          const quoteCurrencies = ['USD', 'EUR', 'USDT', 'USDC', 'BTC', 'ETH'];

          // Construire toutes les paires possibles
          const symbolsToCheck: string[] = [];
          for (const asset of popularAssets) {
            for (const quote of quoteCurrencies) {
              if (asset === quote) continue;

              const symbol = `${asset}/${quote}`;
              if (marketSymbols.includes(symbol) && !symbolsToCheck.includes(symbol)) {
                symbolsToCheck.push(symbol);
              }
            }
          }

          console.log(`Fetching Kraken trades for ${symbolsToCheck.length} symbols...`);

          // Récupère les trades pour chaque symbole
          for (let i = 0; i < symbolsToCheck.length; i++) {
            const sym = symbolsToCheck[i];
            try {
              const trades = await exchangeInstance.fetchMyTrades(sym, since, undefined);
              if (trades.length > 0) {
                allTrades = allTrades.concat(trades);
                console.log(`[${i+1}/${symbolsToCheck.length}] ${sym}: ${trades.length} trades (total: ${allTrades.length})`);
              }
            } catch (err: any) {
              // Ignorer les erreurs silencieusement (paires sans trades)
            }

            // Pause pour éviter les rate limits
            if ((i + 1) % 10 === 0) {
              console.log(`Progress: ${i+1}/${symbolsToCheck.length} symbols checked...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          console.log(`✅ Total Kraken trades collected: ${allTrades.length}`);
        } else {
          // Binance et autres: essaie fetchMyTrades sans symbole
          console.log('Attempting to fetch all trades without symbol filter...');
          try {
            // Certains exchanges permettent de récupérer tous les trades d'un coup
            const trades = await exchangeInstance.fetchMyTrades(undefined, since, limit || 1000);
            allTrades = trades;
            console.log(`Found ${trades.length} total trades`);
          } catch (error: any) {
            console.log('fetchMyTrades without symbol failed, trying comprehensive approach:', error.message);

            // Récupère les marchés
            const markets = await exchangeInstance.loadMarkets();
            const marketSymbols = Object.keys(markets);

            // Liste complète des cryptos populaires à vérifier (historique complet)
            const popularAssets = [
              'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK',
              'UNI', 'ATOM', 'LTC', 'XLM', 'ALGO', 'VET', 'FIL', 'TRX', 'ETC', 'THETA',
              'AAVE', 'SAND', 'MANA', 'AXS', 'EGLD', 'NEAR', 'FLOW', 'ICP', 'FTM', 'HBAR',
              'XTZ', 'ONE', 'GALA', 'CHZ', 'ENJ', 'ROSE', 'LRC', 'CRV', 'ZIL', 'BAT',
              'COMP', 'SUSHI', 'YFI', 'SNX', 'MKR', 'RUNE', 'WAVES', 'DOGE', 'SHIB', 'APE'
            ];

            const quoteCurrencies = ['USDT', 'BUSD', 'EUR', 'USDC', 'BTC', 'ETH', 'BNB'];

            // Construire toutes les paires possibles
            const symbolsToCheck: string[] = [];
            for (const asset of popularAssets) {
              for (const quote of quoteCurrencies) {
                if (asset === quote) continue;

                const symbol = `${asset}/${quote}`;
                if (marketSymbols.includes(symbol) && !symbolsToCheck.includes(symbol)) {
                  symbolsToCheck.push(symbol);
                }
              }
            }

            console.log(`Fetching trades for ${symbolsToCheck.length} symbols (comprehensive scan)...`);

            // Récupère les trades pour chaque symbole
            for (let i = 0; i < symbolsToCheck.length; i++) {
              const sym = symbolsToCheck[i];
              try {
                const trades = await exchangeInstance.fetchMyTrades(sym, since, limit);
                if (trades.length > 0) {
                  allTrades = allTrades.concat(trades);
                  console.log(`[${i+1}/${symbolsToCheck.length}] ${sym}: ${trades.length} trades (total: ${allTrades.length})`);
                }
              } catch (err: any) {
                // Ignorer les erreurs silencieusement (paires sans trades)
              }

              // Pause pour éviter les rate limits
              if ((i + 1) % 10 === 0) {
                console.log(`Progress: ${i+1}/${symbolsToCheck.length} symbols checked...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            console.log(`✅ Total trades collected: ${allTrades.length}`);
          }
        }
      }

      // Tri par date (du plus récent au plus ancien)
      allTrades.sort((a, b) => b.timestamp - a.timestamp);
      
      return { success: true, data: allTrades };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Récupérer les balances
  ipcMain.handle('exchange:fetchBalances', async () => {
    if (!exchangeInstance) {
      return { success: false, error: 'Not connected to any exchange' };
    }

    try {
      const balance = await exchangeInstance.fetchBalance();
      const balances: any[] = [];

      for (const [asset, amounts] of Object.entries(balance.total)) {
        if (typeof amounts === 'number' && amounts > 0) {
          balances.push({
            asset,
            free: balance.free[asset] || 0,
            used: balance.used[asset] || 0,
            total: amounts
          });
        }
      }

      return { success: true, data: balances };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Récupérer le prix actuel
  ipcMain.handle('exchange:fetchPrice', async (event, symbol) => {
    if (!exchangeInstance) {
      return { success: false, error: 'Not connected to any exchange' };
    }

    try {
      console.log(`📊 Fetching ticker for ${symbol}...`);
      const ticker = await exchangeInstance.fetchTicker(symbol);
      console.log(`📊 Ticker for ${symbol}:`, { 
        last: ticker.last, 
        bid: ticker.bid,
        ask: ticker.ask,
        close: ticker.close,
        timestamp: new Date(ticker.timestamp).toISOString(),
        symbol: ticker.symbol 
      });
      
      // Utilise le prix le plus récent disponible (last, close, ou moyenne bid/ask)
      const price = ticker.last || ticker.close || ((ticker.bid + ticker.ask) / 2);
      console.log(`📊 Using price: ${price}`);
      
      return { success: true, data: price };
    } catch (error: any) {
      console.error(`❌ Error fetching price for ${symbol}:`, error.message);
      return { success: false, error: error.message };
    }
  });

  // Liste des exchanges disponibles
  ipcMain.handle('exchange:getAvailable', async () => {
    return { success: true, data: ccxt.exchanges };
  });

  // Récupérer les trades de manière progressive (avec callback)
  ipcMain.handle('exchange:fetchTradesProgressive', async (event, params) => {
    console.log('📥 IPC handler exchange:fetchTradesProgressive called');

    if (!exchangeInstance) {
      return { success: false, error: 'Not connected to any exchange' };
    }

    try {
      const { since, limit } = params;
      const allTrades: any[] = [];
      const exchangeName = exchangeInstance.id.toLowerCase();

      // Stratégie différente selon l'exchange
      if (exchangeName === 'kraken') {
        console.log('Using Kraken symbol-based approach for progressive fetch...');

        const markets = await exchangeInstance.loadMarkets();
        const marketSymbols = Object.keys(markets);

        const popularAssets = [
          'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK',
          'UNI', 'ATOM', 'LTC', 'XLM', 'ALGO', 'FIL', 'TRX', 'ETC',
          'AAVE', 'SAND', 'MANA', 'NEAR', 'FLOW', 'FTM',
          'XTZ', 'CHZ', 'ENJ', 'CRV', 'ZIL', 'BAT',
          'COMP', 'SUSHI', 'YFI', 'SNX', 'MKR', 'WAVES', 'DOGE', 'SHIB'
        ];

        const quoteCurrencies = ['USD', 'EUR', 'USDT', 'USDC', 'BTC', 'ETH'];

        const symbolsToCheck: string[] = [];
        for (const asset of popularAssets) {
          for (const quote of quoteCurrencies) {
            if (asset === quote) continue;

            const symbol = `${asset}/${quote}`;
            if (marketSymbols.includes(symbol) && !symbolsToCheck.includes(symbol)) {
              symbolsToCheck.push(symbol);
            }
          }
        }

        console.log(`Fetching Kraken trades for ${symbolsToCheck.length} symbols...`);

        for (let i = 0; i < symbolsToCheck.length; i++) {
          const sym = symbolsToCheck[i];
          try {
            console.log(`[${i+1}/${symbolsToCheck.length}] Checking ${sym}...`);
            const trades = await exchangeInstance.fetchMyTrades(sym, since, undefined);
            if (trades.length > 0) {
              allTrades.push(...trades);
              console.log(`✓ [${i+1}/${symbolsToCheck.length}] ${sym}: ${trades.length} trades (total: ${allTrades.length})`);
              // Envoie une mise à jour progressive
              event.sender.send('exchange:tradesProgress', {
                symbol: sym,
                trades: trades,
                total: allTrades.length,
                progress: Math.round((i + 1) / symbolsToCheck.length * 100)
              });
            }
          } catch (err: any) {
            console.log(`✗ [${i+1}/${symbolsToCheck.length}] ${sym}: ${err.message || 'error'}`);
          }

          if (i % 5 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } else {
        // Binance et autres: scan par symboles
        const markets = await exchangeInstance.loadMarkets();
        const marketSymbols = Object.keys(markets);

        const popularAssets = [
          'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK',
          'UNI', 'ATOM', 'LTC', 'XLM', 'ALGO', 'VET', 'FIL', 'TRX', 'ETC', 'THETA',
          'AAVE', 'SAND', 'MANA', 'AXS', 'EGLD', 'NEAR', 'FLOW', 'ICP', 'FTM', 'HBAR',
          'XTZ', 'ONE', 'GALA', 'CHZ', 'ENJ', 'ROSE', 'LRC', 'CRV', 'ZIL', 'BAT',
          'COMP', 'SUSHI', 'YFI', 'SNX', 'MKR', 'RUNE', 'WAVES', 'DOGE', 'SHIB', 'APE'
        ];

        const quoteCurrencies = ['USDT', 'BUSD', 'EUR', 'USDC', 'BTC', 'ETH', 'BNB'];

        const symbolsToCheck: string[] = [];
        for (const asset of popularAssets) {
          for (const quote of quoteCurrencies) {
            if (asset === quote) continue;

            const symbol = `${asset}/${quote}`;
            if (marketSymbols.includes(symbol) && !symbolsToCheck.includes(symbol)) {
              symbolsToCheck.push(symbol);
            }
          }
        }

        // Récupère progressivement
        for (let i = 0; i < symbolsToCheck.length; i++) {
          const sym = symbolsToCheck[i];
          try {
            const trades = await exchangeInstance.fetchMyTrades(sym, since, limit);
            if (trades.length > 0) {
              allTrades.push(...trades);
              // Envoie une mise à jour progressive
              event.sender.send('exchange:tradesProgress', {
                symbol: sym,
                trades: trades,
                total: allTrades.length,
                progress: Math.round((i + 1) / symbolsToCheck.length * 100)
              });
            }
          } catch (err) {
            // Ignorer les erreurs
          }

          if (i % 5 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      // Tri par date (du plus récent au plus ancien)
      allTrades.sort((a, b) => b.timestamp - a.timestamp);
      return { success: true, data: allTrades };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

app.on('ready', () => {
  createWindow();
  setupIpcHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
