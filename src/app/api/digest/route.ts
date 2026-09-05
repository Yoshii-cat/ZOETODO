import { Resend } from "resend";
import { isParent } from "@/lib/auth";
import { nyDay, nyHour } from "@/lib/date";
import { buildDigest, digestHtml, digestSubject } from "@/lib/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SEND_HOUR = 20; // 8pm New York

function parentsUrl(req: Request): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : new URL(req.url).origin);
  return `${base.replace(/\/$/, "")}/parents`;
}

function recipients(): string[] {
  return (process.env.DIGEST_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Browser preview for testing. PIN gated, sends nothing.
  if (url.searchParams.get("preview") === "1") {
    if (!(await isParent())) {
      return new Response("Sign in at /parents first.", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const data = await buildDigest(url.searchParams.get("day") ?? nyDay());
    const html = digestHtml(data, parentsUrl(req));
    return new Response(
      `<!-- Subject: ${digestSubject(data)} -->\n${html}`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Cron path. Vercel sends CRON_SECRET as a bearer token.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Vercel schedules in UTC, and 8pm New York is 00:00 UTC in summer but
  // 01:00 UTC in winter. The Hobby plan only allows daily crons, so
  // vercel.json fires once at each of those hours and every run that is not
  // actually the 8pm hour in New York exits here.
  const hour = nyHour();
  const force = url.searchParams.get("force") === "1";
  if (hour !== SEND_HOUR && !force) {
    return Response.json({ skipped: true, nyHour: hour });
  }

  const to = recipients();
  if (to.length === 0) {
    return Response.json({ error: "DIGEST_TO is empty" }, { status: 500 });
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM;
  if (!apiKey || !from) {
    return Response.json(
      { error: "Missing RESEND_API_KEY or DIGEST_FROM" },
      { status: 500 }
    );
  }

  try {
    const data = await buildDigest();
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject: digestSubject(data),
      html: digestHtml(data, parentsUrl(req)),
    });
    if (error) throw new Error(error.message);

    return Response.json({
      sent: true,
      day: data.day,
      to: to.length,
      done: data.done.length,
      skipped: data.skipped.length,
      notStarted: data.notStarted.length,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Send failed" },
      { status: 500 }
    );
  }
}
