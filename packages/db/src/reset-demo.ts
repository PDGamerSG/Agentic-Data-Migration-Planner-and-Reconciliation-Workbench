import { config } from "dotenv";
import { getDb } from "./client";
import { resetDemoWorkspace } from "./demo-reset";

if (!process.argv.includes("--confirm-reset-demo"))
  throw new Error(
    "This deletes all demo test history. Pass --confirm-reset-demo to run it.",
  );
config({ path: "../../.env", quiet: true });
const db = getDb();
try {
  console.info(
    JSON.stringify({
      event: "demo_workspace_reset",
      ...(await resetDemoWorkspace(db)),
    }),
  );
} finally {
  await db.$disconnect();
}
