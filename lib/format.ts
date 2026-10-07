import { ethers } from "ethers";
import type { Language } from "./types";

export function formatTokenAmount(value: string, decimals: string) {
  try {
    return Number(ethers.formatUnits(value || "0", Number(decimals || "18"))).toFixed(4);
  } catch {
    return "0.0000";
  }
}

export function formatEth(value: string) {
  try {
    return Number(ethers.formatEther(value || "0")).toFixed(4);
  } catch {
    return "0.0000";
  }
}

export function formatTime(timestamp: string, language: Language) {
  return new Date(Number(timestamp) * 1000).toLocaleString(language === "zh" ? "zh-CN" : "en-US");
}

export function shortenGlobal(value: string) {
  if (!value) return "N/A";
  if (value.length <= 20) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function formatMetricValue(value: number) {
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
