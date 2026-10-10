// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {CollateralVault} from "./CollateralVault.sol";
import {OracleVerifier} from "./OracleVerifier.sol";

/// @title ComputeMarket
/// @notice Compute Delivery Protection. A seller commits immutable terms and reserves collateral equal to the
///         maximum payout. Buyers pay a premium per unit and receive transferable ERC-1155 positions (token id =
///         contract id). A quorum-signed incident report fixes the outcome, a challenge window allows a bonded
///         dispute, and settlement is deterministic. Missing data never pays out.
/// @dev The full rule set is docs/FINANCIAL_MODEL.md. Not audited.
contract ComputeMarket is ERC1155, Ownable2Step, ReentrancyGuard {
    enum State {
        NONE,
        OPEN, // terms committed, collateral reserved, nothing sold
        ACTIVE, // at least one unit sold
        REVIEW, // a report is accepted, challenge window running
        DISPUTED, // bonded dispute open, waiting on the guardian
        DELIVERED, // delivery final, funds release at expiry
        SETTLED, // failure final, holders claim
        EXPIRED, // seller released
        VOIDED // premiums refunded, seller released
    }

    enum Outcome {
        NONE,
        FAILURE,
        DELIVERED
    }

    struct Terms {
        address seller;
        bytes32 underlying;
        uint64 quantity;
        bytes32 slaHash;
        uint64 units;
        uint128 payoutPerUnit;
        uint128 premiumPerUnit;
        uint16 feeBps;
        uint64 saleEnd;
        uint64 deliveryDeadline;
        uint64 expiry;
        uint32 policyId;
    }

    struct Status {
        State state;
        Outcome outcome;
        bool unsoldReleased;
        uint64 sold;
        uint64 challengeEnd;
        uint64 resolveBy;
        address disputer;
        bytes32 incidentId;
        bytes32 evidenceHash;
        uint256 bondPerUnit;
    }

    uint16 public constant MAX_FEE_BPS = 1_000;

    CollateralVault public immutable vault;
    OracleVerifier public immutable oracle;

    address public guardian;
    uint256 public nextId = 1;

    mapping(uint256 id => Terms) internal _terms;
    mapping(uint256 id => Status) internal _status;

    event GuardianSet(address guardian);
    event Created(uint256 indexed id, address indexed seller, Terms terms, string slaURI);
    event Bought(uint256 indexed id, address indexed buyer, uint64 units, uint256 premium);
    event UnsoldReleased(uint256 indexed id, uint256 amount);
    event ReportAccepted(
        uint256 indexed id, bytes32 indexed incidentId, Outcome outcome, bytes32 evidenceHash, uint64 challengeEnd
    );
    event Disputed(uint256 indexed id, address indexed disputer, uint256 bond, uint64 resolveBy);
    event Resolved(uint256 indexed id, Outcome outcome, bool voided, bool disputerWon);
    event DisputeTimedOut(uint256 indexed id);
    event Settled(uint256 indexed id, uint256 payable_, uint256 bondPerUnit);
    event DeliveryFinal(uint256 indexed id);
    event Expired(uint256 indexed id, uint256 released);
    event Voided(uint256 indexed id, uint256 released);
    event Claimed(uint256 indexed id, address indexed holder, uint256 units, uint256 amount);
    event Refunded(uint256 indexed id, address indexed holder, uint256 units, uint256 amount);

    error NoContract(uint256 id);
    error BadTerms();
    error NoPolicy(uint32 policyId);
    error WrongState(State actual);
    error SaleClosed();
    error SoldOut(uint64 available);
    error PremiumTooHigh(uint256 cost, uint256 maxPremium);
    error ZeroUnits();
    error WrongContract();
    error BadOutcome();
    error ReportExpired();
    error ObservedTooEarly();
    error ObservedInFuture();
    error ChallengeClosed();
    error ChallengeOpen();
    error NotSeller();
    error NotHolder();
    error NotGuardian();
    error ResolveClosed();
    error TooEarly();
    error NothingToRedeem();

    constructor(address owner_, CollateralVault vault_, OracleVerifier oracle_, address guardian_)
        ERC1155("")
        Ownable(owner_)
    {
        vault = vault_;
        oracle = oracle_;
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    function setGuardian(address guardian_) external onlyOwner {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    // ───────────────────────────── issuance ─────────────────────────────

    /// @notice Commits terms and reserves the full maximum payout from the caller's free vault balance.
    function create(Terms calldata t, string calldata slaURI) external nonReentrant returns (uint256 id) {
        if (t.seller != msg.sender) revert NotSeller();
        if (
            t.units == 0 || t.payoutPerUnit == 0 || t.premiumPerUnit == 0 || t.quantity == 0
                || t.underlying == bytes32(0) || t.slaHash == bytes32(0) || t.feeBps > MAX_FEE_BPS
                || t.saleEnd <= block.timestamp || t.saleEnd > t.deliveryDeadline || t.deliveryDeadline >= t.expiry
        ) revert BadTerms();
        if (!oracle.policyExists(t.policyId)) revert NoPolicy(t.policyId);

        id = nextId++;
        _terms[id] = t;
        _status[id].state = State.OPEN;
        vault.reserve(id, msg.sender, maxPayout(id)); // reverts if free < M: C = M, never less
        emit Created(id, msg.sender, t, slaURI);
    }

    /// @param maxPremium slippage guard: the most the buyer agrees to pay in total
    function buy(uint256 id, uint64 units, uint256 maxPremium) external nonReentrant {
        Terms storage t = _existing(id);
        Status storage s = _status[id];
        if (s.state != State.OPEN && s.state != State.ACTIVE) revert WrongState(s.state);
        if (block.timestamp >= t.saleEnd) revert SaleClosed();
        if (units == 0) revert ZeroUnits();
        uint64 available = t.units - s.sold;
        if (units > available) revert SoldOut(available);
        uint256 cost = uint256(units) * t.premiumPerUnit;
        if (cost > maxPremium) revert PremiumTooHigh(cost, maxPremium);

        s.sold += units;
        s.state = State.ACTIVE;
        vault.pullPremium(id, msg.sender, cost);
        _mint(msg.sender, id, units, "");
        emit Bought(id, msg.sender, units, cost);
    }

    /// @notice After the sale closes, collateral for unsold units goes back to the seller's free balance.
    ///         A contract that sold nothing is finished at that point.
    function releaseUnsold(uint256 id) external nonReentrant {
        Terms storage t = _existing(id);
        Status storage s = _status[id];
        if (block.timestamp < t.saleEnd) revert TooEarly();
        if (s.unsoldReleased) revert WrongState(s.state);
        _releaseUnsold(id, t, s);
        if (s.sold == 0 && s.state == State.OPEN) {
            s.state = State.EXPIRED;
            emit Expired(id, 0);
        }
    }

    // ───────────────────────────── evidence ─────────────────────────────

    /// @notice Anyone may submit; only a quorum of the policy's signers makes it valid. The first accepted
    ///         report fixes the outcome.
    function submitReport(OracleVerifier.IncidentReport calldata r, bytes[] calldata sigs) external nonReentrant {
        uint256 id = r.contractId;
        Terms storage t = _existing(id);
        Status storage s = _status[id];
        if (s.state != State.ACTIVE) revert WrongState(s.state);
        if (r.outcome != uint8(Outcome.FAILURE) && r.outcome != uint8(Outcome.DELIVERED)) revert BadOutcome();
        if (block.timestamp > r.validUntil || block.timestamp > t.expiry) revert ReportExpired();
        if (r.observedAt < t.deliveryDeadline) revert ObservedTooEarly();
        if (r.observedAt > block.timestamp) revert ObservedInFuture();

        oracle.verify(r, sigs, t.policyId); // quorum, signer set, replay

        uint64 challengeEnd = uint64(block.timestamp) + oracle.policy(t.policyId).challengeWindow;
        s.state = State.REVIEW;
        s.outcome = Outcome(r.outcome);
        s.incidentId = r.incidentId;
        s.evidenceHash = r.evidenceHash;
        s.challengeEnd = challengeEnd;
        emit ReportAccepted(id, r.incidentId, Outcome(r.outcome), r.evidenceHash, challengeEnd);
    }

    /// @notice Bonded dispute. The seller disputes FAILURE with a bond from free balance (never the reserved
    ///         collateral); any position holder disputes DELIVERED with a bond from their wallet.
    function dispute(uint256 id) external nonReentrant {
        Terms storage t = _existing(id);
        Status storage s = _status[id];
        if (s.state != State.REVIEW) revert WrongState(s.state);
        if (block.timestamp >= s.challengeEnd) revert ChallengeClosed();

        uint256 b = disputeBond(id);
        if (s.outcome == Outcome.FAILURE) {
            if (msg.sender != t.seller) revert NotSeller();
            vault.lockBondFromFree(id, msg.sender, b);
        } else {
            // the seller is the counterparty to a DELIVERED dispute, never the disputer
            if (msg.sender == t.seller || balanceOf(msg.sender, id) == 0) revert NotHolder();
            vault.lockBondFromWallet(id, msg.sender, b);
        }
        uint64 resolveBy = uint64(block.timestamp) + oracle.policy(t.policyId).resolveWindow;
        s.state = State.DISPUTED;
        s.disputer = msg.sender;
        s.resolveBy = resolveBy;
        emit Disputed(id, msg.sender, b, resolveBy);
    }

    /// @notice Guardian decides a dispute before `resolveBy`: uphold the report, overturn it, or void because
    ///         the evidence itself is broken. A wrong disputer loses the bond to the counterparty.
    function resolve(uint256 id, Outcome o, bool void_) external nonReentrant {
        if (msg.sender != guardian) revert NotGuardian();
        Terms storage t = _existing(id);
        Status storage s = _status[id];
        if (s.state != State.DISPUTED) revert WrongState(s.state);
        if (block.timestamp > s.resolveBy) revert ResolveClosed();

        if (void_) {
            _returnBond(id, t, s);
            emit Resolved(id, Outcome.NONE, true, false);
            _void(id, t, s);
            return;
        }
        if (o != Outcome.FAILURE && o != Outcome.DELIVERED) revert BadOutcome();
        bool disputerWon = o != s.outcome;
        if (disputerWon) _returnBond(id, t, s);
        else _slashBond(id, t, s);
        s.outcome = o;
        emit Resolved(id, o, false, disputerWon);
        _finalizeOutcome(id, t, s);
    }

    // ───────────────────────────── permissionless transitions ─────────────────────────────

    /// @notice REVIEW past its challenge window becomes final. DISPUTED past `resolveBy` voids, and the bond is
    ///         still slashed: an unresolved dispute never profits the disputer.
    function finalize(uint256 id) external nonReentrant {
        Terms storage t = _existing(id);
        Status storage s = _status[id];
        if (s.state == State.REVIEW) {
            if (block.timestamp < s.challengeEnd) revert ChallengeOpen();
            _finalizeOutcome(id, t, s);
        } else if (s.state == State.DISPUTED) {
            if (block.timestamp <= s.resolveBy) revert TooEarly();
            _slashBond(id, t, s);
            emit DisputeTimedOut(id);
            _void(id, t, s);
        } else {
            revert WrongState(s.state);
        }
    }

    /// @notice Releases the seller once nothing can still pay out: no report by expiry (missing data never
    ///         pays), or delivery final and expiry reached.
    function expire(uint256 id) external nonReentrant {
        Terms storage t = _existing(id);
        Status storage s = _status[id];
        bool noReport = s.state == State.ACTIVE && block.timestamp > t.expiry;
        bool deliveredDue = s.state == State.DELIVERED && block.timestamp >= t.expiry;
        if (!noReport && !deliveredDue) revert WrongState(s.state);
        _expire(id, t, s);
    }

    // ───────────────────────────── holders ─────────────────────────────

    /// @notice SETTLED: burns the caller's position and pays maxPayout per unit plus any slashed-bond share.
    function claim(uint256 id) external nonReentrant {
        Terms storage t = _existing(id);
        Status storage s = _status[id];
        if (s.state != State.SETTLED) revert WrongState(s.state);
        uint256 units = balanceOf(msg.sender, id);
        if (units == 0) revert NothingToRedeem();
        _burn(msg.sender, id, units);
        uint256 amount = units * (uint256(t.payoutPerUnit) + s.bondPerUnit);
        vault.payOut(id, msg.sender, amount);
        emit Claimed(id, msg.sender, units, amount);
    }

    /// @notice VOIDED: burns the caller's position and returns the premium per unit plus any slashed-bond share.
    function refund(uint256 id) external nonReentrant {
        Terms storage t = _existing(id);
        Status storage s = _status[id];
        if (s.state != State.VOIDED) revert WrongState(s.state);
        uint256 units = balanceOf(msg.sender, id);
        if (units == 0) revert NothingToRedeem();
        _burn(msg.sender, id, units);
        uint256 premiumBack = units * t.premiumPerUnit;
        uint256 bondShare = units * s.bondPerUnit;
        vault.refundPremium(id, msg.sender, premiumBack);
        vault.payOut(id, msg.sender, bondShare);
        emit Refunded(id, msg.sender, units, premiumBack + bondShare);
    }

    // ───────────────────────────── internal ─────────────────────────────

    function _finalizeOutcome(uint256 id, Terms storage t, Status storage s) internal {
        if (s.outcome == Outcome.FAILURE) {
            _releaseUnsold(id, t, s);
            uint256 owed = uint256(s.sold) * t.payoutPerUnit;
            vault.makePayable(id, owed);
            vault.earnPremium(id, t.seller, t.feeBps);
            s.state = State.SETTLED;
            emit Settled(id, owed, s.bondPerUnit);
        } else if (block.timestamp >= t.expiry) {
            _expire(id, t, s);
        } else {
            s.state = State.DELIVERED;
            emit DeliveryFinal(id);
        }
    }

    function _expire(uint256 id, Terms storage t, Status storage s) internal {
        uint256 released = vault.reserved(id);
        if (!s.unsoldReleased) s.unsoldReleased = true;
        vault.release(id, t.seller, released);
        vault.earnPremium(id, t.seller, t.feeBps);
        s.state = State.EXPIRED;
        emit Expired(id, released);
    }

    function _void(uint256 id, Terms storage t, Status storage s) internal {
        uint256 released = vault.reserved(id);
        s.unsoldReleased = true;
        vault.release(id, t.seller, released);
        s.state = State.VOIDED; // premiums stay in the vault for `refund`
        emit Voided(id, released);
    }

    /// @dev The disputer was right (or the guardian voided in good faith): the bond goes back where it came from.
    function _returnBond(uint256 id, Terms storage t, Status storage s) internal {
        if (s.disputer == t.seller) vault.returnBondToFree(id, t.seller);
        else vault.returnBond(id, s.disputer);
    }

    /// @dev The disputer was wrong (or let the dispute time out): the bond goes to the other side.
    function _slashBond(uint256 id, Terms storage t, Status storage s) internal {
        if (s.disputer == t.seller) s.bondPerUnit = vault.slashBondToPayable(id, s.sold);
        else vault.slashBondToFree(id, t.seller);
    }

    function _releaseUnsold(uint256 id, Terms storage t, Status storage s) internal {
        if (s.unsoldReleased) return;
        s.unsoldReleased = true;
        uint256 amount = uint256(t.units - s.sold) * t.payoutPerUnit;
        vault.release(id, t.seller, amount);
        emit UnsoldReleased(id, amount);
    }

    function _existing(uint256 id) internal view returns (Terms storage t) {
        t = _terms[id];
        if (t.seller == address(0)) revert NoContract(id);
    }

    // ───────────────────────────── views ─────────────────────────────

    function terms(uint256 id) external view returns (Terms memory) {
        return _terms[id];
    }

    function status(uint256 id) external view returns (Status memory) {
        return _status[id];
    }

    function maxPayout(uint256 id) public view returns (uint256) {
        Terms storage t = _terms[id];
        return uint256(t.units) * t.payoutPerUnit;
    }

    /// @notice B = max(disputeBondBps × M, minBond) under the contract's evidence policy.
    function disputeBond(uint256 id) public view returns (uint256) {
        OracleVerifier.Policy memory p = oracle.policy(_terms[id].policyId);
        uint256 b = (maxPayout(id) * p.disputeBondBps) / 10_000;
        return b < p.minBond ? p.minBond : b;
    }
}
