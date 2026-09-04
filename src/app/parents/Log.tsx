"use client";

import { useMemo, useState } from "react";
import { nyShortDate } from "@/lib/date";

type Entry = {
  id: number;
  day: string;
  taskId: string;
  taskName: string;
  status: "done" | "skipped";
  time: string;
  words: string;
};

export default function Log({
  entries,
  tasks,
}: {
  entries: Entry[];
  tasks: { id: string; name: string }[];
}) {
  const [filter, setFilter] = useState<string>("all");

  const shown = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.taskId === filter)),
    [entries, filter]
  );

  return (
    <>
      <div className="filters">
        <button
          className={"chip" + (filter === "all" ? " on" : "")}
          onClick={() => setFilter("all")}
        >
          Everything
        </button>
        {tasks.map((t) => (
          <button
            key={t.id}
            className={"chip" + (filter === t.id ? " on" : "")}
            onClick={() => setFilter(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="log">
        {shown.length === 0 && <p className="hint">Nothing here yet.</p>}
        {shown.map((e) => (
          <div className={"entry " + e.status} key={e.id}>
            <span className="dot" />
            <div>
              <div className="meta">
                {nyShortDate(e.day)} · {e.time}
              </div>
              <div className="what">
                {e.taskName}
                {e.status === "skipped" ? " — skipped" : ""}
              </div>
              <div className="words">{e.words || "(no words)"}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
