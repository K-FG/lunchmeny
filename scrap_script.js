const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const RESTAURANTS = [
    {
        id: 'partymakarna',
        name: 'Partymakarna',
        url: 'https://www.partymakarna.se/',
        location: 'Slakthusområdet, Stockholm'
    }
];

function getDayName() {
    const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    const today = new Date();
    return days[today.getDay()];
}

async function scrapePartymakarna(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        
        const dayName = getDayName();
        console.log(`Letar efter menyer för: ${dayName}`);
        
        // Hitta rätt dag i menyn
        let menuText = '';
        let foundDay = false;
        
        $('h4').each((i, elem) => {
            const heading = $(elem).text().trim();
            if (heading === dayName) {
                foundDay = true;
                // Samla alla list-items efter denna rubrik tills nästa h4
                let current = $(elem).next();
                const items = [];
                
                while (current.length && !current.is('h4')) {
                    if (current.is('ul') || current.is('ol')) {
                        current.find('li').each((j, li) => {
                            const text = $(li).text().trim();
                            if (text && !text.includes('####')) {
                                items.push('• ' + text);
                            }
                        });
                    }
                    current = current.next();
                }
                
                menuText = items.join('\n');
                return false; // Break the loop
            }
        });
        
        if (!foundDay || !menuText) {
            // Försök alternativ metod - leta i textinnehåll
            const fullText = $('body').text();
            const dayPattern = new RegExp(`${dayName}([\\s\\S]*?)(?=Måndag|Tisdag|Onsdag|Torsdag|Fredag|Lördag|Söndag|$)`, 'i');
            const match = fullText.match(dayPattern);
            
            if (match && match[1]) {
                const content = match[1]
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && 
                        line.length > 10 && 
                        !line.includes('####') &&
                        !line.match(/^\d{4}-\d{2}-\d{2}/)
                    )
                    .slice(0, 10) // Ta max 10 rätter
                    .map(line => '• ' + line);
                
                menuText = content.join('\n');
            }
        }
        
        return menuText || 'Ingen meny hittades för idag';
        
    } catch (error) {
        console.error(`Fel vid scraping av ${url}:`, error.message);
        throw error;
    }
}

async function scrapeAllMenus() {
    const results = [];
    
    for (const restaurant of RESTAURANTS) {
        console.log(`\nHämtar meny för ${restaurant.name}...`);
        
        try {
            let menu;
            
            // Anpassa scraper baserat på restaurang
            if (restaurant.id === 'partymakarna') {
                menu = await scrapePartymakarna(restaurant.url);
            } else {
                menu = 'Scraper inte implementerad för denna restaurang';
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
    console.log(`Dag: ${getDayName()}\n`);
    
    const menus = await scrapeAllMenus();
    
    const output = {
        lastUpdate: new Date().toISOString(),
        day: getDayName(),
        menus: menus
    };
    
    fs.writeFileSync('menus.json', JSON.stringify(output, null, 2));
    console.log('\n✓ menus.json har skapats/uppdaterats');
    
    // Skriv ut resultat
    console.log('\n=== Resultat ===');
    menus.forEach(menu => {
        console.log(`\n${menu.restaurant}:`);
        console.log(menu.menu.substring(0, 200) + '...');
    });
}

main().catch(console.error);