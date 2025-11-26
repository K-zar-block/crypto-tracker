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

      // Test de connexion
      await exchangeInstance.fetchBalance();
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
      console.log(`Fetching trades for symbol: ${symbol || 'all'}`);
      let allTrades: any[] = [];

      if (symbol) {
        console.log(`Fetching trades for specific symbol: ${symbol} since ${since ? new Date(since) : 'beginning'}`);
        const trades = await exchangeInstance.fetchMyTrades(symbol, since, limit);
        allTrades = trades;
        console.log(`Found ${trades.length} trades for ${symbol}`);
      } else {
        // Binance: utilise fetchMyTrades sans symbole pour récupérer TOUS les trades
        console.log('Attempting to fetch all trades without symbol filter...');
        try {
          // Certains exchanges permettent de récupérer tous les trades d'un coup
          const trades = await exchangeInstance.fetchMyTrades(undefined, since, limit || 1000);
          allTrades = trades;
          console.log(`Found ${trades.length} total trades`);
        } catch (error: any) {
          console.log('fetchMyTrades without symbol failed, trying optimized approach:', error.message);
          
          // Stratégie optimisée: Récupère d'abord les balances pour connaître les actifs
          const balance = await exchangeInstance.fetchBalance();
          const assets = Object.keys(balance.total).filter(asset => balance.total[asset] > 0);
          console.log(`Found ${assets.length} assets with balance:`, assets);
          
          // Récupère les marchés
          const markets = await exchangeInstance.loadMarkets();
          
          // Pour l'instant, uniquement BTC
          const symbolsToCheck = ['BTC/USDT', 'BTC/BUSD', 'BTC/EUR', 'BTC/USDC'];
          
          console.log(`Fetching trades for ${symbolsToCheck.length} symbols...`);

          // Récupère les trades pour chaque symbole pertinent
          for (let i = 0; i < symbolsToCheck.length; i++) {
            const sym = symbolsToCheck[i];
            try {
              const trades = await exchangeInstance.fetchMyTrades(sym, since, limit);
              if (trades.length > 0) {
                allTrades = allTrades.concat(trades);
                console.log(`[${i+1}/${symbolsToCheck.length}] ${sym}: ${trades.length} trades (total: ${allTrades.length})`);
              }
            } catch (err: any) {
              // Silencieusement ignorer les erreurs
            }
            
            // Pause pour éviter les rate limits (tous les 5 appels)
            if (i % 5 === 0 && i > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          console.log(`✅ Total trades collected: ${allTrades.length}`);
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
      
      // Récupère les balances
      const balance = await exchangeInstance.fetchBalance();
      const assets = Object.keys(balance.total).filter(asset => balance.total[asset] > 0);
      
      // Pour l'instant, uniquement BTC
      const symbolsToCheck = ['BTC/USDT', 'BTC/BUSD', 'BTC/EUR', 'BTC/USDC'];
      
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
