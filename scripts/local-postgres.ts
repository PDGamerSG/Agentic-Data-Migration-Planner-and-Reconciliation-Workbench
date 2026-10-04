import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const pg = new EmbeddedPostgres({
  databaseDir: ".local-postgres",
  user: "postgres",
  password: "postgres",
  port: 54329,
  persistent: true,
  onLog: () => {},
  onError: (error) => process.stderr.write(String(error) + "\n"),
});
if (!existsSync(".local-postgres/PG_VERSION")) await pg.initialise();
await pg.start();
for (const database of ["manifest", "manifest_test"]) {
  const client = pg.getPgClient();
  await client.connect();
  const found = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [database],
  );
  await client.end();
  if (!found.rowCount) await pg.createDatabase(database);
}
process.stdout.write(
  "Postgres ready on localhost:54329 · manifest and manifest_test\n",
);
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
