import { NextResponse } from "next/server";
import { isParent } from "@/lib/auth";
import { supabase, type Task } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

async function guard() {
  if (await isParent()) return null;
  return NextResponse.json({ error: "Not signed in" }, { status: 401 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { data, error } = await supabase()
      .from("tasks")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ tasks: (data ?? []) as Task[] });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}

/** Add a task. */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  let body: { name?: unknown; subtitle?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const subtitle = typeof body.subtitle === "string" ? body.subtitle.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const base = slugify(name) || "task";

  try {
    const db = supabase();
    const { data: existing, error: exErr } = await db.from("tasks").select("id, sort_order");
    if (exErr) throw exErr;

    const taken = new Set((existing ?? []).map((t) => t.id as string));
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}${n}`;

    const nextOrder =
      (existing ?? []).reduce((m, t) => Math.max(m, (t.sort_order as number) ?? 0), 0) + 1;

    const { data, error } = await db
      .from("tasks")
      .insert({ id, name, subtitle, sort_order: nextOrder, active: true })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ task: data as Task });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}

/** Rename, retitle, activate or deactivate. History is never touched. */
export async function PATCH(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  let body: { id?: unknown; name?: unknown; subtitle?: unknown; active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    patch.name = name;
  }
  if (typeof body.subtitle === "string") patch.subtitle = body.subtitle.trim();
  if (typeof body.active === "boolean") patch.active = body.active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase()
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ task: data as Task });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}

/** Reorder: body is the full list of ids in the order they should appear. */
export async function PUT(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  let body: { order?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const order = Array.isArray(body.order)
    ? body.order.filter((v): v is string => typeof v === "string")
    : null;
  if (!order || order.length === 0) {
    return NextResponse.json({ error: "order must be a list of ids" }, { status: 400 });
  }

  try {
    const db = supabase();
    for (let i = 0; i < order.length; i++) {
      const { error } = await db
        .from("tasks")
        .update({ sort_order: i + 1 })
        .eq("id", order[i]);
      if (error) throw error;
    }
    const { data, error } = await db
      .from("tasks")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ tasks: (data ?? []) as Task[] });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}

function msg(e: unknown) {
  return e instanceof Error ? e.message : "Database error";
}
