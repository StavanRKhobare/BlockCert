import { useState } from "react";
import AttributionPlaceholder from "./components/AttributionPlaceholder";
import BlockchainExplorer from "./components/BlockchainExplorer";
import CheckpointChainGraph from "./components/CheckpointChainGraph";
import DisputeKanban from "./components/DisputeKanban";
import DriftMonitorGate from "./components/DriftMonitorGate";
import FedAvgVisualizer from "./components/FedAvgVisualizer";
import Legend from "./components/Legend";
import ProvenanceLedger from "./components/ProvenanceLedger";
import StakingEconomics from "./components/StakingEconomics";
import SuspicionHeatmap from "./components/SuspicionHeatmap";
import SystemMap from "./components/SystemMap";
import TeacherModeToggle from "./components/TeacherModeToggle";
import { ServerFeedProvider, useServerFeed } from "./mock/useServerFeed";

function Controls() {
  const {
    currentRound,
    currentStage,
    isPlaying,
    play,
    pause,
    reset,
    step,
  } = useServerFeed();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <button
        type="button"
        data-testid="control-play"
        onClick={play}
        disabled={isPlaying}
        className="rounded-lg border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-100 disabled:opacity-40"
      >
        Play
      </button>
      <button
        type="button"
        data-testid="control-pause"
        onClick={pause}
        disabled={!isPlaying}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-40"
      >
        Pause
      </button>
      <button
        type="button"
        data-testid="control-step"
        onClick={step}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
      >
        Step
      </button>
      <button
        type="button"
        data-testid="control-reset"
        onClick={reset}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
      >
        Reset
      </button>
      <span className="ml-2 text-sm text-slate-300">
        Round{" "}
        <span data-testid="current-round" className="font-bold tabular-nums">
          {currentRound}
        </span>{" "}
        ·{" "}
        <span data-testid="current-stage" className="tabular-nums">
          {currentStage}
        </span>
      </span>
    </div>
  );
}

export default function App() {
  const [teacherMode, setTeacherMode] = useState(false);

  return (
    <ServerFeedProvider>
      <div
        data-testid="app-root"
        className={`min-h-screen bg-slate-950 text-slate-200 ${teacherMode ? "teacher-mode" : ""}`}
      >
        <div className="mx-auto max-w-6xl space-y-4 p-4 pb-24">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-50">
                Fleet Operations Dashboard
              </h1>
              <p className="text-sm text-slate-400">
                8 clients · replay the 20-round scenario
              </p>
            </div>
            <TeacherModeToggle
              enabled={teacherMode}
              onToggle={() => setTeacherMode((v) => !v)}
            />
          </header>

          <Controls />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <SystemMap />
            </div>
            <div className="md:col-span-2">
              <SuspicionHeatmap />
            </div>
            <div className="md:col-span-2">
              <FedAvgVisualizer />
            </div>
            <DriftMonitorGate />
            <CheckpointChainGraph />
            <div className="md:col-span-2">
              <BlockchainExplorer />
            </div>
            <div className="md:col-span-2">
              <DisputeKanban />
            </div>
            <StakingEconomics />
            <ProvenanceLedger />
            <div className="md:col-span-2">
              <AttributionPlaceholder />
            </div>
          </section>
        </div>
        <Legend />
      </div>
    </ServerFeedProvider>
  );
}
