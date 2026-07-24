import {
  generateOTP,
  storeOTP,
  verifyOTP,
  cleanupExpiredOTPs,
} from "../src/server/services/otpService";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  db: {
    query: {
      emailVerifications: {
        findFirst: jest.fn(),
      },
      users: {
        findFirst: jest.fn(),
      },
    },
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve()),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([{}])),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([{ id: "1" }, { id: "2" }])),
      })),
    })),
    transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve()),
          })),
        })),
        insert: jest.fn(() => ({
          values: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ id: "ev-new" }])),
          })),
        })),
      };
      return fn(tx);
    }),
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.requireActual("bcryptjs").hash,
}));

describe("OTP Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateOTP", () => {
    it("should generate a 6-digit string", () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });
  });

  describe("storeOTP", () => {
    it("should store OTP and invalidate previous records inside a transaction", async () => {
      await storeOTP("user-123", "123456");

      // Invalidation + insertion now happen inside a serializable transaction.
      expect(db.transaction).toHaveBeenCalled();
      // The users table lastOtpSentAt update still runs outside the transaction.
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("verifyOTP", () => {
    it("should fail if no verification found", async () => {
      (db.query.emailVerifications.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await verifyOTP("user-123", "123456");

      expect(result.detail).toBeDefined();
      expect(result.message).toContain("No verification code found");
    });

    it("should fail if expired", async () => {
      (db.query.emailVerifications.findFirst as jest.Mock).mockResolvedValue({
        id: "ev-1",
        otpHash: "salt:hash",
        expiresAt: new Date(Date.now() - 1000),
        attempts: 0,
      });

      const result = await verifyOTP("user-123", "123456");

      expect(result.detail).toBeDefined();
      expect(result.message).toContain("expired");
    });
  });

  describe("cleanupExpiredOTPs", () => {
    it("should return deleted count", async () => {
      const count = await cleanupExpiredOTPs();
      expect(count).toBe(2);
    });
  });
});
