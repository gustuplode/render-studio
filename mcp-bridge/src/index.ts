// ChatGPT <-> GitHub MCP Bridge — remote MCP server (Streamable HTTP).
// Execution backend = GitHub Actions (workflow_dispatch). There is NO public shell:
// the Codespaces REST API has no terminal/exec endpoint, so builds/renders run as
// Actions jobs and logs come back through the Actions API. Honest by design.
import express from "express";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { loadConfig, gh, assertRepoAllowed, assertSafePath, audit } from "./github.js";

const cfg = loadConfig();
const MCP_TOKEN = process.env.MCP_AUTH_TOKEN || "";
const PORT = Number(process.env.PORT || 8080);
const MAX_FILE_BYTES = 512_000;

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
const repoArgs = { owner: z.string().default("gustuplode"), repo: z.string().default("render-studio") };
function guard(owner: string, repo: string) { assertRepoAllowed(cfg, owner, repo); }

function buildServer(): McpServer {
  const s = new McpServer({ name: "chatgpt-github-dev-bridge", version: "1.0.0" });

  s.tool("repo_get", "Get repository metadata", repoArgs, async ({ owner, repo }) => {
    guard(owner, repo);
    const r = await gh(cfg, "GET", `/repos/${owner}/${repo}`);
    return ok({ full_name: r.full_name, default_branch: r.default_branch, private: r.private, language: r.language, open_issues: r.open_issues_count, html_url: r.html_url, pushed_at: r.pushed_at });
  });

  s.tool("repo_list_contents", "List a directory in the repository", { ...repoArgs, path: z.string().default(""), ref: z.string().optional() },
    async ({ owner, repo, path, ref }) => {
      guard(owner, repo); if (path) assertSafePath(path);
      const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`);
      const items = Array.isArray(r) ? r.map((i: any) => ({ name: i.name, path: i.path, type: i.type, size: i.size })) : [{ name: r.name, path: r.path, type: r.type, size: r.size }];
      return ok(items);
    });

  s.tool("file_read", "Read a text file (max 512 KB)", { ...repoArgs, path: z.string(), ref: z.string().optional() },
    async ({ owner, repo, path, ref }) => {
      guard(owner, repo); assertSafePath(path);
      const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`);
      if (r.type !== "file") throw new Error(`${path} is not a file`);
      if ((r.size ?? 0) > MAX_FILE_BYTES) throw new Error(`File too large (${r.size} bytes > ${MAX_FILE_BYTES})`);
      return ok(Buffer.from(r.content, "base64").toString("utf8"));
    });

  s.tool("file_create_or_update", "Create or update a file on a branch (creates one commit). Refuses protected branch 'main' unless allow_main=true.",
    { ...repoArgs, path: z.string(), content: z.string(), message: z.string(), branch: z.string().default("main"), allow_main: z.boolean().default(false) },
    async ({ owner, repo, path, content, message, branch, allow_main }) => {
      guard(owner, repo); assertSafePath(path);
      if (branch === "main" && !allow_main) throw new Error("Refusing direct write to main without allow_main=true. Create a branch + PR instead.");
      if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error("Content too large");
      let sha: string | undefined;
      try { const cur = await gh(cfg, "GET", `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`); sha = cur.sha; } catch {}
      const r = await gh(cfg, "PUT", `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
        { message, content: Buffer.from(content).toString("base64"), branch, ...(sha ? { sha } : {}) });
      audit({ tool: "file_create_or_update", repo: `${owner}/${repo}`, path, branch });
      return ok({ committed: r.commit?.sha, path, branch, html_url: r.content?.html_url });
    });

  s.tool("file_delete", "Delete a file. REQUIRES: confirm=true and a non-main branch.",
    { ...repoArgs, path: z.string(), message: z.string(), branch: z.string(), confirm: z.boolean().default(false) },
    async ({ owner, repo, path, message, branch, confirm }) => {
      guard(owner, repo); assertSafePath(path);
      if (!confirm) throw new Error("Deletion not confirmed. Pass confirm=true to proceed.");
      if (branch === "main") throw new Error("Refusing deletion on main. Use a branch + PR.");
      const cur = await gh(cfg, "GET", `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
      const r = await gh(cfg, "DELETE", `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, { message, sha: cur.sha, branch });
      audit({ tool: "file_delete", repo: `${owner}/${repo}`, path, branch });
      return ok({ deleted: true, commit: r.commit?.sha });
    });

  s.tool("branch_list", "List branches", repoArgs, async ({ owner, repo }) => {
    guard(owner, repo);
    const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/branches?per_page=100`);
    return ok(r.map((b: any) => ({ name: b.name, sha: b.commit.sha, protected: b.protected })));
  });

  s.tool("branch_create", "Create a branch from another branch (default: repo default branch)",
    { ...repoArgs, new_branch: z.string(), from_branch: z.string().optional() },
    async ({ owner, repo, new_branch, from_branch }) => {
      guard(owner, repo);
      const src = from_branch || (await gh(cfg, "GET", `/repos/${owner}/${repo}`)).default_branch;
      const ref = await gh(cfg, "GET", `/repos/${owner}/${repo}/git/ref/heads/${src}`);
      const r = await gh(cfg, "POST", `/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${new_branch}`, sha: ref.object.sha });
      audit({ tool: "branch_create", repo: `${owner}/${repo}`, new_branch, from: src });
      return ok({ created: new_branch, sha: r.object?.sha });
    });

  s.tool("commit_list", "Recent commits (git log equivalent)", { ...repoArgs, branch: z.string().optional(), per_page: z.number().default(10) },
    async ({ owner, repo, branch, per_page }) => {
      guard(owner, repo);
      const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/commits?per_page=${Math.min(per_page, 50)}${branch ? `&sha=${encodeURIComponent(branch)}` : ""}`);
      return ok(r.map((c: any) => ({ sha: c.sha.slice(0, 10), message: c.commit.message.split("\n")[0], author: c.commit.author?.name, date: c.commit.author?.date })));
    });

  s.tool("pr_list", "List pull requests", { ...repoArgs, state: z.enum(["open", "closed", "all"]).default("open") },
    async ({ owner, repo, state }) => {
      guard(owner, repo);
      const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`);
      return ok(r.map((p: any) => ({ number: p.number, title: p.title, state: p.state, head: p.head.ref, base: p.base.ref, html_url: p.html_url })));
    });

  s.tool("pr_create", "Create a pull request",
    { ...repoArgs, title: z.string(), head: z.string(), base: z.string().default("main"), body: z.string().default("") },
    async ({ owner, repo, title, head, base, body }) => {
      guard(owner, repo);
      const r = await gh(cfg, "POST", `/repos/${owner}/${repo}/pulls`, { title, head, base, body });
      audit({ tool: "pr_create", repo: `${owner}/${repo}`, head, base });
      return ok({ number: r.number, html_url: r.html_url });
    });

  s.tool("issue_list", "List issues", { ...repoArgs, state: z.enum(["open", "closed", "all"]).default("open") },
    async ({ owner, repo, state }) => {
      guard(owner, repo);
      const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/issues?state=${state}&per_page=50`);
      return ok(r.filter((i: any) => !i.pull_request).map((i: any) => ({ number: i.number, title: i.title, state: i.state, labels: i.labels.map((l: any) => l.name), html_url: i.html_url })));
    });

  s.tool("issue_create", "Create an issue", { ...repoArgs, title: z.string(), body: z.string().default("") },
    async ({ owner, repo, title, body }) => {
      guard(owner, repo);
      const r = await gh(cfg, "POST", `/repos/${owner}/${repo}/issues`, { title, body });
      return ok({ number: r.number, html_url: r.html_url });
    });

  // ---- Execution backend: GitHub Actions (the real, API-supported way to run code) ----
  s.tool("workflow_list", "List Actions workflows (build/render/test entry points)", repoArgs, async ({ owner, repo }) => {
    guard(owner, repo);
    const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/actions/workflows`);
    return ok(r.workflows.map((w: any) => ({ id: w.id, name: w.name, path: w.path, state: w.state })));
  });

  s.tool("workflow_dispatch", "RUN code: dispatch a workflow (e.g. render.yml) on a ref. This is the build/render/test execution tool — jobs run on GitHub runners, not a fake shell.",
    { ...repoArgs, workflow: z.string(), ref: z.string().default("main"), inputs: z.record(z.string()).default({}) },
    async ({ owner, repo, workflow, ref, inputs }) => {
      guard(owner, repo);
      await gh(cfg, "POST", `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, { ref, inputs });
      audit({ tool: "workflow_dispatch", repo: `${owner}/${repo}`, workflow, ref });
      return ok({ dispatched: workflow, ref, note: "Check progress with workflow_runs_list; logs with workflow_run_view." });
    });

  s.tool("workflow_runs_list", "List recent workflow runs with status/conclusion", { ...repoArgs, per_page: z.number().default(10) },
    async ({ owner, repo, per_page }) => {
      guard(owner, repo);
      const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/actions/runs?per_page=${Math.min(per_page, 50)}`);
      return ok(r.workflow_runs.map((w: any) => ({ id: w.id, name: w.name, status: w.status, conclusion: w.conclusion, branch: w.head_branch, sha: w.head_sha?.slice(0, 10), created_at: w.created_at, html_url: w.html_url })));
    });

  s.tool("workflow_run_view", "View one workflow run + its jobs (error analysis entry point)", { ...repoArgs, run_id: z.number() },
    async ({ owner, repo, run_id }) => {
      guard(owner, repo);
      const run = await gh(cfg, "GET", `/repos/${owner}/${repo}/actions/runs/${run_id}`);
      const jobs = await gh(cfg, "GET", `/repos/${owner}/${repo}/actions/runs/${run_id}/jobs`);
      return ok({
        run: { id: run.id, name: run.name, status: run.status, conclusion: run.conclusion, html_url: run.html_url, logs_url: `https://github.com/${owner}/${repo}/actions/runs/${run_id}` },
        jobs: jobs.jobs.map((j: any) => ({ name: j.name, status: j.status, conclusion: j.conclusion, failed_steps: (j.steps || []).filter((st: any) => st.conclusion === "failure").map((st: any) => st.name) })),
      });
    });

  s.tool("release_list", "List releases (render-studio publishes rendered MP4s as release assets)", repoArgs, async ({ owner, repo }) => {
    guard(owner, repo);
    const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/releases?per_page=20`);
    return ok(r.map((rel: any) => ({ tag: rel.tag_name, name: rel.name, published_at: rel.published_at, assets: rel.assets.map((a: any) => ({ name: a.name, size: a.size, download_url: a.browser_download_url })) })));
  });

  s.tool("codespace_list", "List Codespaces for the authenticated App installation's repos. NOTE: the Codespaces REST API can list/create/start/stop codespaces but CANNOT execute terminal commands inside one — execution is via workflow_dispatch (Actions).",
    repoArgs, async ({ owner, repo }) => {
      guard(owner, repo);
      try {
        const r = await gh(cfg, "GET", `/repos/${owner}/${repo}/codespaces`);
        return ok(r.codespaces?.map((c: any) => ({ name: c.name, state: c.state, machine: c.machine?.display_name, created_at: c.created_at })) ?? r);
      } catch (e: any) {
        return ok(`Codespaces listing unavailable: ${e.message}. This usually means the GitHub App lacks 'Codespaces' permission or no codespace exists. Execution still works via workflow_dispatch.`);
      }
    });

  s.tool("auth_status", "Check server-side GitHub App configuration WITHOUT exposing any secret", {}, async () => {
    return ok({
      auth_mode: cfg.fallbackToken ? "fine-grained-token" : cfg.appId ? "github-app" : "none",
      token_configured: Boolean(cfg.fallbackToken),
      app_id_configured: Boolean(cfg.appId),
      private_key_configured: Boolean(cfg.privateKey),
      installation_id_configured: Boolean(cfg.installationId),
      allowed_repos: cfg.allowedRepos,
      mcp_auth_required: Boolean(MCP_TOKEN),
      note: "Values are never shown. If any flag is false, set that env secret on the deployment host.",
    });
  });

  return s;
}

// ---- HTTP layer: bearer auth, Origin check, /health, stateless Streamable HTTP ----
const app = express();
app.use(express.json({ limit: "2mb" }));
app.get("/health", (_req, res) => res.json({ ok: true, service: "chatgpt-github-dev-bridge", github_configured: Boolean(cfg.fallbackToken || (cfg.appId && cfg.privateKey && cfg.installationId)), github_auth_mode: cfg.fallbackToken ? "fine-grained-token" : cfg.appId ? "github-app" : "none" }));

function authorized(req: express.Request): boolean {
  if (!MCP_TOKEN) return true; // local dev only — startup logs a loud warning
  // Two ways in: (1) Authorization: Bearer <token> for header-capable MCP clients;
  // (2) ?key=<token> in the URL — ChatGPT's custom-MCP UI has no bearer field
  // (OAuth / No-auth only), so the token rides inside the private connector URL
  // the user saves in their own ChatGPT account. Never publish that URL.
  const h = req.header("authorization") || "";
  const candidates = [h.replace(/^Bearer\s+/i, ""), String(req.query.key || "")];
  const want = Buffer.from(MCP_TOKEN);
  return candidates.some((c) => {
    const given = Buffer.from(c);
    return given.length === want.length && timingSafeEqual(given, want);
  });
}

app.post("/mcp", async (req, res) => {
  if (!authorized(req)) { res.status(401).json({ error: "Unauthorized: missing/invalid MCP bearer token" }); return; }
  const origin = req.header("origin");
  if (origin && !/^https:\/\//.test(origin) && !/^http:\/\/localhost/.test(origin)) { res.status(403).json({ error: "Forbidden origin" }); return; }
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); // stateless: each request independent — required for ChatGPT remote MCP
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e: any) {
    audit({ error: e.message });
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
});
app.get("/mcp", (_req, res) => res.status(405).json({ error: "Method not allowed: use POST (stateless Streamable HTTP)" }));
app.delete("/mcp", (_req, res) => res.status(405).json({ error: "Method not allowed" }));

app.listen(PORT, () => {
  console.log(`MCP bridge listening on :${PORT}  POST /mcp  GET /health`);
  if (!MCP_TOKEN) console.log("WARNING: MCP_AUTH_TOKEN is not set — endpoint is UNAUTHENTICATED. Set it before any public deployment.");
  if (!cfg.appId) console.log("WARNING: GitHub App env not set — GitHub tools will return a clear missing-credentials error (not fake data).");
});
