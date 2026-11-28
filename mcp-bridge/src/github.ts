// GitHub App auth: App JWT (RS256, <=10 min) -> installation access token (1 h, cached).
// Credentials come ONLY from server env. Never logged, never returned by tools.
import jwt from "jsonwebtoken";

export interface Config {
  appId: string;
  privateKey: string; // PEM, supports \n-escaped single-line form
  installationId: string;
  allowedRepos: string[]; // ["owner/repo", ...]
  fallbackToken?: string; // optional PAT for local dev only (GITHUB_TOKEN)
}

export function loadConfig(): Config {
  const key = (process.env.GITHUB_APP_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  return {
    appId: process.env.GITHUB_APP_ID || "",
    privateKey: key,
    installationId: process.env.GITHUB_APP_INSTALLATION_ID || "",
    allowedRepos: (process.env.ALLOWED_REPOS || "gustuplode/render-studio")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    fallbackToken: process.env.GITHUB_TOKEN || undefined,
  };
}

export function assertRepoAllowed(cfg: Config, owner: string, repo: string) {
  const full = `${owner}/${repo}`.toLowerCase();
  if (!cfg.allowedRepos.includes(full)) {
    throw new Error(`Repository ${full} is not in ALLOWED_REPOS (${cfg.allowedRepos.join(", ")}). Refused.`);
  }
}

// Path safety: no traversal, no absolute paths, no backslashes.
export function assertSafePath(p: string) {
  if (!p || p.startsWith("/") || p.includes("\\") || p.split("/").includes("..")) {
    throw new Error(`Unsafe path refused: ${p}`);
  }
}

let cached: { token: string; expiresAt: number } | null = null;

export async function getToken(cfg: Config): Promise<string> {
  // Token mode takes priority when GITHUB_TOKEN is set: a fine-grained PAT
  // scoped to the allowed repo(s) is a supported alternative to App auth
  // (used when the App private key cannot be entered into the host's env UI).
  if (cfg.fallbackToken) return cfg.fallbackToken;
  if (!cfg.appId || !cfg.privateKey || !cfg.installationId) {
    throw new Error(
      "GitHub App credentials missing on the server. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY and GITHUB_APP_INSTALLATION_ID as deployment secrets. Authentication has NOT been faked."
    );
  }
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const appJwt = jwt.sign({ iat: now - 60, exp: now + 540, iss: cfg.appId }, cfg.privateKey, { algorithm: "RS256" });
  const res = await fetch(`https://api.github.com/app/installations/${cfg.installationId}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appJwt}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) throw new Error(`GitHub App installation token request failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data: any = await res.json();
  cached = { token: data.token, expiresAt: new Date(data.expires_at).getTime() };
  return cached.token;
}

export async function gh(cfg: Config, method: string, path: string, body?: unknown): Promise<any> {
  const token = await getToken(cfg);
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (res.status === 204) return { ok: true, status: 204 };
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(`GitHub API ${method} ${path} -> HTTP ${res.status}: ${typeof parsed === "object" ? (parsed.message || JSON.stringify(parsed).slice(0, 300)) : String(parsed).slice(0, 300)}`);
  return parsed;
}

export const audit = (event: Record<string, unknown>) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...event })); // no secrets, no file contents
