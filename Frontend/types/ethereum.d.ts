export interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
  on(event: 'chainChanged', handler: (chainId: string) => void): void;
  on(event: string, handler: (...args: any[]) => void): void;
}

declare global {
  interface Window {
    ethereum: EthereumProvider;
  }
}