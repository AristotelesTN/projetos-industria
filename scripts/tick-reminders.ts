import "dotenv/config";
import { processDueReminders } from "../src/lib/reminders/tick";

async function main() {
  const result = await processDueReminders();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
