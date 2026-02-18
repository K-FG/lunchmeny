# GEMINI.md

## Project Overview

This project is a lunch menu scraper that fetches menus from various restaurants and displays them on a simple web page. The scraper is written in Node.js and uses `axios` and `cheerio` to fetch and parse HTML. The menus are saved to a `menus.json` file, which is then displayed by a static `index.html` page. The scraping process is automated using GitHub Actions, which runs daily.

## Building and Running

To build and run this project, you need to have Node.js and npm installed.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/K-FG/lunchmeny.git
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the scraper:**
    ```bash
    node scrape-menus.js
    ```
    This will generate the `menus.json` file.

4.  **Open the `index.html` file in your browser:**
    You can open the `index.html` file directly in your browser to see the menus.

## Development Conventions

*   **Adding a new restaurant:**
    1.  Add a new restaurant object to the `RESTAURANTS` array in `scrape-menus.js`.
    2.  Implement a new scraper function for the restaurant. This function should take the restaurant's URL as input and return the menu as a string.
        *   **Note:** If the restaurant's menu page is dynamically rendered using client-side JavaScript (e.g., a Next.js application), it might not be possible to scrape it using `axios` and `cheerio`. In such cases, a headless browser (like Puppeteer or Playwright) would be required, which is outside the current scope of this project.
    3.  Update the `scrapeAllMenus` function to call the new scraper function.
    4.  Add the new restaurant to the `RESTAURANTS` array in `index.html`.

*   **Code style:**
    *   The project uses a consistent code style. Please follow the existing style when adding new code.
    *   Use descriptive variable and function names.
    *   Add comments to explain complex logic.
