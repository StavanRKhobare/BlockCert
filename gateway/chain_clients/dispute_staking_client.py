"""Dispute bridge owned by gateway (G6).

DisputeClient wraps Dispute.sol: file_flag / finalize / get_dispute. Same
sender pattern (accounts[0]) and deployments-dir fallback as the sibling
bridges. dispute_id comes from the receipt's FlagFiled event — the
contract is the source of truth, never a client-side counter (P1 pattern).

No overturn path is wired to anything: nothing in this build disputes a
filed flag, so every filed dispute finalizes as rejected. Stated here so
the session's finalize-then-slash flow reads honestly.
"""

import json
import os

from web3 import Web3

_DEFAULT_RPC_URL = "http://127.0.0.1:8545"
_DEFAULT_DEPLOYMENTS_DIR = "../blockchain/deployments/localhost"

_STATUS_NAMES = ("ProvisionallyRejected", "FinalizedRejected", "Overturned")


class DisputeClient:
    def __init__(self, rpc_url: str | None = None, deployments_dir: str | None = None):
        if rpc_url is None:
            rpc_url = os.environ.get("CHAIN_RPC_URL", _DEFAULT_RPC_URL)
        if deployments_dir is None:
            deployments_dir = os.environ.get(
                "CHAIN_DEPLOYMENTS_DIR", _DEFAULT_DEPLOYMENTS_DIR
            )
        if not os.path.isfile(os.path.join(deployments_dir, "Dispute.json")):
            package_root = os.path.dirname(
                os.path.dirname(os.path.abspath(__file__))
            )
            candidate = os.path.normpath(
                os.path.join(package_root, _DEFAULT_DEPLOYMENTS_DIR)
            )
            if os.path.isfile(os.path.join(candidate, "Dispute.json")):
                deployments_dir = candidate
        self.deployments_dir = deployments_dir
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise ConnectionError(
                f"cannot reach Ethereum node at {rpc_url}; "
                "start it with `npx hardhat node` from blockchain/ first "
                "(Epic G keeps one node running continuously)"
            )
        with open(os.path.join(deployments_dir, "Dispute.json")) as f:
            deployment = json.load(f)
        self.contract = self.w3.eth.contract(
            address=deployment["address"], abi=deployment["abi"]
        )

    def file_flag(
        self,
        did: str,
        round_number: int,
        reason: str,
        challenge_window_seconds: int,
    ) -> tuple[int, str]:
        """File a provisional flag; return (dispute_id, tx_hash)."""
        sender = self.w3.eth.accounts[0]
        tx_hash = self.contract.functions.fileFlag(
            did, round_number, reason, challenge_window_seconds
        ).transact({"from": sender})
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        events = self.contract.events.FlagFiled().process_receipt(receipt)
        dispute_id = int(events[0]["args"]["disputeId"])
        return dispute_id, tx_hash.to_0x_hex()

    def finalize(self, dispute_id: int) -> str:
        """Finalize after the deadline; return the tx hash (hex)."""
        sender = self.w3.eth.accounts[0]
        tx_hash = self.contract.functions.finalize(dispute_id).transact(
            {"from": sender}
        )
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.to_0x_hex()

    def get_dispute(self, dispute_id: int) -> dict:
        """Return one dispute as a plain dict (thin contract wrapper)."""
        did, round_number, status, deadline = self.contract.functions.getDispute(
            dispute_id
        ).call()
        return {
            "dispute_id": dispute_id,
            "did": did,
            "round_number": int(round_number),
            "status": _STATUS_NAMES[int(status)],
            "deadline": int(deadline),
        }
