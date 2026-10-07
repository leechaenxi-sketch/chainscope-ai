import {
  NextRequest,
  NextResponse,
} from "next/server";

import { ethers } from "ethers";

import {
  ProxyAgent,
  fetch as undiciFetch,
} from "undici";

type AddressContext = {
  address: string;
  isContract: boolean;
  contractName?: string;
  sourceVerified?: boolean;
};

type CacheEntry = {
  data: AddressContext;
  cachedAt: number;
};

const RATE_LIMIT_PER_WINDOW = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 30 * 60_000;

const rateLimitMap = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

const contextCache = new Map<
  string,
  CacheEntry
>();

function getClientIp(
  request: NextRequest
) {
  const forwarded =
    request.headers.get(
      "x-forwarded-for"
    );

  if (forwarded) {
    return forwarded
      .split(",")[0]
      .trim();
  }

  return (
    request.headers.get(
      "x-real-ip"
    ) || "unknown"
  );
}

function hitRateLimit(
  ip: string
) {
  const now = Date.now();

  const current =
    rateLimitMap.get(ip);

  if (
    !current ||
    now >= current.resetAt
  ) {
    rateLimitMap.set(ip, {
      count: 1,
      resetAt:
        now +
        RATE_LIMIT_WINDOW_MS,
    });

    return false;
  }

  current.count += 1;

  return (
    current.count >
    RATE_LIMIT_PER_WINDOW
  );
}

function cleanupCache() {
  if (
    contextCache.size <
    1000
  ) {
    return;
  }

  const now = Date.now();

  for (
    const [
      key,
      value,
    ] of contextCache
  ) {
    if (
      now -
        value.cachedAt >=
      CACHE_TTL_MS
    ) {
      contextCache.delete(key);
    }
  }
}

function getDispatcher() {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY;

  return proxyUrl
    ? new ProxyAgent(
        proxyUrl
      )
    : undefined;
}

async function etherscanRequest(
  params:
    Record<string, string>
) {
  const apiKey =
    process.env
      .ETHERSCAN_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ETHERSCAN_API_KEY is missing"
    );
  }

  const search =
    new URLSearchParams({
      chainid: "1",
      ...params,
      apikey: apiKey,
    });

  const response =
    await undiciFetch(
      `https://api.etherscan.io/v2/api?${search.toString()}`,
      {
        method: "GET",
        dispatcher:
          getDispatcher(),
      }
    );

  const data =
    (await response.json()) as any;

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Etherscan request failed"
    );
  }

  return data;
}

async function getCode(
  address: string
) {
  const data =
    await etherscanRequest({
      module: "proxy",
      action: "eth_getCode",
      address,
      tag: "latest",
    });

  return String(
    data?.result || "0x"
  ).trim();
}

async function getContractMetadata(
  address: string
) {
  const data =
    await etherscanRequest({
      module: "contract",
      action: "getsourcecode",
      address,
    });

  if (
    data?.status !== "1" ||
    !Array.isArray(
      data?.result
    ) ||
    !data.result[0]
  ) {
    return {};
  }

  const item =
    data.result[0];

  const sourceCode =
    String(
      item?.SourceCode || ""
    ).trim();

  const contractName =
    String(
      item?.ContractName || ""
    ).trim();

  // 只返回必要字段。
  // ABI / SourceCode 不传给前端或 AI。
  return {
    contractName:
      contractName ||
      undefined,

    sourceVerified:
      sourceCode.length > 0,
  };
}

async function inspectAddress(
  address: string
): Promise<AddressContext> {
  const code =
    await getCode(address);

  const isContract =
    Boolean(
      code &&
        code !== "0x" &&
        code !== "0x0"
    );

  if (!isContract) {
    return {
      address,
      isContract: false,
    };
  }

  let metadata: {
    contractName?: string;
    sourceVerified?: boolean;
  } = {};

  try {
    metadata =
      await getContractMetadata(
        address
      );
  } catch (
    error
  ) {
    console.warn(
      "getsourcecode failed:",
      error
    );
  }

  return {
    address,
    isContract: true,
    ...metadata,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const rawAddresses: unknown[] =
      Array.isArray(
        body?.addresses
      )
        ? body.addresses
        : [];

    const addresses =
      Array.from(
        new Set(
          rawAddresses
            .map(
              (
                value:
                  unknown
              ) =>
                String(
                  value || ""
                ).trim()
            )
            .filter(
              (
                value:
                  string
              ) =>
                ethers.isAddress(
                  value
                )
            )
            .map(
              (
                value:
                  string
              ) =>
                value.toLowerCase()
            )
        )
      ).slice(0, 5);

    if (!addresses.length) {
      return NextResponse.json(
        {
          error:
            "At least one valid Ethereum address is required",
        },
        {
          status: 400,
        }
      );
    }

    cleanupCache();

    const now =
      Date.now();

    const items:
      AddressContext[] = [];

    const misses:
      string[] = [];

    for (
      const address of addresses
    ) {
      const cached =
        contextCache.get(
          address
        );

      if (
        cached &&
        now -
          cached.cachedAt <
          CACHE_TTL_MS
      ) {
        items.push(
          cached.data
        );
      } else {
        misses.push(
          address
        );
      }
    }

    // Cache hit 在限流前，不消耗额度。
    if (
      misses.length > 0
    ) {
      const ip =
        getClientIp(
          request
        );

      if (
        hitRateLimit(ip)
      ) {
        return NextResponse.json(
          {
            error:
              "Too many uncached address-context requests. Please retry later.",
          },
          {
            status: 429,
            headers: {
              "Retry-After":
                "60",
            },
          }
        );
      }

      for (
        const address of misses
      ) {
        const item =
          await inspectAddress(
            address
          );

        contextCache.set(
          address,
          {
            data: item,
            cachedAt:
              Date.now(),
          }
        );

        items.push(item);
      }
    }

    const ordered =
      addresses
        .map(
          (address) =>
            items.find(
              (item) =>
                item.address.toLowerCase() ===
                address
            )
        )
        .filter(
          (
            item
          ): item is AddressContext =>
            Boolean(item)
        );

    return NextResponse.json({
      items: ordered,
      cachedCount:
        addresses.length -
        misses.length,
      fetchedCount:
        misses.length,
    });
  } catch (
    error
  ) {
    console.error(
      "address-context error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to inspect address context",
        details:
          String(error),
      },
      {
        status: 500,
      }
    );
  }
}
