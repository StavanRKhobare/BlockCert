import { useMemo } from "react";
import { useServerFeed } from "../mock/useServerFeed";
import type { StakeEvent } from "../types/schemas";

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

// Current per-client balances from the feed's stake events: staked/restored
// add, slashed subtracts. Pure function so the test can assert it directly.
export function computeStakeBalances(
  clientDids: string[],
  stakeEvents: StakeEvent[],
): Record<string, number> {
  const balances: Record<string, number> = Object.fromEntries(
    clientDids.map((did) => [did, 0]),
  );
  for (const e of stakeEvents) {
    if (!(e.client_did in balances)) balances[e.client_did] = 0;
    balances[e.client_did] += e.event_type === "slashed" ? -e.amount : e.amount;
  }
  return balances;
}

export default function BlockchainExplorer() {
  const { currentRound, clientDids, stakeEvents, transactions } = useServerFeed();

  const balances = useMemo(
    () => computeStakeBalances(clientDids, stakeEvents),
    [clientDids, stakeEvents],
  );

  // Most recent first. Transactions arrive in block order, so reverse.
  const recentFirst = useMemo(() => [...transactions].reverse(), [transactions]);

  // Mock block-height ticker: the highest anchored block visible so far —
  // counts up as currentRound advances because later rounds anchor higher
  // blocks. (Mock only; a real ticker would poll the chain head.)
  const blockHeight =
    transactions.length > 0
      ? Math.max(...transactions.map((t) => t.block_number))
      : 0;

  return (
    <div
      data-testid="blockchain-explorer"
      id="panel-blockchain"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Blockchain explorer
        </h3>
        <span className="text-xs text-slate-500">
          block{" "}
          <span data-testid="block-height" className="font-bold tabular-nums text-slate-200">
            {blockHeight}
          </span>{" "}
          · round {currentRound}
        </span>
      </div>

      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Stakes by client
      </h4>
      <table data-testid="stake-table" className="mb-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="py-1 pr-2 font-medium">Client</th>
            <th className="py-1 text-right font-medium">Staked balance</th>
          </tr>
        </thead>
        <tbody>
          {clientDids.map((did) => (
            <tr
              key={did}
              data-testid={`stake-row-${did.replace("did:example:", "")}`}
              data-balance={balances[did] ?? 0}
              className="border-t border-slate-800/70"
            >
              <td className="py-1 pr-2 text-slate-300" title={did}>
                {did.replace("did:example:", "")}
              </td>
              <td className="py-1 text-right tabular-nums text-slate-100">
                {(balances[did] ?? 0).toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Recent transactions
      </h4>
      {recentFirst.length === 0 ? (
        <p className="py-2 text-center text-sm text-slate-500">
          No transactions anchored yet.
        </p>
      ) : (
        <ul
          data-testid="tx-feed"
          className="max-h-48 space-y-1 overflow-y-auto pr-1"
        >
          {recentFirst.map((tx) => (
            <li
              key={tx.tx_hash}
              data-testid="tx-row"
              data-block={tx.block_number}
              className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs"
            >
              <span
                title={tx.tx_hash}
                className="font-mono tabular-nums text-slate-300"
              >
                {shortHash(tx.tx_hash)}
              </span>
              <span className="text-slate-400">
                {tx.contract_name}.{tx.function_called}
              </span>
              <span className="ml-auto tabular-nums text-slate-500">
                #{tx.block_number} · {tx.gas_used.toLocaleString()} gas
              </span>
            </li>
          ))}
        </ul>
      )}
      <p data-testid="teacher-note-explorer" className="teacher-note">
        Teacher: stakes drain when auth fails, every anchor and slash leaves
        an on-chain receipt below — newest first.
      </p>
    </div>
  );
}
