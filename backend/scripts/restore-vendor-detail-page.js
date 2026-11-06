const fs = require("fs");
const { execSync } = require("child_process");

const baseContent = execSync(
  'git show 2fb5520:"frontend/src/app/administrator/vendors/[id]/page.js"',
  { encoding: "utf8" }
);

console.log("Base content length:", baseContent.length);

const transcriptPath =
  "C:/Users/itspr/.gemini/antigravity/brain/fed5b5b9-a7f2-415d-82ee-c304a6b623b5/.system_generated/logs/transcript_full.jsonl";

const stepsToApply = [
  569, 575, 577, 583, 589, 900, 1047, 1051, 1055, 1059, 1801, 1805, 1811,
  1819, 1823, 1827, 2297, 4962, 4964,
];

const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
const stepEdits = {};

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (stepsToApply.includes(obj.step_index) && obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (
          tc.name === "edit_file" &&
          tc.args &&
          tc.args.Path &&
          tc.args.Path.includes("vendors") &&
          tc.args.Path.includes("[id]")
        ) {
          stepEdits[obj.step_index] = {
            target: tc.args.Target,
            replacement: tc.args.Replacement,
          };
        }
      }
    }
  } catch (e) {}
}

console.log(
  "Found edits for steps:",
  Object.keys(stepEdits).map(Number).sort((a, b) => a - b)
);

let currentContent = baseContent;
for (const step of stepsToApply) {
  const edit = stepEdits[step];
  if (!edit) {
    console.warn(`Missing edit for step ${step}`);
    continue;
  }
  // Try direct replacement
  if (currentContent.includes(edit.target)) {
    currentContent = currentContent.replace(edit.target, edit.replacement);
    console.log(`Successfully applied step ${step}`);
  } else {
    // Try normalized newlines
    const normTarget = edit.target.replace(/\r\n/g, "\n");
    const normContent = currentContent.replace(/\r\n/g, "\n");
    if (normContent.includes(normTarget)) {
      currentContent = normContent.replace(normTarget, edit.replacement.replace(/\r\n/g, "\n"));
      console.log(`Successfully applied step ${step} (normalized)`);
    } else {
      console.error(`Failed to apply step ${step}: target not found!`);
    }
  }
}

console.log("Final reconstructed content lines:", currentContent.split("\n").length);
fs.writeFileSync(
  "frontend/src/app/administrator/vendors/[id]/page.js",
  currentContent,
  "utf8"
);
console.log("Restored frontend/src/app/administrator/vendors/[id]/page.js!");

