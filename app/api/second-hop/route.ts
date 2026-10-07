import { NextRequest, NextResponse } from "next/server";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const RATE_LIMIT_PER_WINDOW = 6;
const RATE_LIMIT_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 5 * 60_000;

const rateLimitMap = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

const secondHopCache = new Map<
  string,
  {
    data: {
      transactions: unknown[];
      tokenTransfers: unknown[];
      internalTransactions: unknown[];
    };
    cachedAt: number;
  }
>();

function getClientIp(request: NextRequest) {
  const xff = request.headers.get("x-forwarded-for");

  if (xff) {
    return xff.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function hitRateLimit(ip: string) {
  const now = Date.now();

  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap) {
      if (now >= value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return false;
  }

  entry.count += 1;

  return entry.count > RATE_LIMIT_PER_WINDOW;
}

function cleanupCache() {
  const now = Date.now();

  if (secondHopCache.size < 500) {
    return;
  }

  for (const [key, value] of secondHopCache) {
    if (now - value.cachedAt >= CACHE_TTL_MS) {
      secondHopCache.delete(key);
    }
  }
}

async function requestEtherscan(
  action: "txlist" | "tokentx" | "txlistinternal",
  address: string,
  apiKey: string,
  dispatcher?: ProxyAgent
) {
  const url =
    `https://api.etherscan.io/v2/api` +
    `?chainid=1` +
    `&module=account` +
    `&action=${action}` +
    `&address=${encodeURIComponent(address)}` +
    `&page=1` +
    `&offset=100` +
    `&sort=desc` +
    `&apikey=${apiKey}`;

  const response = await undiciFetch(url, {
    dispatcher,
    headers: {
      Accept: "application/json",
    },
  });

  const data = (await response.json()) as {
    status?: string;
    message?: string;
    result?: unknown;
  };

  if (
    data.status === "0" &&
    data.message === "No transactions found"
  ) {
    return [];
  }

  if (data.status !== "1") {
    throw new Error(
      `${action}: ${data.message || "Etherscan request failed"}`
    );
  }

  return Array.isArray(data.result) ? data.result : [];
}

export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      {
        error: "Address is required",
      },
      {
        status: 400,
      }
    );
  }

  const normalizedAddress = address.trim().toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
    return NextResponse.json(
      {
        error: "Invalid Ethereum address",
      },
      {
        status: 400,
      }
    );
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "ETHERSCAN_API_KEY is missing",
      },
      {
        status: 500,
      }
    );
  }

  cleanupCache();

  const cached = secondHopCache.get(normalizedAddress);

  if (
    cached &&
    Date.now() - cached.cachedAt < CACHE_TTL_MS
  ) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
    });
  }

  const ip = getClientIp(request);

  if (hitRateLimit(ip)) {
    return NextResponse.json(
      {
        error:
          "Second-hop requests are too frequent. Please try again shortly.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
        },
      }
    );
  }

  try {
    const proxyUrl =
      process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

    const dispatcher = proxyUrl
      ? new ProxyAgent(proxyUrl)
      : undefined;

    const [
      transactions,
      tokenTransfers,
      internalTransactions,
    ] = await Promise.all([
      requestEtherscan(
        "txlist",
        normalizedAddress,
        apiKey,
        dispatcher
      ),

      requestEtherscan(
        "tokentx",
        normalizedAddress,
        apiKey,
        dispatcher
      ),

      requestEtherscan(
        "txlistinternal",
        normalizedAddress,
        apiKey,
        dispatcher
      ),
    ]);

    const result = {
      transactions,
      tokenTransfers,
      internalTransactions,
    };

    secondHopCache.set(normalizedAddress, {
      data: result,
      cachedAt: Date.now(),
    });

    return NextResponse.json({
      ...result,
      cached: false,
      usingProxy: Boolean(proxyUrl),
    });
  } catch (error) {
    console.error("Second-hop investigation error:", error);

    return NextResponse.json(
      {
        error: "Failed to investigate second-hop address",
        details: String(error),
      },
      {
        status: 500,
      }
    );
  }
}