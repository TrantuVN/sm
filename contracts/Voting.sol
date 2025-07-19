// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Voting is Ownable {
    IERC20 public token; // Scoin (SCN) token contract
    uint256 public constant TOTAL_SUPPLY = 1000000 * 10**18; // 1,000,000 SCN with 18 decimals

    struct Proposal {
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 endTime;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(uint256 => bool)) public hasVoted;
    uint256 public proposalCount;

    event ProposalCreated(uint256 proposalId, string description, uint256 endTime);
    event VoteCast(uint256 proposalId, address voter, bool vote, uint256 votePower);
    event ProposalExecuted(uint256 proposalId);

    modifier onlyActiveProposal(uint256 _proposalId) {
        require(proposals[_proposalId].endTime > block.timestamp, "Voting: Proposal has ended");
        require(!proposals[_proposalId].executed, "Voting: Proposal already executed");
        _;
    }

    constructor(address _token) {
        token = IERC20(_token);
        transferOwnership(msg.sender); // Set deployer as owner
    }

    function createProposal(string memory _description, uint256 _durationSeconds) external onlyOwner {
        require(bytes(_description).length > 0, "Voting: Description cannot be empty");
        require(_durationSeconds > 0, "Voting: Duration must be positive");

        proposalCount++;
        proposals[proposalCount] = Proposal({
            description: _description,
            yesVotes: 0,
            noVotes: 0,
            endTime: block.timestamp + _durationSeconds,
            executed: false
        });

        emit ProposalCreated(proposalCount, _description, block.timestamp + _durationSeconds);
    }

    function vote(uint256 _proposalId, bool _vote) external onlyActiveProposal(_proposalId) {
        require(!hasVoted[msg.sender][_proposalId], "Voting: Already voted");
        uint256 votePower = token.balanceOf(msg.sender);
        require(votePower > 0, "Voting: No tokens to vote with");

        hasVoted[msg.sender][_proposalId] = true;

        if (_vote) {
            proposals[_proposalId].yesVotes += votePower;
        } else {
            proposals[_proposalId].noVotes += votePower;
        }

        emit VoteCast(_proposalId, msg.sender, _vote, votePower);
    }

    function executeProposal(uint256 _proposalId) external onlyOwner {
        require(proposals[_proposalId].endTime <= block.timestamp, "Voting: Proposal still active");
        require(!proposals[_proposalId].executed, "Voting: Proposal already executed");

        proposals[_proposalId].executed = true;
        emit ProposalExecuted(_proposalId);
        // Add custom logic here for proposal outcome (e.g., transfer tokens, update state)
    }

    function getProposal(uint256 _proposalId) external view returns (string memory, uint256, uint256, uint256, bool) {
        Proposal memory p = proposals[_proposalId];
        return (p.description, p.yesVotes, p.noVotes, p.endTime, p.executed);
    }
}