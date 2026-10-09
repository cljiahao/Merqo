import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTelegramMessage, generateLinkToken } from "./telegram";

const ORIGINAL_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = ORIGINAL_TOKEN;
  vi.restoreAllMocks();
});

describe("sendTelegramMessage", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token-123";
  });

  it("POSTs to the Telegram sendMessage endpoint with chat_id + text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await sendTelegramMessage(555, "Your order is ready!");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token-123/sendMessage");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(JSON.parse(init.body)).toEqual({
      chat_id: 555,
      text: "Your order is ready!",
    });
  });

  it("no-ops without throwing when TELEGRAM_BOT_TOKEN is unset", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTelegramMessage(555, "hi")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("catches a fetch rejection instead of propagating it", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendTelegramMessage(555, "hi")).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("generateLinkToken", () => {
  it("returns a string matching Telegram's deep-link payload charset (<=64 chars)", () => {
    const token = generateLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("returns a different token on each call", () => {
    expect(generateLinkToken()).not.toBe(generateLinkToken());
  });
});

it("does not log transport errors that can contain the bot credential", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token-123");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(
        new Error("https://api.telegram.org/bottest-token-123/sendMessage"),
      ),
  );
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(sendTelegramMessage(555, "hello")).resolves.toBeUndefined();
  expect(JSON.stringify(log.mock.calls)).not.toContain("test-token-123");
  expect(log).toHaveBeenCalledWith("sendTelegramMessage failed");
  vi.unstubAllEnvs();
});

it("bounds delivery attempts with an abort signal", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token-123");
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  await sendTelegramMessage(555, "hello");
  expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  vi.unstubAllEnvs();
});
