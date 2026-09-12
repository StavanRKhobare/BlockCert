"""Blockchain bridge for the provenance-api.

``PassportClient`` submits device lifecycle events to the ``Passport``
contract on the local Hardhat node. Thin, honest wrapper around the
contract calls — no ``PassportEntry`` construction here (Story P2's job).
"""

import json
import os

from web3 import Web3

_DEFAULT_RPC_URL = "http://127.0.0.1:8545"
_DEFAULT_DEPLOYMENTS_DIR = "../blockchain/deployments/localhost"


class PassportClient:
    def __init__(self, rpc_url: str = None, deployments_dir: str = None):
        if rpc_url is None:
            rpc_url = os.environ.get("CHAIN_RPC_URL", _DEFAULT_RPC_URL)
        if deployments_dir is None:
            deployments_dir = os.environ.get(
                "CHAIN_DEPLOYMENTS_DIR", _DEFAULT_DEPLOYMENTS_DIR
            )
        if not os.path.isfile(os.path.join(deployments_dir, "Passport.json")):
            # Fall back to resolving the same default relative to the
            # provenance-api package root, so the default works regardless
            # of the caller's working directory.
            package_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            candidate = os.path.normpath(
                os.path.join(package_root, _DEFAULT_DEPLOYMENTS_DIR)
            )
            if os.path.isfile(os.path.join(candidate, "Passport.json")):
                deployments_dir = candidate
        self.rpc_url = rpc_url
        self.deployments_dir = deployments_dir
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise ConnectionError(
                f"cannot reach Ethereum node at {rpc_url}; "
                "start it with `npx hardhat node` from blockchain/ first"
            )
        with open(os.path.join(deployments_dir, "Passport.json")) as f:
            deployment = json.load(f)
        self.contract = self.w3.eth.contract(
            address=deployment["address"], abi=deployment["abi"]
        )

    def submit_event(
        self,
        device_id: str,
        event_type: str,
        evidence_hash: str,
        model_version_hash: str,
        actor_did: str,
        signature: str,
    ) -> tuple[int, str]:
        """Submit a lifecycle event; return (entry_id, tx_hash).

        ``entry_id`` comes from the receipt's ``PassportEventSubmitted``
        event — the contract is the source of truth, never a client-side
        counter.
        """
        sender = self.w3.eth.accounts[0]
        tx_hash = self.contract.functions.submitEvent(
            device_id,
            event_type,
            evidence_hash,
            model_version_hash,
            actor_did,
            signature,
        ).transact({"from": sender})
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        events = self.contract.events.PassportEventSubmitted().process_receipt(
            receipt
        )
        entry_id = int(events[0]["args"]["entryId"])
        return entry_id, tx_hash.to_0x_hex()

    def get_events_for_device(self, device_id: str) -> list[int]:
        """Return the entry IDs recorded for a device as Python ints."""
        return [
            int(entry_id)
            for entry_id in self.contract.functions.getEventsForDevice(
                device_id
            ).call()
        ]

    def get_event(self, entry_id: int) -> dict:
        """Return one entry as a plain dict (thin contract wrapper)."""
        (
            device_id,
            event_type,
            evidence_hash,
            model_version_hash,
            actor_did,
            signature,
            timestamp,
        ) = self.contract.functions.getEvent(entry_id).call()
        return {
            "device_id": device_id,
            "event_type": event_type,
            "evidence_hash": evidence_hash,
            "model_version_hash": model_version_hash,
            "actor_did": actor_did,
            "signature": signature,
            "timestamp": int(timestamp),
        }
