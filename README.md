# Market Board

Self-refreshing dashboard: your positions, a top-10 ranking by trailing return (window toggle), and a 15-ticker watchlist with 1-year charts. Prices come from Yahoo Finance through a small Netlify Function, so there is no API key to manage.

## Deploy (pick one)

**A. GitHub → Netlify (most reliable, auto-redeploys on edits)**
1. Push this folder to a GitHub repo.
2. In Netlify: Add new site → Import an existing project → pick the repo. Leave build command empty, publish directory `.`. Deploy.

**B. Netlify CLI from this folder**
```
npx netlify-cli login
npx netlify-cli deploy --prod
```
(pick "Create & configure a new site", publish directory `.`)

**C. Drag and drop** the folder onto app.netlify.com/drop. This usually works, but if `/api/quotes` returns 404 after deploy, the function was not bundled; use A or B.

## Customize
Open `index.html` and edit the CONFIG block at the top of the script: `HOLDINGS`, `WATCHLIST`, `RANK_ONLY`. Any Yahoo Finance ticker works (mutual funds like FXAIX included). The cash amount is editable on the page and remembered in your browser.

## Notes
- Data is cached at Netlify's edge for 5 minutes; the page re-fetches every 5 minutes and when you come back to the tab.
- If Yahoo blocks a request, the function falls back to Stooq for that ticker.
- Returns are price returns using adjusted closes. Past performance only; not investment advice.
