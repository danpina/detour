const [command] = process.argv.slice(2);
const known = ["validate", "draft", "images", "review", "publish"];

if (!command || !known.includes(command)) {
  console.log(`Detour tools\nUsage: pnpm tools <${known.join("|")}>\nNothing is implemented yet (see PROMPTS.md).`);
} else {
  console.log(`"${command}" is not implemented yet.`);
}
