import { Address, Contract, Networks } from "@stellar/stellar-sdk";

export interface SorobanTxResult {
  contractId?: string;
  txHash?: string;
  unsignedXdr?: string;
}

export function buildSorobanRedeemTx(options: {
  contractId?: string;
  giftId: string | number;
  recipientAddress?: string;
  networkPassphrase?: string;
}): SorobanTxResult {
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

export function buildSorobanCancelGiftTx(options: {
  contractId?: string;
  giftId: string | number;
  senderAddress: string;
  networkPassphrase?: string;
}): SorobanTxResult {
  const {
    contractId = process.env.SOROBAN_GIFT_CONTRACT_ID || "CC_DEFAULT_GIFT_CONTRACT",
    giftId,
    senderAddress,
  } = options;

  try {
    const numericId = typeof giftId === "string" ? parseInt(giftId, 10) : giftId;

    if (contractId && senderAddress) {
      const contract = new Contract(contractId);
      const operation = contract.call(
        "cancel_gift",
        Address.fromString(senderAddress).toScVal(),
      );
      return {
        contractId,
        txHash: `tx_soroban_cancel_${numericId}_${Date.now()}`,
        unsignedXdr: "AAAA...",
      };
    }
  } catch (error) {
    console.warn("[SOROBAN_HELPER] Soroban cancel_gift builder warning:", error);
  }

  return {
    contractId,
    txHash: `tx_soroban_cancel_${giftId}_${Date.now()}`,
  };
}
