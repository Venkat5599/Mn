// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title OracleVerifier
/// @notice Evidence policies (signer set, quorum, challenge and dispute windows, dispute bond) and
///         EIP-712 verification of incident reports. A signature proves who signed a report, not that it is true.
/// @dev Policies are write-once: new rules mean a new policyId, so a live contract's rules never change under it.
///      Signers can be revoked (a compromised key must be removable); a revoked signer's signature never counts.
contract OracleVerifier is EIP712, Ownable2Step {
    struct Policy {
        uint8 quorum;
        uint8 signerCount;
        uint32 challengeWindow;
        uint32 resolveWindow;
        uint16 disputeBondBps;
        uint128 minBond;
    }

    struct IncidentReport {
        uint256 contractId;
        bytes32 incidentId;
        uint8 outcome;
        bytes32 evidenceHash;
        uint64 observedAt;
        uint64 validUntil;
    }

    bytes32 public constant REPORT_TYPEHASH = keccak256(
        "IncidentReport(uint256 contractId,bytes32 incidentId,uint8 outcome,bytes32 evidenceHash,uint64 observedAt,uint64 validUntil)"
    );

    address public market;

    mapping(uint32 policyId => Policy) internal _policies;
    mapping(uint32 policyId => mapping(address signer => bool)) public isSigner;
    mapping(bytes32 incidentId => bool) public incidentUsed;

    event MarketSet(address market);
    event PolicyCreated(uint32 indexed policyId, Policy policy, address[] signers);
    event SignerRevoked(uint32 indexed policyId, address signer);
    event IncidentVerified(uint32 indexed policyId, uint256 indexed contractId, bytes32 indexed incidentId, uint8 signatures);

    error MarketAlreadySet();
    error NotMarket();
    error PolicyExists(uint32 policyId);
    error NoPolicy(uint32 policyId);
    error BadPolicy();
    error IncidentReplayed(bytes32 incidentId);
    error SignersNotAscending();
    error UnauthorizedSigner(address signer);
    error QuorumNotMet(uint256 valid, uint256 quorum);

    constructor(address owner_) EIP712("HYPERHEDGE", "1") Ownable(owner_) {}

    /// @notice One-time wiring to the ComputeMarket, the only caller allowed to consume reports.
    function setMarket(address market_) external onlyOwner {
        if (market != address(0)) revert MarketAlreadySet();
        market = market_;
        emit MarketSet(market_);
    }

    function createPolicy(uint32 policyId, Policy calldata p, address[] calldata signers) external onlyOwner {
        if (_policies[policyId].quorum != 0) revert PolicyExists(policyId);
        if (p.quorum == 0 || p.quorum > signers.length || signers.length > type(uint8).max) revert BadPolicy();
        if (p.challengeWindow == 0 || p.resolveWindow == 0 || p.disputeBondBps > 10_000) revert BadPolicy();
        if (p.disputeBondBps == 0 && p.minBond == 0) revert BadPolicy(); // a dispute must always cost something

        address prev;
        for (uint256 i; i < signers.length; ++i) {
            if (signers[i] <= prev) revert SignersNotAscending(); // also rejects zero and duplicates
            isSigner[policyId][signers[i]] = true;
            prev = signers[i];
        }
        Policy memory stored = p;
        stored.signerCount = uint8(signers.length);
        _policies[policyId] = stored;
        emit PolicyCreated(policyId, stored, signers);
    }

    function revokeSigner(uint32 policyId, address signer) external onlyOwner {
        if (!isSigner[policyId][signer]) revert UnauthorizedSigner(signer);
        isSigner[policyId][signer] = false;
        _policies[policyId].signerCount--;
        emit SignerRevoked(policyId, signer);
    }

    /// @notice Consumes a report: checks quorum of distinct, active signers and burns the incidentId.
    /// @dev Signatures must be ordered by ascending signer address, which makes duplicates impossible.
    ///      Time, outcome and contract-state checks live in ComputeMarket, which knows the contract's terms.
    function verify(IncidentReport calldata r, bytes[] calldata sigs, uint32 policyId) external {
        if (msg.sender != market) revert NotMarket();
        Policy storage p = _policies[policyId];
        if (p.quorum == 0) revert NoPolicy(policyId);
        if (incidentUsed[r.incidentId]) revert IncidentReplayed(r.incidentId);

        bytes32 digest = hashReport(r);
        address prev;
        for (uint256 i; i < sigs.length; ++i) {
            address signer = ECDSA.recover(digest, sigs[i]);
            if (signer <= prev) revert SignersNotAscending();
            if (!isSigner[policyId][signer]) revert UnauthorizedSigner(signer);
            prev = signer;
        }
        if (sigs.length < p.quorum) revert QuorumNotMet(sigs.length, p.quorum);

        incidentUsed[r.incidentId] = true;
        emit IncidentVerified(policyId, r.contractId, r.incidentId, uint8(sigs.length));
    }

    // ───────────────────────────── views ─────────────────────────────

    function hashReport(IncidentReport calldata r) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    REPORT_TYPEHASH, r.contractId, r.incidentId, r.outcome, r.evidenceHash, r.observedAt, r.validUntil
                )
            )
        );
    }

    function policy(uint32 policyId) external view returns (Policy memory) {
        return _policies[policyId];
    }

    function policyExists(uint32 policyId) external view returns (bool) {
        return _policies[policyId].quorum != 0;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
