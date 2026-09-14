import { useMemo } from "react";
import {
  Background,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useServerFeed } from "../mock/useServerFeed";
import type { Checkpoint, DriftEvent } from "../types/schemas";

export function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

// Chain layout for the checkpoint graph: nodes = checkpoints in round
// order, forward edges resolved through parent_hash links (falling back to
// the previous round if a hash has no match). When a drift event is
// present, a distinct red dashed revert edge runs from the latest
// checkpoint back to the event's reverted_to_checkpoint_hash node. Pure
// function — the test asserts edges here because jsdom cannot render xyflow
// edge geometry at all (see SD5 notes); node presence is asserted rendered.
export function buildCheckpointChain(
  checkpoints: Checkpoint[],
  driftEvents: DriftEvent[],
): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...checkpoints].sort((a, b) => a.round_number - b.round_number);
  const idByHash = new Map(sorted.map((cp) => [cp.weights_hash, `cp-${cp.round_number}`]));

  const nodes: Node[] = sorted.map((cp, i) => ({
    id: `cp-${cp.round_number}`,
    type: "default",
    position: { x: i * 170, y: 40 },
    data: { label: `R${cp.round_number} ${shortHash(cp.weights_hash)}` },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: {
      width: 140,
      background: "#0f172a",
      border: "1px solid #475569",
      borderRadius: 10,
      color: "#e2e8f0",
      fontSize: 12,
    },
  }));

  const edges: Edge[] = [];
  for (const cp of sorted) {
    if (cp.parent_hash == null) continue;
    const parentId = idByHash.get(cp.parent_hash);
    // Hash-resolve first (the real link); fall back to the previous round
    // only if the parent hash matches no known checkpoint.
    const fallbackId = `cp-${cp.round_number - 1}`;
    const source = parentId ?? (cp.round_number > 1 ? fallbackId : null);
    if (source == null) continue;
    edges.push({
      id: `e-${source}-cp-${cp.round_number}`,
      source,
      target: `cp-${cp.round_number}`,
      className: "edge-chain",
      style: { stroke: "#64748b", strokeWidth: 1.5 },
    });
  }

  for (const event of driftEvents) {
    const targetId = idByHash.get(event.reverted_to_checkpoint_hash);
    const latest = sorted[sorted.length - 1];
    if (targetId == null || latest == null) continue;
    edges.push({
      id: `e-revert-${latest.round_number}`,
      source: `cp-${latest.round_number}`,
      target: targetId,
      label: "synthetic revert (demo)",
      className: "edge-revert",
      animated: true,
      style: { stroke: "#fb7185", strokeWidth: 2, strokeDasharray: "8 4" },
    });
  }

  return { nodes, edges };
}

export default function CheckpointChainGraph() {
  const { currentRound, checkpoints, driftEvents } = useServerFeed();

  const { nodes, edges } = useMemo(
    () => buildCheckpointChain(checkpoints, driftEvents),
    [checkpoints, driftEvents],
  );

  return (
    <div
      data-testid="checkpoint-chain-graph"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Checkpoint hash-chain
        </h3>
        <span className="text-xs text-slate-500">
          round {currentRound} · red dashed = revert
        </span>
      </div>

      {nodes.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          No checkpoints yet — complete a round to anchor one.
        </p>
      ) : (
        <div
          data-testid="checkpoint-chain-diagram"
          className="h-[220px] w-full rounded-xl border border-slate-800 bg-slate-950"
        >
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
      )}
      {driftEvents.length > 0 && (
        <p
          data-testid="chain-synthetic-note"
          className="mt-2 text-xs text-amber-100/80"
        >
          Revert edge is a demo stand-in from the synthetic drift event — not
          measured system behavior.
        </p>
      )}
      <p data-testid="teacher-note-chain" className="teacher-note">
        Teacher: each block hashes to its parent — at round 17 a red dashed
        edge rewinds the chain to the last pre-attack anchor.
      </p>
    </div>
  );
}
