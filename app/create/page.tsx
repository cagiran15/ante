"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSendTransaction, useActiveAccount } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { anteContract } from "@/lib/contract";
import Link from "next/link";

export default function CreatePage() {
  const router = useRouter();
  const account = useActiveAccount();
  const { mutate: sendTx, isPending } = useSendTransaction();

  const [title, setTitle] = useState("");
  const [judge, setJudge] = useState("");
  const [lockMinutes, setLockMinutes] = useState(10);

  const useSelfAsJudge = () => {
    if (account) setJudge(account.address);
  };

  const handleCreate = () => {
    if (!title.trim()) {
      alert("Give your challenge a title");
      return;
    }
    if (!judge || !judge.startsWith("0x") || judge.length !== 42) {
      alert("Judge must be a valid wallet address (0x...)");
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const lockTime = BigInt(now + lockMinutes * 60);
    const resolveDeadline = BigInt(now + lockMinutes * 60 + 24 * 60 * 60);

    const tx = prepareContractCall({
      contract: anteContract,
      method:
        "function createChallenge(string title, address judge, uint256 lockTime, uint256 resolveDeadline) returns (uint256)",
      params: [title, judge, lockTime, resolveDeadline],
    });

    sendTx(tx, {
      onSuccess: () => {
        router.push("/");
      },
      onError: (err) => {
        alert("Failed: " + err.message);
      },
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/">
          <div>
            <h1 className="text-3xl font-bold">Ante</h1>
            <p className="text-xs text-zinc-500">put your money where your mouth is</p>
          </div>
        </Link>
      </header>

      <section className="max-w-xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-6">New Challenge</h2>

        {!account && (
          <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-800 rounded-lg text-sm text-yellow-300">
            Connect your wallet first.
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              What is the bet?
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. I can do 50 push-ups in 2 minutes"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Judge (wallet address that decides the outcome)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={judge}
                onChange={(e) => setJudge(e.target.value)}
                placeholder="0x..."
                className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
              />
              <button
                onClick={useSelfAsJudge}
                className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm whitespace-nowrap"
              >
                Use me
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Betting open for: <span className="text-white font-semibold">{lockMinutes} minutes</span>
            </label>
            <input
              type="range"
              min={1}
              max={120}
              value={lockMinutes}
              onChange={(e) => setLockMinutes(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>1 min</span>
              <span>2 hours</span>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={isPending || !account}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition"
          >
            {isPending ? "Creating..." : "Create Challenge"}
          </button>
        </div>
      </section>
    </main>
  );
}