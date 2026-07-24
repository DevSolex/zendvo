export const FEE_PERCENTAGE = 0.02; // 2% flat fee

export function calculateProcessingFee(amount: number): number {
  return amount * FEE_PERCENTAGE;
}

export function calculateTotalAmount(amount: number): number {
  return amount + calculateProcessingFee(amount);
}

export function validateGiftPricing(
  amount: number,
  fee: number,
  totalAmount: number
): { isValid: boolean; error?: string } {
  const expectedFee = calculateProcessingFee(amount);
  const expectedTotal = amount + expectedFee;

  // We use Math.abs to handle potential floating point precision issues
  if (Math.abs(fee - expectedFee) > 0.01) {
    return {
      isValid: false,
      error: `Invalid processing fee. Expected ${expectedFee}, got ${fee}`,
    };
  }

  if (Math.abs(totalAmount - expectedTotal) > 0.01) {
    return {
      isValid: false,
      error: `Invalid total amount. Expected ${expectedTotal}, got ${totalAmount}`,
    };
  }

  return { isValid: true };
}
