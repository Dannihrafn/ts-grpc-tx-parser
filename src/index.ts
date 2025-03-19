import Client, {
  CommitmentLevel,
  SubscribeRequest,
  SubscribeRequestFilterAccountsFilter,
} from "@triton-one/yellowstone-grpc";
import bs58 from "bs58";
import { parseTx } from "./utils";
import dotenv from "dotenv";

dotenv.config();

const GRPC_URL = process.env.GRPC_URL;
const X_TOKEN = process.env.X_TOKEN;

if (!GRPC_URL || !X_TOKEN) {
  throw new Error("GRPC_URL and X_TOKEN environment variables are required");
}

const PING_INTERVAL_MS = 30_000; // 30s

// Add this utility function to process the transaction object
function convertBuffers(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle Buffer objects
  if (obj.type === "Buffer" && Array.isArray(obj.data)) {
    return bs58.encode(new Uint8Array(obj.data));
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => convertBuffers(item));
  }

  // Handle objects
  if (typeof obj === "object") {
    // Handle Uint8Array directly
    if (obj instanceof Uint8Array) {
      return bs58.encode(obj);
    }

    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip certain keys that shouldn't be converted
      if (
        key === "uiAmount" ||
        key === "decimals" ||
        key === "uiAmountString"
      ) {
        converted[key] = value;
      } else {
        converted[key] = convertBuffers(value);
      }
    }
    return converted;
  }

  return obj;
}

async function main() {
  // Open connection.
  const client = new Client(GRPC_URL as string, X_TOKEN as string, {
    "grpc.max_receive_message_length": 1024 * 1024 * 1024, // 64MiB
  });

  // Subscribe for events
  const stream = await client.subscribe();

  // Create `error` / `end` handler
  const streamClosed = new Promise<void>((resolve, reject) => {
    stream.on("error", (error) => {
      reject(error);
      stream.end();
    });
    stream.on("end", () => {
      resolve();
    });
    stream.on("close", () => {
      resolve();
    });
  });

  // Handle updates
  stream.on("data", (data) => {
    let ts = new Date();
    if (data) {
      if (data.transaction) {
        const tx = data.transaction;
        // Convert the entire transaction object
        const convertedTx = convertBuffers(tx);
        // If you want to see the entire converted transaction:
        let logs;
        try {
          logs = convertedTx.transaction.meta.logMessages;
        } catch (err) {
          console.error(err);
        }
        const log = logs?.find(
          (log: any) => log.includes("Transfer") || log.includes("Swap")
        );
        if (!log) return;
        parseTx(convertedTx.transaction);
        /*
        console.log(
          `${ts.toUTCString()}: Received update: ${JSON.stringify(convertedTx)}`
        );
        */
      } else {
        console.log(`${ts.toUTCString()}: Received update: ${data}`);
      }
      stream.end();
    } else if (data.pong) {
      console.log(`${ts.toUTCString()}: Processed ping response!`);
    }
  });

  // Example subscribe request.
  const request: SubscribeRequest = {
    commitment: CommitmentLevel.PROCESSED,
    accountsDataSlice: [],
    ping: undefined,
    transactions: {
      client: {
        vote: false,
        failed: false,
        accountInclude: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"],
        accountExclude: [],
        accountRequired: [],
      },
    },
    // unused arguments
    accounts: {},
    slots: {},
    transactionsStatus: {},
    entry: {},
    blocks: {},
    blocksMeta: {},
  };

  // Send subscribe request
  await new Promise<void>((resolve, reject) => {
    stream.write(request, (err: any) => {
      if (err === null || err === undefined) {
        resolve();
      } else {
        reject(err);
      }
    });
  }).catch((reason) => {
    console.error(reason);
    throw reason;
  });

  // Send pings every 5s to keep the connection open
  const pingRequest: SubscribeRequest = {
    // Required, but unused arguments
    accounts: {},
    accountsDataSlice: [],
    transactions: {},
    blocks: {},
    blocksMeta: {},
    slots: {},
    transactionsStatus: {},
    entry: {},
  };
  setInterval(async () => {
    await new Promise<void>((resolve, reject) => {
      stream.write(pingRequest, (err: null | undefined) => {
        if (err === null || err === undefined) {
          resolve();
        } else {
          reject(err);
        }
      });
    }).catch((reason) => {
      console.error(reason);
      throw reason;
    });
  }, PING_INTERVAL_MS);

  await streamClosed;
}

main();
