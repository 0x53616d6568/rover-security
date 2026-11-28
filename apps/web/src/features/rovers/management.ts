import type { RoverBinding, ManagementUser } from "./managementTypes";

const FALLBACK_KEY = "rover-users-fallback";

type FallbackStore = {
  users: ManagementUser[];
  rovers: RoverBinding[];
  authUser?: ManagementUser;
};

function nowIso() {
  return new Date().toISOString();
}

function seedFallbackStore(): FallbackStore {
  const user: ManagementUser = {
    id: "local-owner",
    name: "Owner",
    createdAt: nowIso(),
    password: "Rover2026!",
  };
  const store: FallbackStore = { users: [user], rovers: [] };
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(store));
  } catch {}
  return store;
}

function fallbackStore(): FallbackStore {
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    if (!raw) return seedFallbackStore();
    const parsed = JSON.parse(raw) as Partial<FallbackStore>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      rovers: Array.isArray(parsed.rovers) ? parsed.rovers : [],
      authUser: parsed.authUser,
    };
  } catch {
    return { users: [], rovers: [] };
  }
}

function setFallbackStore(store: FallbackStore) {
  window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(store));
}

function setFallbackUsers(users: ManagementUser[]) {
  const store = fallbackStore();
  setFallbackStore({ ...store, users });
}

function setFallbackRovers(rovers: RoverBinding[]) {
  const store = fallbackStore();
  setFallbackStore({ ...store, rovers });
}

function fallbackOwner(userId?: string): ManagementUser {
  const store = fallbackStore();
  const user = store.users.find((candidate) => candidate.id === userId)
    ?? store.authUser
    ?? store.users[0];
  if (user) return user;
  return { id: userId ?? "local_user", name: userId ? "Local user" : "Local owner", createdAt: nowIso() };
}

function fallbackMacId(mac: string) {
  return mac
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 32);
}

function fallbackMacMask(mac: string) {
  const compact = mac.trim().toUpperCase().replace(/[^0-9A-F]/g, "");
  if (compact.length !== 12) return "••:••:••:••:••:••";
  return ["••", "••", "••", compact.slice(6, 8), compact.slice(8, 10), compact.slice(10, 12)].join(":");
}

function apiBase() {
  const value = (import.meta.env as Record<string, unknown>).VITE_API_BASE;
  return typeof value === "string" ? value.replace(/\/+$/, "") : "";
}

type ApiBody = {
  ok?: boolean;
  error?: string;
  users?: ManagementUser[];
  user?: ManagementUser;
  rovers?: RoverBinding[];
  rover?: RoverBinding;
  owner?: ManagementUser;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, init);
  // fetch resolves on 4xx/5xx: inspect the status before treating the payload as data.
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiBody | null;
    throw new Error(errorBody?.error ?? `Request failed (${response.status}).`);
  }

  const body = (await response.json().catch(() => null)) as ApiBody | null;
  if (body?.ok !== true) {
    throw new Error(body?.error ?? "Malformed API response.");
  }
  return body as unknown as T;
}

export async function getUsers(): Promise<ManagementUser[]> {
  try {
    const body = await request<{ users: ManagementUser[] }>("/api/users");
    return body.users ?? [];
  } catch {
    return fallbackStore().users ?? [];
  }
}

export async function addUser(name: string, password?: string): Promise<ManagementUser> {
  const trimmedName = String(name ?? "").trim();
  try {
    const body = await request<{ user: ManagementUser }>("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmedName, password: password ?? "" }),
    });
    const store = fallbackStore();
    setFallbackUsers([...store.users, body.user]);
    return body.user;
  } catch {
    const store = fallbackStore();
    const existing = store.users.find((user) => user.name === trimmedName);
    if (existing) return existing;
    const user: ManagementUser = { id: `local_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`, name: trimmedName, createdAt: nowIso() };
    setFallbackUsers([...store.users, user]);
    return user;
  }
}

export async function loginUser(name: string, password: string): Promise<ManagementUser> {
  try {
    const body = await request<{ user: ManagementUser }>("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    setFallbackStore({ ...fallbackStore(), authUser: body.user });
    return body.user;
  } catch {
    const store = fallbackStore();
    const user = store.users.find((candidate) => candidate.name === name);
    if (!user) throw new Error("Unknown local owner.");
    if (user.password && user.password !== password) throw new Error("Invalid password.");
    setFallbackStore({ ...store, authUser: user });
    return user;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore backend logout failure and clear local auth state.
  }
  const store = fallbackStore();
  setFallbackStore({ ...store, authUser: undefined });
}

export async function getMe(): Promise<ManagementUser | null> {
  try {
    const body = await request<{ user: ManagementUser }>("/api/auth/me");
    return body.user;
  } catch {
    const store = fallbackStore();
    return store.authUser ?? null;
  }
}

export async function getUserRovers(userId: string) {
  try {
    return await request<{ user: ManagementUser; rovers: RoverBinding[] }>(`/api/users/${userId}/rovers`);
  } catch {
    const store = fallbackStore();
    const user = store.users.find((candidate) => candidate.id === userId) ?? store.authUser ?? store.users[0];
    return { user: user ?? fallbackOwner(userId), rovers: store.rovers.filter((rover) => rover.userId === userId) };
  }
}

export async function addRover(userId: string, mac: string): Promise<RoverBinding> {
  const roverId = fallbackMacId(mac);
  try {
    const body = await request<{ rover: RoverBinding }>(`/api/users/${userId}/rovers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mac }),
    });
    setFallbackRovers([...fallbackStore().rovers, body.rover]);
    return body.rover;
  } catch {
    const store = fallbackStore();
    const now = nowIso();
    const rover: RoverBinding = {
      roverId,
      macMask: fallbackMacMask(mac),
      userId,
      connectionCount: 0,
      activeConnection: false,
      createdAt: now,
      updatedAt: now,
    };
    setFallbackRovers([...store.rovers, rover]);
    return rover;
  }
}

export async function deleteRover(userId: string, roverId: string): Promise<void> {
  try {
    await request(`/api/users/${userId}/rovers/${roverId}`, { method: "DELETE" });
  } catch {
    setFallbackRovers(fallbackStore().rovers.filter((rover) => rover.roverId !== roverId));
  }
}

export async function getRover(roverId: string) {
  try {
    return await request<{ rover: RoverBinding; owner: ManagementUser }>(`/api/rover/${roverId}`);
  } catch {
    const store = fallbackStore();
    const rover = store.rovers.find((candidate) => candidate.roverId === roverId);
    return { rover: rover ?? { roverId, macMask: roverId, userId: store.users[0]?.id ?? "", connectionCount: 0, activeConnection: false, createdAt: nowIso(), updatedAt: nowIso() }, owner: fallbackOwner(rover?.userId) };
  }
}

export async function connectRover(roverId: string, userId?: string) {
  try {
    return await request<{ rover: RoverBinding; owner: ManagementUser }>("/api/rover/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roverId, userId }),
    });
  } catch {
    const store = fallbackStore();
    const rover = store.rovers.find((candidate) => candidate.roverId === roverId);
    if (!rover) throw new Error("Rover not found in local storage.");
    const connected = { ...rover, connectionCount: 1, activeConnection: true };
    setFallbackRovers(store.rovers.map((candidate) => (candidate.roverId === roverId ? connected : candidate)));
    return { rover: connected, owner: fallbackOwner(rover.userId) };
  }
}

export async function disconnectRover(roverId: string): Promise<void> {
  try {
    await request("/api/rover/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roverId }),
    });
  } catch {
    const store = fallbackStore();
    setFallbackRovers(
      store.rovers.map((candidate) => (candidate.roverId === roverId ? { ...candidate, connectionCount: 0, activeConnection: false } : candidate)),
    );
  }
}
