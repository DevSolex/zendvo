import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAuthPayload } from "@/lib/auth-session";
import { createProblemDetails } from "@/lib/api-utils";
import { sanitizePhoneNumber, validateE164PhoneNumber } from "@/lib/validation";
import { consumeRateLimit } from "@/lib/rate-limiter";

// 20 lookups per minute per authenticated user — enough for legitimate use,
// tight enough to prevent phone-number enumeration.
const RESOLVE_RATE_LIMIT = 20;
const RESOLVE_RATE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {
  try {
    // --- Authentication ---
    const payload = await getAuthPayload(request);
    if (!payload) {
      return createProblemDetails(
        "about:blank",
        "Unauthorized",
        401,
        "Authentication is required to resolve a recipient.",
      );
    }

    // --- Rate limiting (keyed per authenticated user) ---
    const rateLimitStatus = consumeRateLimit(
      `resolve:${payload.userId}`,
      RESOLVE_RATE_LIMIT,
      RESOLVE_RATE_WINDOW_MS,
    );
    if (rateLimitStatus.limited) {
      return createProblemDetails(
        "about:blank",
        "Too Many Requests",
        429,
        "Too many lookup attempts. Please wait before trying again.",
      );
    }

    // --- Input validation ---
    const { searchParams } = new URL(request.url);
    const rawPhone = searchParams.get("phoneNumber");

    if (!rawPhone || rawPhone.trim() === "") {
      return createProblemDetails(
        "about:blank",
        "Bad Request",
        400,
        "Query parameter 'phoneNumber' is required.",
      );
    }

    if (!validateE164PhoneNumber(rawPhone)) {
      return createProblemDetails(
        "about:blank",
        "Bad Request",
        400,
        "Invalid phone number format. Use E.164 format (e.g. +2348123456789).",
      );
    }

    const sanitizedPhone = sanitizePhoneNumber(rawPhone);

    // --- Database lookup ---
    const recipientRows = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.phoneNumber, sanitizedPhone))
      .limit(1);

    const recipient = recipientRows[0];

    if (!recipient) {
      return createProblemDetails(
        "about:blank",
        "Not Found",
        404,
        "No account found with the provided phone number.",
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: recipient.id,
          name: recipient.name,
          avatarUrl: recipient.avatarUrl,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[RESOLVE_RECIPIENT_ERROR]", error);
    return createProblemDetails(
      "about:blank",
      "Internal Server Error",
      500,
      "Internal server error.",
    );
  }
}
