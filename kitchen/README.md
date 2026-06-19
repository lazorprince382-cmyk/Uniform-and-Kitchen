# Kitchen Management Web App

Smart Kitchen Management for **The Ocean of Knowledge School** — define meals with ingredient quantities (kg, g, L, ml, pcs, etc.), auto-deduct from inventory when meals are prepared, real-time cost and budget tracking, and stock alerts (restock & surplus).

## Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Database:** PostgreSQL

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **PostgreSQL**
   - Create a database, e.g. `kitchen_db`:
     ```bash
     createdb kitchen_db
     ```
   - Copy `.env.example` to `.env` and set your database URL:
     ```
     DATABASE_URL=postgresql://user:password@localhost:5432/kitchen_db
     ```
     Or use:
     ```
     PG_HOST=localhost
     PG_PORT=5432
     PG_USER=postgres
     PG_PASSWORD=yourpassword
     PG_DATABASE=kitchen_db
     ```

3. **Initialize the database**
   ```bash
   npm run init-db
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. Open **http://localhost:3000** in your browser.

## Features

- **Inventory:** Add ingredients with units (kg, g, L, ml, pcs, etc.), cost per unit, current stock, min/max levels.
- **Meals:** Define meals and attach ingredients with quantities; cost is computed from ingredient costs.
- **Prepare meal:** Choose a meal and portions; the app deducts ingredients from stock, records cost, and shows real-time cost before confirming.
- **Budget:** Set a budget period and amount; view spent, remaining, and usage %.
- **Alerts:** Low-stock (restock) and surplus (above max) alerts.

## Logo & branding

The app uses The Ocean of Knowledge School logo and colors (royal blue, deep red, white, black). The logo is in `public/assets/logo.png`.
