import Stripe from "stripe";

export class StripeCheckoutError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StripeCheckoutError";
  }
}

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return new Stripe(key);
}

export interface CreateCheckoutSessionInput {
  giftId: string;
  paymentReference: string;
  amount: number;
  currency: string;
  senderEmail?: string | null;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CheckoutSession> {
  const stripe = getStripeClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amount,
            product_data: { name: "Gift Payment" },
          },
          quantity: 1,
        },
      ],
      client_reference_id: input.paymentReference,
      metadata: {
        gift_id: input.giftId,
        payment_reference: input.paymentReference,
      },
      ...(input.senderEmail ? { customer_email: input.senderEmail } : {}),
      success_url: `${appUrl}/gifts/success?ref=${input.paymentReference}`,
      cancel_url: `${appUrl}/gifts/cancel?ref=${input.paymentReference}`,
    });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      throw new StripeCheckoutError(`Stripe API error: ${err.message}`, err);
    }
    throw new StripeCheckoutError(
      "Unexpected error creating checkout session",
      err,
    );
  }

  if (!session.url) {
    throw new StripeCheckoutError(
      "Stripe returned a session without a checkout URL",
    );
  }

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
}
