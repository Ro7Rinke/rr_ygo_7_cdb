const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cliProgress = require('cli-progress');

const INPUT_DIR = './import-cdbs';
const OUTPUT_DB = './generated-cdbs/cards-master.cdb';

function openDb(file) {
  return new sqlite3.Database(file);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getColumns(db, table) {
  const cols = await all(db, `PRAGMA table_info(${table})`);
  return cols.map(c => c.name);
}

async function optimizeDb(db) {
  await run(db, `PRAGMA journal_mode = WAL;`);
  await run(db, `PRAGMA synchronous = NORMAL;`);
}

async function createSchema(db) {
  await run(db, `
    CREATE TABLE IF NOT EXISTS datas (
      id INTEGER PRIMARY KEY,
      ot INTEGER,
      alias INTEGER,
      setcode INTEGER,
      type INTEGER,
      atk INTEGER,
      def INTEGER,
      level INTEGER,
      race INTEGER,
      attribute INTEGER,
      category INTEGER
    )
  `);

  await run(db, `
    CREATE TABLE IF NOT EXISTS texts (
      id INTEGER PRIMARY KEY,
      name TEXT,
      desc TEXT,
      str1 TEXT, str2 TEXT, str3 TEXT, str4 TEXT,
      str5 TEXT, str6 TEXT, str7 TEXT, str8 TEXT,
      str9 TEXT, str10 TEXT, str11 TEXT, str12 TEXT,
      str13 TEXT, str14 TEXT, str15 TEXT, str16 TEXT
    )
  `);
}

async function main() {
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter(f => f.endsWith('.cdb'))
    .map(f => {
      const full = path.join(INPUT_DIR, f);
      return {
        file: f,
        path: full,
        mtime: fs.statSync(full).mtimeMs
      };
    })
    .sort((a, b) => a.mtime - b.mtime);

  console.log('\n📂 Ordem de prioridade (mais novo vence):');
  files.forEach(f => console.log(`- ${f.file}`));

  const masterDb = openDb(OUTPUT_DB);
  await optimizeDb(masterDb);
  await createSchema(masterDb);

  const conflictLog = [];

  const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

  for (const file of files) {
    console.log(`\n📦 Processando: ${file.file}`);
    const db = openDb(file.path);

    try {
      const dataCols = await getColumns(db, 'datas');
      const textCols = await getColumns(db, 'texts');

      const datas = await all(db, `SELECT * FROM datas`);
      const texts = await all(db, `SELECT * FROM texts`);

      progress.start(datas.length + texts.length, 0);

      await run(masterDb, 'BEGIN TRANSACTION');

      for (const row of datas) {
        const values = dataCols.map(c => row[c] ?? null);

        const placeholders = dataCols.map(() => '?').join(',');
        const sql = `INSERT OR REPLACE INTO datas (${dataCols.join(',')}) VALUES (${placeholders})`;

        await run(masterDb, sql, values);
        progress.increment();
      }

      for (const row of texts) {
        const validCols = textCols.filter(c => c === 'id' || c.startsWith('str') || c === 'name' || c === 'desc');

        const values = validCols.map(c => row[c] ?? null);
        const placeholders = validCols.map(() => '?').join(',');

        const sql = `INSERT OR REPLACE INTO texts (${validCols.join(',')}) VALUES (${placeholders})`;

        await run(masterDb, sql, values);
        progress.increment();
      }

      await run(masterDb, 'COMMIT');
      progress.stop();

    } catch (err) {
      console.error(`❌ Erro em ${file.file}:`, err.message);
      await run(masterDb, 'ROLLBACK');
    }

    db.close();
  }

  await run(masterDb, `PRAGMA wal_checkpoint(FULL);`);
  
  masterDb.close();

  console.log('\n✅ Merge concluído!');
}

main().catch(console.error);