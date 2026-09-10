// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CheckpointAnchor
/// @notice Records federated-learning round checkpoints on-chain.
/// @dev Stores ONLY the weights hash string and the off-chain URI pointing to
/// where the weights actually live. Raw model weights are NEVER stored here.
contract CheckpointAnchor {
    struct Checkpoint {
        uint256 roundNumber;
        string weightsHash;
        string offChainUri;
        string parentHash;
        bool isDelta;
        address submitter;
        uint256 timestamp;
    }

    event CheckpointAnchored(
        uint256 checkpointId,
        uint256 roundNumber,
        string weightsHash,
        string offChainUri,
        string parentHash,
        bool isDelta,
        address submitter,
        uint256 timestamp
    );

    Checkpoint[] private checkpoints;

    function anchorCheckpoint(
        uint256 roundNumber,
        string calldata weightsHash,
        string calldata offChainUri,
        string calldata parentHash,
        bool isDelta
    ) external returns (uint256 checkpointId) {
        checkpointId = checkpoints.length;
        checkpoints.push(
            Checkpoint({
                roundNumber: roundNumber,
                weightsHash: weightsHash,
                offChainUri: offChainUri,
                parentHash: parentHash,
                isDelta: isDelta,
                submitter: msg.sender,
                timestamp: block.timestamp
            })
        );
        emit CheckpointAnchored(
            checkpointId,
            roundNumber,
            weightsHash,
            offChainUri,
            parentHash,
            isDelta,
            msg.sender,
            block.timestamp
        );
    }

    function getCheckpoint(
        uint256 checkpointId
    )
        external
        view
        returns (
            uint256 roundNumber,
            string memory weightsHash,
            string memory offChainUri,
            string memory parentHash,
            bool isDelta,
            address submitter,
            uint256 timestamp
        )
    {
        Checkpoint storage checkpoint = checkpoints[checkpointId];
        return (
            checkpoint.roundNumber,
            checkpoint.weightsHash,
            checkpoint.offChainUri,
            checkpoint.parentHash,
            checkpoint.isDelta,
            checkpoint.submitter,
            checkpoint.timestamp
        );
    }

    function getLatestCheckpointId() external view returns (uint256) {
        require(checkpoints.length > 0, "no checkpoints anchored");
        return checkpoints.length - 1;
    }
}
