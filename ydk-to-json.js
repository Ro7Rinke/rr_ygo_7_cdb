const fs = require('fs');
const path = require('path');

const INPUT_DIR = './jsons/rrygo7-cc1';

function parseYdk(content) {
  const lines = content.split('\n');

  const cards = [];
  let lastName = null;

  for (let line of lines) {
    line = line.trim();

    if (line.startsWith('#') && !line.startsWith('#main') && !line.startsWith('#extra')) {
      lastName = line.replace(/^#\s*/, '').trim();
      continue;
    }

    if (/^\d+$/.test(line)) {
      const id = Number(line);

      if (lastName) {
        cards.push({
          id,
          name: lastName
        });
      }

      lastName = null;
    }
  }

  return cards;
}

function main() {
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter(f => f.endsWith('.ydk'));

  const unique = new Map();

  for (const file of files) {
    const fullPath = path.join(INPUT_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf-8');

    const cards = parseYdk(content);

    for (const card of cards) {
      if (!unique.has(card.id)) {
        unique.set(card.id, card);
      }
    }
  }

  const folderName = path.basename(INPUT_DIR);
  const outputFile = `./${folderName}.json`;

  const result = {
    title: folderName,
    cards: Array.from(unique.values())
  };

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

  console.log('✅ JSON gerado com sucesso!');
  console.log(`📁 Arquivo: ${outputFile}`);
  console.log(`📦 Total de cartas únicas: ${result.cards.length}`);
}

main();