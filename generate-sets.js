const fs = require('fs');
const path = require('path');

const BASE_PATH = './data/individual';

// configs
const TARGET_LOCALE = 'na';
const TARGET_PREFIXES = ['SDY-', 'SDK-', 'SDJ-'];

// paths
const SETS_INDEX = `${BASE_PATH}/sets.json`;
const CARDS_INDEX = `${BASE_PATH}/cards.json`;
const DISTRIBUTIONS_INDEX = `${BASE_PATH}/distributions.json`;

const SETS_DIR = `${BASE_PATH}/sets`;
const CARDS_DIR = `${BASE_PATH}/cards`;
const DISTRIBUTIONS_DIR = `${BASE_PATH}/distributions`;

// load index
const setIds = JSON.parse(fs.readFileSync(SETS_INDEX, 'utf-8'));
const cardIds = JSON.parse(fs.readFileSync(CARDS_INDEX, 'utf-8'));
const distributionIds = JSON.parse(fs.readFileSync(DISTRIBUTIONS_INDEX, 'utf-8'));

//cache de cartas (AGORA COMPLETO)
const cardMap = {};
for (const id of cardIds) {
    const file = path.join(CARDS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) continue;

    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

    cardMap[id] = {
        name: data.text?.en?.name || "UNKNOWN",
        passwords: data.passwords || []
    };
}

//cache de distributions
const distributionMap = {};
for (const id of distributionIds) {
    const file = path.join(DISTRIBUTIONS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) continue;

    distributionMap[id] = JSON.parse(fs.readFileSync(file, 'utf-8'));
}

//helper slots
function parseDistribution(distributionId) {
    const dist = distributionMap[distributionId];
    if (!dist) return [];

    return dist.slots || [];
}

//build set
function buildSet(setData, localeData) {
    const cardsMap = {};

    for (const content of setData.contents) {

        // filtra locale
        if (!content.locales.includes(TARGET_LOCALE)) continue;

        for (const entry of content.cards || []) {
            const cardId = entry.card;
            const rarity = entry.rarity;

            if (!cardsMap[cardId]) {
                cardsMap[cardId] = {
                    id: cardId,
                    name: cardMap[cardId]?.name || "UNKNOWN",
                    passwords: cardMap[cardId]?.passwords || [],
                    rarities: new Set()
                };
            }

            cardsMap[cardId].rarities.add(rarity);
        }
    }

    // slots (distribution)
    let slots = [];

    for (const content of setData.contents) {
        if (!content.locales.includes(TARGET_LOCALE)) continue;

        const dist = content.distribution; // 🔥 corrigido (era "distrobution")

        if (!dist) continue;

        if (dist === "preconstructed") {
            slots = []; // deck fixo
        } else {
            slots = parseDistribution(dist);
        }
    }

    return {
        title: setData.name?.en || "UNKNOWN",
        prefix: localeData.prefix,
        type: setData.type || null,
        date: localeData.date || null,
        cards: Object.values(cardsMap).map(c => ({
            id: c.id,
            name: c.name,
            passwords: c.passwords,
            rarities: Array.from(c.rarities)
        })),
        slots
    };
}

//main
function main() {
    if (!fs.existsSync('./output')) {
        fs.mkdirSync('./output');
    }

    let processed = 0;
    let matched = 0;
    const total = setIds.length;

    for (const setId of setIds) {
        processed++;

        const file = path.join(SETS_DIR, `${setId}.json`);
        if (!fs.existsSync(file)) continue;

        const setData = JSON.parse(fs.readFileSync(file, 'utf-8'));

        const localeData = setData.locales?.[TARGET_LOCALE];
        if (!localeData) continue;

        const prefix = localeData.prefix;

        if (!TARGET_PREFIXES.includes(prefix)) continue;

        const result = buildSet(setData, localeData);

        const safeName = result.title
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase();

        fs.writeFileSync(
            `./generated-sets/${safeName}.json`,
            JSON.stringify(result, null, 2)
        );

        matched++;

        console.log(
            `✅ ${matched} match | 📦 ${processed}/${total} processed | ${result.title}`
        );
    }

    console.log(`\n🎯 FINAL: ${matched} sets gerados de ${total}`);
}

main();