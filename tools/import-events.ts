import { runEventsImport } from "@/server/events-import";

function readArg(name: string) {
  const direct = process.argv.find((arg) => arg === `--${name}`);
  if (direct) return "true";
  const prefixed = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!prefixed) return null;
  return prefixed.slice(name.length + 3);
}

function toBool(value: string | null, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

async function main() {
  const city = readArg("city") || undefined;
  const daysRaw = readArg("days");
  const categoriesRaw = readArg("categories");
  const forceSeed = toBool(readArg("force-seed"), false);

  const daysAhead = daysRaw ? Number(daysRaw) : undefined;
  const categories = categoriesRaw
    ? categoriesRaw.split(",").map((x) => x.trim()).filter(Boolean)
    : undefined;

  const result = await runEventsImport({
    city,
    daysAhead,
    categories,
    forceSeed,
    actorUserId: null,
    sourceName: "kudago_timepad",
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
