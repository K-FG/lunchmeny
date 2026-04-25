const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const RESTAURANTS = [
    {
        id: 'partymakarna',
        name: 'Partymakarna',
        url: 'https://www.partymakarna.se/veckans/',
        location: 'Slakthusområdet, Stockholm',
        scraper: 'partymakarna'
    },
    {
        id: 'blues',
        name: 'Blues Restaurang',
        url: 'https://bluesrestaurang.se/veckans-lunchmeny',
        location: 'Stockholm',
        scraper: 'blues'
    }
];

function getTargetDayName() {
    const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    const today = new Date();
    const dayIndex = today.getDay();

    // På helgen, visa fredagens meny (senaste vardagen)
    if (dayIndex === 0 || dayIndex === 6) {
        return 'Fredag';
    }

    return days[dayIndex];
}

function getDisplayMessage() {
    const today = new Date();
    const dayIndex = today.getDay();

    if (dayIndex === 0 || dayIndex === 6) {
        return '(Visar fredagens meny)';
    }
    return '';
}

const DAY_SLUGS = {
    'Måndag':  'mandag',
    'Tisdag':  'tisdag',
    'Onsdag':  'onsdag',
    'Torsdag': 'torsdag',
    'Fredag':  'fredag',
};

const NOISE_WORDS = ['cookie', 'gdpr', 'policy', 'instagram', 'facebook', 'kontakt', 'om oss', 'copyright', 'följ oss'];

function isNoise(text) {
    const lower = text.toLowerCase();
    return NOISE_WORDS.some(w => lower.includes(w));
}

async function scrapePartymakarna(baseUrl) {
    const targetDay = getTargetDayName();
    const slug = DAY_SLUGS[targetDay] || 'mandag';
    const url = baseUrl + slug + '/';

    console.log(`Hämtar: ${url}`);

    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });

    const $ = cheerio.load(response.data);

    // Remove nav, header, footer, sidebar noise
    $('nav, header, footer, aside, script, style, .wp-block-navigation').remove();

    const items = [];

    // Try standard WordPress/Gutenberg content containers
    const contentSelectors = [
        '.entry-content',
        '.post-content',
        '.wp-block-post-content',
        'article',
        'main',
        '.content',
        '#content',
        'body',
    ];

    for (const sel of contentSelectors) {
        const container = $(sel);
        if (!container.length) continue;

        container.find('p, li').each((_, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 10 && text.length < 250 && !isNoise(text)) {
                items.push('• ' + text);
            }
        });

        if (items.length > 0) break;
    }

    const displayMsg = getDisplayMessage();
    const menuText = items.slice(0, 12).join('\n');

    if (!menuText) return 'Ingen meny hittades';
    return displayMsg ? displayMsg + '\n\n' + menuText : menuText;
}



const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
};

const BLUES_DAY_IDS = {
    'Måndag':  'lunch_mån',
    'Tisdag':  'lunch_tis',
    'Onsdag':  'lunch_ons',
    'Torsdag': 'lunch_tor',
    'Fredag':  'lunch_fre',
};

async function scrapeBlues(url) {
    const targetDay = getTargetDayName();
    const sectionId = BLUES_DAY_IDS[targetDay];
    console.log(`Hämtar: ${url} (letar efter #${sectionId})`);

    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data);

    const section = $(`[id="${sectionId}"]`);
    const items = [];

    if (section.length) {
        // Get all text content from the section, split on sentence boundaries
        const rawText = section.text().replace(/\s+/g, ' ').trim();
        // Remove the day heading itself (e.g. "fredag") from the start
        const cleaned = rawText.replace(/^(måndag|tisdag|onsdag|torsdag|fredag)\s*/i, '');
        // Split on common separators: period+space, newline, or long runs of whitespace
        const sentences = cleaned.split(/\.\s+|\n+/).map(s => s.trim()).filter(s => s.length > 8 && !isNoise(s));
        sentences.forEach(s => items.push('• ' + s));
    }

    const displayMsg = getDisplayMessage();
    const menuText = items.slice(0, 12).join('\n');
    if (!menuText) return 'Ingen meny hittades';
    return displayMsg ? displayMsg + '\n\n' + menuText : menuText;
}

async function scrapeAllMenus() {
    const results = [];

    for (const restaurant of RESTAURANTS) {
        console.log(`\nHämtar meny för ${restaurant.name}...`);

        try {
            let menu;

            if (restaurant.scraper === 'partymakarna') {
                menu = await scrapePartymakarna(restaurant.url);
            } else if (restaurant.scraper === 'blues') {
                menu = await scrapeBlues(restaurant.url);
            } else {
                throw new Error(`Scraper not implemented for ${restaurant.name}`);
            }

            results.push({
                restaurant: restaurant.name,
                location: restaurant.location,
                menu: menu,
                status: 'success'
            });

            console.log(`✓ ${restaurant.name}: Meny hämtad`);

        } catch (error) {
            results.push({
                restaurant: restaurant.name,
                location: restaurant.location,
                menu: 'Kunde inte hämta meny',
                status: 'error',
                error: error.message
            });

            console.log(`✗ ${restaurant.name}: Fel - ${error.message}`);
        }
    }

    return results;
}

async function main() {
    console.log('=== Lunch Menu Scraper ===');
    console.log(`Datum: ${new Date().toLocaleString('sv-SE')}`);
    console.log(`Måldag: ${getTargetDayName()}\n`);

    const menus = await scrapeAllMenus();

    const output = {
        lastUpdate: new Date().toISOString(),
        day: getTargetDayName(),
        menus: menus
    };

    fs.writeFileSync('menus.json', JSON.stringify(output, null, 2));
    console.log('\n✓ menus.json har skapats/uppdaterats');

    console.log('\n=== Resultat ===');
    menus.forEach(menu => {
        console.log(`\n${menu.restaurant}:`);
        console.log(menu.menu.substring(0, 300));
    });
}

main().catch(console.error);
