import TodayClient from "./TodayClient";
import { nyDay } from "@/lib/date";
import { supabase, type Completion, type Task } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Page() {
  const day = nyDay();

  let tasks: Task[] = [];
  let completions: Completion[] = [];
  let error: string | null = null;

  try {
    const db = supabase();
    const [taskRes, compRes] = await Promise.all([
      db
        .from("tasks")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      db.from("completions").select("*").eq("day", day),
    ]);

    if (taskRes.error) throw taskRes.error;
    if (compRes.error) throw compRes.error;

    tasks = (taskRes.data ?? []) as Task[];
    completions = (compRes.data ?? []) as Completion[];
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach the database.";
  }

  return (
    <TodayClient
      day={day}
      tasks={tasks}
      completions={completions}
      loadError={error}
    />
  );
}
