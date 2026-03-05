import "server-only";

import { getToken } from "next-auth/jwt";
import { auth } from "@/app/(auth)/auth";
import { guestRegex } from "@/lib/constants";

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function checkApiKey(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  const apiKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : request.headers.get("X-Admin-API-Key");

  const expected = process.env.ADMIN_API_KEY?.trim();
  return Boolean(expected && apiKey && apiKey === expected);
}

/**
 * Verifies admin access via API key or session.
 * Use in API route handlers: const result = await requireAdmin(request);
 */
export async function requireAdmin(
  request: Request
): Promise<{ ok: true } | { ok: false; status: number }> {
  if (checkApiKey(request)) {
    return { ok: true };
  }

  const token = await getToken({
    req: request as unknown as { headers: Headers; url?: string },
    secret: process.env.AUTH_SECRET,
  });

  if (!token?.email || guestRegex.test(token.email)) {
    return { ok: false, status: 401 };
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    return { ok: false, status: 403 };
  }

  const email = String(token.email).toLowerCase();
  if (!adminEmails.includes(email)) {
    return { ok: false, status: 403 };
  }

  return { ok: true };
}

/**
 * Verifies admin access for page/layout (session only, no API key).
 */
export async function requireAdminSession(): Promise<
  { ok: true } | { ok: false; redirect: string }
> {
  const session = await auth();

  if (!session?.user?.email || guestRegex.test(session.user.email)) {
    return { ok: false, redirect: "/login" };
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    return { ok: false, redirect: "/" };
  }

  const email = session.user.email.toLowerCase();
  if (!adminEmails.includes(email)) {
    return { ok: false, redirect: "/" };
  }

  return { ok: true };
}
