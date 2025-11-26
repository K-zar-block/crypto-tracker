export interface Transaction {
  id: string;
  timestamp: number;
  datetime: string;
  symbol: string;
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal';
  side?: 'buy' | 'sell';
  price: number;
  amount: number;
  cost: number;
  fee: {
    cost: number;
    currency: string;
  };
  exchange: string;
  orderId?: string;
}

export interface Position {
  symbol: string;
  asset: string;
  totalAmount: number;
  averageCost: number;
  totalInvested: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface RealizedPnL {
  symbol: string;
  asset: string;
  totalRealized: number;
  totalSold: number;
  totalProfit: number;
  totalLoss: number;
  profitPercent: number;
  transactions: Transaction[];
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Position[];
  realizedPnLByAsset: RealizedPnL[];
}

export interface ExchangeCredentials {
  name: string;
  apiKey: string;
  apiSecret: string;
  password?: string;
  testnet?: boolean;
}

export interface ExchangeBalance {
  asset: string;
  free: number;
  used: number;
  total: number;
}
