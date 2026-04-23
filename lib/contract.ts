import { createThirdwebClient, defineChain, getContract } from "thirdweb";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  rpc: "https://testnet-rpc.monad.xyz",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  blockExplorers: [
    { name: "MonadScan", url: "https://testnet.monadscan.com" },
  ],
});
export const ANTE_ADDRESS = "0xc7BCf996c09A4A924aB973C146BD83617745feF2";

export const anteContract = getContract({
  client,
  chain: monadTestnet,
  address: ANTE_ADDRESS,
});