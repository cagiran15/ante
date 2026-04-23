"use client";
import { useEffect, useRef } from "react";

const DRIPPED_KEY = "ante_dripped";

export function useDrip(address: string | undefined) {
  const triggered = useRef(false);

  useEffect(() => {
    if (!address || triggered.current) return;

    // Bu tarayıcıda daha önce drip aldıysan yine deneme
    const seen = localStorage.getItem(DRIPPED_KEY);
    if (seen && seen.toLowerCase() === address.toLowerCase()) return;

    triggered.current = true;

    fetch("/api/drip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          localStorage.setItem(DRIPPED_KEY, address);
          console.log("Drip sent:", data.txHash);
        } else {
          console.log("Drip skipped:", data.error);
        }
      })
      .catch((err) => {
        console.error("Drip request failed:", err);
      });
  }, [address]);
}