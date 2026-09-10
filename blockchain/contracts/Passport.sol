// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Passport
/// @notice Append-only device lifecycle passport (repairs, resales, etc.).
/// @dev Stores ONLY hash/URI-style string references, never raw blobs.
contract Passport {
    struct PassportEntry {
        string deviceId;
        string eventType;
        string evidenceHash;
        string modelVersionHash;
        string actorDid;
        uint256 timestamp;
    }

    event PassportEventSubmitted(
        uint256 entryId,
        string deviceId,
        string eventType,
        string evidenceHash,
        string modelVersionHash,
        string actorDid,
        uint256 timestamp
    );

    PassportEntry[] private entries;
    mapping(string => uint256[]) private entryIdsByDevice;

    function _isValidEventType(
        string calldata eventType
    ) private pure returns (bool) {
        bytes32 hashed = keccak256(bytes(eventType));
        return
            hashed == keccak256(bytes("repair")) ||
            hashed == keccak256(bytes("resale")) ||
            hashed == keccak256(bytes("refurbishment")) ||
            hashed == keccak256(bytes("recycling")) ||
            hashed == keccak256(bytes("inspection"));
    }

    function submitEvent(
        string calldata deviceId,
        string calldata eventType,
        string calldata evidenceHash,
        string calldata modelVersionHash,
        string calldata actorDid
    ) external returns (uint256 entryId) {
        require(_isValidEventType(eventType), "invalid event type");
        entryId = entries.length;
        entries.push(
            PassportEntry({
                deviceId: deviceId,
                eventType: eventType,
                evidenceHash: evidenceHash,
                modelVersionHash: modelVersionHash,
                actorDid: actorDid,
                timestamp: block.timestamp
            })
        );
        entryIdsByDevice[deviceId].push(entryId);
        emit PassportEventSubmitted(
            entryId,
            deviceId,
            eventType,
            evidenceHash,
            modelVersionHash,
            actorDid,
            block.timestamp
        );
    }

    function getEventsForDevice(
        string calldata deviceId
    ) external view returns (uint256[] memory entryIds) {
        return entryIdsByDevice[deviceId];
    }

    function getEvent(
        uint256 entryId
    )
        external
        view
        returns (
            string memory deviceId,
            string memory eventType,
            string memory evidenceHash,
            string memory modelVersionHash,
            string memory actorDid,
            uint256 timestamp
        )
    {
        PassportEntry storage entry = entries[entryId];
        return (
            entry.deviceId,
            entry.eventType,
            entry.evidenceHash,
            entry.modelVersionHash,
            entry.actorDid,
            entry.timestamp
        );
    }
}
