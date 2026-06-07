const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// ===== CONFIG =====
const INPUT_FILE = './old-card-names.txt';
const DB_FILE = '../cdbs/cards-master.cdb';
const OUTPUT_DIR = './output';
const NOT_FOUND_FILE = path.join(OUTPUT_DIR, 'not-found-cards.txt');
const BLOCK_SIZE = 40;

// ===== SETUP =====
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_FILE);

// ===== NORMALIZE FUNCTION =====
function normalizeName(name) {
  if (!name) return null;

  let n = name.trim();

  // remove 1x–5x do início
  n = n.replace(/^(?:[1-5]x)\s*/i, '');

  // remove 1x–5x do final
  n = n.replace(/\s*(?:[1-5]x)$/i, '');

  // remove ** do início e fim
  n = n.replace(/^\*\*|\*\*$/g, '');

  // trim de novo
  n = n.trim();

  return n;
}

// ===== READ + NORMALIZE =====
const rawLines = fs.readFileSync(INPUT_FILE, 'utf-8').split('\n');

const normalizedSet = new Set();

for (const line of rawLines) {
  const n = normalizeName(line);
  if (n) normalizedSet.add(n);
}

const normalizedList = Array.from(normalizedSet);

// ===== QUERY DB =====
function findCardIds(names) {
  return new Promise((resolve, reject) => {
    const found = [];
    const notFound = [];

    let pending = names.length;

    if (pending === 0) {
      resolve({ found, notFound });
      return;
    }

    names.forEach((name) => {
      const lower = name.toLowerCase();

      db.get(
        `SELECT id FROM texts WHERE LOWER(name) = ? LIMIT 1`,
        [lower],
        (err, row) => {
          if (err) return reject(err);

          if (row) {
            found.push(row.id);
          } else {
            notFound.push(name);
          }

          pending--;
          if (pending === 0) {
            resolve({ found, notFound });
          }
        }
      );
    });
  });
}

// ===== WRITE YDK =====
function writeYDKBlocks(ids) {
  let blockIndex = 1;

  for (let i = 0; i < ids.length; i += BLOCK_SIZE) {
    const chunk = ids.slice(i, i + BLOCK_SIZE);

    const content = [
      '#created by script',
      '#main',
      ...chunk,
      '#extra',
      '!side',
    ].join('\n');

    const fileName = path.join(
      OUTPUT_DIR,
      `old-cards-${blockIndex}.ydk`
    );

    fs.writeFileSync(fileName, content, 'utf-8');
    blockIndex++;
  }
}

// ===== MAIN =====
(async () => {
  try {
    const { found, notFound } = await findCardIds(normalizedList);

    // salva não encontrados
    fs.writeFileSync(
      NOT_FOUND_FILE,
      notFound.join('\n'),
      'utf-8'
    );

    // gera ydk
    writeYDKBlocks(found);

    console.log(`Total normalizados: ${normalizedList.length}`);
    console.log(`Encontrados: ${found.length}`);
    console.log(`Não encontrados: ${notFound.length}`);
  } catch (err) {
    console.error(err);
  } finally {
    db.close();
  }
})();