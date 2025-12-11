# Quick Start

## Architecture

**Hybrid Storage Model** - on-chain for critical state, off-chain for metadata:
- **On-Chain**: User permissions, asset ownership, checkout timestamps (immutable audit trail)
- **Off-Chain**: User profiles, asset descriptions (flexible, cost-effective)
- **Real-Time**: Socket.IO for instant updates across all clients

## Setup

### 1. Start FireFly
```bash
ff init dev_challenge --block-period 2
ff start dev_challenge
```
> Note: You'll see 2 nodes start (ports 9000 and 9001). This is normal - we only use the first one.

### 2. Deploy Contracts
```bash
cd solidity && npm install
make compile deploy
```
Copy the contract addresses from the output.

### 3. Update Config
Edit `backend/src/config.json`:
- Paste the contract addresses
- Bump `VERSION` (e.g., `v1.2` → `v1.3`)

### 4. Start Backend
```bash
make start-backend
```

### 5. Start Frontend
```bash
make start-frontend
```

Visit [http://localhost:4000](http://localhost:4000)

## Try It Out
- Switch between Peter and Madison
- Register with a display name
- Create/checkout/return assets
- Open multiple windows to see real-time sync!

## Useful Commands
```bash
make compile        # Compile contracts
make deploy         # Deploy to FireFly
make stop           # Stop servers
make status         # Check what's running
make rebuild        # Clean + compile + deploy
```
