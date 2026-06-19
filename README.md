# The Ocean of Knowledge School — Uniform Desk

An in-school uniform inventory system for **The Ocean of Knowledge School** (*Up With Skills*). Staff manage stock and issue uniforms to **children** (collected by parents). Built with **Node.js**, **PostgreSQL**, and **React**.

![Dashboard](https://via.placeholder.com/800x400?text=School+Uniform+Inventory+Dashboard)

## Features

- **Dashboard** — Key metrics, donut chart by category, low-stock alerts, recent orders, inventory by category, stock movement
- **Inventory** — Filter and view all stock items
- **Categories** — Uniform Store, Sports Wear, Track Suits, Socks
- **Products** — SKU, pricing, stock levels with CRUD
- **Stock In / Stock Out** — Record transactions with real-time stock updates
- **Issuances** — Issue uniforms to parents for a specific child; stock deducts automatically
- **Returns** — Parents returning items; stock is restocked
- **Parents & Students** — Register parents and link enrolled children (class, section)
- **Reports** — Stock, Collections (fees from parents), and Low Stock
- **System** — Users, Roles & Permissions (RBAC), Settings

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL](https://www.postgresql.org/) 14+

## Setup

### 1. Create the database

```sql
CREATE DATABASE toks_uniform;
```

### 2. Configure environment

Copy `server/.env.example` to `server/.env` and update your PostgreSQL connection:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/toks_uniform
```

### 3. Install dependencies

```bash
npm run install:all
```

### 4. Initialize database (schema + seed data)

```bash
npm run db:setup
npm run db:migrate-school
npm run db:seed-school
```

### 5. Start the application

```bash
npm run dev
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000

### Login credentials

| Email            | Password  |
|------------------|-----------|
| admin@toks.com   | admin123  |

## Project Structure

```
├── client/          # React + Vite + Tailwind CSS frontend
├── server/          # Express + PostgreSQL API
│   └── src/
│       ├── db/      # Schema, seed, setup
│       └── routes/  # REST API endpoints
└── package.json     # Root scripts
```

## API Endpoints

| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| POST   | /api/auth/login             | User login               |
| GET    | /api/dashboard/stats        | Dashboard metrics        |
| GET    | /api/products               | List products            |
| POST   | /api/stock/in               | Record stock in          |
| POST   | /api/stock/out              | Record stock out         |
| POST   | /api/orders                 | Create order             |
| PATCH  | /api/orders/:id/status      | Update order status      |
| GET    | /api/reports/low-stock      | Low stock report         |

## Tech Stack

- **Backend:** Node.js, Express, pg, JWT, bcrypt
- **Database:** PostgreSQL
- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide Icons
