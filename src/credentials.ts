import { execFileSync } from "child_process";

const SERVICE_NAME = "workmail-mcp-server";

export interface Credentials {
  email: string;
  password: string;
}

export function getCredentials(): Credentials {
  try {
    const email = execFileSync("security", [
      "find-generic-password",
      "-s", SERVICE_NAME,
      "-a", "email",
      "-w",
    ], { encoding: "utf-8" }).trim();

    const password = execFileSync("security", [
      "find-generic-password",
      "-s", SERVICE_NAME,
      "-a", "password",
      "-w",
    ], { encoding: "utf-8" }).trim();

    if (!email || !password) {
      throw new Error("Empty credentials retrieved from Keychain");
    }

    return { email, password };
  } catch (err: any) {
    if (err.status === 44 || err.message?.includes("could not be found")) {
      throw new Error(
        "WorkMail credentials not found in Keychain. Run: npm run setup-credentials"
      );
    }
    throw new Error(`Failed to retrieve credentials from Keychain: ${err.message}`);
  }
}

export function storeCredential(account: string, value: string): void {
  execFileSync("security", [
    "add-generic-password",
    "-s", SERVICE_NAME,
    "-a", account,
    "-w", value,
    "-U", // update if exists
  ]);
}

export function deleteCredentials(): void {
  for (const account of ["email", "password"]) {
    try {
      execFileSync("security", [
        "delete-generic-password",
        "-s", SERVICE_NAME,
        "-a", account,
      ]);
    } catch {
      // ignore if not found
    }
  }
}
