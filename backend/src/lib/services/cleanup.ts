import { db } from "@/lib/db";
import {
  users,
  gifts,
  refreshTokens,
  emailVerifications,
  passwordResets,
  actionTokens,
  wallets,
  notifications,
  bankAccounts,
  transactions,
} from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { buildSorobanCancelGiftTx } from "@/lib/soroban";
import {
  AuditEventType,
  logAuditEvent,
} from "@/server/services/auditService";

export interface AccountDeletionResult {
  success: boolean;
  message: string;
  giftsResolved: number;
  giftsCancelled: number;
  tokensRevoked: number;
  error?: string;
  detail?: string;
}

const UNCLAIMED_GIFT_STATUSES = [
  "pending_otp",
  "otp_verified",
  "pending_review",
  "confirmed",
] as const;

export async function deleteAccount(
  userId: string,
): Promise<AccountDeletionResult> {
  const now = new Date();

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return {
        success: false,
        message: "User not found",
        giftsResolved: 0,
        giftsCancelled: 0,
        tokensRevoked: 0,
        error: "USER_NOT_FOUND",
        detail: "USER_NOT_FOUND",
      };
    }

    if (user.status === "suspended") {
      return {
        success: false,
        message: "Cannot delete a suspended account. Please contact support.",
        giftsResolved: 0,
        giftsCancelled: 0,
        tokensRevoked: 0,
        error: "ACCOUNT_SUSPENDED",
        detail: "ACCOUNT_SUSPENDED",
      };
    }

    const unclaimedSentGifts = await db.query.gifts.findMany({
      where: and(
        eq(gifts.senderId, userId),
        or(
          ...UNCLAIMED_GIFT_STATUSES.map((status) =>
            eq(gifts.status, status)
          )
        )
      ),
    });

    const unclaimedReceivedGifts = await db.query.gifts.findMany({
      where: and(
        eq(gifts.recipientId, userId),
        or(
          ...UNCLAIMED_GIFT_STATUSES.map((status) =>
            eq(gifts.status, status)
          )
        )
      ),
    });

    const allUnclaimedGifts = [...unclaimedSentGifts, ...unclaimedReceivedGifts];

    let giftsCancelled = 0;
    const blockchainResults: Array<{
      giftId: string;
      txHash?: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const gift of unclaimedSentGifts) {
      try {
        if (gift.senderId) {
          const sorobanResult = buildSorobanCancelGiftTx({
            giftId: gift.id,
            senderAddress: gift.senderId,
          });

          await db
            .update(gifts)
            .set({
              status: "failed",
              updatedAt: now,
              blockchainTxHash: sorobanResult.txHash || gift.blockchainTxHash,
            })
            .where(eq(gifts.id, gift.id));

          blockchainResults.push({
            giftId: gift.id,
            txHash: sorobanResult.txHash,
            success: true,
          });

          logAuditEvent({
            timestamp: now,
            eventType: AuditEventType.GIFT_CANCELLED_FOR_DELETION,
            userId,
            metadata: {
              giftId: gift.id,
              amount: gift.amount,
              currency: gift.currency,
              direction: "sent",
              blockchainTxHash: sorobanResult.txHash,
            },
            message: `Gift ${gift.id} cancelled due to account deletion (sender)`,
          });
        }
      } catch (error) {
        console.error(
          `[ACCOUNT_DELETION] Failed to cancel sent gift ${gift.id}:`,
          error
        );
        blockchainResults.push({
          giftId: gift.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    for (const gift of unclaimedReceivedGifts) {
      try {
        await db
          .update(gifts)
          .set({
            status: "failed",
            updatedAt: now,
          })
          .where(eq(gifts.id, gift.id));

        giftsCancelled++;

        logAuditEvent({
          timestamp: now,
          eventType: AuditEventType.GIFT_CANCELLED_FOR_DELETION,
          userId,
          metadata: {
            giftId: gift.id,
            amount: gift.amount,
            currency: gift.currency,
            direction: "received",
          },
          message: `Gift ${gift.id} cancelled due to account deletion (recipient)`,
        });
      } catch (error) {
        console.error(
          `[ACCOUNT_DELETION] Failed to cancel received gift ${gift.id}:`,
          error
        );
      }
    }

    giftsCancelled = blockchainResults.filter((r) => r.success).length +
      unclaimedReceivedGifts.length;

    const revokedTokens = await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt)
        )
      )
      .returning();

    await db
      .update(actionTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(actionTokens.userId, userId),
          isNull(actionTokens.revokedAt)
        )
      );

    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, userId));

    await db
      .delete(passwordResets)
      .where(eq(passwordResets.userId, userId));

    const anonymizedEmail = `deleted_${userId}@deleted.invalid`;
    const anonymizedPhone = null;

    await db
      .update(users)
      .set({
        email: anonymizedEmail,
        passwordHash: "DELETED",
        name: "Deleted User",
        phoneNumber: anonymizedPhone,
        username: null,
        avatarUrl: null,
        phoneLast4: null,
        status: "suspended",
        role: "user",
        loginAttempts: 0,
        lockUntil: null,
        otpFailedAttempts: 0,
        otpAttemptsWindowStart: null,
        lastLogin: null,
        lastOtpSentAt: null,
        isPhoneVerified: false,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    await db
      .delete(wallets)
      .where(eq(wallets.userId, userId));

    await db
      .delete(notifications)
      .where(eq(notifications.userId, userId));

    await db
      .delete(bankAccounts)
      .where(eq(bankAccounts.userId, userId));

    logAuditEvent({
      timestamp: now,
      eventType: AuditEventType.ACCOUNT_DELETION_COMPLETED,
      userId,
      metadata: {
        giftsResolved: allUnclaimedGifts.length,
        giftsCancelled,
        tokensRevoked: revokedTokens.length,
        blockchainResults,
      },
      message: `Account ${userId} successfully deleted`,
    });

    return {
      success: true,
      message: "Account successfully deleted",
      giftsResolved: allUnclaimedGifts.length,
      giftsCancelled,
      tokensRevoked: revokedTokens.length,
    };
  } catch (error) {
    console.error("[ACCOUNT_DELETION_ERROR]", error);

    logAuditEvent({
      timestamp: now,
      eventType: AuditEventType.ACCOUNT_DELETION_FAILED,
      userId,
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      message: `Account deletion failed for user ${userId}`,
    });

    return {
      success: false,
      message: "Failed to delete account",
      giftsResolved: 0,
      giftsCancelled: 0,
      tokensRevoked: 0,
      error: "DELETION_FAILED",
      detail: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
