"""Blockchain bridge for the rollback-service (integration touchpoint #5).

``ChainClient`` anchors checkpoint hashes to the ``CheckpointAnchor``
contract on the local Hardhat node. Only hashes + off-chain URIs go on-chain.
"""

import json
import os

from web3 import Web3

from shared.interfaces.schemas import Checkpoint

_DEFAULT_RPC_URL = "http://127.0.0.1:8545"
_DEFAULT_DEPLOYMENTS_DIR = "../blockchain/deployments/localhost"


class ChainClient:
    def __init__(self, rpc_url: str = None, deployments_dir: str = None):
        if rpc_url is None:
            rpc_url = os.environ.get("CHAIN_RPC_URL", _DEFAULT_RPC_URL)
        if deployments_dir is None:
            deployments_dir = os.environ.get(
                "CHAIN_DEPLOYMENTS_DIR", _DEFAULT_DEPLOYMENTS_DIR
            )
        if not os.path.isfile(
            os.path.join(deployments_dir, "CheckpointAnchor.json")
        ):
            # Fall back to resolving the same default relative to the
            # rollback-service package root, so the default works regardless
            # of the caller's working directory.
            package_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            candidate = os.path.normpath(
                os.path.join(package_root, _DEFAULT_DEPLOYMENTS_DIR)
            )
            if os.path.isfile(os.path.join(candidate, "CheckpointAnchor.json")):
                deployments_dir = candidate
        self.rpc_url = rpc_url
        self.deployments_dir = deployments_dir
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise ConnectionError(
                f"cannot reach Ethereum node at {rpc_url}; "
                "start it with `npx hardhat node` from blockchain/ first"
            )
        with open(
            os.path.join(deployments_dir, "CheckpointAnchor.json")
        ) as f:
            deployment = json.load(f)
        self.contract = self.w3.eth.contract(
            address=deployment["address"], abi=deployment["abi"]
        )

    def anchor_checkpoint(self, checkpoint: Checkpoint) -> str:
        """Anchor a checkpoint hash on-chain; return the tx hash (hex)."""
        sender = self.w3.eth.accounts[0]
        tx_hash = self.contract.functions.anchorCheckpoint(
            checkpoint.round_number,
            checkpoint.weights_hash,
            checkpoint.off_chain_uri,
            checkpoint.parent_hash or "",
            checkpoint.is_delta,
        ).transact({"from": sender})
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.to_0x_hex()
