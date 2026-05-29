const fs = require("fs");
const path = require("path");

// ===== CONFIG =====
const INPUT_DIR = "./import-sets";
const OUTPUT_DIR = "./generated-boosters";
const RARITIES_FILE = "./rrygo7-rarities.json"

let raritiesMap = new Map();

try {
  if (fs.existsSync(RARITIES_FILE)) {
    const rawData = fs.readFileSync(RARITIES_FILE, 'utf8');
    const raritiesList = JSON.parse(rawData);
    
    raritiesMap = new Map(
      raritiesList.map(item => [
        item.original_name.toLowerCase().trim(), 
        { code: item.code, level: item.level }
      ])
    );
  } else {
    console.warn(`Aviso: Arquivo de configuração não encontrado em ${CONFIG_PATH}.`);
  }
} catch (error) {
  console.error("Erro ao carregar ou processar o arquivo rrygo7-rarities.json:", error);
}

function parseRarity(r) {
  if (!r) return "UK";
  const key = r.toLowerCase().trim();
  
  const rarity = raritiesMap.get(key);
  return rarity ? rarity.code : "UK";
}

function getHighestRarityCode(raritiesArray) {
  if (!Array.isArray(raritiesArray) || raritiesArray.length === 0) {
    return "UK";
  }

  let highestRarity = null;

  for (const r of raritiesArray) {
    if (!r) continue;
    
    const key = r.toLowerCase().trim();
    const rarityData = raritiesMap.get(key);

    // Se a raridade existir no JSON, fazemos a comparação de nível
    if (rarityData) {
      // Se for a primeira raridade válida encontrada OU se tiver um nível maior que a maior atual
      if (!highestRarity || rarityData.level > highestRarity.level) {
        highestRarity = rarityData;
      }
    }
  }

  // Retorna o código da maior encontrada, ou "UK" caso nenhuma raridade da lista exista no JSON
  return highestRarity ? highestRarity.code : "UK";
}

// prioridade de raridade
// const rarityPriority = ["SC", "UR", "SR", "R", "C"];

// parser de raridade
// function parseRarity(r) {
//   if (!r) return "UK";

//   const value = r.toLowerCase();

//   if (value.includes("secret")) return "SC";
//   if (value.includes("ultra")) return "UR";
//   if (value.includes("super")) return "SR";
//   if (value.includes("rare")) return "R";
//   if (value.includes("common")) return "C";

//   return "UK";
// }

// pega maior raridade
// function getHighestRarity(rarities = []) {
//   const parsed = rarities.map(parseRarity);

//   for (const r of rarityPriority) {
//     if (parsed.includes(r)) return r;
//   }

//   return "UK";
// }

// pega menor password
function getCardId(passwords = []) {
  if (!passwords.length) return null;
  return Math.min(...passwords.map(p => parseInt(p, 10)));
}

// transforma set
function transformSet(set) {
  return {
    title: set.title,
    code: null,
    price: 500,
    cash_type: "cash",
    prefix: set.prefix,
    type: set.type,
    date: set.date,
    cards: (set.cards || []).map(card => ({
      id: getCardId(card.passwords),
      name: card.name,
      rarity: getHighestRarityCode(card.rarities)
    })),
    slots: set.slots || []
  };
}

// garantir pasta de saída
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ler arquivos
const files = fs.readdirSync(INPUT_DIR);

for (const file of files) {
  if (!file.endsWith(".json")) continue; // skip não-json

  try {
    const inputPath = path.join(INPUT_DIR, file);
    const raw = fs.readFileSync(inputPath, "utf-8");
    const json = JSON.parse(raw);

    const transformed = transformSet(json);

    const outputPath = path.join(OUTPUT_DIR, file);

    fs.writeFileSync(
      outputPath,
      JSON.stringify(transformed, null, 2),
      "utf-8"
    );

    console.log(`✅ Processado: ${file}`);
  } catch (err) {
    console.error(`❌ Erro em ${file}:`, err.message);
  }
}

console.log("🚀 Todos os sets foram processados!");