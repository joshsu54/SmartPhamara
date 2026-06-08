const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large requests for base64 images

const db = new sqlite3.Database('./database.sqlite', sqlite3.OPEN_READWRITE, (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to the SQLite database.');
});

// GET /api/inventory
app.get('/api/inventory', (req, res) => {
    db.all(`SELECT * FROM inventory`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const data = rows.map(r => ({...r, rxOnly: r.rxOnly === 1}));
        res.json(data);
    });
});

// GET /api/requests
app.get('/api/requests', (req, res) => {
    db.all(`SELECT * FROM requests`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const data = rows.map(r => {
            const out = {...r, from: r.from_station, to: r.to_station, time: r.date};
            delete out.from_station;
            delete out.to_station;
            delete out.date;
            return out;
        });
        res.json(data);
    });
});

// POST /api/syncInventory
app.post('/api/syncInventory', (req, res) => {
    const inventory = req.body;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare(`INSERT OR REPLACE INTO inventory (drugCode, drugChineseName, drugEnglishName, price, rxOnly, atcCode, dosageForm, singleCompoundFlag, manufacturer, temperatureReq, stock_DEYI, stock_FUXING_HC, stock_KAO_CLINIC, stock_SHISHENG_FX, stock_GREAT_TREE, stock_SHISHENG_KZ, stock_ZISHENG) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const item of inventory) {
            stmt.run(
                item.drugCode, item.drugChineseName, item.drugEnglishName, item.price || 0, item.rxOnly ? 1 : 0, item.atcCode, item.dosageForm, item.singleCompoundFlag, item.manufacturer, item.temperatureReq,
                item.stock_DEYI || 0, item.stock_FUXING_HC || 0, item.stock_KAO_CLINIC || 0, item.stock_SHISHENG_FX || 0, item.stock_GREAT_TREE || 0, item.stock_SHISHENG_KZ || 0, item.stock_ZISHENG || 0
            );
        }
        stmt.finalize();
        db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ status: 'success' });
        });
    });
});

// POST /api/syncRequests
app.post('/api/syncRequests', (req, res) => {
    const requests = req.body;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        // Clear requests table and re-insert to keep it perfectly synced with frontend
        db.run('DELETE FROM requests');
        const stmt = db.prepare(`INSERT INTO requests (id, date, from_station, to_station, item, qty, status, targetTime, relatedReserveId, dispatchTime, logisticsCondition, payment, pickupTime, paidStatus, price, prescriptionImg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const reqItem of requests) {
            stmt.run(reqItem.id, reqItem.date || reqItem.time, reqItem.from, reqItem.to, reqItem.item, reqItem.qty, reqItem.status, reqItem.targetTime || null, reqItem.relatedReserveId || null, reqItem.dispatchTime || null, reqItem.logisticsCondition || null, reqItem.payment || null, reqItem.pickupTime || null, reqItem.paidStatus || null, reqItem.price || 0, reqItem.prescriptionImg || null);
        }
        stmt.finalize();
        db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ status: 'success' });
        });
    });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
