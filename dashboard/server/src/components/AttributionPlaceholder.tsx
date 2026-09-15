import { useServerFeed } from "../mock/useServerFeed";

// Culprit Attribution — coming soon. Standing decision: attribution-service
// stays on hold, so this panel is a grayed-out, non-interactive placeholder
// with no functional content. It reserves the panel-attribution anchor and
// mirrors the SystemMap's grayed attribution node (SD3).
export default function AttributionPlaceholder() {
  const { currentRound } = useServerFeed();

  return (
    <div
      data-testid="attribution-placeholder"
      id="panel-attribution"
      aria-disabled="true"
      className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-500">
          Culprit Attribution — coming soon
        </h3>
        <span className="text-xs text-slate-600">round {currentRound}</span>
      </div>
      <p className="py-4 text-center text-sm text-slate-600">
        Drift-culprit ranking will appear here once attribution-service lands.
        Nothing to click yet.
      </p>
      <p data-testid="teacher-note-attribution" className="teacher-note">
        Teacher: this gray box is deliberate — attribution is out of scope
        until the service exists.
      </p>
    </div>
  );
}
