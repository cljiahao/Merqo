import { describe, it, expect, afterEach } from "vitest";
import { customerNotifySecretOk } from "./customer-notify-auth";

const ORIGINAL_SECRET = process.env.MERQO_CUSTOMER_SECRET;
const SECRET = "customer-notify-secret-xyz";

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.MERQO_CUSTOMER_SECRET;
  else process.env.MERQO_CUSTOMER_SECRET = ORIGINAL_SECRET;
});

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://merqo.example.com/api/merqo/notify-customer", {
    method: "POST",
    headers,
  });
}

describe("customerNotifySecretOk", () => {
  it("passes with a valid Authorization: Bearer <MERQO_CUSTOMER_SECRET> header", () => {
    process.env.MERQO_CUSTOMER_SECRET = SECRET;
    const request = makeRequest({ authorization: `Bearer ${SECRET}` });
    expect(customerNotifySecretOk(request)).toBe(true);
  });

  it("fails when the Authorization header is missing", () => {
    process.env.MERQO_CUSTOMER_SECRET = SECRET;
    expect(customerNotifySecretOk(makeRequest())).toBe(false);
  });

  it("fails when the Authorization header has the wrong prefix", () => {
    process.env.MERQO_CUSTOMER_SECRET = SECRET;
    const request = makeRequest({ authorization: `Token ${SECRET}` });
    expect(customerNotifySecretOk(request)).toBe(false);
  });

  it("fails when the bearer value is the wrong secret", () => {
    process.env.MERQO_CUSTOMER_SECRET = SECRET;
    const request = makeRequest({ authorization: "Bearer wrong-secret" });
    expect(customerNotifySecretOk(request)).toBe(false);
  });

  it("fails when the bearer value has the wrong length (not just wrong content)", () => {
    process.env.MERQO_CUSTOMER_SECRET = SECRET;
    const request = makeRequest({ authorization: "Bearer short" });
    expect(customerNotifySecretOk(request)).toBe(false);
  });

  it("fails closed when MERQO_CUSTOMER_SECRET is not configured server-side", () => {
    delete process.env.MERQO_CUSTOMER_SECRET;
    const request = makeRequest({ authorization: `Bearer ${SECRET}` });
    expect(customerNotifySecretOk(request)).toBe(false);
  });
});
