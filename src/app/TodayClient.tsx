"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nyLongDate, nyTime } from "@/lib/date";
import type { Completion, Task } from "@/lib/supabase";

type Props = {
  day: string;
  tasks: Task[];
  completions: Completion[];
  loadError: string | null;
};

const R = 52;
const CIRC = 2 * Math.PI * R;

export default function TodayClient({
  day,
  tasks,
  completions,
  loadError,
}: Props) {
  const [state, setState] = useState<Record<string, Completion>>(() =>
    Object.fromEntries(completions.map((c) => [c.task_id, c]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [clock, setClock] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);

  // recap sheet
  const [recapFor, setRecapFor] = useState<Task | null>(null);
  const [recap, setRecap] = useState("");
  const recapRef = useRef<HTMLTextAreaElement>(null);

  // skip sheet
  const [skipFor, setSkipFor] = useState<Task | null>(null);
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const doneCount = useMemo(
    () => Object.values(state).filter((s) => s.status === "done").length,
    [state]
  );

  const showToast = useCallback((msg: string, bad = false) => {
    setToast({ msg, bad });
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  // Clock ticks client side only, so the server render stays stable.
  useEffect(() => {
    setClock(nyTime(new Date()));
    const id = window.setInterval(() => setClock(nyTime(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  // The server owns "today". Poll so the list rolls over at New York midnight
  // and so a change made elsewhere (a parent undoing a row) shows up here.
  useEffect(() => {
    const sync = async () => {
      try {
        const res = await fetch("/api/completions", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          day: string;
          completions: Completion[];
        };
        if (data.day !== day) {
          window.location.reload();
          return;
        }
        setState(Object.fromEntries(data.completions.map((c) => [c.task_id, c])));
      } catch {
        // Offline for a moment: keep whatever is on screen.
      }
    };
    const id = window.setInterval(sync, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [day]);

  useEffect(() => {
    if (recapFor) window.setTimeout(() => recapRef.current?.focus(), 50);
  }, [recapFor]);
  useEffect(() => {
    if (skipFor) window.setTimeout(() => reasonRef.current?.focus(), 50);
  }, [skipFor]);

  async function save(task: Task, status: "done" | "skipped", text: string) {
    setBusy(task.id);
    try {
      const res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status, text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { completion } = (await res.json()) as { completion: Completion };
      setState((s) => ({ ...s, [task.id]: completion }));
      return true;
    } catch {
      showToast("Could not save, try again", true);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function undo(task: Task) {
    if (!window.confirm(`Undo ${task.name}?`)) return;
    setBusy(task.id);
    try {
      const res = await fetch(
        `/api/completions?taskId=${encodeURIComponent(task.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
      setState((s) => {
        const next = { ...s };
        delete next[task.id];
        return next;
      });
      showToast("Undone");
    } catch {
      showToast("Could not undo, try again", true);
    } finally {
      setBusy(null);
    }
  }

  async function onSaveRecap() {
    if (!recapFor) return;
    const ok = await save(recapFor, "done", recap.trim());
    if (ok) {
      setRecapFor(null);
      setRecap("");
      showToast("Saved");
    }
  }

  async function onConfirmSkip() {
    if (!skipFor) return;
    const ok = await save(skipFor, "skipped", reason.trim());
    if (ok) {
      setSkipFor(null);
      setReason("");
    }
  }

  return (
    <>
      <header>
        <div>
          <div className="date">{nyLongDate(day)}</div>
          <h1>
            Hey <span>Zoe</span>, here&apos;s today.
          </h1>
        </div>
        <div className="ring">
          <svg viewBox="0 0 120 120">
            <circle className="track" cx="60" cy="60" r={R} />
            <circle
              className="fill"
              cx="60"
              cy="60"
              r={R}
              style={{
                strokeDasharray: CIRC,
                strokeDashoffset:
                  tasks.length === 0
                    ? CIRC
                    : CIRC * (1 - doneCount / tasks.length),
              }}
            />
          </svg>
          <div className="num">
            <span>{doneCount}</span>
            <small>of {tasks.length}</small>
          </div>
        </div>
      </header>

      {loadError ? (
        <div className="empty">
          Can&apos;t reach the list right now. Pull down to refresh in a minute.
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty">No tasks yet. A parent can add some in /parents.</div>
      ) : (
        <div className="grid">
          {tasks.map((t) => {
            const s = state[t.id];
            let sub = t.subtitle ?? "";
            if (s?.status === "done") sub = "Done at " + nyTime(s.created_at);
            if (s?.status === "skipped") sub = "Skipped: " + (s.reason ?? "");
            return (
              <button
                key={t.id}
                className={
                  "tile" +
                  (s ? " " + s.status : "") +
                  (busy === t.id ? " busy" : "")
                }
                onClick={(e) => {
                  if ((e.target as HTMLElement).dataset.skip) return;
                  if (s) void undo(t);
                  else setRecapFor(t);
                }}
              >
                <div className="mark">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="name">{t.name}</div>
                  <div className="sub">{sub}</div>
                </div>
                <span
                  className="skip"
                  data-skip={t.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSkipFor(t);
                  }}
                >
                  skip
                </span>
              </button>
            );
          })}
        </div>
      )}

      <footer>
        <span>List clears at midnight. Everything you finish stays saved.</span>
        <span>{clock ?? ""}</span>
      </footer>

      {/* Recap sheet. There is deliberately no way out but saving. */}
      <div className={"veil" + (recapFor ? " open" : "")}>
        {recapFor && (
          <div className="sheet">
            <h2>Nice, {recapFor.name.toLowerCase()} done.</h2>
            <p>Say what you did. It counts once your recap is saved.</p>
            <textarea
              ref={recapRef}
              value={recap}
              onChange={(e) => setRecap(e.target.value)}
              placeholder="Tap here, then hit the mic key and talk"
            />
            <div className="row">
              <button
                className="btn primary"
                disabled={recap.trim().length < 3 || busy === recapFor.id}
                onClick={() => void onSaveRecap()}
              >
                {busy === recapFor.id ? "Saving..." : "Save recap"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Skip sheet */}
      <div className={"veil" + (skipFor ? " open" : "")}>
        {skipFor && (
          <div className="sheet">
            <h2>Skipping {skipFor.name.toLowerCase()} today?</h2>
            <p>That&apos;s fine, but you need to say why.</p>
            <textarea
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Because..."
            />
            <div className="row">
              <button
                className="btn ghost"
                onClick={() => {
                  setSkipFor(null);
                  setReason("");
                }}
              >
                Never mind
              </button>
              <button
                className="btn primary"
                disabled={reason.trim().length < 3 || busy === skipFor.id}
                onClick={() => void onConfirmSkip()}
              >
                {busy === skipFor.id ? "Saving..." : "Skip it"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={"toast" + (toast ? " show" : "") + (toast?.bad ? " bad" : "")}>
        {toast?.msg ?? ""}
      </div>
    </>
  );
}
