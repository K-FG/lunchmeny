const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const RESTAURANTS = [
    {
        id: 'partymakarna',
        name: 'Partymakarna',
        url: 'https://www.partymakarna.se/',
        location: 'Slakthusområdet, Stockholm',
        scraper: 'partymakarna'
    }
];

function getTargetDayName() {
    const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    const today = new Date();
    const dayIndex = today.getDay();
    
    // På helgen (lördag/söndag), visa måndagens meny
    if (dayIndex === 0) { // Söndag
        return 'Måndag';
    } else if (dayIndex === 6) { // Lördag
        return 'Måndag';
    }
    
    // Vardagar - visa dagens meny
    return days[dayIndex];
}

function getDisplayMessage() {
    const today = new Date();
    const dayIndex = today.getDay();
    
    if (dayIndex === 0 || dayIndex === 6) {
        return '(Visar måndagens meny)';
    }
    return '';
}

async function scrapePartymakarna(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const html = response.data;
        const $ = cheerio.load(html);
        
        const targetDay = getTargetDayName();
        console.log(`Letar efter meny för: ${targetDay}`);
        
        let menuText = '';
        
        // Metod 1: Leta efter h4 med veckodagar
        $('h4').each((i, elem) => {
            const heading = $(elem).text().trim();
            if (heading === targetDay) {
                // Samla alla textnoder efter denna rubrik tills nästa h4
                let current = $(elem);
                const items = [];
                
                // Gå igenom alla siblings efter h4 tills nästa h4
                current.nextAll().each((j, sibling) => {
                    if ($(sibling).is('h4')) {
                        return false; // Stoppa vid nästa h4
                    }
                    
                    const text = $(sibling).text().trim();
                    if (text && text.length > 10 && !text.includes('####')) {
                        // Ta inte med extra whitespace eller tomma rader
                        const lines = text.split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 10);
                        
                        lines.forEach(line => {
                            if (!items.some(item => item.includes(line))) {
                                items.push('• ' + line);
                            }
                        });
                    }
                });
                
                menuText = items.join('\n');
                return false; // Stoppa loopen
            }
        });
        
        // Metod 2: Om h4-metoden inte fungerade, sök i all text
        if (!menuText) {
            console.log('Försöker alternativ metod...');
            const fullText = $('body').text();
            
            // Hitta rätt dag och extrahera text till nästa dag
            const dayPattern = new RegExp(
                `####\\s*${targetDay}([\\s\\S]*?)(?=####\\s*(?:Måndag|Tisdag|Onsdag|Torsdag|Fredag|Lördag|Söndag)|$)`,
                'i'
            );
            const match = fullText.match(dayPattern);
            
            if (match && match[1]) {
                const content = match[1]
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => 
                        line.length > 15 && 
                        line.length < 200 &&
                        !line.includes('####') &&
                        !line.match(/^\d{4}-\d{2}-\d{2}/) &&
                        !line.includes('Veckans meny')
                    )
                    .slice(0, 10)
                    .map(line => '• ' + line);
                
                menuText = content.join('\n');
            }
        }
        
        const displayMsg = getDisplayMessage();
        if (displayMsg && menuText) {
            menuText = displayMsg + '\n\n' + menuText;
        }
        
        return menuText || 'Ingen meny hittades';
        
    } catch (error) {
        console.error(`Fel vid scraping:`, error.message);
        throw error;
    }
}

async function scrapeAllMenus() {
    const results = [];
    
    for (const restaurant of RESTAURANTS) {
        console.log(`\nHämtar meny för ${restaurant.name}...`);
        
        try {
            let menu;
            
            if (restaurant.scraper === 'partymakarna') {
                menu = await scrapePartymakarna(restaurant.url);
            } else {
                menu = 'Scraper inte implementerad';
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
