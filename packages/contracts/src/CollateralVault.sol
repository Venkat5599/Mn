// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title CollateralVault
/// @notice Holds every token HYPERHEDGE touches, in buckets that never mix (docs/FINANCIAL_MODEL.md §3):
///         free (per seller), reserved / premium / payable / bond (per contract), and protocol fees.
///         Sellers deposit and withdraw `free` only; every other movement is a ComputeMarket state transition.
/// @dev Running totals make the conservation invariant checkable onchain: see `reconcile()`.
///      Fee-on-transfer and rebasing tokens are not supported.
contract CollateralVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public market;

    mapping(address seller => uint256) public free;
    mapping(uint256 id => uint256) public reserved;
    mapping(uint256 id => uint256) public premium;
    mapping(uint256 id => uint256) public payable_;
    mapping(uint256 id => uint256) public bond;
    uint256 public fees;

    uint256 public totalFree;
    uint256 public totalReserved;
    uint256 public totalPremium;
    uint256 public totalPayable;
    uint256 public totalBond;

    event MarketSet(address market);
    event Deposited(address indexed seller, uint256 amount);
    event Withdrawn(address indexed seller, uint256 amount);
    event Reserved(uint256 indexed id, address indexed seller, uint256 amount);
    event Released(uint256 indexed id, address indexed seller, uint256 amount);
    event PremiumIn(uint256 indexed id, address indexed payer, uint256 amount);
    event PremiumEarned(uint256 indexed id, address indexed seller, uint256 net, uint256 fee);
    event PremiumRefunded(uint256 indexed id, address indexed to, uint256 amount);
    event MadePayable(uint256 indexed id, uint256 amount);
    event PaidOut(uint256 indexed id, address indexed to, uint256 amount);
    event BondLocked(uint256 indexed id, address indexed from, uint256 amount, bool fromFree);
    event BondReturned(uint256 indexed id, address indexed to, uint256 amount);
    event BondSlashed(uint256 indexed id, address indexed toSeller, uint256 toPayable, uint256 dust);
    event FeesWithdrawn(address indexed to, uint256 amount);

    error MarketAlreadySet();
    error NotMarket();
    error ZeroAmount();
    error Insufficient(uint256 available, uint256 needed);

    modifier onlyMarket() {
        if (msg.sender != market) revert NotMarket();
        _;
    }

    constructor(address owner_, IERC20 token_) Ownable(owner_) {
        token = token_;
    }

    function setMarket(address market_) external onlyOwner {
        if (market != address(0)) revert MarketAlreadySet();
        market = market_;
        emit MarketSet(market_);
    }

    // ───────────────────────────── sellers ─────────────────────────────

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        free[msg.sender] += amount;
        totalFree += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Only unreserved collateral can leave. Reserved collateral moves through market transitions only.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 f = free[msg.sender];
        if (f < amount) revert Insufficient(f, amount);
        free[msg.sender] = f - amount;
        totalFree -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ───────────────────────────── market-only transitions ─────────────────────────────

    function reserve(uint256 id, address seller, uint256 amount) external onlyMarket {
        uint256 f = free[seller];
        if (f < amount) revert Insufficient(f, amount);
        free[seller] = f - amount;
        totalFree -= amount;
        reserved[id] += amount;
        totalReserved += amount;
        emit Reserved(id, seller, amount);
    }

    function release(uint256 id, address seller, uint256 amount) external onlyMarket {
        if (amount == 0) return;
        reserved[id] -= amount;
        totalReserved -= amount;
        free[seller] += amount;
        totalFree += amount;
        emit Released(id, seller, amount);
    }

    function pullPremium(uint256 id, address payer, uint256 amount) external onlyMarket {
        premium[id] += amount;
        totalPremium += amount;
        token.safeTransferFrom(payer, address(this), amount);
        emit PremiumIn(id, payer, amount);
    }

    /// @notice Premium becomes the seller's (minus the explicit protocol fee) once the outcome is final.
    function earnPremium(uint256 id, address seller, uint16 feeBps) external onlyMarket {
        uint256 amount = premium[id];
        premium[id] = 0;
        totalPremium -= amount;
        uint256 fee = (amount * feeBps) / 10_000;
        fees += fee;
        free[seller] += amount - fee;
        totalFree += amount - fee;
        emit PremiumEarned(id, seller, amount - fee, fee);
    }

    function refundPremium(uint256 id, address to, uint256 amount) external onlyMarket {
        if (amount == 0) return;
        premium[id] -= amount;
        totalPremium -= amount;
        token.safeTransfer(to, amount);
        emit PremiumRefunded(id, to, amount);
    }

    function makePayable(uint256 id, uint256 amount) external onlyMarket {
        reserved[id] -= amount;
        totalReserved -= amount;
        payable_[id] += amount;
        totalPayable += amount;
        emit MadePayable(id, amount);
    }

    function payOut(uint256 id, address to, uint256 amount) external onlyMarket {
        if (amount == 0) return;
        payable_[id] -= amount;
        totalPayable -= amount;
        token.safeTransfer(to, amount);
        emit PaidOut(id, to, amount);
    }

    /// @notice Seller's dispute bond: new money from `free`, never from the contract's reserved collateral.
    function lockBondFromFree(uint256 id, address seller, uint256 amount) external onlyMarket {
        uint256 f = free[seller];
        if (f < amount) revert Insufficient(f, amount);
        free[seller] = f - amount;
        totalFree -= amount;
        bond[id] += amount;
        totalBond += amount;
        emit BondLocked(id, seller, amount, true);
    }

    function lockBondFromWallet(uint256 id, address holder, uint256 amount) external onlyMarket {
        bond[id] += amount;
        totalBond += amount;
        token.safeTransferFrom(holder, address(this), amount);
        emit BondLocked(id, holder, amount, false);
    }

    function returnBond(uint256 id, address to) external onlyMarket {
        uint256 amount = bond[id];
        bond[id] = 0;
        totalBond -= amount;
        token.safeTransfer(to, amount);
        emit BondReturned(id, to, amount);
    }

    /// @notice A seller's bond came from `free`, so a returned seller bond goes back to `free`.
    function returnBondToFree(uint256 id, address seller) external onlyMarket {
        uint256 amount = bond[id];
        bond[id] = 0;
        totalBond -= amount;
        free[seller] += amount;
        totalFree += amount;
        emit BondReturned(id, seller, amount);
    }

    /// @notice Seller's bond to buyers: `perUnit * sold` becomes payable, the rounding dust becomes fees.
    function slashBondToPayable(uint256 id, uint256 sold) external onlyMarket returns (uint256 perUnit) {
        uint256 amount = bond[id];
        bond[id] = 0;
        totalBond -= amount;
        perUnit = amount / sold;
        uint256 toPayable = perUnit * sold;
        payable_[id] += toPayable;
        totalPayable += toPayable;
        fees += amount - toPayable;
        emit BondSlashed(id, address(0), toPayable, amount - toPayable);
    }

    function slashBondToFree(uint256 id, address seller) external onlyMarket {
        uint256 amount = bond[id];
        bond[id] = 0;
        totalBond -= amount;
        free[seller] += amount;
        totalFree += amount;
        emit BondSlashed(id, seller, 0, 0);
    }

    // ───────────────────────────── owner ─────────────────────────────

    function withdrawFees(address to) external onlyOwner nonReentrant {
        uint256 amount = fees;
        fees = 0;
        token.safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    // ───────────────────────────── views ─────────────────────────────

    /// @notice Conservation check: every token the vault holds sits in exactly one bucket.
    function reconcile() external view returns (bool ok, uint256 balance, uint256 tracked) {
        balance = token.balanceOf(address(this));
        tracked = totalFree + totalReserved + totalPremium + totalPayable + totalBond + fees;
        ok = balance == tracked;
    }
}
