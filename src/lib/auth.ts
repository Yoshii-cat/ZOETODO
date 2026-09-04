import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const PARENT_COOKIE = "zoe_parent";

/**
 * The cookie holds a hash of the PIN, never the PIN itself, so a stolen cookie
 * cannot be read back into the number someone types on the iPad. Rotating
 * PARENT_PIN invalidates every existing cookie for free.
 */
export function parentToken(): string {
  const pin = process.env.PARENT_PIN;
  if (!pin) throw new Error("Missing PARENT_PIN. See .env.local.example.");
  return createHash("sha256").update(`zoe-today:${pin}`).digest("hex");
}

export function pinMatches(candidate: string): boolean {
  const pin = process.env.PARENT_PIN ?? "";
  const a = Buffer.from(createHash("sha256").update(candidate).digest());
  const b = Buffer.from(createHash("sha256").update(pin).digest());
  return pin.length > 0 && timingSafeEqual(a, b);
}

/** True when the caller already passed the PIN gate. */
export async function isParent(): Promise<boolean> {
  try {
    const jar = await cookies();
    const value = jar.get(PARENT_COOKIE)?.value;
    if (!value) return false;
    const expected = parentToken();
    if (value.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  } catch {
    return false;
  }
}
