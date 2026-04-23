import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, toWei } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  rpc: "https://testnet-rpc.monad.xyz",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
});

// Haksız sömürüyü önlemek için basit bellek içi takip (sunucu yeniden başlarsa sıfırlanır)
const recentlyDripped = new Map<string, number>();
const DRIP_AMOUNT = "0.2"; // 2 MON
const COOLDOWN_MS = 60 * 60 * 1000; // 1 saat

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== "string" || !address.startsWith("0x") || address.length !== 42) {
      return NextResponse.json({ error: "invalid address" }, { status: 400 });
    }

    const normalized = address.toLowerCase();
    const last = recentlyDripped.get(normalized);
    if (last && Date.now() - last < COOLDOWN_MS) {
      return NextResponse.json({ error: "already dripped" }, { status: 429 });
    }

    const pk = process.env.DRIP_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json({ error: "drip not configured" }, { status: 500 });
    }

    const dripAccount = privateKeyToAccount({
      client,
      privateKey: pk.startsWith("0x") ? pk : `0x${pk}`,
    });

    const tx = prepareTransaction({
      to: address,
      value: toWei(DRIP_AMOUNT),
      chain: monadTestnet,
      client,
        gas: 30000n,

    });

    const result = await sendTransaction({
      transaction: tx,
      account: dripAccount,
    });

    recentlyDripped.set(normalized, Date.now());

    return NextResponse.json({
      success: true,
      txHash: result.transactionHash,
      amount: DRIP_AMOUNT,
    });
  } catch (err: any) {
    console.error("drip error:", err);
    return NextResponse.json(
      { error: err.message ?? "unknown error" },
      { status: 500 }
    );
  }
}