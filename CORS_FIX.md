# Correction du problème CORS

## Problème
Les appels API depuis Angular vers les exchanges (Binance, etc.) étaient bloqués par la politique CORS car les requêtes étaient faites directement depuis le navigateur.

## Solution
Mise en place d'une architecture IPC (Inter-Process Communication) entre Angular et Electron :
- Les appels API sont maintenant exécutés dans le processus principal Electron (Node.js)
- Angular communique avec Electron via l'API `contextBridge`

## Modifications apportées

### 1. `electron/main.ts`
- Ajout de handlers IPC pour toutes les opérations exchange
- Import de CCXT côté Node.js
- Configuration de `contextIsolation: true` pour la sécurité

### 2. `electron/preload.ts`
- Exposition sécurisée de l'API via `contextBridge`
- Fonctions disponibles : connect, disconnect, fetchTrades, fetchBalances, fetchPrice

### 3. `src/app/services/exchange.service.ts`
- Remplacement des appels CCXT directs par des appels à l'API Electron
- Toutes les méthodes utilisent maintenant `window.electronAPI`

### 4. `src/app/models/electron.d.ts`
- Définition TypeScript de l'API Electron pour l'autocomplétion

## Lancement de l'application

```bash
# Compiler Electron
npm run electron:compile

# Lancer en mode dev
npm run electron:dev
```

L'application devrait maintenant se connecter correctement à Binance sans erreur CORS ! 🎉
