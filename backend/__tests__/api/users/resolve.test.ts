import { NextRequest } from "next/server";
import { GET } from "@/app/api/users/resolve/route";
import { db } from "@/lib/db";
import { getAuthPayload } from "@/lib/auth-session";

jest.mock("drizzle-orm", () => ({
  eq: jest.fn(() => ({})),
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
  },
}));

jest.mock("@/lib/auth-session", () => ({
  getAuthPayload: jest.fn(),
}));

// Silence rate-limiter state leak between tests by resetting per unique key
const makeRequest = (phoneNumber?: string) => {
  const url = phoneNumber
    ? `http://localhost/api/users/resolve?phoneNumber=${encodeURIComponent(phoneNumber)}`
    : "http://localhost/api/users/resolve";
  return new NextRequest(url, { method: "GET" });
};

describe("GET /api/users/resolve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no auth token is provided", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest("+2348123456789"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.detail).toBeDefined();
  });

  it("returns 400 when phoneNumber query param is missing", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({
      userId: "sender-1",
      email: "sender@example.com",
      role: "Sender",
    });

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.detail).toContain("phoneNumber");
  });

  it("returns 400 for an invalid phone number format", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({
      userId: "sender-2",
      email: "sender@example.com",
      role: "Sender",
    });

    const response = await GET(makeRequest("not-a-phone"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.detail).toContain("Invalid phone number");
  });

  it("returns 404 when no user matches the phone number", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({
      userId: "sender-3",
      email: "sender@example.com",
      role: "Sender",
    });

    // Simulate empty DB result
    const limitMock = jest.fn().mockResolvedValue([]);
    const whereMock = jest.fn(() => ({ limit: limitMock }));
    const fromMock = jest.fn(() => ({ where: whereMock }));
    const selectMock = jest.fn(() => ({ from: fromMock }));
    (db.select as jest.Mock).mockImplementation(selectMock);

    const response = await GET(makeRequest("+2348123456789"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.detail).toBeDefined();
  });

  it("returns 200 with recipient data when found", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({
      userId: "sender-4",
      email: "sender@example.com",
      role: "Sender",
    });

    const limitMock = jest.fn().mockResolvedValue([
      {
        id: "recipient-uuid",
        name: "Jane Doe",
        avatarUrl: "https://example.com/avatar.jpg",
      },
    ]);
    const whereMock = jest.fn(() => ({ limit: limitMock }));
    const fromMock = jest.fn(() => ({ where: whereMock }));
    const selectMock = jest.fn(() => ({ from: fromMock }));
    (db.select as jest.Mock).mockImplementation(selectMock);

    const response = await GET(makeRequest("+2348123456789"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe("recipient-uuid");
    expect(json.data.name).toBe("Jane Doe");
    expect(json.data.avatarUrl).toBe("https://example.com/avatar.jpg");
    // Sensitive fields must not be present
    expect(json.data.email).toBeUndefined();
    expect(json.data.phoneNumber).toBeUndefined();
    expect(json.data.passwordHash).toBeUndefined();
  });

  it("accepts E.164 numbers with country codes other than +234", async () => {
    (getAuthPayload as jest.Mock).mockResolvedValue({
      userId: "sender-5",
      email: "sender@example.com",
      role: "Sender",
    });

    const limitMock = jest.fn().mockResolvedValue([
      { id: "uk-user", name: "John Smith", avatarUrl: null },
    ]);
    const whereMock = jest.fn(() => ({ limit: limitMock }));
    const fromMock = jest.fn(() => ({ where: whereMock }));
    const selectMock = jest.fn(() => ({ from: fromMock }));
    (db.select as jest.Mock).mockImplementation(selectMock);

    const response = await GET(makeRequest("+447911234567"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("uk-user");
  });
});
