// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Ante - Commitment-based challenge market
/// @notice Put your money where your mouth is
contract Ante {
    enum Outcome { Pending, Yes, No, Cancelled }

    struct Challenge {
        string title;
        address creator;
        address judge;
        uint256 lockTime;
        uint256 resolveDeadline;
        uint256 yesPool;
        uint256 noPool;
        Outcome outcome;
        bool resolved;
    }

    uint256 public challengeCount;
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => mapping(address => uint256)) public yesBets;
    mapping(uint256 => mapping(address => uint256)) public noBets;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event ChallengeCreated(
        uint256 indexed id,
        string title,
        address indexed creator,
        address indexed judge,
        uint256 lockTime
    );
    event BetPlaced(
        uint256 indexed id,
        address indexed bettor,
        bool isYes,
        uint256 amount
    );
    event Resolved(uint256 indexed id, Outcome outcome);
    event Claimed(uint256 indexed id, address indexed bettor, uint256 payout);

    function createChallenge(
        string calldata title,
        address judge,
        uint256 lockTime,
        uint256 resolveDeadline
    ) external returns (uint256 id) {
        require(lockTime > block.timestamp, "lock must be in future");
        require(resolveDeadline > lockTime, "resolve after lock");
        require(judge != address(0), "judge required");

        id = ++challengeCount;
        challenges[id] = Challenge({
            title: title,
            creator: msg.sender,
            judge: judge,
            lockTime: lockTime,
            resolveDeadline: resolveDeadline,
            yesPool: 0,
            noPool: 0,
            outcome: Outcome.Pending,
            resolved: false
        });

        emit ChallengeCreated(id, title, msg.sender, judge, lockTime);
    }

    function bet(uint256 id, bool isYes) external payable {
        Challenge storage c = challenges[id];
        require(c.creator != address(0), "no such challenge");
        require(block.timestamp < c.lockTime, "betting closed");
        require(msg.value > 0, "zero bet");

        if (isYes) {
            yesBets[id][msg.sender] += msg.value;
            c.yesPool += msg.value;
        } else {
            noBets[id][msg.sender] += msg.value;
            c.noPool += msg.value;
        }

        emit BetPlaced(id, msg.sender, isYes, msg.value);
    }

    function resolve(uint256 id, bool isYes) external {
        Challenge storage c = challenges[id];
        require(msg.sender == c.judge, "only judge");
        require(!c.resolved, "already resolved");
        require(block.timestamp >= c.lockTime, "too early");

        c.outcome = isYes ? Outcome.Yes : Outcome.No;
        c.resolved = true;

        emit Resolved(id, c.outcome);
    }

    function cancelIfStale(uint256 id) external {
        Challenge storage c = challenges[id];
        require(!c.resolved, "already resolved");
        require(block.timestamp > c.resolveDeadline, "not stale yet");

        c.outcome = Outcome.Cancelled;
        c.resolved = true;

        emit Resolved(id, Outcome.Cancelled);
    }

    function claim(uint256 id) external {
        Challenge storage c = challenges[id];
        require(c.resolved, "not resolved yet");
        require(!claimed[id][msg.sender], "already claimed");

        uint256 payout;
        if (c.outcome == Outcome.Cancelled) {
            payout = yesBets[id][msg.sender] + noBets[id][msg.sender];
        } else if (c.outcome == Outcome.Yes) {
            uint256 stake = yesBets[id][msg.sender];
            if (stake > 0 && c.yesPool > 0) {
                payout = (stake * (c.yesPool + c.noPool)) / c.yesPool;
            }
        } else {
            uint256 stake = noBets[id][msg.sender];
            if (stake > 0 && c.noPool > 0) {
                payout = (stake * (c.yesPool + c.noPool)) / c.noPool;
            }
        }

        require(payout > 0, "nothing to claim");
        claimed[id][msg.sender] = true;

        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");

        emit Claimed(id, msg.sender, payout);
    }

    function getChallenge(uint256 id) external view returns (Challenge memory) {
        return challenges[id];
    }

    function getBets(uint256 id, address user)
        external
        view
        returns (uint256 yesAmount, uint256 noAmount)
    {
        yesAmount = yesBets[id][user];
        noAmount = noBets[id][user];
    }
}