import FireFly from "@hyperledger/firefly-sdk";
import bodyparser from "body-parser";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import simplestorage from "../../solidity/artifacts/contracts/simple_storage.sol/SimpleStorage.json";
import token from "../../solidity/artifacts/contracts/Token.sol/Token.json";
import assetLibrary from "../../solidity/artifacts/contracts/asset_storage.sol/AssetLibrary.json";
import config from "./config.json";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:4000",
    methods: ["GET", "POST"]
  }
});

const firefly = new FireFly({
  host: config.HOST,
  namespace: config.NAMESPACE,
});

// FFI and API names
const ssFfiName: string = `simpleStorageFFI-${config.VERSION}`;
const ssApiName: string = `simpleStorageApi-${config.VERSION}`;
const tokenFfiName: string = `tokenFFI-${config.VERSION}`;
const tokenApiName: string = `tokenApi-${config.VERSION}`;
const assetFfiName: string = `assetLibraryFFI-${config.VERSION}`;
const assetApiName: string = `assetLibraryApi-${config.VERSION}`;

// Demo: Hardcoded wallet addresses for two users (Peter and Madison)
// In a real app, would integrate with proper wallet management/authentication like MetaMask 
const MEMBER_KEYS: Record<string, string> = {
  member0: "0xf56dfc48a146b9b4511465ecbf7f4b4e7308ce5a", // Peter
  member1: "0x58521a46882c3049f392a9022204e47201ca7ca4", // Madison
};

// ON-CHAIN:
//   - Core business logic (permissions, asset state, ownership)
//   - Provides immutability, auditability, and trust//
// OFF-CHAIN (In-memory for demo, SQL/NoSQL DB would be best for actual Prod app):
//   - Metadata (descriptions, emails, departments, locations)
//   - Flexible schema (easy to add new fields without contract changes), cost effective storage
const userProfiles: Record<string, {
  name: string;
  email?: string;
  department?: string;
  registrationTime: number;
}> = {};

// Asset metadata storage (off-chain)
const assetMetadata: Record<number, {
  description: string;
  category: string;
  location?: string;
  createdBy: string;
  createdAt: number;
}> = {};

// Temporary storage for pending asset metadata
// Keyed by FireFly transaction ID until blockchain event confirms the asset ID
// This handles the async nature of blockchain transactions
const pendingAssetMetadata: Record<string, {
  description: string;
  category: string;
  location?: string;
  createdBy: string;
  createdAt: number;
}> = {};

app.use(bodyparser.json());

// ============ Existing Simple Storage & Token Endpoints ============

app.get("/api/value", async (req, res) => {
  res.send(
    await firefly.queryContractAPI(ssApiName, "get", {
      key: config.SIGNING_KEY,
    })
  );
});

app.post("/api/value", async (req, res) => {
  try {
    const fireflyRes = await firefly.invokeContractAPI(ssApiName, "set", {
      input: {
        x: req.body.x,
      },
      key: config.SIGNING_KEY,
    });
    res.status(202).send({
      id: fireflyRes.id,
    });
    /* eslint-disable  @typescript-eslint/no-explicit-any */
  } catch (e: any) {
    res.status(500).send({
      error: e.message,
    });
  }
});

app.post("/api/mintToken", async (req, res) => {
  try {
    const fireflyRes = await firefly.invokeContractAPI(
      tokenApiName,
      "safeMint",
      {
        input: {
          tokenId: Number(req.body.tokenId),
        },
        key: config.SIGNING_KEY,
      }
    );
    res.status(202).send({
      tokenId: fireflyRes.input.input.tokenId,
    });
  } catch (e: any) {
    res.status(500).send({
      error: e.message,
    });
  }
});

// Asset Library API endpoints
app.post("/api/user/register", async (req, res) => {
  try {
    const { userId, name, email, department } = req.body;
    const signingKey = MEMBER_KEYS[userId];
    
    if (!signingKey) {
      return res.status(400).send({ error: "Invalid user ID" });
    }

    // On-chain: Register user address for permissions only
    const fireflyRes = await firefly.invokeContractAPI(assetApiName, "registerUser", {
      input: { name: "" }, // No name stored on-chain for hybrid approach
      key: signingKey,
    });

    // Off-chain: Store rich user profile data
    userProfiles[signingKey.toLowerCase()] = {
      name,
      email,
      department,
      registrationTime: Date.now(),
    };
    
    console.log(`Hybrid registration: ${name} (${userId}) - On-chain: permissions, Off-chain: profile`);
    res.status(202).send({ id: fireflyRes.id });
  } catch (e: any) {
    res.status(500).send({ error: e.message });
  }
});

// Create new asset with hybrid storage
app.post("/api/asset/register", async (req, res) => {
  try {
    const { userId, description, category, location } = req.body;
    const signingKey = MEMBER_KEYS[userId];
    if (!signingKey) {
      return res.status(400).send({ error: "Invalid user ID" });
    }

    // On-chain: Core asset state only
    const fireflyRes = await firefly.invokeContractAPI(assetApiName, "registerAsset", {
      input: {},
      key: signingKey,
    });

    // Off-chain: Store metadata temporarily by transaction ID until we get the blockchain event
    pendingAssetMetadata[fireflyRes.id] = {
      description: description || `Asset created by ${userId}`,
      category: category || "General",
      location: location || "Unknown",
      createdBy: signingKey,
      createdAt: Date.now(),
    };
    
    console.log(`Hybrid asset creation: ${userId} - On-chain: state, Off-chain: metadata (pending tx: ${fireflyRes.id})`);
    res.status(202).send({ id: fireflyRes.id });
  } catch (e: any) {
    console.error('FireFly error in asset register:', e);
    res.status(500).send({ error: e.message });
  }
});

// Check out asset
app.post("/api/asset/checkout", async (req, res) => {
  try {
    const { userId, assetId } = req.body;
    const signingKey = MEMBER_KEYS[userId];
    if (!signingKey) {
      return res.status(400).send({ error: "Invalid user ID" });
    }

    const fireflyRes = await firefly.invokeContractAPI(assetApiName, "checkOut", {
      input: { assetId: Number(assetId) },
      key: signingKey,
    });

    console.log(`Asset ${assetId} checked out by ${userId}`);
    res.status(202).send({ id: fireflyRes.id });
  } catch (e: any) {
    console.error('FireFly error in asset checkout:', e);

    // Handle race condition: user registered but blockchain hasn't confirmed yet
    // This happens when users try to interact too quickly after registration
    // Real blockchains have confirmation times (2s block period in our demo)
    if (e.message?.includes('NotRegistered')) {
      return res.status(409).send({
        error: "Registration still pending - please wait a moment for blockchain confirmation"
      });
    }

    res.status(500).send({ error: e.message });
  }
});

// Return asset
app.post("/api/asset/return", async (req, res) => {
  try {
    const { userId, assetId } = req.body;
    const signingKey = MEMBER_KEYS[userId];
    if (!signingKey) {
      return res.status(400).send({ error: "Invalid user ID" });
    }

    const fireflyRes = await firefly.invokeContractAPI(assetApiName, "returnAsset", {
      input: { assetId: Number(assetId) },
      key: signingKey,
    });

    console.log(`Asset ${assetId} returned by ${userId}`);
    res.status(202).send({ id: fireflyRes.id });
  } catch (e: any) {
    console.error('FireFly error in asset return:', e);

    // Handle race condition (same as checkout - registration pending)
    if (e.message?.includes('NotRegistered')) {
      return res.status(409).send({
        error: "Registration still pending - please wait a moment for blockchain confirmation"
      });
    }

    res.status(500).send({ error: e.message });
  }
});

// Get asset details (on-chain state only)
app.get("/api/asset/:assetId", async (req, res) => {
  try {
    const result = await firefly.queryContractAPI(assetApiName, "getAsset", {
      input: { assetId: Number(req.params.assetId) },
      key: config.SIGNING_KEY,
    });
    res.send(result);
  } catch (e: any) {
    res.status(500).send({
      error: e.message,
    });
  }
});

// Get rich asset data (hybrid: on-chain state + off-chain metadata)
app.get("/api/asset/:assetId/full", async (req, res) => {
  try {
    const assetId = Number(req.params.assetId);
    
    // Get on-chain state
    const onChainResult = await firefly.queryContractAPI(assetApiName, "getAsset", {
      input: { assetId },
      key: config.SIGNING_KEY,
    });
    
    // Get off-chain metadata (if available)
    // stored in-memory for demo purposes, would use real DB (like SQL) for prod
    const metadata = assetMetadata[assetId];
    
    res.send({
      onChain: onChainResult.output,
      offChain: metadata || null,
      hybrid: true,
    });
  } catch (e: any) {
    res.status(500).send({
      error: e.message,
    });
  }
});

// Get total asset count
app.get("/api/assets/count", async (req, res) => {
  try {
    const result = await firefly.queryContractAPI(
      assetApiName,
      "getAssetCount",
      {
        key: config.SIGNING_KEY,
      }
    );
    res.send(result);
  } catch (e: any) {
    res.status(500).send({
      error: e.message,
    });
  }
});

// Get user profile (hybrid: on-chain verification + off-chain data)
app.get("/api/user/:address", async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    
    // Check on-chain registration status
    const onChainResult = await firefly.queryContractAPI(assetApiName, "isUserRegistered", {
      input: { user: req.params.address },
      key: config.SIGNING_KEY,
    });
    
    if (onChainResult.output && userProfiles[address]) {
      // Return off-chain profile data
      res.send({ output: userProfiles[address].name });
    } else {
      res.status(404).send({ error: "User not registered" });
    }
  } catch (e: any) {
    res.status(500).send({
      error: e.message,
    });
  }
});

// Debug endpoint - reset user registration (for demo purposes)
app.post("/api/user/reset", async (req, res) => {
  try {
    const { userId } = req.body;
    const signingKey = MEMBER_KEYS[userId];
    
    if (!signingKey) {
      return res.status(400).send({ error: "Invalid user ID" });
    }

    // Note: This is a demo feature - in production you'd need a proper "unregister" function
    console.log(`Demo reset: Clearing ${userId} registration status`);
    res.status(200).send({ message: "User reset (demo only)" });
  } catch (e: any) {
    res.status(500).send({ error: e.message });
  }
});



// ============ Initialization ============

async function init() {
  // Simple storage
  await firefly
    .generateContractInterface({
      name: ssFfiName,
      namespace: config.NAMESPACE,
      version: "1.0",
      description: "Deployed simple-storage contract",
      input: {
        abi: simplestorage.abi,
      },
    })
    .then(async (ssGeneratedFFI) => {
      if (!ssGeneratedFFI) return;
      return await firefly.createContractInterface(ssGeneratedFFI, {
        confirm: true,
      });
    })
    .then(async (ssContractInterface) => {
      if (!ssContractInterface) return;
      return await firefly.createContractAPI(
        {
          interface: {
            id: ssContractInterface.id,
          },
          location: {
            address: config.SIMPLE_STORAGE_ADDRESS,
          },
          name: ssApiName,
        },
        { confirm: true }
      );
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));
       if (err.status === 409) {
        console.log("'simpleStorageFFI' already exists in FireFly. Ignoring.");
      } else {
        return;
      }
    });

  // Token
  await firefly
    .generateContractInterface({
      name: tokenFfiName,
      namespace: config.NAMESPACE,
      version: "1.0",
      description: "Deployed token contract",
      input: {
        abi: token.abi,
      },
    })
    .then(async (tokenGeneratedFFI) => {
      if (!tokenGeneratedFFI) return;
      return await firefly.createContractInterface(tokenGeneratedFFI, {
        confirm: true,
      });
    })
    .then(async (tokenContractInterface) => {
      if (!tokenContractInterface) return;
      return await firefly.createContractAPI(
        {
          interface: {
            id: tokenContractInterface.id,
          },
          location: {
            address: config.TOKEN_ADDRESS,
          },
          name: tokenApiName,
        },
        { confirm: true }
      );
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));
      if (err.status === 409) {
        console.log("'tokenFFI' already exists in FireFly. Ignoring.");
      }
    });

  // AssetCheckout
  await firefly
    .generateContractInterface({
      name: assetFfiName,
      namespace: config.NAMESPACE,
      version: "1.0",
      description: "Deployed asset checkout contract",
      input: {
        abi: assetLibrary.abi,
      },
    })
    .then(async (assetGeneratedFFI) => {
      if (!assetGeneratedFFI) return;
      return await firefly.createContractInterface(assetGeneratedFFI, {
        confirm: true,
      });
    })
    .then(async (assetContractInterface) => {
      if (!assetContractInterface) return;
      return await firefly.createContractAPI(
        {
          interface: {
            id: assetContractInterface.id,
          },
          location: {
            address: config.ASSET_LIBRARY_ADDRESS,
          },
          name: assetApiName,
        },
        { confirm: true }
      );
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));
      if (err.status === 409) {
        console.log("'assetCheckoutFFI' already exists in FireFly. Ignoring.");
      }
    });

  // ============ Event Listeners ============

  // Simple storage listener
  await firefly
    .createContractAPIListener(ssApiName, "Changed", {
      topic: "changed",
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));
      if (err.status === 409) {
        console.log(
          "Simple storage 'changed' event listener already exists in FireFly. Ignoring."
        );
      }
    });

  // Token listener
  await firefly
    .createContractAPIListener(tokenApiName, "Transfer", {
      topic: "transfer",
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));
      if (err.status === 409) {
        console.log(
          "Token 'transfer' event listener already exists in FireFly. Ignoring."
        );
      }
    });

  // AssetCheckout listeners
  await firefly
    .createContractAPIListener(assetApiName, "UserRegistered", {
      topic: "user_registered",
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));
      if (err.status === 409) {
        console.log(
          "AssetCheckout 'UserRegistered' listener already exists. Ignoring."
        );
      }
    });

  await firefly
    .createContractAPIListener(assetApiName, "AssetRegistered", {
      topic: "asset_registered",
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));
      if (err.status === 409) {
        console.log(
          "AssetCheckout 'AssetRegistered' listener already exists. Ignoring."
        );
      }
    });

  await firefly
    .createContractAPIListener(assetApiName, "AssetCheckedOut", {
      topic: "asset_checked_out",
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));
      if (err.status === 409) {
        console.log(
          "AssetCheckout 'AssetCheckedOut' listener already exists. Ignoring."
        );
      }
    });

  await firefly
    .createContractAPIListener(assetApiName, "AssetReturned", {
      topic: "asset_returned",
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));
      if (err.status === 409) {
        console.log(
          "AssetCheckout 'AssetCheckedIn' listener already exists. Ignoring."
        );
      }
    });

  // Socket.IO provides real-time bidirectional communication between server and clients
  // When blockchain events occur, we broadcast them to all connected clients
  // This eliminates the need for polling and provides instant UI updates
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // FireFly event listening with Socket.IO broadcasting
  // This listener receives blockchain events from FireFly and broadcasts them to all connected clients
  firefly.listen(
    {
      filter: {
        events: "blockchain_event_received",
      },
    },
    async (socket, event) => {
      const eventName = event.blockchainEvent?.name;
      const eventOutput = event.blockchainEvent?.output;
      console.log(`${eventName}: ${JSON.stringify(eventOutput, null, 2)}`);
      
      // Handle AssetRegistered event: move metadata from pending to final storage
      if (eventName === 'AssetRegistered' && eventOutput) {
        const assetId = parseInt(eventOutput.assetId);
        const creatorAddress = eventOutput.registeredBy.toLowerCase();
        
        // Find pending metadata from the same creator (concurrency-safe)
        const creatorEntries = Object.entries(pendingAssetMetadata).filter(
          ([txId, metadata]) => metadata.createdBy.toLowerCase() === creatorAddress
        );
        
        if (creatorEntries.length > 0) {
          // Take the oldest pending from this specific creator (FIFO per user)
          const sortedEntries = creatorEntries.sort((a, b) => a[1].createdAt - b[1].createdAt);
          const [txId, metadata] = sortedEntries[0];
          
          assetMetadata[assetId] = metadata;
          delete pendingAssetMetadata[txId];
          console.log(`✅ Matched Asset #${assetId} with creator ${creatorAddress} (tx: ${txId})`);
        } else {
          console.warn(`⚠️ No pending metadata found for creator ${creatorAddress} - asset #${assetId}`);
        }
      }
      
      // Broadcast blockchain events to all connected Socket.IO clients
      if (eventName) {
        io.emit(eventName, {
          name: eventName,
          output: eventOutput,
          timestamp: Date.now()
        });
        console.log(`Broadcasting ${eventName} to all connected clients`);
      }
    }
  );

  // Start server with Socket.IO
  httpServer.listen(config.PORT, () => {
    console.log(`Kaleido DApp backend listening on port ${config.PORT}!`);
    console.log(`Socket.IO server ready for connections`);
  });
}

init().catch((err) => {
  console.error(err.stack);
  process.exit(1);
});

module.exports = {
  app,
};