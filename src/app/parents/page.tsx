import Charts from "./Charts";
import Log from "./Log";
import PinGate from "./PinGate";
import SignOut from "./SignOut";
import TaskManager from "./TaskManager";
import "./parents.css";
import { isParent } from "@/lib/auth";
import {
  addDays,
  dayToUtcDate,
  nyDay,
  nyLongDate,
  nyTime,
  weekDays,
} from "@/lib/date";
import { WEEKDAY_ONLY, currentStreak } from "@/lib/streak";
import {
  fetchAllCompletions,
  supabase,
  type Completion,
  type Task,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function ParentsPage() {
  if (!(await isParent())) {
    return (
      <div className="p-wrap">
        <PinGate />
      </div>
    );
  }

  const today = nyDay();

  let tasks: Task[] = [];
  let completions: Completion[] = [];
  let error: string | null = null;

  try {
    const db = supabase();
    const [taskRes, allCompletions] = await Promise.all([
      db.from("tasks").select("*").order("sort_order", { ascending: true }),
      fetchAllCompletions(),
    ]);
    if (taskRes.error) throw taskRes.error;
    tasks = (taskRes.data ?? []) as Task[];
    completions = allCompletions;
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach the database.";
  }

  const activeTasks = tasks.filter((t) => t.active);
  const nameById = new Map(tasks.map((t) => [t.id, t.name]));

  // task id -> day -> row
  const byTask = new Map<string, Map<string, Completion>>();
  for (const c of completions) {
    let m = byTask.get(c.task_id);
    if (!m) {
      m = new Map<string, Completion>();
      byTask.set(c.task_id, m);
    }
    // Rows arrive newest first and (task, day) is unique, so first write wins.
    if (!m.has(c.day)) m.set(c.day, c);
  }

  const week = weekDays(today);

  const countSince = (taskId: string, days: number) => {
    const from = addDays(today, -(days - 1));
    const m = byTask.get(taskId);
    if (!m) return 0;
    let n = 0;
    for (const [day, row] of m) {
      if (row.status === "done" && day >= from && day <= today) n++;
    }
    return n;
  };

  const chartData = activeTasks.map((t) => ({
    name: t.name,
    last4: countSince(t.id, 28),
    last12: countSince(t.id, 84),
  }));

  const streaks = activeTasks.map((t) => ({
    id: t.id,
    name: t.name,
    n: currentStreak(t.id, today, byTask.get(t.id) ?? new Map<string, Completion>()),
    weekdayOnly: WEEKDAY_ONLY.has(t.id),
  }));

  const logEntries = completions.map((c) => ({
    id: c.id,
    day: c.day,
    taskId: c.task_id,
    taskName: nameById.get(c.task_id) ?? c.task_id,
    status: c.status,
    time: nyTime(c.created_at),
    words: (c.status === "done" ? c.recap : c.reason) ?? "",
  }));

  return (
    <div className="p-wrap">
      <header className="p-head">
        <div>
          <div className="date">{nyLongDate(today)}</div>
          <h1>
            Zoe, <span>the numbers</span>.
          </h1>
        </div>
        <div className="p-actions">
          <a className="linkbtn" href="/api/digest?preview=1">
            Preview tonight&apos;s email
          </a>
          <a className="linkbtn" href="/">
            Her screen
          </a>
          <SignOut />
        </div>
      </header>

      {error && (
        <div className="card">
          <h2>Can&apos;t reach the database</h2>
          <p className="hint">{error}</p>
        </div>
      )}

      <section className="card">
        <h2>This week</h2>
        <p className="hint">Monday through Sunday, New York time.</p>
        <div className="weekscroll">
          <table className="week">
            <thead>
              <tr>
                <th className="rowhead" />
                {week.map((d, i) => (
                  <th key={d} className={d === today ? "today" : undefined}>
                    {DOW[i]}
                    <br />
                    {dayToUtcDate(d).getUTCDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeTasks.map((t) => (
                <tr key={t.id}>
                  <th className="rowhead">{t.name}</th>
                  {week.map((d) => {
                    const row = byTask.get(t.id)?.get(d);
                    const future = d > today;
                    const cls = row
                      ? row.status
                      : future
                        ? "future"
                        : "";
                    return (
                      <td key={d}>
                        <div
                          className={"cell " + cls}
                          title={
                            row
                              ? `${row.status}: ${row.recap ?? row.reason ?? ""}`
                              : undefined
                          }
                        >
                          {row?.status === "done"
                            ? "✓"
                            : row?.status === "skipped"
                              ? "✕"
                              : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend">
          <span>
            <i style={{ background: "var(--lime)" }} />
            done
          </span>
          <span>
            <i style={{ background: "var(--coral)" }} />
            skipped
          </span>
          <span>
            <i style={{ background: "var(--paper-2)" }} />
            nothing recorded
          </span>
        </div>
      </section>

      <section className="card">
        <h2>Streaks</h2>
        <p className="hint">
          Days done in a row. Today still counts as open until she records it.
          Homework and studying ignore weekends.
        </p>
        <div className="streaks">
          {streaks.map((s) => (
            <div className="streak" key={s.id}>
              <div className={"n" + (s.n >= 5 ? " hot" : "")}>{s.n}</div>
              <div className="t">{s.name}</div>
              <div className="u">
                {s.n === 1 ? "day" : "days"}
                {s.weekdayOnly ? " · school days" : ""}
              </div>
            </div>
          ))}
          {streaks.length === 0 && <p className="hint">No active tasks.</p>}
        </div>
      </section>

      <section className="card">
        <h2>Completions</h2>
        <p className="hint">Times each task was finished. Skips are not counted.</p>
        <Charts data={chartData} />
      </section>

      <section className="card">
        <h2>The log</h2>
        <p className="hint">Every entry, newest first, in her own words.</p>
        <Log entries={logEntries} tasks={tasks.map((t) => ({ id: t.id, name: t.name }))} />
      </section>

      <section className="card">
        <h2>Tasks</h2>
        <p className="hint">
          Rename, reorder, add, or turn one off. Turning a task off hides it from
          her screen and keeps every past entry.
        </p>
        <TaskManager initial={tasks} />
      </section>

      <p className="note">Everything is New York time.</p>
    </div>
  );
}
