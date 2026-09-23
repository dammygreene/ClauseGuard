// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ClauseGuardRegistry {
    struct Review {
        bytes32 contractHash;
        bytes32 reportHash;
        uint256 timestamp;
        address sender;
    }

    mapping(bytes32 => Review) public reviews;

    event ReviewSealed(
        address indexed sender,
        bytes32 indexed contractHash,
        bytes32 indexed reportHash,
        uint256 timestamp
    );

    function registerReview(bytes32 contractHash, bytes32 reportHash) external {
        bytes32 reviewId = keccak256(abi.encode(contractHash, reportHash));
        reviews[reviewId] = Review(contractHash, reportHash, block.timestamp, msg.sender);
        emit ReviewSealed(msg.sender, contractHash, reportHash, block.timestamp);
    }

    function getReview(bytes32 contractHash, bytes32 reportHash) external view returns (Review memory) {
        return reviews[keccak256(abi.encode(contractHash, reportHash))];
    }
}
