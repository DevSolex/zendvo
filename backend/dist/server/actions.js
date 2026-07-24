"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGift = createGift;
exports.claimGift = claimGift;
const cache_1 = require("next/cache");
const pricing_1 = require("../lib/pricing");
async function createGift(formData) {
    console.log("Creating gift...");
    const amount = Number(formData.get("amount") || 0);
    const processingFee = Number(formData.get("processingFee") || 0);
    const totalAmount = Number(formData.get("totalAmount") || 0);
    const validation = (0, pricing_1.validateGiftPricing)(amount, processingFee, totalAmount);
    if (!validation.isValid) {
        console.error("Gift creation failed validation:", validation.error);
        return { success: false, error: validation.error };
    }
    // TODO: write gift records to the database here
    (0, cache_1.revalidatePath)("/dashboard");
    return { success: true };
}
async function claimGift(giftId) {
    console.log(`Claiming gift: ${giftId}`);
    (0, cache_1.revalidatePath)("/dashboard");
    return { success: true };
}
