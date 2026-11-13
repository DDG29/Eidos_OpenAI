import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { openSession, sealSession } from "./token";

const key = randomBytes(32);

describe("session tokens", () => {
  it("round-trips", () => {
    const t = sealSession({ fileIds: ["file_1"], mode: "pdf", docTitles: ["A"] }, 60_000, key)!;
    expect(openSession(t, key)).toMatchObject({ fileIds: ["file_1"], mode: "pdf" });
  });
  it("rejects expired tokens", () => {
    const t = sealSession({ fileIds: ["f"], mode: "text", docTitles: [] }, -1, key)!;
    expect(openSession(t, key)).toBeNull();
  });
  it("detects tampering and wrong keys", () => {
    const t = sealSession({ fileIds: ["f"], mode: "text", docTitles: [] }, 60_000, key)!;
    const b = Buffer.from(t, "base64url");
    b[20] = b[20]! ^ 1;
    expect(openSession(b.toString("base64url"), key)).toBeNull();
    expect(openSession(t, randomBytes(32))).toBeNull();
    expect(openSession("garbage", key)).toBeNull();
  });
  it("returns null without a secret", () => {
    expect(sealSession({ fileIds: [], mode: "topic", docTitles: [] }, 1000, null)).toBeNull();
  });
});
