import { config } from "dotenv";
import { Workbench } from "./workbench";
config({ path: "../../.env", quiet: true });
const workbench = new Workbench();
try {
  await workbench.seed();
  process.stdout.write(
    "Dataset ready: 250 source records and 20 existing target customers.\n",
  );
} finally {
  await workbench.db.$disconnect();
}
