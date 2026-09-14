// Presentation-mode toggle (CD9). Controlled by App: when enabled, App
// adds the .teacher-mode class to its root and CSS (index.css) scales type
// up and reveals the .teacher-note annotation callouts on the flowchart
// and suspicion chart. Purely visual — asserted by eye, not tests.
export default function TeacherModeToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      data-testid="teacher-mode-toggle"
      onClick={onToggle}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        enabled
          ? "border-amber-400 bg-amber-500/20 text-amber-100"
          : "border-slate-700 text-slate-300 hover:border-slate-500"
      }`}
    >
      Teacher mode: {enabled ? "on" : "off"}
    </button>
  );
}
