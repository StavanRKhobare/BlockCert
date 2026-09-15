"""Chain bridges owned by gateway (G2).

DIDClient wraps DIDRegistry.sol: register_did / is_registered / get_did.
StakingClient wraps Staking.sol: stake / balance_of. Same sender pattern
as the sibling bridges (accounts[0]); same deployments-dir fallback so the
default works regardless of the caller's working directory.

Kept in one small file deliberately (prompt's call) — these split into
siblings if either grows past thin-wallet size.
"""

import json
import os

from web3 import Web3

_DEFAULT_RPC_URL = "http://127.0.0.1:8545"
_DEFAULT_DEPLOYMENTS_DIR = "../blockchain/deployments/localhost"


def _resolve_deployments_dir(deployments_dir: str | None, filename: str) -> str:
    if deployments_dir is None:
        deployments_dir = os.environ.get(
            "CHAIN_DEPLOYMENTS_DIR", _DEFAULT_DEPLOYMENTS_DIR
        )
    if not os.path.isfile(os.path.join(deployments_dir, filename)):
        package_root = os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))
        )
        candidate = os.path.normpath(
            os.path.join(package_root, _DEFAULT_DEPLOYMENTS_DIR)
        )
        if os.path.isfile(os.path.join(candidate, filename)):
            deployments_dir = candidate
    return deployments_dir


def _connect(rpc_url: str | None) -> Web3:
    if rpc_url is None:
        rpc_url = os.environ.get("CHAIN_RPC_URL", _DEFAULT_RPC_URL)
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise ConnectionError(
            f"cannot reach Ethereum node at {rpc_url}; "
            "start it with `npx hardhat node` from blockchain/ first "
            "(Epic G keeps one node running continuously)"
        )
    return w3


def _load_contract(w3: Web3, deployments_dir: str, filename: str):
    with open(os.path.join(deployments_dir, filename)) as f:
        deployment = json.load(f)
    return w3.eth.contract(
        address=deployment["address"], abi=deployment["abi"]
    )


class DIDClient:
    def __init__(self, rpc_url: str | None = None, deployments_dir: str | None = None):
        self.w3 = _connect(rpc_url)
        self.deployments_dir = _resolve_deployments_dir(
            deployments_dir, "DIDRegistry.json"
        )
        self.contract = _load_contract(
            self.w3, self.deployments_dir, "DIDRegistry.json"
        )

    def register_did(
        self, did: str, public_key: str, display_name: str
    ) -> str:
        """Register a DID; return the tx hash (hex). Reverts if taken."""
        sender = self.w3.eth.accounts[0]
        tx_hash = self.contract.functions.registerDID(
            did, public_key, display_name
        ).transact({"from": sender})
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.to_0x_hex()

    def is_registered(self, did: str) -> bool:
        return bool(self.contract.functions.isRegistered(did).call())

    def get_did(self, did: str) -> dict:
        public_key, display_name, owner, timestamp = (
            self.contract.functions.getDID(did).call()
        )
        return {
            "did": did,
            "public_key": public_key,
            "display_name": display_name,
            "owner": owner,
            "timestamp": int(timestamp),
        }


class StakingClient:
    def __init__(self, rpc_url: str | None = None, deployments_dir: str | None = None):
        self.w3 = _connect(rpc_url)
        self.deployments_dir = _resolve_deployments_dir(
            deployments_dir, "Staking.json"
        )
        self.contract = _load_contract(
            self.w3, self.deployments_dir, "Staking.json"
        )

    def stake(self, did: str, amount_wei: int) -> str:
        """Stake amount_wei (sent as msg.value) for did; return tx hash."""
        sender = self.w3.eth.accounts[0]
        tx_hash = self.contract.functions.stake(did).transact(
            {"from": sender, "value": amount_wei}
        )
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.to_0x_hex()

    def slash(self, did: str, amount_wei: int, reason: str) -> str:
        """Slash a finalized-rejected did; return the tx hash (hex).

        Staking.slash is onlyOwner — works because the deployer is
        accounts[0], the same sender every bridge in this build uses.
        """
        sender = self.w3.eth.accounts[0]
        tx_hash = self.contract.functions.slash(did, amount_wei, reason).transact(
            {"from": sender}
        )
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.to_0x_hex()

    def balance_of(self, did: str) -> int:
        return int(self.contract.functions.balanceOf(did).call())
