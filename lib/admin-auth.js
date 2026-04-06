import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPlatformConfig, hasAdminCredentials } from "@/lib/env";

const COOKIE_NAME = "drum_blonde_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 6;
const loginAttempts = new Map();
const SHOULD_USE_SECURE_COOKIES = process.env.NODE_ENV === "production";

function signValue(value) {
  const { adminSessionSecret } = getPlatformConfig();
  return crypto
    .createHmac("sha256", adminSessionSecret)
    .update(value)
    .digest("hex");
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeAdminUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function passwordMatches(input, expected) {
  return safeCompare(String(input || ""), String(expected || ""));
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function buildSessionValue(expiresAt = getNowSeconds() + SESSION_TTL_SECONDS) {
  const payload = Buffer.from(
    JSON.stringify({
      v: "authorized",
      exp: expiresAt,
      nonce: crypto.randomUUID()
    })
  ).toString("base64url");

  return `${payload}.${signValue(payload)}`;
}

function verifySessionValue(value) {
  if (!value || !value.includes(".")) {
    return false;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeCompare(signature, signValue(payload))) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.v === "authorized" && Number(session.exp) > getNowSeconds();
  } catch {
    return false;
  }
}

function getClientIp(rawForwardedFor) {
  return String(rawForwardedFor || "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean) || "unknown";
}

function getAttemptKey(ip, username) {
  return `${ip}:${String(username || "").trim().toLowerCase()}`;
}

function pruneAttempts(now = Date.now()) {
  for (const [key, value] of loginAttempts.entries()) {
    if (value.resetAt <= now) {
      loginAttempts.delete(key);
    }
  }
}

export function verifyAdminCredentials(username, password) {
  if (!hasAdminCredentials()) {
    return false;
  }

  const { adminUsername, adminPassword } = getPlatformConfig();
  return (
    safeCompare(normalizeAdminUsername(username), normalizeAdminUsername(adminUsername)) &&
    passwordMatches(password, adminPassword)
  );
}

export async function isAdminAuthenticated() {
  if (!hasAdminCredentials()) {
    return false;
  }

  const store = await cookies();
  return verifySessionValue(store.get(COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  if (await isAdminAuthenticated()) {
    return true;
  }

  redirect("/admin/login");
}

export async function createAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, buildSessionValue(), {
    httpOnly: true,
    secure: SHOULD_USE_SECURE_COOKIES,
    sameSite: "lax",
    path: "/",
    priority: "high",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: SHOULD_USE_SECURE_COOKIES,
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
}

export async function isAdminRequest(request) {
  if (!hasAdminCredentials()) {
    return false;
  }

  return verifySessionValue(request.cookies.get(COOKIE_NAME)?.value);
}

export async function assertLoginAllowed(username) {
  const headerStore = await headers();
  const ip = getClientIp(headerStore.get("x-forwarded-for"));
  const key = getAttemptKey(ip, username);
  const now = Date.now();
  pruneAttempts(now);

  const record = loginAttempts.get(key);
  if (!record || record.resetAt <= now) {
    return true;
  }

  return record.count < MAX_LOGIN_ATTEMPTS;
}

export async function registerFailedLoginAttempt(username) {
  const headerStore = await headers();
  const ip = getClientIp(headerStore.get("x-forwarded-for"));
  const key = getAttemptKey(ip, username);
  const now = Date.now();
  pruneAttempts(now);

  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, {
      count: 1,
      resetAt: now + LOGIN_WINDOW_MS
    });
    return;
  }

  loginAttempts.set(key, {
    count: current.count + 1,
    resetAt: current.resetAt
  });
}

export async function clearFailedLoginAttempts(username) {
  const headerStore = await headers();
  const ip = getClientIp(headerStore.get("x-forwarded-for"));
  loginAttempts.delete(getAttemptKey(ip, username));
}

