import { nyDay, nyShortDate, nyTime } from "./date";
import { supabase, type Completion, type Task } from "./supabase";

export type DigestData = {
  day: string;
  done: { name: string; time: string; recap: string }[];
  skipped: { name: string; reason: string }[];
  notStarted: string[];
};

export async function buildDigest(day = nyDay()): Promise<DigestData> {
  const db = supabase();
  const [taskRes, compRes] = await Promise.all([
    db.from("tasks").select("*").eq("active", true).order("sort_order", { ascending: true }),
    db.from("completions").select("*").eq("day", day),
  ]);
  if (taskRes.error) throw taskRes.error;
  if (compRes.error) throw compRes.error;

  const tasks = (taskRes.data ?? []) as Task[];
  const rows = new Map(
    ((compRes.data ?? []) as Completion[]).map((c) => [c.task_id, c])
  );

  const data: DigestData = { day, done: [], skipped: [], notStarted: [] };

  for (const t of tasks) {
    const row = rows.get(t.id);
    if (row?.status === "done") {
      data.done.push({
        name: t.name,
        time: nyTime(row.created_at),
        recap: row.recap ?? "",
      });
    } else if (row?.status === "skipped") {
      data.skipped.push({ name: t.name, reason: row.reason ?? "" });
    } else {
      data.notStarted.push(t.name);
    }
  }

  return data;
}

export function digestSubject(d: DigestData): string {
  return `Zoe, ${nyShortDate(d.day)}: ${d.done.length} done, ${d.skipped.length} skipped, ${d.notStarted.length} not started`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function digestHtml(d: DigestData, parentsUrl: string): string {
  const total = d.done.length + d.skipped.length + d.notStarted.length;

  const section = (
    title: string,
    accent: string,
    count: number,
    inner: string
  ) => `
    <tr><td style="padding:26px 26px 0">
      <div style="font:800 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:1.2px;text-transform:uppercase;color:${accent}">
        ${esc(title)} &middot; ${count}
      </div>
    </td></tr>
    <tr><td style="padding:12px 26px 0">${inner}</td></tr>`;

  const doneRows = d.done.length
    ? d.done
        .map(
          (x) => `
      <div style="background:#f7f3ea;border-left:5px solid #b9d63f;border-radius:10px;padding:14px 16px;margin-bottom:10px">
        <div style="font:800 17px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1f3a">
          ${esc(x.name)}
          <span style="font-weight:600;font-size:13px;color:#7c7f94"> &middot; ${esc(x.time)}</span>
        </div>
        <div style="font:600 16px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1f3a;margin-top:6px">
          &ldquo;${esc(x.recap)}&rdquo;
        </div>
      </div>`
        )
        .join("")
    : `<div style="font:600 16px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#7c7f94">Nothing finished today.</div>`;

  const skipRows = d.skipped.length
    ? d.skipped
        .map(
          (x) => `
      <div style="background:#f7f3ea;border-left:5px solid #ff7a59;border-radius:10px;padding:14px 16px;margin-bottom:10px">
        <div style="font:800 17px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1f3a">${esc(x.name)}</div>
        <div style="font:600 16px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1f3a;margin-top:6px">
          &ldquo;${esc(x.reason)}&rdquo;
        </div>
      </div>`
        )
        .join("")
    : `<div style="font:600 16px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#7c7f94">Nothing skipped.</div>`;

  const notRows = d.notStarted.length
    ? `<div style="font:700 16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1f3a">${d.notStarted
        .map(esc)
        .join("<br>")}</div>`
    : `<div style="font:600 16px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#7c7f94">She got to everything.</div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(digestSubject(d))}</title>
</head>
<body style="margin:0;padding:0;background:#1b1f3a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1b1f3a;padding:24px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">

    <tr><td style="background:#1b1f3a;padding:26px">
      <div style="font:600 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#c9b8ff">${esc(nyShortDate(d.day))}</div>
      <div style="font:800 30px/1.15 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f7f3ea;margin-top:8px">
        Zoe finished <span style="color:#d6f25a">${d.done.length} of ${total}</span>.
      </div>
    </td></tr>

    ${section("Done", "#5f8a00", d.done.length, doneRows)}
    ${section("Skipped", "#d1502f", d.skipped.length, skipRows)}
    ${section("Not started", "#7c7f94", d.notStarted.length, notRows)}

    <tr><td style="padding:26px">
      <a href="${esc(parentsUrl)}" style="font:700 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1f3a">
        See the whole picture &rarr;
      </a>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}
