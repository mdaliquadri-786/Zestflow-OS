const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:/Users/gamin/.gemini/antigravity/brain/953792ab-652d-4973-ad0a-b736cbd43dee/.system_generated/logs/transcript_full.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('"step_index":720')) {
      const o = JSON.parse(line);
      console.log('STEP 720 THINKING:');
      console.log(o.thinking);
      break;
    }
  }
}

processLineByLine();
