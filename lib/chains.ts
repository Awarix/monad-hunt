import { type Chain } from 'viem'

export const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
      apiUrl: 'https://testnet.monadexplorer.com/api', // Assuming an API endpoint exists, adjust if needed
    },
  },
  testnet: true,
} satisfies Chain 