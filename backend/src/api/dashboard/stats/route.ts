import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gifts, wallets } from "@/lib/db/schema";
import { and, count, eq, gt, isNotNull, notInArray } from "drizzle-orm";
import { getAuthPayload } from "@/lib/auth-session";
import { createProblemDetails } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return createProblemDetails("about:blank", "Unauthorized", 401, "Unauthorized");
    }

    const { userId } = payload;
    const now = new Date();

    const [giftsReceived, giftsSent, unopenedGifts, userWallets] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(gifts)
          .where(and(eq(gifts.recipientId, userId), eq(gifts.status, "completed"))),

        db
          .select({ count: count() })
          .from(gifts)
          .where(and(eq(gifts.senderId, userId), eq(gifts.status, "completed"))),

        db
          .select({ count: count() })
          .from(gifts)
          .where(
            and(
              eq(gifts.recipientId, userId),
              notInArray(gifts.status, ["completed", "failed", "sent"]),
              isNotNull(gifts.unlockDatetime),
              gt(gifts.unlockDatetime, now),
            ),
          ),

        db
          .select({ currency: wallets.currency, balance: wallets.balance })
          .from(wallets)
          .where(eq(wallets.userId, userId)),
      ]);

    return NextResponse.json(
      {
        success: true,
        stats: {
          accountBalance: userWallets,
          giftsReceived: giftsReceived[0]?.count ?? 0,
          giftsSent: giftsSent[0]?.count ?? 0,
          unopenedGifts: unopenedGifts[0]?.count ?? 0,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in dashboard/stats:", error);
    return createProblemDetails(
      "about:blank",
      "Internal Server Error",
      500,
      "Internal server error",
    );
  }
}
