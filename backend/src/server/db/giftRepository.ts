import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";

export interface CreateGiftInput {
  recipientId: string;
  amount: number;
  currency: string;
  paymentReference: string;
  paymentProvider: string;
  senderName?: string | null;
  senderEmail?: string | null;
  message?: string | null;
  template?: string | null;
  recipientPhone?: string | null;
  isAnonymous?: boolean;
}

export interface GiftRecord {
  id: string;
  recipientId: string;
  amount: number;
  fee: number;
  totalAmount: number;
  currency: string;
  paymentReference: string;
  paymentProvider: string | null;
  status: string;
  createdAt: Date;
}

export async function createGift(input: CreateGiftInput): Promise<GiftRecord> {
  const fee = 0;
  const totalAmount = input.amount + fee;

  const [gift] = await db
    .insert(gifts)
    .values({
      senderId: null,
      recipientId: input.recipientId,
      amount: input.amount,
      fee,
      totalAmount,
      currency: input.currency,
      paymentReference: input.paymentReference,
      paymentProvider: input.paymentProvider,
      senderName: input.senderName ?? null,
      senderEmail: input.senderEmail ?? null,
      message: input.message ?? null,
      template: input.template ?? null,
      recipientPhone: input.recipientPhone ?? null,
      isAnonymous: input.isAnonymous ?? false,
      status: "pending_otp",
    })
    .returning();

  return {
    id: gift.id,
    recipientId: gift.recipientId,
    amount: gift.amount,
    fee: gift.fee,
    totalAmount: gift.totalAmount,
    currency: gift.currency,
    paymentReference: gift.paymentReference!,
    paymentProvider: gift.paymentProvider,
    status: gift.status,
    createdAt: gift.createdAt,
  };
}

export async function findGiftByPaymentReference(
  reference: string,
): Promise<GiftRecord | null> {
  const gift = await db.query.gifts.findFirst({
    where: eq(gifts.paymentReference, reference),
  });

  if (!gift) return null;

  return {
    id: gift.id,
    recipientId: gift.recipientId,
    amount: gift.amount,
    fee: gift.fee,
    totalAmount: gift.totalAmount,
    currency: gift.currency,
    paymentReference: gift.paymentReference!,
    paymentProvider: gift.paymentProvider,
    status: gift.status,
    createdAt: gift.createdAt,
  };
}
