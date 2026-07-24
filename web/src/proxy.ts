import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken, verifyAccessTokenDetailed } from "@/lib/tokens";
import { consumeRateLimit } from "@/lib/rate-limiter";
import { getAccountTypeFromRole } from "@/lib/auth";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  COOKIE_OPTIONS,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/cookies";
import type { TokenPayload } from "@/lib/tokens";
import { computeFingerprint } from "@/lib/fingerprint";


const PROTECTED_API_ROUTES = [
  "/api/user",
  "/api/auth/logout",
  "/api/auth/reset-password",
  "/api/auth/revoke",
  "/api/dashboard",
  "/api/wallet",
];

const AUTH_RATE_LIMIT = 100;
const AUTH_RATE_WINDOW_MS = 60 * 1000; 

function withAuthRateLimitHeaders(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (!request.nextUrl.pathname.startsWith("/api/auth")) {
    return response;
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const status = consumeRateLimit(
    `auth:${ip}`,
    AUTH_RATE_LIMIT,
    AUTH_RATE_WINDOW_MS,
  );

  response.headers.set("X-RateLimit-Remaining", String(status.remaining));
  response.headers.set("X-RateLimit-Limit", String(status.limit));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(status.resetMs / 1000)));

  if (status.limited) {
    response.headers.set("Retry-After", String(Math.ceil(status.resetMs / 1000)));
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return withAuthRateLimitHeaders(
      request,
      NextResponse.redirect(new URL("/auth/login", request.url)),
    );
  }

  if (pathname.startsWith("/api/auth/refresh")) {
    return withAuthRateLimitHeaders(request, NextResponse.next());
  }



  if (pathname.startsWith("/dashboard")) {
    const response = await handleDashboardRoute(request);
    if (response.status === 307) {
      return NextResponse.next();
    }
    return response;
  }

  
  const isProtectedApi = PROTECTED_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  if (isProtectedApi) {
    const response = await handleApiRoute(request);
    return withAuthRateLimitHeaders(request, response);
  }

  return withAuthRateLimitHeaders(request, NextResponse.next());
}

async function isFingerprintValid(
  request: NextRequest,
  payload: TokenPayload,
): Promise<boolean> {
  if (!payload.fingerprint) {
    
    return true;
  }
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1";
  const userAgent = request.headers.get("user-agent");
  const incoming = await computeFingerprint(userAgent, ip);
  return incoming === payload.fingerprint;
}

function injectUserHeaders(
  request: NextRequest,
  payload: TokenPayload,
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  const accountType = getAccountTypeFromRole(payload.role);

  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-role", payload.role);
  if (accountType) {
    requestHeaders.set("X-Account-Type", accountType);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

async function handleDashboardRoute(
  request: NextRequest,
): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (accessToken) {
    const result = await verifyAccessTokenDetailed(accessToken);

    if (result.valid) {
      if (!(await isFingerprintValid(request, result.payload))) {
        return redirectToLogin(request);
      }
      return injectUserHeaders(request, result.payload);
    }

    if (result.expired && refreshToken) {
      return attemptTokenRefresh(request, refreshToken);
    }
  }

  if (!accessToken && refreshToken) {
    return attemptTokenRefresh(request, refreshToken);
  }

  return redirectToLogin(request);
}

async function attemptTokenRefresh(
  request: NextRequest,
  refreshToken: string,
): Promise<NextResponse> {
  try {
    const refreshUrl = new URL("/api/auth/refresh", request.url);
    const refreshResponse = await fetch(refreshUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      const newAccessToken: string = data.data.accessToken;
      const newRefreshToken: string = data.data.refreshToken;

      const payload = await verifyAccessToken(newAccessToken);
      if (payload) {
        const response = injectUserHeaders(request, payload);

        response.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, {
          ...COOKIE_OPTIONS,
          maxAge: ACCESS_TOKEN_MAX_AGE,
        });
        response.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, {
          ...COOKIE_OPTIONS,
          maxAge: REFRESH_TOKEN_MAX_AGE,
        });

        return response;
      }
    }
  } catch (error) {
    console.error("[MIDDLEWARE] Token refresh failed:", error);
  }

  
  return redirectToLogin(request);
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

async function handleApiRoute(request: NextRequest): Promise<NextResponse> {
  
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const payload = await verifyAccessToken(token);
    if (payload) {
      if (!(await isFingerprintValid(request, payload))) {
        return NextResponse.json(
          { success: false, error: "Unauthorized: session fingerprint mismatch" },
          { status: 401 },
        );
      }
      return injectUserHeaders(request, payload);
    }
  }

  
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) {
      if (!(await isFingerprintValid(request, payload))) {
        return NextResponse.json(
          { success: false, error: "Unauthorized: session fingerprint mismatch" },
          { status: 401 },
        );
      }
      return injectUserHeaders(request, payload);
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: "Unauthorized: Missing or invalid token",
    },
    { status: 401 },
  );
}

export const config = {
  matcher: ["/", "/api/:path*", "/dashboard/:path*", "/dashboard"],
};