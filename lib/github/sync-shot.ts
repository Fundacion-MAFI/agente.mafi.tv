import "server-only";

import type { Shot } from "@/lib/db/schema/shots";

const GITHUB_API = "https://api.github.com";
const SHOTS_PATH = "data/mafi-shots";

function buildMarkdown(shot: Shot): string {
  const frontmatter: Record<string, string | string[] | undefined> = {
    title: shot.title,
    vimeo_link: shot.vimeoUrl ?? undefined,
    date: shot.date ?? undefined,
    geotag: shot.geotag ?? undefined,
    place: shot.place ?? undefined,
    author: shot.author ?? undefined,
    description: shot.description ?? undefined,
    historic_context: shot.historicContext ?? undefined,
    tags: shot.tags.length > 0 ? shot.tags : undefined,
  };

  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => `"${v}"`).join(", ")}]`);
    } else {
      const escaped = String(value).replace(/"/g, '\\"');
      lines.push(`${key}: "${escaped}"`);
    }
  }
  lines.push("---");
  lines.push("");
  if (shot.description) {
    lines.push(shot.description);
    lines.push("");
  }

  return lines.join("\n");
}

type SyncResult =
  | { ok: true; commitSha?: string }
  | { ok: false; error: string };

export async function syncShotToGitHub(
  shot: Shot,
  operation: "create" | "update" | "delete"
): Promise<SyncResult> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  const branch = process.env.GITHUB_BRANCH?.trim();

  if (!token || !repo) {
    return { ok: false, error: "GITHUB_TOKEN and GITHUB_REPO must be set" };
  }

  const filePath = `${SHOTS_PATH}/${shot.slug}.md`;
  const baseUrl = `${GITHUB_API}/repos/${repo}/contents/${filePath}`;
  const url = branch ? `${baseUrl}?ref=${branch}` : baseUrl;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    if (operation === "delete") {
      const getRes = await fetch(url, { headers });
      if (!getRes.ok) {
        if (getRes.status === 404) {
          return { ok: true };
        }
        const err = await getRes.json().catch(() => ({}));
        return {
          ok: false,
          error:
            (err as { message?: string }).message ?? "Failed to fetch file",
        };
      }
      const { sha } = (await getRes.json()) as { sha: string };
      const deleteBody: { message: string; sha: string; branch?: string } = {
        message: `Admin: delete shot ${shot.slug}`,
        sha,
      };
      if (branch) {
        deleteBody.branch = branch;
      }
      const deleteRes = await fetch(url, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(deleteBody),
      });
      if (!deleteRes.ok) {
        const err = await deleteRes.json().catch(() => ({}));
        return {
          ok: false,
          error: (err as { message?: string }).message ?? "Failed to delete",
        };
      }
      return { ok: true };
    }

    if (operation === "create" || operation === "update") {
      let sha: string | undefined;
      const getRes = await fetch(url, { headers });
      if (getRes.ok) {
        const data = (await getRes.json()) as { sha: string };
        sha = data.sha;
      }

      const content = buildMarkdown(shot);
      const body: {
        message: string;
        content: string;
        sha?: string;
        branch?: string;
      } = {
        message: `Admin: ${operation} shot ${shot.slug}`,
        content: Buffer.from(content, "utf8").toString("base64"),
      };
      if (sha) {
        body.sha = sha;
      }
      if (branch) {
        body.branch = branch;
      }

      const putRes = await fetch(url, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        return {
          ok: false,
          error: (err as { message?: string }).message ?? "Failed to sync",
        };
      }

      const result = (await putRes.json()) as { commit?: { sha?: string } };
      return { ok: true, commitSha: result.commit?.sha };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }

  return { ok: false, error: "Invalid operation" };
}
