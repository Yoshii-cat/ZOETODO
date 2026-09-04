import { NextResponse } from "next/server";
import { nyDay } from "@/lib/date";
import { supabase, type Completion } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Today's rows, plus the server's idea of today so the iPad can roll over. */
export async function GET() {
  const day = nyDay();
  try {
    const { data, error } = await supabase()
      .from("completions")
      .select("*")
      .eq("day", day);
    if (error) throw error;
    return NextResponse.json({ day, completions: (data ?? []) as Completion[] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const day = nyDay();

  let body: { taskId?: unknown; status?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const status = body.status === "done" || body.status === "skipped" ? body.status : null;
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!taskId || !status) {
    return NextResponse.json({ error: "taskId and status are required" }, { status: 400 });
  }
  // A recap or a reason is the whole point: never record one without it.
  if (text.length < 3) {
    return NextResponse.json(
      { error: status === "done" ? "Recap is required" : "Reason is required" },
      { status: 400 }
    );
  }

  try {
    const db = supabase();

    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .eq("active", true)
      .maybeSingle();
    if (taskErr) throw taskErr;
    if (!task) return NextResponse.json({ error: "Unknown task" }, { status: 404 });

    const { data, error } = await db
      .from("completions")
      .upsert(
        {
          task_id: taskId,
          day,
          status,
          recap: status === "done" ? text : null,
          reason: status === "skipped" ? text : null,
        },
        { onConflict: "task_id,day" }
      )
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ completion: data as Completion });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 }
    );
  }
}

/** Undo: today's row for this task goes away entirely. */
export async function DELETE(req: Request) {
  const day = nyDay();
  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  try {
    const { error } = await supabase()
      .from("completions")
      .delete()
      .eq("task_id", taskId)
      .eq("day", day);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 }
    );
  }
}
