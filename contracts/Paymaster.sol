// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@account-abstraction/contracts/core/BasePaymaster.sol";

contract Paymaster is BasePaymaster {
    uint256 public constant MAX_FREE_CALLS = 3;
    mapping(address => uint256) public userCalls;
    address public immutable accountFactory;

    event UserAccepted(address indexed user, uint256 callCount);
    event UserRejected(address indexed user, uint256 callCount);

    constructor(IEntryPoint _entryPoint, address _accountFactory) BasePaymaster(_entryPoint) {
        accountFactory = _accountFactory; // Store accountFactoryAddress
    }

    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 /* maxCost */
    ) internal view override returns (bytes memory context, uint256 validationData) {
        uint256 calls = userCalls[userOp.sender];
        require(calls < MAX_FREE_CALLS, "Paymaster: Free call limit reached");
        return (abi.encode(userOp.sender), 0);
    }

    function _postOp(
        PostOpMode /* mode */,
        bytes calldata context,
        uint256 /* actualGasCost */
    ) internal override {
        address sender = abi.decode(context, (address));
        userCalls[sender] += 1;
        emit UserAccepted(sender, userCalls[sender]);
    }

    function resetUserCalls(address user) external onlyOwner {
        userCalls[user] = 0;
    }
}