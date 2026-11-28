# ChatGPT ↔ GitHub Dev Bridge (MCP Server)

A real, secure remote **MCP server** that lets an MCP client (ChatGPT where custom
MCP is supported, or any MCP client) work on **gustuplode/render-studio** through a
**GitHub App** installation — files, branches, commits, PRs, issues, and real code
execution via **GitHub Actions**.

## Honest architecture (no fakes)

```
ChatGPT / MCP client
   │  HTTPS, Streamable HTTP (POST /mcp)
   ▼
This server (Node 20, @modelcontextprotocol/sdk v1, stateless)
   │  Bearer check (for bearer-capable clients) + repo allowlist + path guards
   │  GitHub App JWT (RS256) → installation token (1 h, cached, server-side only)
   ▼
GitHub REST API ──► gustuplode/render-studio (only repo allowed by default)
   │
   └─ Execution = Actions workflow_dispatch (render.yml etc.) → runs on GitHub
      runners → status/logs via workflow_runs_list / workflow_run_view
```

**Why no Codespace terminal tool?** The GitHub Codespaces REST API can list /
create / start / stop codespaces, but it has **no official terminal/exec API**.
Pretending otherwise would be a fake tool. Real execution (install, build, test,
render) therefore runs as **GitHub Actions jobs**, which this repo already uses
for rendering. `codespace_list` exists and reports this limitation itself.

## Tools (19)

Read: `repo_get`, `repo_list_contents`, `file_read`, `branch_list`, `commit_list`,
`pr_list`, `issue_list`, `workflow_list`, `workflow_runs_list`, `workflow_run_view`,
`release_list`, `codespace_list`, `auth_status`
Write (guarded): `file_create_or_update` (refuses `main` unless `allow_main=true`),
`file_delete` (requires `confirm=true`, never on `main`), `branch_create`,
`pr_create`, `issue_create`, `workflow_dispatch` (the build/render/test runner)

Note: tools are not annotated `readOnlyHint`, so ChatGPT treats them as
write-capable and asks for confirmation by default — safer, on purpose.

## Security

- GitHub App private key lives **only** in host env secrets. Never in git, logs,
  or tool output (`auth_status` returns booleans only).
- Repo allowlist (`ALLOWED_REPOS`), path-traversal guard, 512 KB file cap.
- Bearer token check (constant-time) for clients that support headers.
  **ChatGPT's custom-MCP UI supports OAuth or “No authentication”, not static
  bearer tokens** — see “ChatGPT connection” below for the real options.
- Audit log: tool name + repo + path only — no file contents, no secrets.
- No public shell, ever. Destructive ops need explicit confirmation arguments.

## GitHub App setup (the app you already created: “ChatGPT Master Dev”)

Repository permissions needed: **Contents: RW, Issues: RW, Pull requests: RW,
Actions: RW, Metadata: R** (Workflows: RW only if it must edit workflow files).
Install it on **render-studio only**. Then note three values from GitHub:
App ID (or Client ID), Installation ID (from the installation URL), and the
generated **private key (.pem)**. These go into the host's secrets — never chat,
never git.

## Run locally

```bash
npm install
cp .env.example .env   # fill locally only; .env is git-ignored
npm run build && npm start        # http://localhost:8080/mcp , GET /health
```

## Deploy on Render (free) — exact steps

A Blueprint file sits at the **repo root** (`render.yaml`, service root =
`mcp-bridge/`), so setup is one flow:

1. Open https://dashboard.render.com/blueprint/new?repo=https://github.com/gustuplode/render-studio
   and sign in / sign up (free), connect GitHub if asked.
2. Render reads `render.yaml` and proposes the service
   `chatgpt-github-mcp-bridge`. It will ask for the secret env vars
   (marked `sync: false`) — fill exactly these:
   - `GITHUB_APP_ID` — your GitHub App's App ID (or Client ID)
   - `GITHUB_APP_INSTALLATION_ID` — the installation ID (number in the URL
     when you open the app's installation on render-studio)
   - `GITHUB_APP_PRIVATE_KEY` — paste the **whole .pem file content**,
     including `-----BEGIN RSA PRIVATE KEY-----` … `-----END RSA PRIVATE KEY-----`
     (single-line with `\n` escapes also works)
   - `MCP_AUTH_TOKEN` — invent one long random secret (e.g. 32+ characters).
     You will use the same value in the ChatGPT connector URL (next section).
3. Apply / Create. First build takes a few minutes. Your endpoint becomes
   `https://chatgpt-github-mcp-bridge.onrender.com/mcp` (Render shows the
   real hostname — use that, it may differ slightly).
4. Check `https://<host>/health` → `{"ok":true,...,"github_app_configured":true}`.
   If `github_app_configured` is false, one of the 3 App secrets is missing/wrong.

Free tier sleeps after ~15 min idle (~1 min wake on first call).
- **Fly.io (~$2/mo)**: always-on, `fly launch` with the same Dockerfile + secrets.
- Endpoint will be `https://<your-host>/mcp`. No URL exists until *you* deploy —
  none is invented here.

## ChatGPT connection (current official flow)

ChatGPT: **Plugins → + → Add custom MCP server** → name it, paste the public
HTTPS `/mcp` URL, choose authentication, tick “I understand and want to
continue”, Create. (Developer Mode is no longer required first.)

Authentication reality:
- ChatGPT offers **OAuth** or **No authentication** (or mixed) for custom MCP —
  **not** a static bearer/API-key field. This server therefore accepts the
  token **inside the connector URL**: use
  `https://<host>/mcp?key=<your MCP_AUTH_TOKEN>` as the server URL in ChatGPT
  with authentication = **No authentication**. The URL lives only in your
  ChatGPT account — never share or publish it; anyone holding it can call the
  tools (still limited to ALLOWED_REPOS). Header-capable MCP clients use
  `Authorization: Bearer <token>` on the plain `/mcp` URL instead. Rotate by
  changing `MCP_AUTH_TOKEN` on Render and updating the connector URL.
  Alternatives: an OAuth proxy in front, or OpenAI's Secure MCP Tunnel.
- Plan reality (OpenAI help, Nov 2026): **Business and Enterprise/Edu get full
  MCP including write tools; Pro is read/fetch only; Plus support for custom
  MCP creation is not clearly documented.** If your plan is Pro/Plus, expect
  read-only at best — the server is unchanged; the limit is ChatGPT-side.
- After changing tools on the server, **Refresh** the connector in ChatGPT —
  it snapshots the tool list.

## Test (what was actually run locally)

- `initialize` → OK, protocol 2025-03-26, server `chatgpt-github-dev-bridge 1.0.0`
- `tools/list` → 19 tools
- No/invalid bearer → **401**
- Wrong repo (`torvalds/linux`) → refused by allowlist
- `file_delete` without `confirm=true` → refused
- No GitHub credentials → tools return a clear “credentials missing” error
  (no fake data); App JWT RS256 sign/verify tested with a throwaway key (PASS);
  GitHub rejected the throwaway app as expected, proving the JWT is really sent.
- Real repo read of `gustuplode/render-studio` verified through GitHub.

Full end-to-end GitHub-App test happens right after deployment, once the real
App secrets are in the host: call `auth_status` (all flags true), then
`repo_get`, then create a test branch + file + PR with the write tools.
