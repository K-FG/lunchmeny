const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Areas define which restaurants are shown per location
const AREAS = {
    tyreso: {
        name: 'Tyresö',
        restaurants: [
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
        ]
    },
    marievik: {
        name: 'Marievik',
        restaurants: [
            {
                id: 'tantmaja',
                name: 'Tant Maja & Fröken Emilia',
                url: 'https://app.lunchzonen.se/api/widget-config/372ca510-2c0d-4d59-a011-64badecfe554',
                location: 'Marievik',
                price: '119 kr',
                scraper: 'lunchzonen',
                businessId: '372ca510-2c0d-4d59-a011-64badecfe554'
            },
            {
                id: 'bankomat',
                name: 'BankOmat Seaside',
                url: 'https://restaurangbankomat.se/lunch/',
                location: 'Marievik',
                price: '149 kr',
                scraper: 'bankomat'
            }
        ]
    }
};

// Default: scrape all areas (for GitHub Actions)
const ALL_RESTAURANTS = [
    ...AREAS.tyreso.restaurants,
    ...AREAS.marievik.restaurants
];

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
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

// Parses the day sections of Energikällan's page: an <h4> with the day name followed by
// <ol>/<p> siblings. The dish numbers are list markers, not text, so read the <li> elements.
function parseEnergikallan(html, targetDay) {
    const $ = cheerio.load(html);
    const heading = $('h4').filter((i, el) => $(el).text().trim().toLowerCase() === targetDay.toLowerCase()).first();
    if (!heading.length) return [];

    const section = heading.nextUntil('h4');
    const clean = el => $(el).text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    let nodes = section.filter('ol, ul').find('li').toArray();
    if (nodes.length === 0) nodes = section.filter('p').toArray();

    return nodes
        .map(clean)
        .filter(t => t.length > 5 && t.length < 200 && !isNoise(t))
        .map(t => '• ' + t);
}

async function scrapeEnergikallan(url) {
    const targetDay = getTargetDayName();
    console.log(`Hämtar: ${url} (letar efter ${targetDay})`);

    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const items = parseEnergikallan(response.data, targetDay);

    const displayMsg = getDisplayMessage();
    const menuText = items.slice(0, 15).join('\n');
    if (!menuText) return 'Ingen meny hittades';
    return displayMsg ? displayMsg + '\n\n' + menuText : menuText;
}

async function scrapeGreenBull(url) {
    const targetDay = getTargetDayName();
    const dayMarker = targetDay.toUpperCase();
    console.log(`Hämtar: ${url} (letar efter ${dayMarker})`);

    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header').remove();
    const text = $('body').text();

    const items = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let inTargetDay = false;
    const allDayMarkers = ['MÅNDAG', 'TISDAG', 'ONSDAG', 'TORSDAG', 'FREDAG', 'VARJE DAG'];

    for (const line of lines) {
        if (allDayMarkers.some(d => line === d || line.startsWith(d))) {
            inTargetDay = line.startsWith(dayMarker);
            continue;
        }
        if (inTargetDay) {
            if (allDayMarkers.some(d => line.startsWith(d)) || line.startsWith('Med reservation')) break;
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

// Parses BankOmat Seaside's Elementor page: an <h2> day heading widget followed by a
// price-list widget with one item per dish (title + description).
function parseBankomat(html, targetDay) {
    const $ = cheerio.load(html);
    const heading = $('h2').filter((i, el) => $(el).text().trim().toLowerCase() === targetDay.toLowerCase()).first();
    if (!heading.length) return [];

    const list = heading.closest('.elementor-widget').nextAll('[data-widget_type="wpr-price-list.default"]').first();
    const items = [];
    list.find('.wpr-price-list-item').each((i, el) => {
        const title = $(el).find('.wpr-price-list-title').first().text().replace(/\s+/g, ' ').trim();
        const description = $(el).find('.wpr-price-list-description').first().text().replace(/\s+/g, ' ').trim();
        if (title) items.push('• ' + title + (description ? ' -- ' + description : ''));
    });
    return items;
}

async function scrapeBankomat(url) {
    const targetDay = getTargetDayName();
    console.log(`Hämtar: ${url} (letar efter ${targetDay})`);

    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const items = parseBankomat(response.data, targetDay);

    const displayMsg = getDisplayMessage();
    const menuText = items.join('\n');
    if (!menuText) return 'Ingen meny hittades';
    return displayMsg ? displayMsg + '\n\n' + menuText : menuText;
}

// Lunchzonen API scraper (Tant Maja & Fröken Emilia)
async function scrapeLunchzonen(url, name) {
    console.log(`Hämtar: ${url} via browser-referer`);

    // Strategy 1: direct API with Referer (works from browsers)
    try {
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                'Accept': 'application/json,*/*;q=0.8',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
                'Referer': 'https://www.tantmajaochfrokenemilia.se/',
                'Origin': 'https://www.tantmajaochfrokenemilia.se',
            },
            timeout: 15000
        });
        if (resp.data && resp.data.success) {
            return formatLunchzonenMenu(resp.data);
        }
    } catch (e) {
        console.log(`  Direct API failed: ${e.response?.status || e.message}`);
    }

    // Strategy 2: scrape the public lunchzonen.se page
    try {
        const publicUrl = 'https://lunchzonen.se/restaurants/tant-maja-froken-emilia?tab=lunch';
        const resp = await axios.get(publicUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
            },
            timeout: 15000
        });
        const result = parseLunchzonenHTML(resp.data);
        if (result) return result;
    } catch (e) {
        console.log(`  Public page failed: ${e.message}`);
    }

    return 'Ingen meny hittades';
}

function formatLunchzonenMenu(data) {
    if (!data.success || !data.menu) return 'Ingen meny hittades';
    const targetDayName = getTargetDayName();
    const allDays = data.menu.allDays || [];
    const dayMap = { 'Måndag': 'Måndag', 'Tisdag': 'Tisdag', 'Onsdag': 'Onsdag', 'Torsdag': 'Torsdag', 'Fredag': 'Fredag' };
    const apiDayName = dayMap[targetDayName] || targetDayName;
    const dayData = allDays.find(d => d.dayName === apiDayName);
    if (!dayData || !dayData.items || dayData.items.length === 0) return 'Ingen meny hittades';

    const items = dayData.items.map(item => {
        let t = item.is_vegetarian || item.is_vegan ? 'Veg: ' : '';
        t += item.title;
        if (item.description) t += ' -- ' + item.description;
        return '• ' + t;
    });
    return items.join('\n');
}

// Parses lunchzonen.se's public page: each day is an <h3> whose section holds one
// <button data-dish-title> per dish, with the title in <h4> and the description in <p>.
function parseLunchzonenHTML(html) {
    const $ = cheerio.load(html);
    const targetDay = getTargetDayName();
    const heading = $('h3').filter((i, el) => $(el).text().trim() === targetDay).first();
    if (!heading.length) return null;

    const items = [];
    heading.parent().parent().find('button[data-dish-title]').each((i, el) => {
        const title = $(el).find('h4').first().text().trim();
        const description = $(el).find('p').first().text().trim();
        if (title) items.push('• ' + title + (description ? ' -- ' + description : ''));
    });
    return items.length > 0 ? items.join('\n') : null;
}

async function scrapeAllMenus(restaurants) {
    const results = [];
    for (const restaurant of restaurants) {
        console.log(`\nHämtar meny för ${restaurant.name}...`);
        try {
            let menu;
            if (restaurant.scraper === 'energikallan') {
                menu = await scrapeEnergikallan(restaurant.url);
            } else if (restaurant.scraper === 'greenbull') {
                menu = await scrapeGreenBull(restaurant.url);
            } else if (restaurant.scraper === 'bankomat') {
                menu = await scrapeBankomat(restaurant.url);
            } else if (restaurant.scraper === 'lunchzonen') {
                menu = await scrapeLunchzonen(restaurant.url, restaurant.name);
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

    // Scrape all restaurants (for GitHub Actions - generates full menus.json)
    const menus = await scrapeAllMenus(ALL_RESTAURANTS);

    const output = {
        lastUpdate: new Date().toISOString(),
        day: getTargetDayName(),
        menus: menus
    };

    // Write per-area files too
    for (const [areaKey, area] of Object.entries(AREAS)) {
        const areaMenus = menus.filter(m => area.restaurants.some(r => r.name === m.restaurant));
        const areaOutput = {
            lastUpdate: output.lastUpdate,
            day: output.day,
            area: area.name,
            menus: areaMenus
        };
        fs.writeFileSync(`menus-${areaKey}.json`, JSON.stringify(areaOutput, null, 2));
    }

    // Write combined file
    fs.writeFileSync('menus.json', JSON.stringify(output, null, 2));
    console.log('\n✓ menus.json + area files created');

    console.log('\n=== Resultat ===');
    menus.forEach(menu => {
        console.log(`\n${menu.restaurant}:`);
        console.log(menu.menu.substring(0, 500));
    });
}

main().catch(console.error);
