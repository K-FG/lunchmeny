# 🍽️ Dagens Lunchmenyer

En automatisk lunchmeny-aggregator som uppdateras varje dag kl 07:00 via GitHub Actions.

## 🚀 Snabbstart

### 1. Skapa ett nytt repository

1. Gå till https://github.com/new
2. Namnge det: `lunchmeny` (eller valfritt namn)
3. Välj **Public** (för GitHub Pages)
4. Klicka **Create repository**

### 2. Ladda upp filerna

Skapa följande filer i ditt repository:

#### **index.html**
Kopiera innehållet från den första artifakten ("index.html - Lunchmeny Webbsida")

#### **scrape-menus.js**
Kopiera innehållet från artifakten ("scrape-menus.js")

#### **.github/workflows/update-menus.yml**
1. Skapa mappen `.github/workflows/` i ditt repo
2. Kopiera innehållet från artifakten ("update-menus.yml")

#### **package.json**
Skapa en fil med detta innehåll:
```json
{
  "name": "lunchmeny-scraper",
  "version": "1.0.0",
  "dependencies": {
    "axios": "^1.6.0",
    "cheerio": "^1.0.0-rc.12"
  }
}
```

### 3. Aktivera GitHub Pages

1. Gå till ditt repository på GitHub
2. Klicka på **Settings**
3. Scrolla ner till **Pages** (vänster meny)
4. Under **Source**, välj **Deploy from a branch**
5. Välj **main** branch och **/ (root)**
6. Klicka **Save**

Din sida kommer att vara tillgänglig på:
```
https://K-FG.github.io/lunchmeny/
```
(byt ut `lunchmeny` om du valde ett annat namn)

### 4. Testa automatisk uppdatering

1. Gå till **Actions** i ditt repository
2. Klicka på **Update Lunch Menus** workflow
3. Klicka på **Run workflow** → **Run workflow**
4. Efter ~1 minut, ladda om din webbsida - menyerna ska visas!

## ⚙️ Konfiguration

### Lägg till fler restauranger

Redigera både `index.html` och `scrape-menus.js`:

```javascript
const RESTAURANTS = [
    {
        id: 'partymakarna',
        name: 'Partymakarna',
        url: 'https://www.partymakarna.se/',
        location: 'Slakthusområdet, Stockholm'
    },
    {
        id: 'nyrestaurang',
        name: 'Din Restaurang',
        url: 'https://dinrestaurang.se/',
        location: 'Din Stadsdel, Stockholm'
    }
];
```

**OBS:** För nya restauranger måste du också lägga till en scraping-funktion i `scrape-menus.js` eftersom olika webbplatser har olika struktur.

### Ändra uppdateringstid

I `.github/workflows/update-menus.yml`, ändra cron-schemat:

```yaml
- cron: '0 6 * * *'  # 06:00 UTC = 07:00 svensk tid (vintertid)
```

## 📁 Filstruktur

```
lunchmeny/
├── .github/
│   └── workflows/
│       └── update-menus.yml    # GitHub Actions automation
├── index.html                  # Webbsidan
├── scrape-menus.js            # Scraping-script
├── package.json               # Node.js dependencies
├── menus.json                 # Genererad data (skapas automatiskt)
└── README.md                  # Denna fil
```

## 🔧 Felsökning

### Menyerna uppdateras inte
1. Kontrollera **Actions** i ditt repo - har workflowen körts?
2. Klicka på senaste körningen för att se loggar
3. Om den misslyckades, läs felmeddelandet

### Sidan visar "404"
1. Kontrollera att GitHub Pages är aktiverat
2. Vänta 2-3 minuter efter aktivering
3. Kontrollera att `index.html` ligger i root-mappen

### "Inväntar data" visas
1. Kör workflowen manuellt första gången
2. Kontrollera att `menus.json` skapats i ditt repo

## 📝 Anpassa scraper för nya restauranger

När du lägger till en ny restaurang måste du skapa en scraping-funktion. Exempel:

```javascript
async function scrapeNyRestaurang(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Hitta menyn på sidan - detta varierar per webbplats
    const menuItems = [];
    $('.menu-item').each((i, elem) => {
        menuItems.push('• ' + $(elem).text().trim());
    });
    
    return menuItems.join('\n');
}
```

## 📱 Dela sidan

Din lunchmeny-sida är publik och kan delas med:
```
https://K-FG.github.io/lunchmeny/
```

## 💡 Tips

- Första gången tar det ~2-3 minuter innan sidan är tillgänglig
- Workflowen körs automatiskt varje dag kl 07:00
- Du kan också köra den manuellt när som helst
- `menus.json` uppdateras automatiskt och commitas till ditt repo

## 🤝 Bidra

Har du förbättringsförslag eller vill lägga till support för fler restauranger? Öppna en issue eller pull request!

## 📄 Licens

MIT License - använd fritt!
