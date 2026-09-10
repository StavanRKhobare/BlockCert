"""Local content-addressed off-chain checkpoint store.

Files live at ``<base_dir>/<weights_hash>.npz`` and are referenced by a
``local://`` URI. The URI scheme is deliberately swappable for an IPFS URI
later without changing any CALLER code — only this module's internals.
"""

import os

import numpy as np

from checkpoint_store.hasher import merkle_root

_URI_SCHEME = "local://"


class LocalCheckpointStore:
    def __init__(self, base_dir: str = "./checkpoint_data"):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def _path_for_uri(self, off_chain_uri: str) -> str:
        assert off_chain_uri.startswith(_URI_SCHEME), (
            f"unsupported URI scheme: {off_chain_uri!r}"
        )
        return off_chain_uri[len(_URI_SCHEME):]

    def save_full(
        self, weights_hash: str, weights: dict[str, np.ndarray]
    ) -> str:
        """Serialize weights to ``<base_dir>/<weights_hash>.npz``.

        Returns the ``local://`` off-chain URI of the stored checkpoint.
        """
        path = os.path.join(self.base_dir, f"{weights_hash}.npz")
        np.savez(path, **{k: np.asarray(v) for k, v in weights.items()})
        return f"{_URI_SCHEME}{path}"

    def load(self, off_chain_uri: str) -> dict[str, np.ndarray]:
        """Read a ``.npz`` checkpoint back into a ``{name: array}`` dict."""
        with np.load(self._path_for_uri(off_chain_uri)) as archive:
            return {key: archive[key].copy() for key in archive.files}

    def verify_integrity(
        self, off_chain_uri: str, expected_hash: str
    ) -> bool:
        """Confirm the stored checkpoint hashes to ``expected_hash``.

        Any load failure (e.g. a corrupted file) counts as failed integrity.
        """
        try:
            return merkle_root(self.load(off_chain_uri)) == expected_hash
        except Exception:
            return False
