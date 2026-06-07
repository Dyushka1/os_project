export type AuthPayload = {
  sub?: string;
  role?: string;
  exp?: number;
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + padding);
}

export function getAuthPayload(): AuthPayload | null {
  const token = localStorage.getItem("token");
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as AuthPayload;
  } catch {
    return null;
  }
}

export function getCurrentRole(): string | null {
  return getAuthPayload()?.role ?? null;
}

export function getCurrentUsername(): string | null {
  return getAuthPayload()?.sub ?? null;
}

export function isClientUser(): boolean {
  return getCurrentRole() === "user";
}
