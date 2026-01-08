# FluxSwap Blockchain

FluxSwap is a Proof of Concept (PoC) Automated Market Maker (AMM) decentralized exchange inspired by Uniswap V2, built with React and a custom ERC20-based LP AMM smart contract. This repository contains the smart contracts and Hardhat environment for the FluxSwap.

## Features

- **Automated Market Maker (AMM):** Implements the constant product formula ($x * y = k$) for decentralized token swaps.
- **Liquidity Pools:** Allows users to add and remove liquidity to earn fees.
- **ERC20 Support:** Fully compatible with standard ERC20 tokens.
- **Built with Hardhat:** Uses the Hardhat development environment with TypeScript for robust testing and deployment.
- **Polygon Amoy Support:** Pre-configured for deployment to the Polygon Amoy testnet.

## Project Structure

- `contracts/`: Solidity smart contracts.
  - `AMM_v2.sol`: The core AMM logic.
  - `MockERC20.sol`: Mock tokens for testing purposes.
- `ignition/modules/`: Hardhat Ignition deployment modules.
- `test/`: Unit tests for the contracts.
- `hardhat.config.ts`: Hardhat configuration file.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd AMM_Dex_Blockchain
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

This project uses **Hardhat Configuration Variables** for sensitive data management. You do not need a `.env` file for these specific values.

Set the following variables before running scripts that require them (e.g., deployment):

1. **Private Key** (Account to deploy contracts):
   ```bash
   npx hardhat vars set PRIVATE_KEY
   ```
   *Enter your wallet's private key when prompted.*

2. **Etherscan API Key** (For contract verification):
   ```bash
   npx hardhat vars set ETHERSCAN_API_KEY
   ```
   *Enter your Polygon/Etherscan API key when prompted.*

## Usage

### Compile Contracts
Compile the Solidity smart contracts:
```bash
npx hardhat compile
```

### Run Tests
Execute the test suite to verify contract functionality:
```bash
npx hardhat test
```

### Deploy to Local Network
Start a local Hardhat node and deploy:
1. Start the node:
   ```bash
   npx hardhat node
   ```
2. In a new terminal, deploy using Ignition:
   ```bash
   npx hardhat ignition deploy ./ignition/modules/Amm_v2.ts --network localhost
   ```

### Deploy to Polygon Amoy Testnet
To deploy the AMM contract to the Polygon Amoy testnet:
```bash
npx hardhat ignition deploy ./ignition/modules/Amm_v2.ts --network polygon_amoy
```

## Technologies

- **Solidity** ^0.8.28
- **Hardhat**
- **Ethers.js v6**
- **OpenZeppelin Contracts**
- **TypeScript**
