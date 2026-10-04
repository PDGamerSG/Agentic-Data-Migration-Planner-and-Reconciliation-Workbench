import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "./generated/prisma/client";
const globalDb = globalThis as unknown as { manifestDb?: PrismaClient };
export function getDb(): PrismaClient {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Database is not configured. Add DATABASE_URL and run the migrations.",
    );
  return (globalDb.manifestDb ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
    }),
  }));
}
export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;
