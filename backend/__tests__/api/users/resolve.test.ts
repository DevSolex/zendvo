import { NextRequest } from "next/server";
import { GET } from "@/app/api/users/resolve/route";
import { db } from "@/lib/db";
import { getAuthPayload } from "@/lib/auth-session";

jest.mock("drizzle-orm", () => ({
  eq: jest.fn(() => ({})),
  or: jest.fn(() => ({})),
}));

jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock("@/lib/db/schema", () => ({
  users: {
    id: "id",
    name: "name",
    avatarUrl: "avatarUrl",
    phoneNumber: "phoneNumber",
    email: "email",
  },
  wallets: {
    userId: "userId",
    currency: "currency",
  },
}));

jest.mock("@/lib/auth-session", () => ({
  getAuthPayload: jest.fn(),
}));

// Helpers to build requests
const makePhoneRequest = (phoneNumber?: string) => {
  const url = phoneNumber
    ? `http://localhost/api/users/resolve?phoneNumber=${encodeURIComponent(phoneNumber)}`
    : "http://localhost/api/users/resolve";
  return new NextRequest(url, { method: "GET" });
};

const makeEmailRequest = (email?: string) => {
  const url = email
    ? `http://localhost/api/users/resolve?email=${encodeURIComponent(email)}`
    : "http://localhost/api/users/resolve";
  return new NextRequest(url, { method: "GET" });
};

// Build a db.select() chain that returns first call result then second call result
const mockDbSelectChain = (firstResult: unknown[], secondResult: unknown[] = []) => {
  let callCount = 0;
  const makeLimitMock = () =>
    jest.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? Promise.resolve(firstResult) : Promise.resolve(secondResult);
    });

  const limitMock = makeLimitMock();
  const whereMock = jest.fn(() => ({ limit: limitMock }));
  const fromMock = jest.fn(() => ({ where: whereMock }));
  const selectMock = jest.fn(() => ({ from: fromMock }));
  (db.select as jest.Mock).mockImplementation(selectMock);
};

describe("GET /api/users/resolve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Authentication ──────────────────────────────────────────────────────────

  it("returns 401 when no auth token is provided", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue(null);

    const response = await GET(makePhoneRequest("+2348123456789"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.detail).toBeDefined();
  });

  // ── Missing / conflicting params ────────────────────────────────────────────

  it("returns 400 when neither phoneNumber nor email is provided", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-1", email: "s@x.com", role: "user" });

    const response = await GET(makePhoneRequest());
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.detail).toContain("phoneNumber");
  });

  it("returns 400 when both phoneNumber and email are provided", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-2", email: "s@x.com", role: "user" });

    const url = "http://localhost/api/users/resolve?phoneNumber=%2B2348123456789&email=jane%40example.com";
    const response = await GET(new NextRequest(url, { method: "GET" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.detail).toContain("only one");
  });

  // ── Phone number validation ─────────────────────────────────────────────────

  it("returns 400 for an invalid phone number format", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-3", email: "s@x.com", role: "user" });

    const response = await GET(makePhoneRequest("not-a-phone"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.detail).toContain("Invalid phone number");
  });

  // ── Email validation ────────────────────────────────────────────────────────

  it("returns 400 for an invalid email format", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-4", email: "s@x.com", role: "user" });

    const response = await GET(makeEmailRequest("not-an-email"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.detail).toContain("Invalid email");
  });

  // ── Not found ───────────────────────────────────────────────────────────────

  it("returns 404 when no user matches the phone number", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-5", email: "s@x.com", role: "user" });
    mockDbSelectChain([]);

    const response = await GET(makePhoneRequest("+2348123456789"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.detail).toBeDefined();
  });

  it("returns 404 when no user matches the email", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-6", email: "s@x.com", role: "user" });
    mockDbSelectChain([]);

    const response = await GET(makeEmailRequest("nobody@example.com"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.detail).toBeDefined();
  });

  // ── Successful phone lookup ─────────────────────────────────────────────────

  it("returns 200 with recipient data when found by phone", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-7", email: "s@x.com", role: "user" });

    mockDbSelectChain(
      [{ id: "recipient-uuid", name: "Jane Doe", avatarUrl: "https://example.com/avatar.jpg", email: "jane@example.com", phoneNumber: "+2348123456789" }],
      [{ currency: "NGN" }],
    );

    const response = await GET(makePhoneRequest("+2348123456789"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe("recipient-uuid");
    expect(json.data.name).toBe("Jane Doe");
    expect(json.data.avatarUrl).toBe("https://example.com/avatar.jpg");
    expect(json.data.currency).toBe("NGN");

    // Masking: raw PII must not be exposed
    expect(json.data.email).toBeUndefined();
    expect(json.data.phoneNumber).toBeUndefined();
    expect(json.data.passwordHash).toBeUndefined();

    // Masked versions should be present and redacted
    expect(json.data.maskedEmail).toBeDefined();
    expect(json.data.maskedEmail).not.toBe("jane@example.com");
    expect(json.data.maskedPhone).toBeDefined();
    expect(json.data.maskedPhone).not.toBe("+2348123456789");
  });

  // ── Successful email lookup ─────────────────────────────────────────────────

  it("returns 200 with recipient data when found by email", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-8", email: "s@x.com", role: "user" });

    mockDbSelectChain(
      [{ id: "recipient-uuid-2", name: "John Smith", avatarUrl: null, email: "john@example.com", phoneNumber: "+447911234567" }],
      [{ currency: "GBP" }],
    );

    const response = await GET(makeEmailRequest("john@example.com"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe("recipient-uuid-2");
    expect(json.data.name).toBe("John Smith");
    expect(json.data.currency).toBe("GBP");

    // Raw PII must not be exposed
    expect(json.data.email).toBeUndefined();
    expect(json.data.phoneNumber).toBeUndefined();

    // Masked versions present
    expect(json.data.maskedEmail).toBeDefined();
    expect(json.data.maskedEmail).not.toBe("john@example.com");
  });

  // ── International numbers ───────────────────────────────────────────────────

  it("accepts E.164 numbers with country codes other than +234", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-9", email: "s@x.com", role: "user" });

    mockDbSelectChain(
      [{ id: "uk-user", name: "John Smith", avatarUrl: null, email: "js@uk.com", phoneNumber: "+447911234567" }],
      [],
    );

    const response = await GET(makePhoneRequest("+447911234567"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("uk-user");
  });

  // ── No wallet ───────────────────────────────────────────────────────────────

  it("returns null currency when user has no wallet", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({ userId: "s-10", email: "s@x.com", role: "user" });

    mockDbSelectChain(
      [{ id: "no-wallet-user", name: "No Wallet", avatarUrl: null, email: "nw@example.com", phoneNumber: "+2348000000000" }],
      [], // empty wallet result
    );

    const response = await GET(makePhoneRequest("+2348000000000"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.currency).toBeNull();
  });
});
