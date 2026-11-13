// Placeholder runner for scripts whose implementation lands in a later phase (see PLAN.md).
export {};
const [scriptName = "script", phase = "?"] = process.argv.slice(2);
console.error(`[eidos] "${scriptName}" is implemented in phase ${phase} (see PLAN.md). Nothing was run.`);
process.exit(1);
