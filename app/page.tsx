"use client";

import { ConnectButton, useReadContract } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { client, monadTestnet, anteContract } from "@/lib/contract";
import Link from "next/link";

const wallets = [
  inAppWallet({
    auth: {
      options: ["guest","email", "google", "x"],
    },
  }),
  createWallet("io.metamask"),
];

export default function Home() {
  const { data: count, isLoading } = useReadContract({
    contract: anteContract,
    method: "function challengeCount() view returns (uint256)",
    params: [],
  });

  const totalChallenges = count ? Number(count) : 0;
  const ids = Array.from({ length: totalChallenges }, (_, i) => totalChallenges - i);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold">Ante</h1>
          <p className="text-xs text-zinc-500">put your money where your mouth is</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold text-sm"
          >
            + New Challenge
          </Link>
          <ConnectButton
            client={client}
            wallets={wallets}
            chain={monadTestnet}
            connectModal={{ size: "compact", title: "Welcome to Ante" }}
          />
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-xl font-semibold mb-6">Live Challenges</h2>

        {isLoading && <p className="text-zinc-500">Loading...</p>}

        {!isLoading && totalChallenges === 0 && (
          <div className="border border-dashed border-zinc-700 rounded-xl p-10 text-center">
            <p className="text-zinc-400 mb-4">No challenges yet. Be the first.</p>
            <Link
              href="/create"
              className="inline-block px-5 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold"
            >
              Create the first challenge
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {ids.map((id) => (
            <ChallengeCard key={id} id={id} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ChallengeCard({ id }: { id: number }) {
  const { data, isLoading } = useReadContract({
    contract: anteContract,
    method:
      "function getChallenge(uint256 id) view returns ((string title, address creator, address judge, uint256 lockTime, uint256 resolveDeadline, uint256 yesPool, uint256 noPool, uint8 outcome, bool resolved))",
    params: [BigInt(id)],
  });

  if (isLoading || !data) {
    return (
      <div className="border border-zinc-800 rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
      </div>
    );
  }

  const { title, yesPool, noPool, resolved, outcome } = data;
  const total = yesPool + noPool;
  const yesPct = total > 0n ? Number((yesPool * 100n) / total) : 50;

  return (
    <Link href={`/c/${id}`}>
      <div className="border border-zinc-800 hover:border-zinc-600 rounded-xl p-5 transition cursor-pointer">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="font-semibold text-lg flex-1">{title}</h3>
          {resolved ? (
            <span className="text-xs px-2 py-1 bg-zinc-800 rounded">
              {outcome === 1 ? "✅ YES" : outcome === 2 ? "❌ NO" : "CANCELLED"}
            </span>
          ) : (
            <span className="text-xs px-2 py-1 bg-green-900/50 text-green-400 rounded">
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
          <span>Pool: {formatEther(total)} MON</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
          <div className="bg-green-500" style={{ width: `${yesPct}%` }} />
          <div className="bg-red-500" style={{ width: `${100 - yesPct}%` }} />
        </div>
        <div className="flex justify-between text-xs mt-1 text-zinc-500">
          <span>YES {yesPct}%</span>
          <span>NO {100 - yesPct}%</span>
        </div>
      </div>
    </Link>
  );
}

function formatEther(wei: bigint): string {
  const mon = Number(wei) / 1e18;
  return mon.toFixed(3);
}