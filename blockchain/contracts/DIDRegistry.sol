// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DIDRegistry
/// @notice Registers client DIDs with their public key and display name.
contract DIDRegistry {
    struct DIDRecord {
        string publicKey;
        string displayName;
        address owner;
        uint256 timestamp;
    }

    mapping(string => DIDRecord) private records;
    mapping(string => bool) private registered;

    event DIDRegistered(
        string did,
        address owner,
        string publicKey,
        uint256 timestamp
    );

    function registerDID(
        string calldata did,
        string calldata publicKey,
        string calldata displayName
    ) external {
        require(!registered[did], "DID already registered");
        records[did] = DIDRecord({
            publicKey: publicKey,
            displayName: displayName,
            owner: msg.sender,
            timestamp: block.timestamp
        });
        registered[did] = true;
        emit DIDRegistered(did, msg.sender, publicKey, block.timestamp);
    }

    function getDID(
        string calldata did
    )
        external
        view
        returns (
            string memory publicKey,
            string memory displayName,
            address owner,
            uint256 timestamp
        )
    {
        DIDRecord storage record = records[did];
        return (
            record.publicKey,
            record.displayName,
            record.owner,
            record.timestamp
        );
    }

    function isRegistered(
        string calldata did
    ) external view returns (bool) {
        return registered[did];
    }
}
