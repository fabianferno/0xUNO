// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IXReceiver} from "@connext/interfaces/core/IXReceiver.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract OxReceiverUNO is IXReceiver, Ownable, ReentrancyGuard {
    struct Game {
        address[2] players;
        mapping(address => bool) isStaked;
        uint256 totalStake;
        uint256 startedAt;
        uint256 reward;
        bool isCreated;
        bool isStarted;
    }
    mapping(bytes => Game) games;

    uint256 private royaltyFunds;
    uint256 private royaltyPercentage;
    AggregatorV3Interface ETH_TO_USD =
        AggregatorV3Interface(0x0715A7794a1dc8e42615F059dD6e406A6594651A);
    AggregatorV3Interface MATIC_TO_USD =
        AggregatorV3Interface(0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada);

    event NewGameCreated(
        bytes indexed gameCode,
        address player1,
        address player2,
        uint256 createdAt,
        uint256 bet
    );
    event PlayerStaked(bytes indexed gameCode, address player, uint256 stakedAt, uint256 stake);
    event GameStarted(bytes indexed gameCode, uint256 startedAt);
    event GameFinished(bytes indexed gameCode, address winner, uint256 finishedAt, uint256 bet);
    event RoyaltiesClaimed();
    event FundsRetreived(bytes indexed gameCode, uint256 reward);
    event XCallFailed(bytes indexed gameCode, address caller, uint256 returnCode);
    event XCallSuccessful(bytes indexed gameCode, address caller);

    constructor(uint256 _royaltyPercentage) {
        royaltyFunds = 0;
        royaltyPercentage = _royaltyPercentage;
    }

    receive() external payable {
        royaltyFunds += msg.value;
    }

    fallback() external payable {
        royaltyFunds += msg.value;
    }

    function _updateRoyaltyfunds(uint256 bet) internal returns (uint256) {
        uint256 _reward = bet - (bet * royaltyPercentage) / 100;
        royaltyFunds -= _reward;
        return _reward;
    }

    function createGame(
        bytes calldata gameCode,
        address player1,
        address player2,
        uint256 bet
    ) external onlyOwner {
        require(games[gameCode].isCreated == false, "Game already exists");

        games[gameCode].players = [player1, player2];
        games[gameCode].isStaked[player1] = false;
        games[gameCode].isStaked[player2] = false;
        games[gameCode].totalStake = bet;
        games[gameCode].isCreated = true;
        games[gameCode].isStarted = false;
        games[gameCode].reward = 0;

        emit NewGameCreated(gameCode, player1, player2, block.timestamp, bet);
    }

    function xReceive(
        bytes32,
        uint256,
        address,
        address,
        uint32,
        bytes memory _callData
    ) external returns (bytes memory) {
        (bytes memory gameCode, address sender, uint256 amount) = abi.decode(
            _callData,
            (bytes, address, uint256)
        );
        uint256 returnCode = _xStake(gameCode, amount, sender);
        if (returnCode > 0) {
            // TODO: Send back lost funds using xCall or claimable in this native chain
            emit XCallFailed(gameCode, sender, returnCode);
        } else {
            emit XCallSuccessful(gameCode, sender);
        }
        return "";
    }

    function _xStake(
        bytes memory gameCode,
        uint256 senderChainWei,
        address player
    ) internal returns (uint256) {
        if (!(games[gameCode].players[0] == player || games[gameCode].players[1] == player)) {
            return 1;
        }
        if (!(games[gameCode].isCreated && !games[gameCode].isStarted)) {
            return 2;
        }
        if (games[gameCode].isStaked[player] == true) {
            return 3;
        }
        uint256 _stake = games[gameCode].totalStake / 2;
        // Chainlink API calls
        (, int256 priceETH_USD, , , ) = ETH_TO_USD.latestRoundData();
        (, int256 priceMATIC_USD, , , ) = MATIC_TO_USD.latestRoundData();
        uint256 senderChainUSD = uint256(priceETH_USD) * senderChainWei;
        uint256 stakeUSD = _stake * uint256(priceMATIC_USD);
        if (senderChainUSD < stakeUSD) {
            return 4;
        }

        games[gameCode].isStaked[player] = true;
        uint256 _reward = _updateRoyaltyfunds(_stake);
        games[gameCode].reward += _reward;

        emit PlayerStaked(gameCode, player, block.timestamp, _stake);
        return 0;
    }

    function stake(bytes calldata gameCode) external payable {
        require(
            games[gameCode].players[0] == msg.sender || games[gameCode].players[1] == msg.sender,
            "Invalid game code"
        );
        require(games[gameCode].isCreated && !games[gameCode].isStarted, "Game unavailable");
        require(games[gameCode].isStaked[msg.sender] == false, "Already staked");
        uint256 _stake = games[gameCode].totalStake / 2;
        require(msg.value >= _stake, "Stake too low");

        games[gameCode].isStaked[msg.sender] = true;
        royaltyFunds += msg.value;
        uint256 _reward = _updateRoyaltyfunds(_stake);
        games[gameCode].reward += _reward;

        emit PlayerStaked(gameCode, msg.sender, block.timestamp, _stake);
    }

    function startGame(bytes calldata gameCode) external onlyOwner {
        require(games[gameCode].isCreated && !games[gameCode].isStarted, "Game unavailable");
        address _player1 = games[gameCode].players[0];
        address _player2 = games[gameCode].players[1];
        require(
            games[gameCode].isStaked[_player1] && games[gameCode].isStaked[_player2],
            "Players not staked"
        );

        games[gameCode].isStarted = true;
        games[gameCode].startedAt = block.timestamp;

        emit GameStarted(gameCode, block.timestamp);
    }

    function endGame(bytes calldata gameCode, address winner) external onlyOwner nonReentrant {
        require(
            winner == games[gameCode].players[0] || winner == games[gameCode].players[1],
            "Winner did not play"
        );
        require(games[gameCode].isCreated && games[gameCode].isStarted, "Game unavailable");

        (bool success, ) = payable(winner).call{value: games[gameCode].reward}("");
        if (success) {
            uint256 _reward = games[gameCode].reward;
            delete games[gameCode];

            emit GameFinished(gameCode, winner, block.timestamp, _reward);
        } else {
            revert("Error occured");
        }
    }

    function withdrawRoyaltyFunds() external onlyOwner nonReentrant {
        require(royaltyFunds > 0, "No funds");
        (bool success, ) = payable(msg.sender).call{value: royaltyFunds}("");
        if (success) {
            royaltyFunds = 0;
            emit RoyaltiesClaimed();
        }
    }

    function updateRoyaltyPercentage(uint256 _royaltyPercentage) external onlyOwner {
        require(_royaltyPercentage < 40, "Too high");
        royaltyPercentage = _royaltyPercentage;
    }

    function getRoyaltyPercentage() external view onlyOwner returns (uint256) {
        return royaltyPercentage;
    }

    function retrieveLockedFunds(bytes calldata gameCode) external nonReentrant {
        require(games[gameCode].isCreated && games[gameCode].isStarted, "Game unavailable");
        uint256 _reward = games[gameCode].reward / 2;
        address _player1 = games[gameCode].players[0];
        address _player2 = games[gameCode].players[1];

        delete games[gameCode];
        (bool success1, ) = payable(_player1).call{value: _reward}("");

        (bool success2, ) = payable(_player2).call{value: _reward}("");
        if (success1 && success2) {
            emit FundsRetreived(gameCode, _reward * 2);
        }
    }
}
