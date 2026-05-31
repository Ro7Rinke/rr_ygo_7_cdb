const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const JSON_DIR = './import-boosters';
const MASTER_DB = './cdbs/cards-master.cdb';
const CDBS_DIR = './cdbs';
const OUTPUT_DIR = './generated-cdbs';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

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

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
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

//Carrega TODAS as cartas já usadas dos CDBs antigos
async function loadUsedCards() {
  const used = new Set();

  if (!fs.existsSync(CDBS_DIR)) return used;

  const files = fs
    .readdirSync(CDBS_DIR)
    .filter(f => f.endsWith('.cdb') && f !== 'cards-master.cdb');

  for (const file of files) {
    const dbPath = path.join(CDBS_DIR, file);
    const db = openDb(dbPath);

    try {
      const rows = await all(db, `SELECT id FROM datas`);
      rows.forEach(row => used.add(row.id));
    } catch (err) {
      console.warn(`⚠️ Erro lendo ${file}:`, err.message);
    }

    db.close();
  }

  console.log(`📊 ${used.size} cartas já usadas carregadas dos CDBs antigos`);
  return used;
}

async function main() {
  const masterDb = openDb(MASTER_DB);

  //SET GLOBAL (histórico completo)
  const globalUsed = await loadUsedCards();

  const files = fs
    .readdirSync(JSON_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const full = path.join(JSON_DIR, f);
      return {
        file: f,
        path: full,
        time: fs.statSync(full).birthtimeMs
      };
    })
    .sort((a, b) => a.time - b.time);

  console.log('\n📂 Ordem de processamento:');
  files.forEach(f => console.log(`- ${f.file}`));

  for (const file of files) {
    console.log(`\n📦 Gerando CDB: ${file.file}`);

    const json = JSON.parse(fs.readFileSync(file.path, 'utf-8'));
    const cdb_name = `rrygo7-${json.code.toLowerCase()}.cdb`
    const outputPath = path.join(OUTPUT_DIR, cdb_name);
    const db = openDb(outputPath);

    await createSchema(db);
    await run(db, 'BEGIN TRANSACTION');

    const inserted = new Set();

    for (const card of json.cards) {
      //duplicata no mesmo JSON
      if (inserted.has(card.id)) continue;

      //duplicata histórica (CDBs antigos + já gerados nessa execução)
      if (globalUsed.has(card.id)) continue;

      const data = await get(masterDb, `SELECT * FROM datas WHERE id = ?`, [card.id]);
      const text = await get(masterDb, `SELECT * FROM texts WHERE id = ?`, [card.id]);

      if (!data || !text) {
        console.warn(`⚠️ Carta não encontrada: ${card.id}`);
        continue;
      }

      await run(db, `
        INSERT OR REPLACE INTO datas (
          id, ot, alias, setcode, type,
          atk, def, level, race, attribute, category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.id, data.ot, data.alias, data.setcode, data.type,
        data.atk, data.def, data.level, data.race, data.attribute, data.category
      ]);

      await run(db, `
        INSERT OR REPLACE INTO texts (
          id, name, desc,
          str1,str2,str3,str4,
          str5,str6,str7,str8,
          str9,str10,str11,str12,
          str13,str14,str15,str16
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        text.id,
        text.name,
        text.desc,
        text.str1, text.str2, text.str3, text.str4,
        text.str5, text.str6, text.str7, text.str8,
        text.str9, text.str10, text.str11, text.str12,
        text.str13, text.str14, text.str15, text.str16
      ]);

      //marca como usada
      inserted.add(card.id);
      globalUsed.add(card.id);
    }

    await run(db, 'COMMIT');
    await run(db, `PRAGMA wal_checkpoint(FULL);`);

    db.close();

    console.log(`✅ Criado: ${json.title}.cdb (${inserted.size} cartas)`);
  }

  await run(masterDb, `PRAGMA wal_checkpoint(FULL);`);
  masterDb.close();

  console.log('\n🎉 Tudo finalizado!');
}

main().catch(console.error);