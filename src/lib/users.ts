import { compare, hash } from "bcryptjs";
import { collections, ensureIndexes } from "./data-store";
import { getDatabase, hasDatabase } from "./mongodb";
import type { UserAccount, UserRole } from "./types";

const defaults = [
  {
    id: "demo-admin",
    name: "Vân Anh",
    email: "admin@nichiei.vn",
    role: "admin" as UserRole,
    password: "Nichiei@2026",
  },
  {
    id: "demo-sales",
    name: "Trâm",
    email: "sale@nichiei.vn",
    role: "sales" as UserRole,
    password: "Sale@2026",
  },
  {
    id: "demo-care",
    name: "Linh",
    email: "cskh@nichiei.vn",
    role: "care" as UserRole,
    password: "CSKH@2026",
  },
];

export async function ensureDefaultUsers() {
  if (!hasDatabase()) return;
  await ensureIndexes();
  const db = await getDatabase();
  const existing = new Set(
    (
      await db
        .collection(collections.users)
        .find(
          { email: { $in: defaults.map((x) => x.email) } },
          { projection: { email: 1 } },
        )
        .toArray()
    ).map((x) => x.email),
  );
  for (const item of defaults) {
    if (existing.has(item.email)) continue;
    const passwordHash = await hash(item.password, 10);
    await db.collection(collections.users).updateOne(
      { email: item.email },
      {
        $setOnInsert: {
          id: item.id,
          name: item.name,
          email: item.email,
          role: item.role,
          active: true,
          sessionVersion: 0,
          passwordHash,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
  }
}

export async function authenticateUser(email: string, password: string) {
  if (!hasDatabase()) {
    const item = defaults.find((x) => x.email === email.toLowerCase());
    return item && item.password === password
      ? { id: item.id, name: item.name, email: item.email, role: item.role }
      : null;
  }
  const db = await getDatabase();
  let user = await db
    .collection<UserAccount>(collections.users)
    .findOne({ email: email.toLowerCase(), active: true });
  if (!user) {
    const initial = defaults.find((item) => item.email === email.toLowerCase());
    if (initial) {
      const passwordHash = await hash(initial.password, 10);
      await db.collection(collections.users).updateOne(
        { email: initial.email },
        {
          $setOnInsert: {
            id: initial.id,
            name: initial.name,
            email: initial.email,
            role: initial.role,
            passwordHash,
            active: true,
            sessionVersion: 0,
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true },
      );
      user = await db
        .collection<UserAccount>(collections.users)
        .findOne({ email: initial.email, active: true });
    }
  }
  if (!user || !(await compare(password, user.passwordHash))) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion || 0,
  };
}

export async function listUsers() {
  if (!hasDatabase())
    return defaults.map((x) => ({
      id: x.id,
      name: x.name,
      email: x.email,
      role: x.role,
      active: true,
      createdAt: "demo",
    }));
  await ensureDefaultUsers();
  return (await getDatabase())
    .collection<UserAccount>(collections.users)
    .find({}, { projection: { passwordHash: 0, _id: 0 } })
    .sort({ name: 1 })
    .toArray();
}
