# AquaQuota: Decentralized Water Quota Management System

## Overview

AquaQuota is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It tokenizes water usage quotas as NFTs for agricultural basins like the Merín Lagoon in Uruguay, addressing real-world problems such as water scarcity, unsustainable farming practices, and environmental degradation (e.g., eutrophication caused by excessive nutrient runoff from over-irrigation). By leveraging NFTs for quota representation, satellite-data oracles for enforcement, and zero-knowledge proofs (ZKPs) for private trading, AquaQuota enables farmers to trade water rights securely while ensuring compliance with sustainable allocation rules. This prevents overuse, protects farmer privacy, and promotes ecological balance.

The system solves:
- **Water Overallocation**: Dynamic enforcement via oracles reduces waste and prevents basin depletion.
- **Eutrophication**: Quotas are tied to environmental metrics (e.g., nutrient levels from satellite imagery), incentivizing sustainable practices.
- **Privacy Concerns**: ZKPs allow trades without revealing sensitive farm data.
- **Inefficient Markets**: Decentralized trading creates a liquid market for water rights, aiding small farmers.
- **Regulatory Compliance**: Automated audits via blockchain ensure transparency for governments and NGOs.

AquaQuota involves 6 core smart contracts written in Clarity, integrating with external oracles (e.g., Chainlink for satellite data feeds) and ZKP libraries (simulated via Clarity's trait system or external verification).

## How It Works

1. **Quota Allocation**: Government or basin authorities mint NFTs representing annual water quotas (e.g., cubic meters per hectare) based on sustainable models.
2. **Monitoring & Enforcement**: Oracles pull satellite data (e.g., from NASA or ESA sources) to verify actual usage and environmental impact. If quotas are exceeded, penalties are auto-applied (e.g., burning portions of NFTs).
3. **Trading**: Farmers trade quotas via ZKP-secured transactions, proving ownership and compliance without disclosing private data like farm locations or yields.
4. **Sustainability Rules**: Smart contracts enforce caps to prevent eutrophication, adjusting quotas based on real-time basin health.
5. **Governance**: A DAO allows stakeholders (farmers, ecologists) to vote on allocation parameters.

Users interact via a dApp (not included here; assume frontend in React/STX wallet integration).

## Smart Contracts

AquaQuota consists of 6 Clarity smart contracts. Each is designed for modularity, security, and efficiency on Stacks. Contracts use traits for interoperability (e.g., SIP-009 for NFTs).

### 1. QuotaNFT Contract
- **Purpose**: Manages the minting, transfer, and burning of water quota NFTs.
- **Key Functions**:
  - `mint-quota`: Mints an NFT with metadata (quota amount, basin ID, expiration year) – restricted to admins.
  - `transfer-quota`: Standard SIP-009 transfer, with hooks for enforcement checks.
  - `burn-excess`: Burns partial quota if oracle detects overuse.
- **Traits Used**: SIP-009 (NFT standard).
- **Real-World Impact**: Represents fixed water rights, preventing double-spending or fraud.

### 2. OracleIntegrator Contract
- **Purpose**: Interfaces with external oracles to fetch and validate satellite data for water usage and environmental metrics.
- **Key Functions**:
  - `submit-data`: Accepts oracle feeds (e.g., water level, nutrient concentration) and stores verified readings.
  - `query-usage`: Computes compliance score based on data (e.g., if nutrient levels > threshold, flag for penalty).
  - `validate-oracle`: Verifies signatures from trusted oracles (e.g., Chainlink).
- **Traits Used**: Custom oracle trait for data integrity.
- **Real-World Impact**: Enforces sustainability by linking blockchain to real-time Earth observation data, reducing eutrophication risks.

### 3. ZKPTrade Contract
- **Purpose**: Handles private trades of quotas using zero-knowledge proofs for verification without revealing details.
- **Key Functions**:
  - `initiate-trade`: Submits ZKP proof (e.g., via external circuit) proving sender owns quota and meets conditions.
  - `verify-proof`: Validates ZKP (Clarity simulates via public inputs; full ZK via Stacks extensions or off-chain).
  - `settle-trade`: Transfers NFT if proof valid, emitting events for privacy.
- **Traits Used**: Integrates with QuotaNFT for transfers.
- **Real-World Impact**: Protects farmer privacy (e.g., hiding trade volumes to avoid market manipulation) while enabling efficient quota redistribution.

### 4. AllocationEnforcer Contract
- **Purpose**: Applies sustainable allocation rules, adjusting quotas based on basin-wide data.
- **Key Functions**:
  - `allocate-annual`: Distributes quotas proportionally based on farm size and historical usage.
  - `enforce-cap`: Reduces all quotas if oracle data shows basin stress (e.g., low water levels).
  - `penalty-apply`: Auto-triggers burns or locks on non-compliant NFTs.
- **Traits Used**: Depends on OracleIntegrator for data.
- **Real-World Impact**: Prevents collective overuse, directly combating environmental issues like Merín Lagoon's algal blooms.

### 5. GovernanceDAO Contract
- **Purpose**: Enables decentralized governance for updating rules, oracle sources, or allocation models.
- **Key Functions**:
  - `propose-change`: Submits proposals (e.g., "Update eutrophication threshold").
  - `vote-on-proposal`: Token-weighted voting using staked NFTs or governance tokens.
  - `execute-proposal`: Auto-executes if passed, calling other contracts.
- **Traits Used**: SIP-010 for fungible governance tokens (optional).
- **Real-World Impact**: Empowers local stakeholders, ensuring the system adapts to climate changes or new regulations.

### 6. PrivacyAuditor Contract
- **Purpose**: Audits trades and usages for compliance without compromising privacy, using aggregated ZKP data.
- **Key Functions**:
  - `audit-batch`: Verifies aggregated proofs for basin-wide compliance.
  - `report-summary`: Generates anonymized reports (e.g., total traded volume) for regulators.
  - `flag-violation`: Alerts without revealing identities.
- **Traits Used**: Integrates with ZKPTrade and OracleIntegrator.
- **Real-World Impact**: Balances transparency for environmental oversight with individual privacy, fostering trust in the system.

## Installation & Deployment

### Prerequisites
- Stacks CLI (install via `cargo install stacks-cli`).
- Clarity development environment (e.g., Clarinet for testing).
- Node.js for any frontend integration.

### Steps
1. Clone the repo: `this repo`
2. Install dependencies: `cd aquaquota && clarinet integrate`
3. Test contracts: `clarinet test`
4. Deploy to Stacks testnet: Use Clarinet or Stacks Explorer to deploy each contract in order (start with QuotaNFT).
5. Configure oracles: Set up Chainlink nodes for satellite data feeds (e.g., API from Copernicus or Google Earth Engine).
6. For ZKPs: Integrate with external provers (e.g., via Stacks' Bitcoin anchoring); Clarity handles verification stubs.

## Security Considerations
- All contracts use Clarity's safety features (no reentrancy, explicit errors).
- Audited for common vulnerabilities (e.g., overflow in quota calculations).
- Oracles are multi-sourced to prevent single-point failure.
- ZKPs ensure privacy; assume Groth16 or similar for efficiency.

## Future Enhancements
- Integrate with DeFi (e.g., lending against quotas).
- Mobile dApp for farmers.
- Expand to other basins (e.g., Colorado River).

## License
MIT License. Contributions welcome!