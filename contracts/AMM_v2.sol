pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AMM is ERC20, ReentrancyGuard {
    address public owner;

    uint256 public totalToken1;
    uint256 public totalToken2;
    uint256 public K;

    uint256 constant PRECISION = 1_000_000;
    uint256 constant MINIMUM_LIQUIDITY = 1000;
    uint256 public feeRate = 30;

    IERC20 public token1;
    IERC20 public token2;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );

    modifier activePool() {
        require(totalSupply() > 0, "Zero Liquidity");
        _;
    }

    modifier tokensSet() {
        require(address(token1) != address(0) && address(token2) != address(0), "Tokens not set!");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "Transaction deadline passed!");
        _;
    }

    constructor() ERC20("My AMM LP Token", "AMM-LP") {
        owner = msg.sender;
    }

    /* ================= OWNER ================= */

    function setPoolTokens(address _token1, address _token2) external onlyOwner {
        require(address(token1) == address(0) && address(token2) == address(0), "Tokens already set!");
        token1 = IERC20(_token1);
        token2 = IERC20(_token2);
    }

    function setFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Fee too high! Max 10%");
        feeRate = _newFee;
    }

    /* ================= VIEW ================= */

    function getPoolDetails()
        external
        view
        returns (uint256 _totalToken1, uint256 _totalToken2, uint256 _totalShares, uint256 _feeRate)
    {
        return (totalToken1, totalToken2, totalSupply(), feeRate);
    }

    function getEquivalentToken1Estimate(uint256 amountToken2) public view activePool returns (uint256) {
        return (totalToken1 * amountToken2) / totalToken2;
    }

    function getEquivalentToken2Estimate(uint256 amountToken1) public view activePool returns (uint256) {
        return (totalToken2 * amountToken1) / totalToken1;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public view returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 amountInAfterFee = amountIn * (10000 - feeRate);
        uint256 numerator = amountInAfterFee * reserveOut;
        uint256 denominator = (reserveIn * 10000) + amountInAfterFee;

        amountOut = numerator / denominator;
    }

    function getSwapToken1Estimate(uint256 amountToken1) public view activePool returns (uint256) {
        return getAmountOut(amountToken1, totalToken1, totalToken2);
    }

    function getSwapToken2Estimate(uint256 amountToken2) public view activePool returns (uint256) {
        return getAmountOut(amountToken2, totalToken2, totalToken1);
    }

    /* ================= LIQUIDITY ================= */

    function provide(
        uint256 amountToken1,
        uint256 amountToken2,
        uint256 deadline
    ) external nonReentrant tokensSet ensure(deadline) returns (uint256 share) {
        require(amountToken1 > 0 && amountToken2 > 0, "Amounts must be > 0");

        require(token1.transferFrom(msg.sender, address(this), amountToken1), "Transfer of Token1 failed");
        require(token2.transferFrom(msg.sender, address(this), amountToken2), "Transfer of Token2 failed");

        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            share = (100 * PRECISION) - MINIMUM_LIQUIDITY;
            _mint(address(this), MINIMUM_LIQUIDITY);
        } else {
            uint256 share1 = (_totalSupply * amountToken1) / totalToken1;
            uint256 share2 = (_totalSupply * amountToken2) / totalToken2;
            share = Math.min(share1, share2);
        }

        require(share > 0, "Asset value too low");

        totalToken1 += amountToken1;
        totalToken2 += amountToken2;
        K = totalToken1 * totalToken2;

        _mint(msg.sender, share);
        emit Mint(msg.sender, amountToken1, amountToken2);
    }

    function withdraw(
        uint256 share,
        uint256 minAmount1,
        uint256 minAmount2,
        uint256 deadline
    ) external nonReentrant activePool tokensSet ensure(deadline)
        returns (uint256 amountToken1, uint256 amountToken2)
    {
        require(share > 0 && balanceOf(msg.sender) >= share, "Insufficient shares");

        uint256 _totalSupply = totalSupply();

        amountToken1 = (share * totalToken1) / _totalSupply;
        amountToken2 = (share * totalToken2) / _totalSupply;

        require(amountToken1 >= minAmount1, "Slippage: Token1 amount too low");
        require(amountToken2 >= minAmount2, "Slippage: Token2 amount too low");

        _burn(msg.sender, share);

        totalToken1 -= amountToken1;
        totalToken2 -= amountToken2;
        K = totalToken1 * totalToken2;

        require(token1.transfer(msg.sender, amountToken1), "Transfer of Token1 failed");
        require(token2.transfer(msg.sender, amountToken2), "Transfer of Token2 failed");

        emit Burn(msg.sender, amountToken1, amountToken2, msg.sender);
    }

    /* ================= SWAPS ================= */

    function swapToken1(
        uint256 amountToken1,
        uint256 minAmountOut,
        uint256 deadline
    ) external nonReentrant activePool tokensSet ensure(deadline) returns (uint256 amountToken2) {
        require(amountToken1 > 0, "Amount must be > 0");

        amountToken2 = getAmountOut(amountToken1, totalToken1, totalToken2);
        require(amountToken2 >= minAmountOut, "Slippage: Output amount too low");
        require(amountToken2 < totalToken2, "Insufficient liquidity");

        require(token1.transferFrom(msg.sender, address(this), amountToken1), "TransferFrom failed");
        require(token2.transfer(msg.sender, amountToken2), "Transfer failed");

        totalToken1 += amountToken1;
        totalToken2 -= amountToken2;

        emit Swap(msg.sender, amountToken1, 0, 0, amountToken2, msg.sender);
    }

    function swapToken2(
        uint256 amountToken2,
        uint256 minAmountOut,
        uint256 deadline
    ) external nonReentrant activePool tokensSet ensure(deadline) returns (uint256 amountToken1) {
        require(amountToken2 > 0, "Amount must be > 0");

        amountToken1 = getAmountOut(amountToken2, totalToken2, totalToken1);
        require(amountToken1 >= minAmountOut, "Slippage: Output amount too low");
        require(amountToken1 < totalToken1, "Insufficient liquidity");

        require(token2.transferFrom(msg.sender, address(this), amountToken2), "TransferFrom failed");
        require(token1.transfer(msg.sender, amountToken1), "Transfer failed");

        totalToken2 += amountToken2;
        totalToken1 -= amountToken1;

        emit Swap(msg.sender, 0, amountToken2, amountToken1, 0, msg.sender);
    }
}
