// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/// @title PositionListings
/// @notice An onchain order book for ComputeMarket protection positions. A holder lists units at a price; any
///         buyer fills some or all of them, paying the holder in the stake token while the position, and its
///         right to claim, moves to the buyer in the same transaction. Positions never leave the holder's
///         wallet until a fill, so cancelling costs nothing and an unfilled listing locks nothing.
/// @dev The holder approves this contract on the market (setApprovalForAll). Ownership and approval are
///      checked at fill time, so a stale listing simply fails. Not audited.
contract PositionListings is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint64 expiresAt;
        bool cancelled;
        uint256 id; // ComputeMarket contract id (= ERC-1155 token id)
        uint128 units;
        uint128 filled;
        uint128 pricePerUnit;
    }

    IERC1155 public immutable market;
    IERC20 public immutable token;
    uint256 public nextListing = 1;
    mapping(uint256 => Listing) internal _listings;

    event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed id, uint128 units, uint128 pricePerUnit, uint64 expiresAt);
    event Filled(uint256 indexed listingId, address indexed buyer, uint256 indexed id, uint128 units, uint256 paid);
    event Cancelled(uint256 indexed listingId);

    error BadParams();
    error NotSeller();
    error NotLive();
    error TooMany(uint128 available);
    error SellerLacksUnits();
    error NotApproved();

    constructor(IERC1155 market_, IERC20 token_) {
        market = market_;
        token = token_;
    }

    function list(uint256 id, uint128 units, uint128 pricePerUnit, uint64 expiresAt) external returns (uint256 listingId) {
        if (units == 0 || pricePerUnit == 0 || expiresAt <= block.timestamp) revert BadParams();
        if (market.balanceOf(msg.sender, id) < units) revert SellerLacksUnits();
        if (!market.isApprovedForAll(msg.sender, address(this))) revert NotApproved();
        listingId = nextListing++;
        _listings[listingId] = Listing({
            seller: msg.sender,
            expiresAt: expiresAt,
            cancelled: false,
            id: id,
            units: units,
            filled: 0,
            pricePerUnit: pricePerUnit
        });
        emit Listed(listingId, msg.sender, id, units, pricePerUnit, expiresAt);
    }

    function cancel(uint256 listingId) external {
        Listing storage l = _listings[listingId];
        if (l.seller != msg.sender) revert NotSeller();
        if (l.cancelled) revert NotLive();
        l.cancelled = true;
        emit Cancelled(listingId);
    }

    /// @notice Buys `units` from a listing: payment to the seller and the position to the buyer, atomically.
    function fill(uint256 listingId, uint128 units) external nonReentrant {
        Listing storage l = _listings[listingId];
        if (l.seller == address(0) || l.cancelled || block.timestamp >= l.expiresAt) revert NotLive();
        uint128 available = l.units - l.filled;
        if (units == 0 || units > available) revert TooMany(available);
        if (market.balanceOf(l.seller, l.id) < units) revert SellerLacksUnits();

        l.filled += units; // effects before the two external transfers
        uint256 paid = uint256(units) * l.pricePerUnit;
        token.safeTransferFrom(msg.sender, l.seller, paid);
        market.safeTransferFrom(l.seller, msg.sender, l.id, units, "");
        emit Filled(listingId, msg.sender, l.id, units, paid);
    }

    function listing(uint256 listingId) external view returns (Listing memory) {
        return _listings[listingId];
    }
}
