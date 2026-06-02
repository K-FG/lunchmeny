const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const RESTAURANTS = [
    {
        id: 'energikallan',
        name: 'Restaurang Nya Energikällan',
        url: 'https://www.xn--energikllan-r8a.net',
        location: 'Tyresö',
        price: '138 kr',
        scraper: 'energikallan'
    },
    {
        id: 'greenbull',
        name: 'Restaurang Green Bull',
        url: 'https://restauranggreenbull.se/lunch',
        location: 'Tyresö',
        price: '149 kr (139 kr pensionärer)',
        scraper: 'greenbull'
    }
];

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
};

function getTargetDayName() {
    const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    const today = new Date();
    const dayIndex = today.getDay();
    if (dayIndex === 0 || dayIndex === 6) return 'Fredag';
    return days[dayIndex];
}

function getDisplayMessage() {
    const today = new Date();
    const dayIndex = today.getDay();
    if (dayIndex === 0 || dayIndex === 6) return '(Visar fredagens meny)';
    return '';
}

const NOISE_WORDS = ['cookie', 'gdpr', 'policy', 'instagram', 'facebook', 'kontakt', 'om oss', 'copyright', 'följ oss', 'samtycker', 'personlig'];

function isNoise(text) {
    const lower = text.toLowerCase();
    return NOISE_WORDS.some(w => lower.includes(w));
}

// Energikällan: all text är sammanslagen i få radar
// Format: "Måndag1.Jägerschnitzel...2.Kokt lunchkorv...Tisdag1.Stekt laxfilé..."
// Vi använder regex för att hitta dagens sektion och extrahera numrerade rätter
async function scrapeEnergikallan(url) {
    const targetDay = getTargetDayName();
    console.log(`Hämtar: ${url} (letar efter ${targetDay})`);

    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    // Build regex to find target day section
    // Days are: Måndag, Tisdag, Onsdag, Torsdag, Fredag
    const allDays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];
    const targetIdx = allDays.indexOf(targetDay);
    const nextDay = allDays[targetIdx + 1] || null;

    // Extract text between target day and next day
    let section = '';
    const dayPattern = new RegExp(targetDay.replace(/[åäö]/g, c => c) + '(.*?)(?=' + (nextDay || 'Måndag') + '|$)', 's');
    const match = text.match(dayPattern);
    if (match) {
        section = match[1];
    }

    if (!section) return 'Ingen meny hittades';

    // Split on numbered items: "1.", "2.", "3." etc
    const items = [];
    const parts = section.split(/(?=\d+\.)/);
    for (const part of parts) {
        const cleaned = part.replace(/^\d+\.\s*/, '').trim();
        if (cleaned.length > 5 && cleaned.length < 200 && !isNoise(cleaned)) {
            items.push('• ' + cleaned);
        }
    }

    const displayMsg = getDisplayMessage();
    const menuText = items.slice(0, 15).join('\n');
    if (!menuText) return 'Ingen meny hittades';
    return displayMsg ? displayMsg + '\n\n' + menuText : menuText;
}

// Green Bull: meny med vecka/dag struktur, rubriker MÅNDAG/TISDAG etc
// Rätter inleds med ○ symbol
async function scrapeGreenBull(url) {
    const targetDay = getTargetDayName();
    const dayMarker = targetDay.toUpperCase();
    console.log(`Hämtar: ${url} (letar efter ${dayMarker})`);

    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const html = response.data;

    const $ = cheerio.load(html);
    $('script, style, nav, footer, header').remove();
    const text = $('body').text();

    const items = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let inTargetDay = false;
    const allDayMarkers = ['MÅNDAG', 'TISDAG', 'ONSDAG', 'TORSDAG', 'FREDAG', 'VARJE DAG'];

    for (const line of lines) {
        // Check for day markers
        if (allDayMarkers.some(d => line === d || line.startsWith(d))) {
            inTargetDay = line.startsWith(dayMarker);
            continue;
        }

        if (inTargetDay) {
            // Stop at next day section or end markers
            if (allDayMarkers.some(d => line.startsWith(d)) || line.startsWith('Med reservation')) {
                break;
            }

            // Clean up the line - remove leading ○ or bullet markers
            let cleaned = line.replace(/^[○\*\-•]\s*/, '').trim();

            if (cleaned.length > 5 && cleaned.length < 300 && !isNoise(cleaned)) {
                items.push('• ' + cleaned);
            }
        }
    }

    const displayMsg = getDisplayMessage();
    const menuText = items.slice(0, 15).join('\n');
    if (!menuText) return 'Ingen meny hittades';
    return displayMsg ? displayMsg + '\n\n' + menuText : menuText;
}

async function scrapeAllMenus() {
    const results = [];

    for (const restaurant of RESTAURANTS) {
        console.log(`\nHämtar meny för ${restaurant.name}...`);

        try {
            let menu;
            if (restaurant.scraper === 'energikallan') {
                menu = await scrapeEnergikallan(restaurant.url);
            } else if (restaurant.scraper === 'greenbull') {
                menu = await scrapeGreenBull(restaurant.url);
            } else {
                throw new Error(`Scraper not implemented for ${restaurant.name}`);
            }

            results.push({
                restaurant: restaurant.name,
                location: restaurant.location,
                price: restaurant.price,
                menu: menu,
                status: 'success'
            });
            console.log(`✓ ${restaurant.name}: Meny hämtad`);
        } catch (error) {
            results.push({
                restaurant: restaurant.name,
                location: restaurant.location,
                price: restaurant.price,
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
        console.log(menu.menu.substring(0, 500));
    });
}

main().catch(console.error);
