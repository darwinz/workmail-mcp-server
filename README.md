# WorkMail MCP Server

![](https://github-tracker-liart.vercel.app/api/pixel?source=darwinz/workmail-mcp-server)

A Model Context Protocol (MCP) server that connects Claude Desktop to Amazon WorkMail, providing email and calendar access over a secure local stdio transport.

## Features

| Tool | Description |
|---|---|
| `list_emails` | List emails from any folder with pagination |
| `read_email` | Read full email content by ID |
| `search_emails` | Search emails using AQS query syntax |
| `send_email` | Send an email (requires explicit confirmation) |
| `list_calendar_events` | List calendar events in a date range |
| `get_calendar_event` | Get full event details by ID |
| `create_calendar_event` | Create a calendar event (requires explicit confirmation) |

## Security

- **Credentials** are stored in macOS Keychain (hardware-encrypted on Apple Silicon) — never in config files or environment variables
- **Transport** uses stdio (local pipe) — no HTTP server, no open ports
- **Wire encryption** via HTTPS/TLS to the WorkMail EWS endpoint
- **Input validation** on every tool call via Zod schemas
- **Output sanitization** redacts credential values from all responses and error messages
- **Rate limiting** prevents runaway request loops (configurable, default 30/min)
- **Write protection** — `send_email` and `create_calendar_event` require a `confirm: true` parameter

## Prerequisites

- **macOS** (uses Keychain for credential storage)
- **Node.js** 20+
- **Amazon WorkMail** account with username/password authentication

## Setup

### 1. Install dependencies

```sh
git clone https://github.com/your-username/workmail-mcp-server.git
cd workmail-mcp-server
npm install
```

### 2. Configure environment

```sh
cp .env.example .env
```

Edit `.env` if your WorkMail is in a different region:

```sh
WORKMAIL_MCP_EWS_ENDPOINT=https://ews.mail.us-west-2.awsapps.com/EWS/Exchange.asmx
```

The EWS endpoint follows the pattern `https://ews.mail.<region>.awsapps.com/EWS/Exchange.asmx`. Common regions: `us-east-1`, `us-west-2`, `eu-west-1`.

### 3. Store credentials

```sh
npm run setup-credentials
```

This prompts for your WorkMail email and password, stores them in macOS Keychain, and validates the connection.

### 4. Build

```sh
npm run build
```

### 5. Register with Claude Desktop

Add the following to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "workmail": {
      "command": "node",
      "args": ["/absolute/path/to/workmail-mcp-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. The WorkMail server should appear as connected.

## Configuration

All settings are optional and have sensible defaults. Set them in `.env` or as environment variables:

| Variable | Default | Description |
|---|---|---|
| `WORKMAIL_MCP_EWS_ENDPOINT` | `https://ews.mail.us-west-2.awsapps.com/EWS/Exchange.asmx` | WorkMail EWS endpoint URL |
| `WORKMAIL_MCP_MAX_EMAILS` | `25` | Max emails returned per request (1-100) |
| `WORKMAIL_MCP_MAX_CALENDAR_DAYS` | `30` | Max calendar date range in days (1-90) |
| `WORKMAIL_MCP_RATE_LIMIT` | `30` | Max requests per minute (1-60) |
| `WORKMAIL_MCP_LOG_LEVEL` | `info` | Log verbosity: `error`, `warn`, `info`, `debug` |

Environment variables set in `claude_desktop_config.json` take precedence over `.env`.

## Usage

Once connected, ask Claude Desktop to interact with your WorkMail:

- "List my recent emails"
- "Read the email from Sarah about the Q3 report"
- "Search my inbox for messages about the deployment"
- "What meetings do I have this week?"
- "Send an email to team@example.com about the status update"
- "Create a meeting for tomorrow at 2pm with Alex"

## Development

```sh
# Run directly from TypeScript (no build step)
npm run dev

# Rebuild after changes
npm run build

# Re-run credential setup
npm run setup-credentials
```

Logs are written to stderr in JSON format. To see them while running via Claude Desktop, check the MCP server logs in Claude Desktop's developer tools.

## Architecture

```
Claude Desktop  <──stdio──>  MCP Server (Node.js)
                                  │
                                  ▼
                            EWS Client Layer
                                  │
                                  ▼
                  Amazon WorkMail (Exchange Web Services)
```

The server uses the EWS protocol at the `Exchange2010_SP2` compatibility level, which is the version supported by Amazon WorkMail.

## License

MIT
