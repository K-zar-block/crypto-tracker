# Crypto Tracker - Application Electron + Angular 21

Application de bureau pour suivre vos transactions cryptocurrency et calculer automatiquement votre profit & loss (P&L) ainsi que le coût de revient.

## 📋 Fonctionnalités

- ✅ **Connexion aux exchanges** : Binance, Coinbase, Kraken, Bybit, OKX, et plus
- 📊 **Récupération automatique des transactions** via API
- 💰 **Calcul du P&L** (réalisé et non réalisé)
- 📈 **Coût de revient moyen pondéré** (méthode FIFO)
- 📱 **Interface moderne** et responsive
- 🖥️ **Application desktop native** (Windows, macOS, Linux)

## 🛠️ Technologies

- **Frontend** : Angular 21
- **Desktop** : Electron
- **API Crypto** : CCXT (support de 100+ exchanges)
- **Langage** : TypeScript
- **Styles** : SCSS

## 📦 Installation

### Prérequis

- Node.js 20.x ou supérieur
- npm 11.x ou supérieur

### Installation des dépendances

```bash
npm install
```

## 🚀 Utilisation

### Mode Développement

Pour lancer l'application en mode développement :

```bash
npm run electron:dev
```

Cette commande :
1. Démarre le serveur de développement Angular (port 4200)
2. Compile le code Electron
3. Lance l'application Electron avec hot-reload

### Mode Production

Pour construire l'application Angular seulement :

```bash
npm run build
```

Pour compiler Electron :

```bash
npm run electron:compile
```

## 📦 Build de l'application

### Windows

```bash
npm run electron:build:win
```

Génère un installateur `.exe` dans le dossier `release/`

### macOS

```bash
npm run electron:build:mac
```

Génère un fichier `.dmg` dans le dossier `release/`

### Linux

```bash
npm run electron:build:linux
```

Génère un fichier `.AppImage` dans le dossier `release/`

### Tous les systèmes

```bash
npm run electron:build
```

## 🔑 Configuration des API

### Obtenir vos clés API

#### Binance
1. Connectez-vous à votre compte Binance
2. Allez dans **Compte** > **API Management**
3. Créez une nouvelle API Key
4. **Permissions recommandées** : 
   - ✅ Enable Reading (lecture uniquement)
   - ❌ Enable Spot & Margin Trading (désactivé pour la sécurité)
   - ❌ Enable Futures (désactivé)
   - ❌ Enable Withdrawals (désactivé)

#### Autres exchanges
Consultez la documentation de votre exchange pour créer des API keys en lecture seule.

### ⚠️ Sécurité

- **Ne partagez JAMAIS vos clés API**
- Utilisez des clés avec permissions en **lecture seule**
- Activez l'authentification 2FA sur votre compte exchange
- Ne commitez jamais vos clés dans Git

## 📖 Utilisation de l'application

1. **Connexion à l'exchange**
   - Sélectionnez votre exchange
   - Entrez votre API Key et API Secret
   - Cliquez sur "Se connecter"

2. **Chargement des transactions**
   - Une fois connecté, cliquez sur "Charger les transactions"
   - L'application récupère automatiquement toutes vos transactions

3. **Analyse du P&L**
   - Le tableau de bord affiche automatiquement :
     - Investissement total
     - Valeur actuelle du portfolio
     - P&L réalisé (ventes effectuées)
     - P&L non réalisé (positions actuelles)
     - P&L total et pourcentage

4. **Détails par asset**
   - Positions actuelles avec coût moyen
   - Historique des ventes avec profits/pertes
   - Liste détaillée de toutes les transactions

## 🧮 Calcul du P&L

L'application utilise la méthode **FIFO** (First In, First Out) pour calculer le coût de revient :

- **Achat** : Ajout à la position avec son coût
- **Vente** : Retire en priorité les achats les plus anciens
- **Coût moyen** : Calculé automatiquement pour chaque asset
- **P&L réalisé** : Différence entre prix de vente et coût d'achat
- **P&L non réalisé** : Différence entre prix actuel et coût moyen

## 📁 Structure du projet

```
crypto-tracker/
├── electron/              # Code Electron (TypeScript)
│   ├── main.ts           # Processus principal
│   ├── preload.ts        # Script preload
│   └── tsconfig.json     # Config TypeScript pour Electron
├── src/
│   ├── app/
│   │   ├── components/   # Composants Angular
│   │   ├── models/       # Interfaces TypeScript
│   │   ├── services/     # Services (Exchange, P&L)
│   │   ├── app.ts        # Composant principal
│   │   └── app.html      # Template principal
│   ├── index.html
│   └── styles.scss
├── package.json
└── README.md
```

## 🔧 Scripts disponibles

- `npm start` - Démarre le serveur Angular dev
- `npm run build` - Build Angular en production
- `npm run electron:compile` - Compile TypeScript Electron
- `npm run electron` - Lance Electron (sans serveur dev)
- `npm run electron:dev` - Lance l'app complète en dev
- `npm run electron:build` - Build l'app pour tous les OS
- `npm run electron:build:win` - Build pour Windows
- `npm run electron:build:mac` - Build pour macOS
- `npm run electron:build:linux` - Build pour Linux

## 🐛 Dépannage

### Erreur de connexion à l'exchange

- Vérifiez que vos clés API sont correctes
- Vérifiez que les permissions sont activées
- Testez avec le mode Testnet activé

### L'application ne se lance pas

```bash
# Nettoyer et réinstaller
rm -rf node_modules dist dist-electron
npm install
npm run electron:compile
npm run electron:dev
```

### Erreurs de compilation TypeScript

```bash
npm run electron:compile
```

## 📝 Limitations actuelles

- Les transactions de staking ne sont pas encore supportées
- Les frais de gas ne sont pas encore inclus dans le calcul
- Export CSV/Excel à venir dans une future version

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📄 Licence

MIT

## ⚠️ Disclaimer

Cette application est fournie à titre informatif uniquement. Les calculs de P&L sont basés sur vos transactions et les prix actuels, mais ne constituent pas un conseil financier ou fiscal. Consultez un professionnel pour vos déclarations fiscales.
