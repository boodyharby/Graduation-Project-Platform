-- Eco-Park AI v5.0 Standalone SQLite Schema
CREATE TABLE IF NOT EXISTS parking_spots (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    zone TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('available', 'occupied', 'reserved')),
    has_charger INTEGER NOT NULL DEFAULT 0,
    charger_kw INTEGER NOT NULL DEFAULT 0,
    vehicle_type TEXT,
    vehicle_plate TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    ticket_code TEXT UNIQUE NOT NULL,
    branch TEXT NOT NULL,
    spot_id TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    fee_sar REAL NOT NULL DEFAULT 0,
    carbon_tax_sar REAL NOT NULL DEFAULT 0,
    points_earned INTEGER NOT NULL DEFAULT 0,
    co2_saved_kg REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS carbon_transactions (
    id TEXT PRIMARY KEY,
    description_ar TEXT NOT NULL,
    description_en TEXT NOT NULL,
    points INTEGER NOT NULL,
    co2_kg REAL NOT NULL,
    tx_type TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
