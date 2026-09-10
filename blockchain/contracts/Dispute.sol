// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Dispute
/// @notice Provisional-flag pattern for rejected clients: a flag is never
/// deleted, only superseded by a later status (Overturned or FinalizedRejected).
contract Dispute {
    enum Status {
        ProvisionallyRejected,
        FinalizedRejected,
        Overturned
    }

    struct DisputeRecord {
        string did;
        uint256 roundNumber;
        string reason;
        Status status;
        uint256 deadline;
    }

    event FlagFiled(
        uint256 disputeId,
        string did,
        uint256 roundNumber,
        string reason,
        uint256 deadline
    );
    event Overturned(uint256 disputeId, string evidenceHash);
    event Finalized(uint256 disputeId, Status finalStatus);

    DisputeRecord[] private disputes;

    function fileFlag(
        string calldata did,
        uint256 roundNumber,
        string calldata reason,
        uint256 challengeWindowSeconds
    ) external returns (uint256 disputeId) {
        disputeId = disputes.length;
        uint256 deadline = block.timestamp + challengeWindowSeconds;
        disputes.push(
            DisputeRecord({
                did: did,
                roundNumber: roundNumber,
                reason: reason,
                status: Status.ProvisionallyRejected,
                deadline: deadline
            })
        );
        emit FlagFiled(disputeId, did, roundNumber, reason, deadline);
    }

    function overturn(
        uint256 disputeId,
        string calldata evidenceHash
    ) external {
        DisputeRecord storage record = disputes[disputeId];
        require(
            record.status == Status.ProvisionallyRejected,
            "dispute not provisional"
        );
        require(block.timestamp < record.deadline, "challenge window closed");
        record.status = Status.Overturned;
        emit Overturned(disputeId, evidenceHash);
    }

    function finalize(uint256 disputeId) external {
        DisputeRecord storage record = disputes[disputeId];
        require(block.timestamp >= record.deadline, "challenge window open");
        if (record.status == Status.ProvisionallyRejected) {
            record.status = Status.FinalizedRejected;
        }
        emit Finalized(disputeId, record.status);
    }

    function getDispute(
        uint256 disputeId
    )
        external
        view
        returns (
            string memory did,
            uint256 roundNumber,
            Status status,
            uint256 deadline
        )
    {
        DisputeRecord storage record = disputes[disputeId];
        return (record.did, record.roundNumber, record.status, record.deadline);
    }
}
