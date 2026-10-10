// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PriceProtectionPool
/// @notice An AMM that sells protection against a token's price falling. Liquidity providers pool a stablecoin;
///         a buyer pays a premium priced by an onchain curve and is paid `notional × (strike − price) / spot`
///         if the price at expiry is below the strike. Every position is fully collateralized: its maximum payout
///         is locked from the pool when it is sold.
///         Prices are EIP-712 reports signed by a quorum of the HYPERHEDGE oracle signers, sampled from a public
///         exchange. A position whose expiry price is never reported pays nothing: missing data never pays out.
/// @dev Not audited. Fee-on-transfer tokens are not supported.
contract PriceProtectionPool is EIP712, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PriceReport {
        bytes32 feedId;
        int64 price; // 1e8 fixed point
        uint64 publishTime;
    }

    struct Position {
        address owner;
        uint64 start;
        uint64 expiry;
        bool settled;
        int64 spot;
        int64 strike;
        int64 expiryPrice;
        uint128 notional;
        uint128 maxPayout;
        uint128 premium;
        uint128 paid;
    }

    bytes32 public constant PRICE_TYPEHASH = keccak256("PriceReport(bytes32 feedId,int64 price,uint64 publishTime)");
    uint64 public constant MAX_PRICE_AGE = 120; // a buy must use a price at most 2 minutes old
    uint64 public constant SETTLE_WINDOW = 600; // the expiry price must be published within 10 minutes after expiry
    uint64 public constant STALE_AFTER = 1 days; // after this with no report, the position lapses with no payout
    uint16 public constant MIN_RATE_BPS = 25;
    uint16 public constant MIN_STRIKE_BPS = 7_000;
    uint16 public constant MAX_STRIKE_BPS = 9_900;

    IERC20 public immutable token;
    bytes32 public immutable feedId;
    uint8 public immutable quorum;

    /// @notice Assumed daily volatility used by the premium curve, in bps. A disclosed assumption, owner-tunable.
    uint16 public volDailyBps;

    mapping(address => bool) public isSigner;
    uint256 public totalShares;
    mapping(address => uint256) public shares;
    uint256 public locked;

    uint256 public nextId = 1;
    mapping(uint256 => Position) internal _positions;

    event SignerSet(address signer, bool active);
    event VolSet(uint16 volDailyBps);
    event Deposited(address indexed lp, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lp, uint256 amount, uint256 shares);
    event Bought(
        uint256 indexed id,
        address indexed owner,
        uint128 notional,
        int64 spot,
        int64 strike,
        uint64 expiry,
        uint128 premium,
        uint128 maxPayout
    );
    event Settled(uint256 indexed id, int64 expiryPrice, uint128 paid);
    event Lapsed(uint256 indexed id);

    error BadParams();
    error StalePrice();
    error WrongFeed();
    error QuorumNotMet();
    error SignersNotAscending();
    error UnauthorizedSigner(address signer);
    error PremiumTooHigh(uint256 premium, uint256 maxPremium);
    error InsufficientLiquidity(uint256 free, uint256 needed);
    error NotExpired();
    error AlreadySettled();
    error PriceOutsideWindow();
    error NoPosition();

    constructor(
        address owner_,
        IERC20 token_,
        bytes32 feedId_,
        address[] memory signers_,
        uint8 quorum_,
        uint16 volDailyBps_
    ) EIP712("HYPERHEDGE Price", "1") Ownable(owner_) {
        if (quorum_ == 0 || quorum_ > signers_.length || volDailyBps_ == 0 || volDailyBps_ > 5_000) revert BadParams();
        token = token_;
        feedId = feedId_;
        quorum = quorum_;
        volDailyBps = volDailyBps_;
        for (uint256 i; i < signers_.length; ++i) {
            isSigner[signers_[i]] = true;
            emit SignerSet(signers_[i], true);
        }
    }

    // ───────────────────────────── liquidity ─────────────────────────────

    function deposit(uint256 amount) external nonReentrant returns (uint256 minted) {
        if (amount == 0) revert BadParams();
        uint256 a = assets();
        minted = totalShares == 0 || a == 0 ? amount : (amount * totalShares) / a;
        shares[msg.sender] += minted;
        totalShares += minted;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, minted);
    }

    /// @notice Burns shares for their slice of the pool. Locked collateral cannot leave.
    function withdraw(uint256 shareAmount) external nonReentrant returns (uint256 amount) {
        if (shareAmount == 0 || shareAmount > shares[msg.sender]) revert BadParams();
        amount = (shareAmount * assets()) / totalShares;
        uint256 free = assets() - locked;
        if (amount > free) revert InsufficientLiquidity(free, amount);
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, shareAmount);
    }

    // ───────────────────────────── protection ─────────────────────────────

    /// @param strikeBps strike as a fraction of spot (9_500 = protection below a 5% drop)
    /// @param durationIdx 0 = 1 hour, 1 = 6 hours, 2 = 24 hours
    function buy(
        uint128 notional,
        uint16 strikeBps,
        uint8 durationIdx,
        uint256 maxPremium,
        PriceReport calldata r,
        bytes[] calldata sigs
    ) external nonReentrant returns (uint256 id) {
        _verify(r, sigs);
        if (block.timestamp > r.publishTime + MAX_PRICE_AGE || r.publishTime > block.timestamp) revert StalePrice();
        if (r.price <= 0) revert BadParams();
        (uint256 premium, uint256 maxPayout) = quote(notional, strikeBps, durationIdx);
        if (premium > maxPremium) revert PremiumTooHigh(premium, maxPremium);

        id = nextId++;
        uint64 expiry = uint64(block.timestamp) + duration(durationIdx);
        int64 strike = int64((int256(r.price) * int256(uint256(strikeBps))) / 10_000);
        _positions[id] = Position({
            owner: msg.sender,
            start: uint64(block.timestamp),
            expiry: expiry,
            settled: false,
            spot: r.price,
            strike: strike,
            expiryPrice: 0,
            notional: notional,
            maxPayout: uint128(maxPayout),
            premium: uint128(premium),
            paid: 0
        });
        locked += maxPayout;
        token.safeTransferFrom(msg.sender, address(this), premium);
        emit Bought(id, msg.sender, notional, r.price, strike, expiry, uint128(premium), uint128(maxPayout));
    }

    /// @notice Anyone may settle with a quorum-signed price published inside [expiry, expiry + SETTLE_WINDOW].
    function settle(uint256 id, PriceReport calldata r, bytes[] calldata sigs) external nonReentrant {
        Position storage p = _positions[id];
        if (p.owner == address(0)) revert NoPosition();
        if (p.settled) revert AlreadySettled();
        if (block.timestamp < p.expiry) revert NotExpired();
        if (r.publishTime < p.expiry || r.publishTime > p.expiry + SETTLE_WINDOW) revert PriceOutsideWindow();
        _verify(r, sigs);

        uint256 payout;
        if (r.price < p.strike) {
            int256 price = r.price < 0 ? int256(0) : int256(r.price);
            payout = (uint256(p.notional) * uint256(int256(p.strike) - price)) / uint256(int256(p.spot));
            if (payout > p.maxPayout) payout = p.maxPayout;
        }
        p.settled = true;
        p.expiryPrice = r.price;
        p.paid = uint128(payout);
        locked -= p.maxPayout;
        if (payout != 0) token.safeTransfer(p.owner, payout);
        emit Settled(id, r.price, uint128(payout));
    }

    /// @notice No expiry price was ever reported: the lock is released and nothing is paid.
    function lapse(uint256 id) external nonReentrant {
        Position storage p = _positions[id];
        if (p.owner == address(0)) revert NoPosition();
        if (p.settled) revert AlreadySettled();
        if (block.timestamp <= p.expiry + STALE_AFTER) revert NotExpired();
        p.settled = true;
        locked -= p.maxPayout;
        emit Lapsed(id);
    }

    // ───────────────────────────── owner ─────────────────────────────

    function setVol(uint16 volDailyBps_) external onlyOwner {
        if (volDailyBps_ == 0 || volDailyBps_ > 5_000) revert BadParams();
        volDailyBps = volDailyBps_;
        emit VolSet(volDailyBps_);
    }

    function setSigner(address signer, bool active) external onlyOwner {
        isSigner[signer] = active;
        emit SignerSet(signer, active);
    }

    // ───────────────────────────── pricing ─────────────────────────────

    /// @notice The AMM curve. Base rate = vol × √t minus half the out-of-the-money distance (floored), then
    ///         scaled up by utilization: rate × (1 + 2u²), where u is the pool share locked after this trade.
    ///         A transparent curve, not a fair-value model.
    function quote(uint128 notional, uint16 strikeBps, uint8 durationIdx)
        public
        view
        returns (uint256 premium, uint256 maxPayout)
    {
        if (notional == 0 || strikeBps < MIN_STRIKE_BPS || strikeBps > MAX_STRIKE_BPS || durationIdx > 2) {
            revert BadParams();
        }
        maxPayout = (uint256(notional) * strikeBps) / 10_000;
        uint256 a = assets();
        if (locked + maxPayout > a) revert InsufficientLiquidity(a - locked, maxPayout);

        uint256 sqrtT = durationIdx == 0 ? 2_041 : durationIdx == 1 ? 5_000 : 10_000; // √(hours/24) in bps
        uint256 expected = (uint256(volDailyBps) * sqrtT) / 10_000;
        uint256 otmHalf = (10_000 - uint256(strikeBps)) / 2;
        uint256 rateBps = expected > otmHalf ? expected - otmHalf : 0;
        if (rateBps < MIN_RATE_BPS) rateBps = MIN_RATE_BPS;

        uint256 u = ((locked + maxPayout) * 10_000) / a;
        uint256 multBps = 10_000 + (2 * u * u) / 10_000;
        premium = (uint256(notional) * rateBps * multBps) / 1e8;
    }

    function duration(uint8 idx) public pure returns (uint64) {
        return idx == 0 ? 1 hours : idx == 1 ? 6 hours : 24 hours;
    }

    // ───────────────────────────── views ─────────────────────────────

    function assets() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function position(uint256 id) external view returns (Position memory) {
        return _positions[id];
    }

    function hashPrice(PriceReport calldata r) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(PRICE_TYPEHASH, r.feedId, r.price, r.publishTime)));
    }

    function _verify(PriceReport calldata r, bytes[] calldata sigs) internal view {
        if (r.feedId != feedId) revert WrongFeed();
        if (sigs.length < quorum) revert QuorumNotMet();
        bytes32 digest = hashPrice(r);
        address prev;
        for (uint256 i; i < sigs.length; ++i) {
            address s = ECDSA.recover(digest, sigs[i]);
            if (s <= prev) revert SignersNotAscending();
            if (!isSigner[s]) revert UnauthorizedSigner(s);
            prev = s;
        }
    }
}
