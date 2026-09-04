"use client";

export default function SignOut() {
  return (
    <button
      className="linkbtn"
      onClick={async () => {
        await fetch("/api/parents/login", { method: "DELETE" });
        window.location.reload();
      }}
    >
      Sign out
    </button>
  );
}
