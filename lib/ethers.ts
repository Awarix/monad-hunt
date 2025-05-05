import { ethers, Wallet, Contract, JsonRpcProvider } from 'ethers';
import TreasureHuntManagerABI from '@/lib/abi/TreasureHuntManagerABI.json';
import HuntMapNFTABI from '@/lib/abi/HuntMapNFTABI.json';

// --- Environment Variable Loading ---
// Ensure these are set in your root .env file
const monadRpcUrl = process.env.MONAD_RPC_URL;
const privateKey = process.env.PRIVATE_KEY; // Backend wallet for admin actions
const managerAddress = process.env.TREASURE_HUNT_MANAGER_ADDRESS;
const nftAddress = process.env.HUNT_MAP_NFT_ADDRESS;

if (!monadRpcUrl) {
  throw new Error('MONAD_RPC_URL environment variable is not set.');
}
if (!privateKey) {
  throw new Error('PRIVATE_KEY environment variable is not set.');
}
if (!managerAddress) {
  throw new Error('TREASURE_HUNT_MANAGER_ADDRESS environment variable is not set.');
}
if (!nftAddress) {
  throw new Error('HUNT_MAP_NFT_ADDRESS environment variable is not set.');
}

// --- Provider Setup ---
export const provider = new JsonRpcProvider(monadRpcUrl);

// --- Backend Signer Setup ---
// This wallet is used by the backend for actions like creating hunts
export const backendSigner = new Wallet(privateKey, provider);

// --- Contract Instances Setup ---
// Ensure the ABI paths are correct relative to the monad-frontend directory execution context

// Instance connected to the backend signer (for sending transactions)
export const treasureHuntManagerContract = new Contract(
  managerAddress,
  TreasureHuntManagerABI.abi,
  backendSigner
);

export const huntMapNFTContract = new Contract(
  nftAddress,
  HuntMapNFTABI.abi,
  backendSigner
);

// Instance connected only to the provider (for read-only calls from backend if needed)
export const treasureHuntManagerContractProvider = new Contract(
  managerAddress,
  TreasureHuntManagerABI.abi,
  provider
);

export const huntMapNFTContractProvider = new Contract(
  nftAddress,
  HuntMapNFTABI.abi,
  provider
);

console.log(`Ethers setup complete. Connected to ${monadRpcUrl}`);
console.log(`Backend signer address: ${backendSigner.address}`);
console.log(`TreasureHuntManager contract address: ${managerAddress}`);
console.log(`HuntMapNFT contract address: ${nftAddress}`); 