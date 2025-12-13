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
    },
    {
        id: 'mukbang',
        name: 'Mukbang',
        url: 'https://www.compass-group.se/restauranger-och-menyer/foodandco/mukbang/',
        location: 'Stockholm',
        scraper: 'compass'
    },
    {
        id: 'olearys',
        name: "O'Learys Tolv",
        url: 'https://olearys.com/sv-se/tolv-stockholm/food/lunchmeny/',
        location: 'Tolv Stockholm',
        scraper: 'olearys'
    },
    {
        id: 'blues',
        name: 'Blues Bar & Kök',
        url: 'https://bluesbarokok.gastrogate.com/lunch/',
        location: 'Stockholm',
        scraper: 'gastrogate'
    },
    {
        id: 'tillmarie',
        name: 'Till Marie',
        url: 'https://tillmarie.se/meny/#lunch',
        location: 'Stockholm',
        scraper: 'tillmarie'
    },
    {
        id: 'tastory',
        name: 'Tastory Hammarbybacken',
        url: 'https://www.compass-group.se/restauranger-och-menyer/tastory/tastory-hammarbybacken/',
        location: 'Hammarbybacken, Stockholm',
        scraper: 'compass'
    }
];

function getDayName() {
    const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    const today = new Date();
    return days[today.getDay()];
}

function getDayNameEnglish() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
        
        let menuText = '';
        let foundDay = false;
        
        $('h4').each((i, elem) => {
            const heading = $(elem).text().trim();
            if (heading === dayName) {
                foundDay = true;
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
                return false;
            }
        });
        
        if (!foundDay || !menuText) {
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
                    .slice(0, 10)
                    .map(line => '• ' + line);
                
                menuText = content.join('\n');
            }
        }
        
        return menuText || 'Ingen meny hittades för idag';
        
    } catch (error) {
        console.error(`Fel vid scraping:`, error.message);
        throw error;
    }
}

async function scrapeCompass(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        
        const dayName = getDayName();
        const items = [];
        
        // Compass Group använder olika strukturer, försök flera metoder
        // Metod 1: Leta efter dagens dag i rubriker
        $('h2, h3, h4, strong').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text.includes(dayName)) {
                let current = $(elem).parent().next();
                let count = 0;
                while (current.length && count < 5) {
                    const itemText = current.text().trim();
                    if (itemText && itemText.length > 5) {
                        items.push('• ' + itemText);
                    }
                    current = current.next();
                    count++;
                }
            }
        });
        
        // Metod 2: Sök i all text
        if (items.length === 0) {
            const fullText = $('body').text();
            const dayPattern = new RegExp(`${dayName}[\\s\\S]{0,500}`, 'i');
            const match = fullText.match(dayPattern);
            
            if (match) {
                const lines = match[0]
                    .split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 10 && l.length < 150)
                    .slice(1, 6);
                
                lines.forEach(line => items.push('• ' + line));
            }
        }
        
        return items.length > 0 ? items.join('\n') : 'Ingen meny hittades för idag';
        
    } catch (error) {
        console.error(`Fel vid scraping:`, error.message);
        throw error;
    }
}

async function scrapeOlearys(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        
        const items = [];
        
        // O'Learys har ofta lunchrätter i en lista
        $('.lunch-item, .menu-item, .dish').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text && text.length > 5) {
                items.push('• ' + text);
            }
        });
        
        // Om det inte finns specifika klasser, ta all text från main content
        if (items.length === 0) {
            $('main p, article p, .content p').each((i, elem) => {
                const text = $(elem).text().trim();
                if (text && text.length > 10 && text.length < 200) {
                    items.push('• ' + text);
                }
            });
        }
        
        return items.length > 0 ? items.slice(0, 10).join('\n') : 'Ingen lunchmeny hittades';
        
    } catch (error) {
        console.error(`Fel vid scraping:`, error.message);
        throw error;
    }
}

async function scrapeGastrogate(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        
        const dayName = getDayName();
        const dayNameEng = getDayNameEnglish();
        const items = [];
        
        // Gastrogate använder ofta veckodagar som rubriker
        $('h2, h3, h4, .day-title').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text.includes(dayName) || text.includes(dayNameEng)) {
                let current = $(elem).next();
                let count = 0;
                while (current.length && count < 8) {
                    if (current.is('p') || current.is('li') || current.is('div')) {
                        const itemText = current.text().trim();
                        if (itemText && itemText.length > 5 && !itemText.match(/^\d+\s*kr/i)) {
                            items.push('• ' + itemText);
                        }
                    }
                    current = current.next();
                    count++;
                }
            }
        });
        
        // Fallback: ta alla lunchrätter
        if (items.length === 0) {
            $('.menu-item, .lunch-dish, li').each((i, elem) => {
                const text = $(elem).text().trim();
                if (text && text.length > 10 && text.length < 200) {
                    items.push('• ' + text);
                }
            });
        }
        
        return items.length > 0 ? items.slice(0, 10).join('\n') : 'Ingen lunchmeny hittades';
        
    } catch (error) {
        console.error(`Fel vid scraping:`, error.message);
        throw error;
    }
}

async function scrapeTillMarie(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        
        const items = [];
        
        // Leta efter lunch-sektionen
        $('#lunch, .lunch-menu, [id*="lunch"]').each((i, section) => {
            $(section).find('p, li, .dish, .menu-item').each((j, elem) => {
                const text = $(elem).text().trim();
                if (text && text.length > 10 && text.length < 200 && !text.toLowerCase().includes('meny')) {
                    items.push('• ' + text);
                }
            });
        });
        
        // Fallback
        if (items.length === 0) {
            $('main .menu-item, article p').each((i, elem) => {
                const text = $(elem).text().trim();
                if (text && text.length > 10 && text.length < 200) {
                    items.push('• ' + text);
                }
            });
        }
        
        return items.length > 0 ? items.slice(0, 10).join('\n') : 'Ingen lunchmeny hittades';
        
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
            
            switch(restaurant.scraper) {
                case 'partymakarna':
                    menu = await scrapePartymakarna(restaurant.url);
                    break;
                case 'compass':
                    menu = await scrapeCompass(restaurant.url);
                    break;
                case 'olearys':
                    menu = await scrapeOlearys(restaurant.url);
                    break;
                case 'gastrogate':
                    menu = await scrapeGastrogate(restaurant.url);
                    break;
                case 'tillmarie':
                    menu = await scrapeTillMarie(restaurant.url);
                    break;
                default:
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
    
    console.log('\n=== Resultat ===');
    menus.forEach(menu => {
        console.log(`\n${menu.restaurant}:`);
        console.log(menu.menu.substring(0, 150) + '...');
    });
}

main().catch(console.error);
