import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type LookupAddress = {
  address: string;
  family: 4 | 6;
};

export type LookupResolver = (hostname: string) => Promise<LookupAddress[]>;

const defaultLookup: LookupResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: false });
  return records.map((record) => ({
    address: record.address,
    family: record.family as 4 | 6,
  }));
};

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return octets;
}

function isPrivateOrReservedIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return true;

  const [a, b] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 0 && octets[2] === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113) ||
    a >= 224
  );
}

function isPrivateOrReservedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

function isPrivateOrReservedAddress(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) return isPrivateOrReservedIpv4(address);
  if (ipVersion === 6) return isPrivateOrReservedIpv6(address);
  return true;
}

export async function assertSafePublicHttpUrl(
  rawUrl: string,
  resolver: LookupResolver = defaultLookup
): Promise<URL> {
  const url = new URL(rawUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }

  if (url.username || url.password) {
    throw new Error("URLs with credentials are not allowed");
  }

  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Only ports 80 and 443 are allowed");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Localhost URLs are not allowed");
  }

  if (isIP(hostname) && isPrivateOrReservedAddress(hostname)) {
    throw new Error("URL resolves to a private or reserved address");
  }

  const records = await resolver(hostname);
  if (records.length === 0) {
    throw new Error("URL hostname did not resolve");
  }

  if (records.some((record) => isPrivateOrReservedAddress(record.address))) {
    throw new Error("URL resolves to a private or reserved address");
  }

  return url;
}

export async function fetchSafeTextWithTimeout(
  rawUrl: string,
  timeoutMs = 8000,
  init: RequestInit = {},
  resolver: LookupResolver = defaultLookup,
  maxRedirects = 3
): Promise<string> {
  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const safeUrl = await assertSafePublicHttpUrl(currentUrl, resolver);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(safeUrl, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error(`${response.status} redirect without location`);
        }

        currentUrl = new URL(location, safeUrl).toString();
        continue;
      }

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return (await response.text()).slice(0, 2_000_000);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Too many redirects");
}
