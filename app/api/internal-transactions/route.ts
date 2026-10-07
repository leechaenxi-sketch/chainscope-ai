import { NextRequest, NextResponse } from "next/server";
import { ProxyAgent, fetch as undiciFetch } from "undici";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const address = searchParams.get("address");

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

  try {
    const url =
      `https://api.etherscan.io/v2/api` +
      `?chainid=1` +
      `&module=account` +
      `&action=txlistinternal` +
      `&address=${encodeURIComponent(address)}` +
      `&page=1` +
      `&offset=100` +
      `&sort=desc` +
      `&apikey=${apiKey}`;

    const proxyUrl =
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY;

    const dispatcher = proxyUrl
      ? new ProxyAgent(proxyUrl)
      : undefined;

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
      return NextResponse.json({
        items: [],
        usingProxy: Boolean(proxyUrl),
      });
    }

    if (data.status !== "1") {
      return NextResponse.json(
        {
          error: "Etherscan internal transaction request failed",
          message: data.message,
          result: data.result,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      items: Array.isArray(data.result)
        ? data.result
        : [],
      usingProxy: Boolean(proxyUrl),
    });
  } catch (error) {
    console.error(
      "Etherscan internal transaction error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to retrieve internal transactions",
        details: String(error),
      },
      {
        status: 500,
      }
    );
  }
}