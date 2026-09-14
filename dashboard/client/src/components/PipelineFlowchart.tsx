import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Background,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { STAGE_ORDER } from "../mock/roundFeed";
import { useRoundFeed } from "../mock/useRoundFeed";
import type { RoundPipelineStage } from "../types/schemas";

type ActiveStage = Exclude<RoundPipelineStage, "idle">;
export type StageStatus = "active" | "completed" | "upcoming";

const STAGE_LABELS: Record<ActiveStage, string> = {
  local_training: "Local Training",
  computing_embeddings: "Embeddings",
  authenticating: "Authenticating",
  aggregating: "Aggregating",
  checkpointing: "Checkpointing",
  drift_check: "Drift Check",
  broadcasting: "Broadcasting",
};

// One sentence per stage — hover only, keeping the diagram text-minimal.
const STAGE_TOOLTIPS: Record<ActiveStage, string> = {
  local_training: "The client trains the defect model on its own private imagery.",
  computing_embeddings: "The client embeds a probe batch for authentication screening.",
  authenticating: "Validators score the embeddings for poisoning signs.",
  aggregating: "Passing clients' updates are averaged into the global model.",
  checkpointing: "The new weights are hashed, stored off-chain, and anchored on-chain.",
  drift_check: "The sliding window is checked for sustained multi-round drift.",
  broadcasting: "The accepted global model is sent back out to the fleet.",
};

export function stageStatusFor(
  stage: ActiveStage,
  currentStage: RoundPipelineStage,
  currentRound: number,
): StageStatus {
  if (stage === currentStage) return "active";
  if (currentStage === "idle")
    return currentRound === 0 ? "upcoming" : "completed";
  const idx = STAGE_ORDER.indexOf(stage);
  const curIdx = STAGE_ORDER.indexOf(currentStage as ActiveStage);
  return idx < curIdx ? "completed" : "upcoming";
}

interface StageNodeData extends Record<string, unknown> {
  stage: ActiveStage;
  label: string;
  tooltip: string;
  status: StageStatus;
}

type StageNodeType = Node<StageNodeData, "stage">;

function StageNode({ data }: NodeProps<StageNodeType>) {
  return (
    <motion.div
      data-testid={`stage-node-${data.stage}`}
      data-status={data.status}
      title={data.tooltip}
      className={`stage-node stage-${data.status}`}
      animate={data.status === "active" ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={
        data.status === "active"
          ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
    >
      {data.label}
    </motion.div>
  );
}

const nodeTypes = { stage: StageNode };

const NODE_WIDTH = 160;
const NODE_GAP = 190;

export default function PipelineFlowchart() {
  const { currentStage, currentRound } = useRoundFeed();

  const nodes: StageNodeType[] = useMemo(
    () =>
      (STAGE_ORDER as ActiveStage[]).map((stage, i) => ({
        id: stage,
        type: "stage",
        position: { x: i * NODE_GAP, y: 40 },
        data: {
          stage,
          label: STAGE_LABELS[stage],
          tooltip: STAGE_TOOLTIPS[stage],
          status: stageStatusFor(stage, currentStage, currentRound),
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: { width: NODE_WIDTH },
      })),
    [currentStage, currentRound],
  );

  const edges: Edge[] = useMemo(
    () =>
      (STAGE_ORDER as ActiveStage[]).slice(1).map((stage, i) => ({
        id: `e-${STAGE_ORDER[i]}-${stage}`,
        source: STAGE_ORDER[i],
        target: stage,
      })),
    [],
  );

  return (
    <div
      data-testid="pipeline-flowchart"
      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2"
    >
      <div className="h-[280px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{ style: { stroke: "#475569", strokeWidth: 1.5 } }}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          panOnDrag={false}
          colorMode="dark"
        >
          <Background gap={24} color="#1e293b" />
        </ReactFlow>
      </div>
      <p data-testid="teacher-note-pipeline" className="teacher-note">
        Teacher: the glowing amber node is the stage this client is in right
        now — press step and watch it walk the pipeline once per round.
      </p>
    </div>
  );
}
