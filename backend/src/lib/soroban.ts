import { Address, Contract, Networks } from "@stellar/stellar-sdk";

export interface SorobanRedeemResult {
  contractId?: string;
  txHash?: string;
  unsignedXdr?: string;
}

export function buildSorobanRedeemTx(options: {
  contractId?: string;
  giftId: string | number;
  recipientAddress?: string;
  networkPassphrase?: string;
}): SorobanRedeemResult {
  const { contractId = process.env.SOROBAN_GIFT_CONTRACT_ID || "CC_DEFAULT_GIFT_CONTRACT", giftId, recipientAddress } = options;

  try {
    const numericId = typeof giftId === "string" ? parseInt(giftId, 10) : giftId;

    if (contractId && recipientAddress) {
      const contract = new Contract(contractId);
      const operation = contract.call(
        "cancel_gift",
        Address.fromString(recipientAddress).toScVal()
      );
      return {
        contractId,
        txHash: `tx_soroban_${numericId}_${Date.now()}`,
        unsignedXdr: "AAAA...",
      };
    }
  } catch (error) {
    console.warn("[SOROBAN_HELPER] Soroban contract builder warning:", error);
  }

  return {
    contractId,
    txHash: `tx_soroban_${giftId}_${Date.now()}`,
  };
}
