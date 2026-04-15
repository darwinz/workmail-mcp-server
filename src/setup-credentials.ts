import * as readline from "readline";
import { storeCredential, getCredentials, deleteCredentials } from "./credentials";
import {
  ExchangeService,
  ExchangeVersion,
  WebCredentials,
  Uri,
  WellKnownFolderName,
  Folder,
} from "ews-javascript-api";

const DEFAULT_ENDPOINT = "https://ews.mail.us-west-2.awsapps.com/EWS/Exchange.asmx";

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("=== WorkMail MCP Server — Credential Setup ===\n");
  console.log("This will store your WorkMail credentials securely in macOS Keychain.\n");

  const email = await ask(rl, "WorkMail email address: ");
  if (!email || !email.includes("@")) {
    console.error("Error: Invalid email address.");
    rl.close();
    process.exit(1);
  }

  const password = await ask(rl, "WorkMail password: ");
  if (!password) {
    console.error("Error: Password cannot be empty.");
    rl.close();
    process.exit(1);
  }

  const endpointInput = await ask(
    rl,
    `EWS endpoint URL [${DEFAULT_ENDPOINT}]: `
  );
  const endpoint = endpointInput || DEFAULT_ENDPOINT;

  rl.close();

  // Store credentials in Keychain
  console.log("\nStoring credentials in macOS Keychain...");
  try {
    storeCredential("email", email);
    storeCredential("password", password);
    storeCredential("endpoint", endpoint);
    console.log("Credentials stored successfully.");
  } catch (err: any) {
    console.error(`Failed to store credentials: ${err.message}`);
    process.exit(1);
  }

  // Validate connection
  console.log("\nTesting EWS connection...");
  try {
    const service = new ExchangeService(ExchangeVersion.Exchange2010_SP2);
    service.Credentials = new WebCredentials(email, password);
    service.Url = new Uri(endpoint);

    await Folder.Bind(service, WellKnownFolderName.Inbox);
    console.log("Connection successful! Your Inbox was reached.\n");
    console.log("Setup complete. You can now use the WorkMail MCP server.");
    console.log("Restart Claude Desktop to activate the server.");
  } catch (err: any) {
    console.error(`\nConnection failed: ${err.message}`);
    console.error("\nPossible causes:");
    console.error("  - Incorrect email or password");
    console.error("  - Wrong EWS endpoint (check your WorkMail region)");
    console.error("  - WorkMail account not active");
    console.error("\nCredentials were saved — you can re-run this to update them.");
    process.exit(1);
  }

  // Verify round-trip from Keychain
  try {
    const retrieved = getCredentials();
    if (retrieved.email !== email) {
      console.warn("Warning: Keychain round-trip verification failed for email.");
    }
  } catch {
    console.warn("Warning: Could not verify Keychain round-trip.");
  }
}

main();
