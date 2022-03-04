//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title RainbowToken
 * The contract implements the rainbow token game.
 * ## Join game
 * Any address can join the game by paying a fixed fee which goes to the contract.
 * By joining the game, a "random" color is associated to the player.
 * ## Blend
 * A player, the blender, may blend its color with the one of another player, the blending player, as a consequence the blender color changes.
 * In order to blend, the blender must pay a fee which is the blending price of the blending player. Half of the fee goes to the contract, the other half to the blending player.
 * ## Self blend
 * A player, the blender, may blend with its own original/starting color by paying a fixed fee which goes to the contract.
 * ## Update blending price
 * A player may update its blending price.
 * ## Claim victory
 * Once the color of a player is close enough to the target color, decided at constructor, the player may claim the victory and obtain the balance of the contract, the game is over.
 *
 * ## WARNING ##
 * This contract is made for educational purpose. Multiple "strategic" attacks are possible in order to programatically win the game.
 */
contract RainbowToken is Context {
    struct Color {
        uint8 r;
        uint8 g;
        uint8 b;
    }

    struct Player {
        Color originalColor;
        Color color;
        uint256 blendingPrice;
    }

    uint256 public constant DEFAULT_BLENDING_PRICE = 0.1 ether;
    uint256 public constant SELF_BLEND_PRICE = 0.5 ether;
    uint256 public constant ENTRY_FEE = 0.1 ether;

    Color private _targetColor;

    mapping(address => Player) private _players;

    error InvalidTargetColor(uint8 r, uint8 g, uint8 b);
    error SenderAlreadyPlayer(address account);
    error InsufficientValue(uint256 value);
    error SenderNotAPlayer(address account);
    error BlendingAccountNotAPlayer(address blendingAccount);
    error InvalidZeroBlendingPrice();
    error ColorNotMatching(Color blendingColor, Color actualColor);
    error PlayerNotWinner(address account);
    error EtherTransferFail(address recipient);

    event PlayerJoined(address indexed account, Color originalColor);
    event BlendingPriceUpdated(address indexed account, uint256 blendingPrice);
    event SelfBlended(address indexed account, Color color);
    event Blended(
        address indexed account,
        address indexed blendingAccount,
        Color color,
        Color blendingColor
    );
    event GameOver(address indexed winner, uint256 amount);

    /**
     * @dev Constructor
     * @param r R component of the target color, must be between 6 and 249
     * @param g G component of the target color, must be between 6 and 249
     * @param b B component of the target color, must be between 6 and 249
     */
    constructor(
        uint8 r,
        uint8 g,
        uint8 b
    ) {
        if (r <= 5 || r >= 250 || g <= 5 || g >= 250 || b <= 5 || b >= 250)
            revert InvalidTargetColor(r, g, b);
        _targetColor = Color({r: r, g: g, b: b});
    }

    modifier onlyPlayer() {
        if (!_isPlayer(_msgSender())) revert SenderNotAPlayer(_msgSender());
        _;
    }

    /**
     * @notice Join the game by paying an entry fee
     * @dev Can only be called by a non player
     * Emits a {PlayerJoined} event
     */
    function joinGame() public payable {
        if (_isPlayer(_msgSender())) revert SenderAlreadyPlayer(_msgSender());
        if (msg.value < ENTRY_FEE) revert InsufficientValue(msg.value);

        Color memory originalColor = _generateOriginalColor();

        _players[_msgSender()] = Player({
            originalColor: originalColor,
            color: originalColor,
            blendingPrice: DEFAULT_BLENDING_PRICE
        });

        emit PlayerJoined(_msgSender(), originalColor);
    }

    /**
     * @notice Update the player blending price
     * @dev Can only be called by a player
     * @param blendingPrice The new blending price of the player
     * Emits a {BlendingPriceUpdated} event
     */
    function updateBlendingPrice(uint256 blendingPrice) public onlyPlayer {
        if (blendingPrice == 0) revert InvalidZeroBlendingPrice();
        _players[_msgSender()].blendingPrice = blendingPrice;
        emit BlendingPriceUpdated(_msgSender(), blendingPrice);
    }

    /**
     * @notice Self blend with player original color
     * @dev Can only be called by a player
     * Emits a {SelfBlended} event
     */
    function selfBlend() public payable onlyPlayer {
        if (msg.value < SELF_BLEND_PRICE) revert InsufficientValue(msg.value);
        Player storage _player = _players[_msgSender()];
        _blend(_player.color, _player.originalColor);
        emit SelfBlended(_msgSender(), _player.color);
    }

    /**
     * @notice Blend with another player color
     * @dev Can only be called by a player and with a player as blending account
     * @param blendingAccount The address of the player with who the sender is blending
     * @param blendingColor The color of the player with who the sender is blending
     */
    function blend(address blendingAccount, Color calldata blendingColor)
        public
        payable
        onlyPlayer
    {
        if (!_isPlayer(blendingAccount))
            revert BlendingAccountNotAPlayer(blendingAccount);
        Player memory otherPlayer = _players[blendingAccount];
        if (msg.value < otherPlayer.blendingPrice)
            revert InsufficientValue(msg.value);
        if (
            otherPlayer.color.r != blendingColor.r ||
            otherPlayer.color.g != blendingColor.g ||
            otherPlayer.color.b != blendingColor.b
        ) revert ColorNotMatching(blendingColor, otherPlayer.color);

        (bool sent, ) = blendingAccount.call{value: msg.value / 2}("");
        if (!sent) revert EtherTransferFail(blendingAccount);

        Color storage _color = _players[_msgSender()].color;
        _blend(_color, blendingColor);

        emit Blended(_msgSender(), blendingAccount, _color, blendingColor);
    }

    /**
     * @notice Claim victory and retrieve contract balance by self destructing contract
     * @dev Can only be called by player with a color close enough to target color
     */
    function claimVictory() public onlyPlayer {
        Color memory playerColor = _players[_msgSender()].color;

        uint16 r = uint16(_absSub(playerColor.r, _targetColor.r));
        uint16 g = uint16(_absSub(playerColor.g, _targetColor.g));
        uint16 b = uint16(_absSub(playerColor.b, _targetColor.b));

        if (r * r + g * g + b * b > 25) revert PlayerNotWinner(_msgSender());

        emit GameOver(_msgSender(), address(this).balance);

        selfdestruct(payable(_msgSender()));
    }

    /**
     * @notice Check if an address is a player
     * @param account Address to check
     * @return isPlayer True if the address is a player, false otherwise
     */
    function isPlayer(address account) public view returns (bool) {
        return _isPlayer(account);
    }

    /**
     * @notice Get the player associated to an address
     * @param account Address of the player
     * @return Player The player associated to the address
     */
    function getPlayer(address account) public view returns (Player memory) {
        return _players[account];
    }

    /**
     * @notice Get the players associated to an array of addresses
     * @param accounts Array of addresses of the players
     * @return Players The players associated to the addresses
     */
    function getPlayers(address[] calldata accounts)
        public
        view
        returns (Player[] memory)
    {
        Player[] memory players = new Player[](accounts.length);
        for (uint256 index = 0; index < accounts.length; index++) {
            players[index] = _players[accounts[index]];
        }
        return players;
    }

    /**
     * @notice Get the target color
     * @return TargetColor The contract target color
     */
    function getTargetColor() public view returns (Color memory) {
        return _targetColor;
    }

    function _absSub(uint8 a, uint8 b) internal pure returns (uint8) {
        unchecked {
            if (a > b) {
                return a - b;
            }
            return b - a;
        }
    }

    function _generateOriginalColor() internal view returns (Color memory) {
        uint256 defaultColorSeed = uint256(
            keccak256(
                abi.encodePacked(
                    _msgSender(),
                    blockhash(block.number - 1),
                    block.timestamp
                )
            )
        );

        Color memory color = Color({
            r: _toPrimary(uint8((defaultColorSeed & 0xff0000) / 0xffff)),
            g: _toPrimary(uint8((defaultColorSeed & 0xff00) / 0xff)),
            b: _toPrimary(uint8(defaultColorSeed & 0xff))
        });

        return color;
    }

    function _toPrimary(uint8 colorComponent) internal pure returns (uint8) {
        if (colorComponent > 127) {
            return 255;
        } else {
            return 0;
        }
    }

    function _isPlayer(address account) internal view returns (bool) {
        return _players[account].blendingPrice > 0;
    }

    function _blend(Color storage _color, Color memory blendingColor) internal {
        _color.r = uint8((uint16(_color.r) + uint16(blendingColor.r)) / 2);
        _color.g = uint8((uint16(_color.g) + uint16(blendingColor.g)) / 2);
        _color.b = uint8((uint16(_color.b) + uint16(blendingColor.b)) / 2);
    }
}
