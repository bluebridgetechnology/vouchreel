import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const close = vi.fn();
const createTransport = vi.fn((_options: Record<string, unknown>) => ({ sendMail, close }));
vi.mock("nodemailer", () => ({ default: { createTransport: (o: Record<string, unknown>) => createTransport(o) } }));

const { sendEmail } = await import("../transport");

const message = { to: "ada@example.com", subject: "Hi", text: "Hello" };
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY", "EMAIL_FROM"]) {
    vi.stubEnv(k, "");
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  sendMail.mockReset();
  createTransport.mockClear();
  fetchMock.mockReset();
});

describe("sendEmail", () => {
  it("logs when no provider is configured", async () => {
    expect(await sendEmail(message)).toEqual({ sent: false, provider: "log" });
    expect(createTransport).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Resend when only RESEND_API_KEY is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "r1" }), { status: 200 }));
    expect(await sendEmail(message)).toEqual({ sent: true, provider: "resend", id: "r1" });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("sends over SMTP when SMTP_HOST is set, with STARTTLS defaults on 587", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "u");
    vi.stubEnv("SMTP_PASS", "p");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    sendMail.mockResolvedValue({ messageId: "<m1@example.com>" });

    expect(await sendEmail(message)).toEqual({ sent: true, provider: "smtp", id: "<m1@example.com>" });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.example.com", port: 587, secure: false, auth: { user: "u", pass: "p" } }),
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.com", from: "Vouchreel <no-reply@vouchreel.com>" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defaults to implicit TLS on port 465 and omits auth without a user", async () => {
    vi.stubEnv("SMTP_HOST", "relay.example.com");
    vi.stubEnv("SMTP_PORT", "465");
    sendMail.mockResolvedValue({ messageId: "m2" });
    await sendEmail(message);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true, auth: undefined }));
  });

  it("falls back to Resend when SMTP fails and a key is set", async () => {
    vi.stubEnv("SMTP_HOST", "down.example.com");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    sendMail.mockRejectedValue(new Error("ECONNREFUSED"));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "r2" }), { status: 200 }));
    expect(await sendEmail(message)).toEqual({ sent: true, provider: "resend", id: "r2" });
  });

  it("returns the SMTP error without throwing when there is no fallback", async () => {
    vi.stubEnv("SMTP_HOST", "down2.example.com");
    sendMail.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await sendEmail(message)).toEqual({ sent: false, provider: "smtp", error: "ECONNREFUSED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
