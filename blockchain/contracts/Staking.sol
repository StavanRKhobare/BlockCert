// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Staking
/// @notice Holds per-DID ETH stakes; the owner can slash misbehaving DIDs.
/// @dev Dispute-window logic lives in Dispute.sol (a later story), not here.
contract Staking is Ownable {
    mapping(string => uint256) private balances;

    event Staked(string did, uint256 amount, uint256 newBalance);
    event Slashed(string did, uint256 amount, string reason, uint256 newBalance);

    constructor() Ownable(msg.sender) {}

    function stake(string calldata did) external payable {
        balances[did] += msg.value;
        emit Staked(did, msg.value, balances[did]);
    }

    function slash(
        string calldata did,
        uint256 amount,
        string calldata reason
    ) external onlyOwner {
        require(balances[did] >= amount, "insufficient stake");
        balances[did] -= amount;
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "payout failed");
        emit Slashed(did, amount, reason, balances[did]);
    }

    function balanceOf(string calldata did) external view returns (uint256) {
        return balances[did];
    }
}
