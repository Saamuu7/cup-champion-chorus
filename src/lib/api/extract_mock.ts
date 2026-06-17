import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scratchpadPath = 'C:\\Users\\Samuel\\.gemini\\antigravity-ide\\brain\\e95a892d-6e7b-47c3-9b73-a6cc8a3a9f8b\\browser\\scratchpad_te3d037e.md';
const destPath = path.resolve(__dirname, 'mock_games.json');

if (!fs.existsSync(scratchpadPath)) {
  console.error("Scratchpad file not found at:", scratchpadPath);
  process.exit(1);
}

const content = fs.readFileSync(scratchpadPath, 'utf-8');
const match = content.match(/```json\s*([\s\S]*?)\s*```/);
if (!match) {
  console.error("No JSON block found in scratchpad file.");
  process.exit(1);
}

try {
  const json = JSON.parse(match[1].trim());
  fs.writeFileSync(destPath, JSON.stringify(json, null, 2), 'utf-8');
  console.log("Successfully extracted mock_games.json to:", destPath);
  process.exit(0);
} catch (e) {
  console.error("Invalid JSON content:", e);
  process.exit(1);
}
