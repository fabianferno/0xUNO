// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IConnext} from "@connext/interfaces/core/IConnext.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH {
    function deposit() external payable;

    function approve(address guy, uint256 wad) external returns (bool);
}

contract OxSenderUNO is ReentrancyGuard, Ownable {
    struct Receiver {
        address destinationUnwrapper;
        address xUNOReceiver;
        bool exists;
    }

    IConnext public immutable connext;
    IWETH public immutable weth;
    mapping(uint32 => Receiver) public domainToReceiver;

    // IWETH public immutable goerli_weth;
    // IWETH public immutable mumbai_weth;
    constructor(address _connext, address _weth) {
        connext = IConnext(_connext);
        weth = IWETH(_weth);
    }

    event xStaked(
        bytes gameCode,
        uint256 amount,
        uint32 destinationDomain,
        address caller,
        uint256 relayerFee
    );

    function addChain(
        uint32 _destinationDomain,
        address _destinationUnwrapper,
        address _xUNOReceiver
    ) public onlyOwner {
        require(!domainToReceiver[_destinationDomain].exists, "Domain exists");
        domainToReceiver[_destinationDomain] = Receiver(_destinationUnwrapper, _xUNOReceiver, true);
    }

    function xStake(
        bytes calldata gameCode,
        uint256 amount,
        uint32 destinationDomain,
        uint256 relayerFee
    ) public payable {
        require(domainToReceiver[destinationDomain].exists, "Invalid Chain");
        require(msg.value >= relayerFee * 2 + amount, "Insufficient gas + funds");
        weth.deposit{value: amount}();

        weth.approve(address(connext), amount);

        bytes memory callData = abi.encode(domainToReceiver[destinationDomain].xUNOReceiver);

        connext.xcall{value: relayerFee}(
            destinationDomain,
            domainToReceiver[destinationDomain].destinationUnwrapper,
            address(weth),
            msg.sender,
            amount,
            30,
            callData
        );

        bytes memory callData1 = abi.encode(gameCode, msg.sender, amount);
        connext.xcall{value: relayerFee}(
            destinationDomain,
            domainToReceiver[destinationDomain].xUNOReceiver,
            address(0),
            msg.sender,
            0,
            0,
            callData1
        );
        emit xStaked(gameCode, amount, destinationDomain, msg.sender, relayerFee);
    }

    // Getter functions

    function getxUNOReceiver(uint32 _destinationDomain) public view returns (address) {
        return domainToReceiver[_destinationDomain].xUNOReceiver;
    }

    function getDestinationUnwrapper(uint32 _destinationDomain) public view returns (address) {
        return domainToReceiver[_destinationDomain].destinationUnwrapper;
    }

    function isExists(uint32 _destinationDomain) public view returns (bool) {
        return domainToReceiver[_destinationDomain].exists;
    }

    function getDomain(uint32 _destinationDomain) public view returns (address, address) {
        require(domainToReceiver[_destinationDomain].exists, "Invalid Chain");
        return (
            domainToReceiver[_destinationDomain].destinationUnwrapper,
            domainToReceiver[_destinationDomain].xUNOReceiver
        );
    }
}
