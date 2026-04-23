"use client";

import { useState, useEffect, use } from "react";
import {
  useReadContract,
  useSendTransaction,
  useActiveAccount,
  useContractEvents,
  ConnectButton,
} from "thirdweb/react";
import { prepareContractCall, prepareEvent, toWei } from "thirdweb";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { anteContract, client, monadTestnet } from "@/lib/contract";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useDrip } from "@/lib/useDrip";

const wallets = [
  inAppWallet({ auth: { options: ["email", "google", "x"] } }),
  createWallet("io.metamask"),
];

const betEvent = prepareEvent({
  signature:
    "event BetPlaced(uint256 indexed id, address indexed bettor, bool isYes, uint256 amount)",
});

export default function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const challengeId = BigInt(id);
  const account = useActiveAccount();
useDrip(account?.address);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading, refetch } = useReadContract({
    contract: anteContract,
    method:
      "function getChallenge(uint256 id) view returns ((string title, address creator, address judge, uint256 lockTime, uint256 resolveDeadline, uint256 yesPool, uint256 noPool, uint8 outcome, bool resolved))",
    params: [challengeId],
    queryOptions: { refetchInterval: 3000 },
  });

  const { data: myBets } = useReadContract({
    contract: anteContract,
    method:
      "function getBets(uint256 id, address user) view returns (uint256 yesAmount, uint256 noAmount)",
    params: [
      challengeId,
      account?.address ?? "0x0000000000000000000000000000000000000000",
    ],
    queryOptions: { refetchInterval: 3000 },
  });

  const { data: events } = useContractEvents({
    contract: anteContract,
    events: [betEvent],
  });

  const recentBets = (events ?? [])
    .filter((e: any) => e.args?.id === challengeId)
    .slice(-8)
    .reverse();

  if (isLoading || !data) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">Loading challenge...</p>
      </main>
    );
  }

  const { title, creator, judge, lockTime, yesPool, noPool, outcome, resolved } =
    data;

  const total = yesPool + noPool;
  const yesPct = total > 0n ? Number((yesPool * 100n) / total) : 50;
  const noPct = 100 - yesPct;
  const isLocked = Number(lockTime) <= now;
  const isJudge =
    account?.address.toLowerCase() === judge.toLowerCase();
  const secondsLeft = Math.max(0, Number(lockTime) - now);
  const pageUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/">
          <div>
            <h1 className="text-3xl font-bold">Ante</h1>
            <p className="text-xs text-zinc-500">
              put your money where your mouth is
            </p>
          </div>
        </Link>
        <ConnectButton
          client={client}
          wallets={wallets}
          chain={monadTestnet}
          connectModal={{ size: "compact", title: "Welcome to Ante" }}
        />
      </header>

      <section className="max-w-2xl mx-auto px-6 py-10">
        {/* Top bar */}
        <div className="mb-4 flex items-center gap-2 text-xs">
          <Link href="/" className="text-zinc-500 hover:text-white">
            ← Back
          </Link>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-500">Challenge #{id}</span>
          {resolved ? (
            <span className="ml-auto px-2 py-1 bg-zinc-800 rounded">
              {outcome === 1
                ? "✅ YES WON"
                : outcome === 2
                ? "❌ NO WON"
                : "CANCELLED"}
            </span>
          ) : isLocked ? (
            <span className="ml-auto px-2 py-1 bg-yellow-900/50 text-yellow-400 rounded">
              ⏳ AWAITING JUDGE
            </span>
          ) : (
            <span className="ml-auto px-2 py-1 bg-green-900/50 text-green-400 rounded">
              🟢 LIVE
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold mb-6">{title}</h2>

        {/* Pool + odds */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm text-zinc-400">Total Pool</span>
            <span className="text-2xl font-bold">
              {formatEther(total)} MON
            </span>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden flex mb-2">
            <div
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${yesPct}%` }}
            />
            <div
              className="bg-red-500 transition-all duration-500"
              style={{ width: `${noPct}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-400">
              YES {yesPct}% · {formatEther(yesPool)} MON
            </span>
            <span className="text-red-400">
              NO {noPct}% · {formatEther(noPool)} MON
            </span>
          </div>
        </div>

        {/* QR code — only while challenge is open */}
        {!resolved && !isLocked && (
          <div className="bg-white rounded-xl p-6 mb-6 flex items-center gap-4">
            <QRCodeSVG value={pageUrl} size={128} level="M" />
            <div className="text-black">
              <p className="font-bold text-lg mb-1">📱 Join the bet</p>
              <p className="text-sm text-zinc-700">
                Scan to place your bet from your phone.
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                Email login supported — no MetaMask needed.
              </p>
            </div>
          </div>
        )}

        {/* Bet form */}
        {!isLocked && !resolved && (
          <BetForm
            challengeId={challengeId}
            account={account}
            onSuccess={refetch}
            secondsLeft={secondsLeft}
          />
        )}

        {/* Judge panel */}
        {isLocked && !resolved && isJudge && (
          <JudgePanel challengeId={challengeId} onSuccess={refetch} />
        )}

        {/* Claim panel */}
        {resolved && account && (
          <ClaimPanel
            challengeId={challengeId}
            myBets={myBets}
            outcome={outcome}
            onSuccess={refetch}
          />
        )}

        {/* Live bets feed */}
        {recentBets.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-zinc-400 mb-3">
              Live bets
            </h3>
            <div className="space-y-2">
              {recentBets.map((e: any, i: number) => (
                <div
                  key={`${e.transactionHash}-${i}`}
                  className={`flex justify-between items-center px-4 py-2 rounded-lg border ${
                    e.args.isYes
                      ? "bg-green-900/20 border-green-800"
                      : "bg-red-900/20 border-red-800"
                  }`}
                >
                  <span className="text-sm font-mono">
                    {shortAddr(e.args.bettor)}
                  </span>
                  <span className="text-sm">
                    {formatEther(e.args.amount)} MON{" "}
                    {e.args.isYes ? "✅" : "❌"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meta info */}
        <div className="mt-8 text-xs text-zinc-600 space-y-1">
          <p>Creator: {shortAddr(creator)}</p>
          <p>
            Judge: {shortAddr(judge)} {isJudge && "(you)"}
          </p>
          {myBets && (myBets[0] > 0n || myBets[1] > 0n) && (
            <p className="text-zinc-400">
              Your stake — YES: {formatEther(myBets[0])} MON · NO:{" "}
              {formatEther(myBets[1])} MON
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function BetForm({
  challengeId,
  account,
  onSuccess,
  secondsLeft,
}: {
  challengeId: bigint;
  account: ReturnType<typeof useActiveAccount>;
  onSuccess: () => void;
  secondsLeft: number;
}) {
  const [amount, setAmount] = useState("0.1");
  const { mutate: sendTx, isPending } = useSendTransaction();

  const placeBet = (isYes: boolean) => {
    if (!account) {
      alert("Connect wallet first");
      return;
    }
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      alert("Enter an amount");
      return;
    }
    const tx = prepareContractCall({
      contract: anteContract,
      method: "function bet(uint256 id, bool isYes) payable",
      params: [challengeId, isYes],
      value: toWei(amount),
    });
    sendTx(tx, {
      onSuccess: () => {
        setTimeout(onSuccess, 1000);
      },
      onError: (err) => alert("Failed: " + err.message),
    });
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Place your bet</h3>
        <span className="text-xs text-zinc-500">
          Closes in {mins}m {secs}s
        </span>
      </div>
      <div className="mb-4">
        <label className="block text-sm text-zinc-400 mb-2">
          Amount (MON)
        </label>
        <div className="flex gap-2 mb-2">
          {["0.1", "0.5", "1", "5"].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={`px-3 py-2 text-sm rounded ${
                amount === v
                  ? "bg-orange-500"
                  : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          type="number"
          step="0.1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg focus:border-orange-500 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => placeBet(true)}
          disabled={isPending}
          className="py-4 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 rounded-lg font-bold text-lg"
        >
          {isPending ? "..." : "BET YES ✅"}
        </button>
        <button
          onClick={() => placeBet(false)}
          disabled={isPending}
          className="py-4 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 rounded-lg font-bold text-lg"
        >
          {isPending ? "..." : "BET NO ❌"}
        </button>
      </div>
    </div>
  );
}

function JudgePanel({
  challengeId,
  onSuccess,
}: {
  challengeId: bigint;
  onSuccess: () => void;
}) {
  const { mutate: sendTx, isPending } = useSendTransaction();

  const resolve = (isYes: boolean) => {
    const tx = prepareContractCall({
      contract: anteContract,
      method: "function resolve(uint256 id, bool isYes)",
      params: [challengeId, isYes],
    });
    sendTx(tx, {
      onSuccess: () => setTimeout(onSuccess, 1000),
      onError: (err) => alert("Failed: " + err.message),
    });
  };

  return (
    <div className="bg-orange-950/30 border border-orange-800 rounded-xl p-5">
      <h3 className="font-semibold mb-2">⚖️ You are the judge</h3>
      <p className="text-sm text-zinc-400 mb-4">
        Betting is closed. Decide the outcome.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => resolve(true)}
          disabled={isPending}
          className="py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 rounded-lg font-bold"
        >
          {isPending ? "..." : "YES happened ✅"}
        </button>
        <button
          onClick={() => resolve(false)}
          disabled={isPending}
          className="py-3 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 rounded-lg font-bold"
        >
          {isPending ? "..." : "NO ❌"}
        </button>
      </div>
    </div>
  );
}

function ClaimPanel({
  challengeId,
  myBets,
  outcome,
  onSuccess,
}: {
  challengeId: bigint;
  myBets: readonly [bigint, bigint] | undefined;
  outcome: number;
  onSuccess: () => void;
}) {
  const { mutate: sendTx, isPending } = useSendTransaction();

  const wonYes = outcome === 1 && myBets && myBets[0] > 0n;
  const wonNo = outcome === 2 && myBets && myBets[1] > 0n;
  const cancelled =
    outcome === 3 && myBets && (myBets[0] > 0n || myBets[1] > 0n);
  const canClaim = wonYes || wonNo || cancelled;

  if (!canClaim) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center text-zinc-500">
        {outcome === 0 ? "Not resolved yet" : "No winnings to claim"}
      </div>
    );
  }

  const claim = () => {
    const tx = prepareContractCall({
      contract: anteContract,
      method: "function claim(uint256 id)",
      params: [challengeId],
    });
    sendTx(tx, {
      onSuccess: () => setTimeout(onSuccess, 1000),
      onError: (err) => alert("Failed: " + err.message),
    });
  };

  return (
    <div className="bg-green-950/30 border border-green-800 rounded-xl p-5 text-center">
      <h3 className="text-xl font-bold mb-2">🏆 You won!</h3>
      <p className="text-sm text-zinc-400 mb-4">
        Claim your share of the pool
      </p>
      <button
        onClick={claim}
        disabled={isPending}
        className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 rounded-lg font-bold"
      >
        {isPending ? "Claiming..." : "Claim Winnings"}
      </button>
    </div>
  );
}

function formatEther(wei: bigint): string {
  const mon = Number(wei) / 1e18;
  return mon.toFixed(3);
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}