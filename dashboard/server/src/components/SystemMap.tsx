import { useCallback, useMemo, useState } from "react";
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
import { useServerFeed, type ServerStage } from "../mock/useServerFeed";

export type LayerId =
  | "vision"
  | "auth"
  | "aggregation"
  | "rollback"
  | "attribution"
  | "blockchain";

export type LayerStatus = "active" | "idle" | "disabled";

// Which architecture layer owns each system stage. Pure function so the
// test can assert the mapping directly. "idle" (between cycles) owns
// nothing; the vision layer is an upstream data source with no dedicated
// stage; attribution is SD10 territory (grayed out, never active here).
export function layerForStage(stage: ServerStage): LayerId | null {
  switch (stage) {
    case "collecting_updates":
    case "authenticating_all":
      return "auth";
    case "aggregating":
    case "broadcasting":
      return "aggregation";
    case "checkpointing":
    case "drift_monitoring":
      return "rollback";
    case "anchoring_chain":
      return "blockchain";
    case "idle":
      return null;
  }
}

interface LayerMeta {
  label: string;
  tooltip: string;
  // Anchor id of the detailed panel further down the page (SD4-SD9 adopt
  // these ids when they land; scroll is a no-op until then) + one-line
  // inline expansion shown when the node is clicked.
  panelAnchor: string;
  blurb: string;
}

const LAYERS: Record<LayerId, LayerMeta> = {
  vision: {
    label: "Vision Model",
    tooltip: "The shared defect-detection model every client trains locally.",
    panelAnchor: "panel-provenance",
    blurb: "Upstream data source: client imagery embedded locally, screened by authentication.",
  },
  auth: {
    label: "Authentication",
    tooltip: "Every client's update is suspicion-scored; failures are rejected.",
    panelAnchor: "panel-auth",
    blurb: "Per-client suspicion scores across the fleet (see heatmap below).",
  },
  aggregation: {
    label: "Aggregation",
    tooltip: "Passing updates are FedAvg-averaged into the new global model.",
    panelAnchor: "panel-aggregation",
    blurb: "FedAvg over accepted updates, weighted by client data volume.",
  },
  rollback: {
    label: "Rollback",
    tooltip: "Checkpoints are hash-chained; drift can revert to an anchor.",
    panelAnchor: "panel-rollback",
    blurb: "Checkpoint chain plus the drift-monitor gate (synthetic demo event).",
  },
  attribution: {
    label: "Attribution",
    tooltip: "Culprit ranking for drift events — arrives in Story SD10.",
    panelAnchor: "panel-attribution",
    blurb: "Coming in SD10 — grayed out until then.",
  },
  blockchain: {
    label: "Blockchain",
    tooltip: "Anchors, stakes, disputes and passports settle on-chain.",
    panelAnchor: "panel-blockchain",
    blurb: "Transaction, dispute and staking activity on the local chain.",
  },
};

const LAYER_ORDER: LayerId[] = [
  "vision",
  "auth",
  "aggregation",
  "rollback",
  "blockchain",
  "attribution",
];

const POSITIONS: Record<LayerId, { x: number; y: number }> = {
  vision: { x: 0, y: 0 },
  auth: { x: 220, y: 0 },
  aggregation: { x: 440, y: 0 },
  rollback: { x: 0, y: 150 },
  blockchain: { x: 220, y: 150 },
  attribution: { x: 440, y: 150 },
};

interface LayerNodeData extends Record<string, unknown> {
  layer: LayerId;
  label: string;
  tooltip: string;
  status: LayerStatus;
  onSelect: (layer: LayerId) => void;
}

type LayerNodeType = Node<LayerNodeData, "layer">;

function LayerNode({ data }: NodeProps<LayerNodeType>) {
  const disabled = data.status === "disabled";
  return (
    <motion.div
      data-testid={`sys-node-${data.layer}`}
      data-status={data.status}
      title={data.tooltip}
      aria-disabled={disabled}
      className={`sys-node sys-${data.status}`}
      animate={data.status === "active" ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={
        data.status === "active"
          ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
      onClick={() => {
        if (!disabled) data.onSelect(data.layer);
      }}
      style={{ cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {data.label}
    </motion.div>
  );
}

const nodeTypes = { layer: LayerNode };

export default function SystemMap() {
  const { currentStage } = useServerFeed();
  const [selected, setSelected] = useState<LayerId | null>(null);

  const activeLayer = layerForStage(currentStage);

  const handleSelect = useCallback((layer: LayerId) => {
    setSelected(layer);
    // Scroll to the layer's detailed panel once SD4-SD9 mount it; no-op
    // until then (guarded — jsdom and early stories have no targets).
    const target = document.getElementById(LAYERS[layer].panelAnchor);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const nodes: LayerNodeType[] = useMemo(
    () =>
      LAYER_ORDER.map((layer) => ({
        id: layer,
        type: "layer",
        position: POSITIONS[layer],
        data: {
          layer,
          label: LAYERS[layer].label,
          tooltip: LAYERS[layer].tooltip,
          status:
            layer === "attribution"
              ? "disabled"
              : layer === activeLayer
                ? "active"
                : "idle",
          onSelect: handleSelect,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: { width: 180 },
      })),
    [activeLayer, handleSelect],
  );

  const edges: Edge[] = useMemo(
    () => [
      { id: "e-vision-auth", source: "vision", target: "auth" },
      { id: "e-auth-aggregation", source: "auth", target: "aggregation" },
      { id: "e-aggregation-rollback", source: "aggregation", target: "rollback" },
      { id: "e-rollback-blockchain", source: "rollback", target: "blockchain" },
    ],
    [],
  );

  return (
    <div
      data-testid="system-map"
      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2"
    >
      <div className="h-[340px] w-full">
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
      {selected && selected !== "attribution" && (
        <p data-testid={`layer-detail-${selected}`} className="p-2 text-sm text-slate-300">
          <span className="font-semibold text-slate-100">
            {LAYERS[selected].label}:
          </span>{" "}
          {LAYERS[selected].blurb}
        </p>
      )}
      <p data-testid="teacher-note-systemmap" className="teacher-note">
        Teacher: this map is the dashboard&apos;s anchor — the glowing amber
        layer is wherever the fleet is right now; click a layer to jump to
        its panel.
      </p>
    </div>
  );
}
