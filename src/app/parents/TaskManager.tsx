"use client";

import { useState } from "react";
import type { Task } from "@/lib/supabase";

export default function TaskManager({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newName, setNewName] = useState("");
  const [newSub, setNewSub] = useState("");

  async function call(method: string, body: unknown) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/tasks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
      return data as { task?: Task; tasks?: Task[] };
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, patchBody: Partial<Task>) {
    const data = await call("PATCH", { id, ...patchBody });
    if (data?.task) {
      setTasks((ts) => ts.map((t) => (t.id === id ? data.task! : t)));
    }
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= tasks.length) return;
    const next = [...tasks];
    [next[index], next[target]] = [next[target], next[index]];
    setTasks(next); // optimistic: the order on screen is what we are saving
    const data = await call("PUT", { order: next.map((t) => t.id) });
    if (data?.tasks) setTasks(data.tasks);
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const data = await call("POST", { name, subtitle: newSub.trim() });
    if (data?.task) {
      setTasks((ts) => [...ts, data.task!]);
      setNewName("");
      setNewSub("");
    }
  }

  return (
    <>
      <div className="tm">
        {tasks.map((t, i) => (
          <div className={"tmrow" + (t.active ? "" : " off")} key={t.id}>
            <button
              className="iconbtn"
              aria-label={`Move ${t.name} up`}
              disabled={busy || i === 0}
              onClick={() => void move(i, -1)}
            >
              ↑
            </button>
            <button
              className="iconbtn"
              aria-label={`Move ${t.name} down`}
              disabled={busy || i === tasks.length - 1}
              onClick={() => void move(i, 1)}
            >
              ↓
            </button>
            <input
              className="name"
              value={t.name}
              aria-label="Task name"
              onChange={(e) =>
                setTasks((ts) =>
                  ts.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x))
                )
              }
              onBlur={(e) => void patch(t.id, { name: e.target.value })}
            />
            <input
              className="sub"
              value={t.subtitle ?? ""}
              placeholder="subtitle"
              aria-label="Task subtitle"
              onChange={(e) =>
                setTasks((ts) =>
                  ts.map((x) => (x.id === t.id ? { ...x, subtitle: e.target.value } : x))
                )
              }
              onBlur={(e) => void patch(t.id, { subtitle: e.target.value })}
            />
            <button
              className="toggle"
              disabled={busy}
              onClick={() => void patch(t.id, { active: !t.active })}
            >
              {t.active ? "Turn off" : "Turn on"}
            </button>
          </div>
        ))}
        {tasks.length === 0 && <p className="hint">No tasks yet.</p>}
      </div>

      <div className="addrow">
        <input
          value={newName}
          placeholder="New task"
          aria-label="New task name"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
        />
        <input
          value={newSub}
          placeholder="Subtitle (optional)"
          aria-label="New task subtitle"
          onChange={(e) => setNewSub(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
        />
        <button disabled={busy || !newName.trim()} onClick={() => void add()}>
          Add
        </button>
      </div>

      {err && <p className="hint" style={{ color: "var(--coral)", marginTop: 12 }}>{err}</p>}
    </>
  );
}
