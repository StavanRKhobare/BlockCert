import { useMemo, useState } from "react";
import {
  Background,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useServerFeed } from "../mock/useServerFeed";

type ClientNode = Node<{ label: string }, "default">;

// Edge configuration for the aggregation diagram: one edge per client into
// the global node. Contributors (passed auth) get animated green edges;
// rejected clients get dimmed, dashed, non-animated edges. Pure function so
// the test can assert the contributed/rejected mapping per edge id
// (jsdom cannot render xyflow edge geometry at all — see test-setup notes
// — so the rendered DOM cannot carry this assertion; the identity list
// below mirrors the same mapping in queryable DOM).
export function buildFedAvgEdges(
  clientDids: string[],
  passedByDid: Map<string, boolean>,
): Edge[] {
  return clientDids.map((did, i) => {
    const contributed = passedByDid.get(did) !== false;
    return {
      id: `e-client-${i}`,
      source: `client-${i}`,
      target: "global",
      animated: contributed,
      className: contributed ? "edge-contributed" : "edge-excluded",
      style: contributed
        ? { stroke: "#34d399", strokeWidth: 2 }
        : { stroke: "#475569", strokeWidth: 1.5, strokeDasharray: "6 3", opacity: 0.45 },
    };
  });
}

export default function FedAvgVisualizer() {
  const { currentRound, clientDids, suspicionScores } = useServerFeed();
  const [compareCentralized, setCompareCentralized] = useState(false);

  // Verdicts for the latest completed round: only passing clients'
  // updates flow into the average.
  const passedByDid = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const s of suspicionScores) {
      if (s.round_number === currentRound) map.set(s.client_did, s.passed);
    }
    return map;
  }, [suspicionScores, currentRound]);

  const nodes: ClientNode[] = useMemo(
    () => [
      ...clientDids.map((did, i) => ({
        id: `client-${i}`,
        type: "default" as const,
        position: { x: 0, y: i * 62 },
        data: { label: did.replace("did:example:", "") },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          width: 110,
          background: passedByDid.get(did) === false ? "#3f1d29" : "#0f2e26",
          border: `1px solid ${passedByDid.get(did) === false ? "#fb7185" : "#34d399"}`,
          borderRadius: 10,
          color: "#e2e8f0",
          fontSize: 12,
        },
      })),
      {
        id: "global",
        type: "default" as const,
        position: { x: 330, y: 3.5 * 62 },
        data: { label: "Global Model" },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          width: 140,
          background: "#1e1b4b",
          border: "1px solid #818cf8",
          borderRadius: 12,
          color: "#e0e7ff",
          fontSize: 13,
          fontWeight: 700,
        },
      },
    ],
    [clientDids, passedByDid],
  );

  const edges: Edge[] = useMemo(
    () => buildFedAvgEdges(clientDids, passedByDid),
    [clientDids, passedByDid],
  );

  const excludedCount = useMemo(
    () => clientDids.filter((d) => passedByDid.get(d) === false).length,
    [clientDids, passedByDid],
  );

  return (
    <div
      data-testid="fedavg-visualizer"
      id="panel-aggregation"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">
          FedAvg aggregation
        </h3>
        <button
          type="button"
          data-testid="centralized-toggle"
          onClick={() => setCompareCentralized((v) => !v)}
          aria-pressed={compareCentralized}
          className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
        >
          {compareCentralized ? "Back to federated view" : "Compare to centralized training"}
        </button>
      </div>

      {currentRound === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          No rounds completed yet — press play on the server feed.
        </p>
      ) : compareCentralized ? (
        <div
          data-testid="centralized-callout"
          className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm leading-relaxed text-slate-300"
        >
          <p>
            Centralized training would pool all 8 clients&apos; raw imagery in
            one place — every pixel leaves its owner.
          </p>
          <p className="mt-2">
            Federated averaging instead flows only weight updates from the{" "}
            {clientDids.length - excludedCount} accepted clients this round
            {excludedCount > 0 &&
              ` (${excludedCount} rejected — their updates never reach the average)`}
            ; raw data never moves.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">
            Round {currentRound}: green edges contributed, dashed gray edges
            were rejected and skipped.
          </p>
          <div data-testid="fedavg-diagram" className="h-[520px] w-full rounded-xl border border-slate-800 bg-slate-950">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              defaultEdgeOptions={{ type: "smoothstep" }}
              nodesDraggable={false}
              nodesConnectable={false}
              zoomOnScroll={false}
              panOnDrag={false}
              colorMode="dark"
            >
              <Background gap={24} color="#1e293b" />
            </ReactFlow>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {clientDids.map((did, i) => {
              const contributed = passedByDid.get(did) !== false;
              return (
                <li
                  key={did}
                  data-testid={`fedavg-client-${i}`}
                  data-contributed={contributed}
                  title={`${did}: ${contributed ? "passed, contributed" : "rejected, excluded"}`}
                  className={`rounded-md border px-2 py-0.5 text-[11px] ${
                    contributed
                      ? "border-emerald-500/50 text-emerald-200"
                      : "border-rose-500/50 text-rose-200"
                  }`}
                >
                  {did.replace("did:example:", "")}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p data-testid="teacher-note-fedavg" className="teacher-note">
        Teacher: only green animated edges reach the global model — flip to
        round 12+ and watch client-3&apos;s edge go dashed gray.
      </p>
    </div>
  );
}
