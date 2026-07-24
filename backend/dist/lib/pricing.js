"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEE_PERCENTAGE = void 0;
exports.calculateProcessingFee = calculateProcessingFee;
exports.calculateTotalAmount = calculateTotalAmount;
exports.validateGiftPricing = validateGiftPricing;
exports.FEE_PERCENTAGE = 0.02; // 2% flat fee
function calculateProcessingFee(amount) {
    return amount * exports.FEE_PERCENTAGE;
}
function calculateTotalAmount(amount) {
    return amount + calculateProcessingFee(amount);
}
function validateGiftPricing(amount, fee, totalAmount) {
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
