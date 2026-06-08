const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('./database.sqlite');

// Load mock data
const mockDataRaw = fs.readFileSync('./mock_nhi_data.json', 'utf8');
const mockData = JSON.parse(mockDataRaw);

// Add custom logic from script.js to inject extra medicines if missing
let inventoryList = mockData.inventory || [];
if (!inventoryList.some(item => item.drugCode === 'B023245199')) {
    inventoryList.push(
        { drugCode: 'B023245199', drugChineseName: '撣??祆迫????(Ibuprofen) - ?訾撮?蹂誨??, drugEnglishName: 'Ibuprofen 400mg', price: 20, rxOnly: false, atcCode: 'N02BE99', dosageForm: '????, singleCompoundFlag: '?格', manufacturer: 'AstraZeneca', temperatureReq: 'Room', expiryDays: 190, batchNo: 'B33842', stock_DEYI: 25, stock_FUXING_HC: 20, stock_KAO_CLINIC: 10, stock_SHISHENG_FX: 90, stock_GREAT_TREE: 100, stock_SHISHENG_KZ: 70, stock_ZISHENG: 50 },
        { drugCode: 'I012345699', drugChineseName: '蝢撟喟??拚? (Metformin) - 蝟倏?隡潭隞?', drugEnglishName: 'Metformin 500mg', price: 10, rxOnly: true, atcCode: 'A10BA02', dosageForm: '??', singleCompoundFlag: '?格', manufacturer: 'Sandoz', temperatureReq: 'Room', expiryDays: 160, batchNo: 'B78129', stock_DEYI: 8, stock_FUXING_HC: 10, stock_KAO_CLINIC: 5, stock_SHISHENG_FX: 100, stock_GREAT_TREE: 80, stock_SHISHENG_KZ: 60, stock_ZISHENG: 40 }
    );
}

if (!inventoryList.some(item => item.drugCode === 'A07DA03100')) {
    inventoryList.push(
        { drugCode: 'A07DA03100', drugChineseName: '璅?撖扯???(Loperamide) - 蝺抵圾?寧?, drugEnglishName: 'Loperamide 2mg', price: 10, rxOnly: false, atcCode: 'A07DA03', dosageForm: '????, singleCompoundFlag: '?格', manufacturer: 'Teva', temperatureReq: 'Room', expiryDays: 300, batchNo: 'L99821', stock_DEYI: 30, stock_SHISHENG_FX: 80, stock_GREAT_TREE: 90, stock_SHISHENG_KZ: 50, stock_ZISHENG: 40 },
        { drugCode: 'M02AA13100', drugChineseName: '隡?祆雯 (Ibuprofen) - ?咱?貊?瘥??, drugEnglishName: 'Ibuprofen Suspension 20mg/ml', price: 50, rxOnly: false, atcCode: 'M02AA13', dosageForm: '???瘨?, singleCompoundFlag: '?格', manufacturer: 'YungShin', temperatureReq: 'Room', expiryDays: 150, batchNo: 'I22014', stock_DEYI: 15, stock_SHISHENG_FX: 40, stock_GREAT_TREE: 60, stock_SHISHENG_KZ: 30, stock_ZISHENG: 20 },
        { drugCode: 'R05DA09100', drugChineseName: '?急??(Dextromethorphan) - ?桀蟡', drugEnglishName: 'Dextromethorphan 15mg', price: 12, rxOnly: false, atcCode: 'R05DA09', dosageForm: '??', singleCompoundFlag: '?格', manufacturer: 'Purzer', temperatureReq: 'Room', expiryDays: 400, batchNo: 'D34521', stock_DEYI: 50, stock_SHISHENG_FX: 150, stock_GREAT_TREE: 200, stock_SHISHENG_KZ: 120, stock_ZISHENG: 80 },
        { drugCode: 'R06AB04100', drugChineseName: '??撖?(Chlorpheniramine) - ????, drugEnglishName: 'Chlorpheniramine 4mg', price: 8, rxOnly: false, atcCode: 'R06AB04', dosageForm: '??', singleCompoundFlag: '?格', manufacturer: 'Standard', temperatureReq: 'Room', expiryDays: 360, batchNo: 'C88732', stock_DEYI: 60, stock_SHISHENG_FX: 180, stock_GREAT_TREE: 220, stock_SHISHENG_KZ: 140, stock_ZISHENG: 90 },
        { drugCode: 'C08CA01100', drugChineseName: '???(Amlodipine) - 擃?憯??, drugEnglishName: 'Norvasc 5mg', price: 30, rxOnly: true, atcCode: 'C08CA01', dosageForm: '??', singleCompoundFlag: '?格', manufacturer: 'Pfizer', temperatureReq: 'Room', expiryDays: 200, batchNo: 'N55234', stock_DEYI: 10, stock_SHISHENG_FX: 45, stock_GREAT_TREE: 60, stock_SHISHENG_KZ: 35, stock_ZISHENG: 25 },
        { drugCode: 'C10AA07100', drugChineseName: '??憒?(Rosuvastatin) - ?????, drugEnglishName: 'Crestor 10mg', price: 45, rxOnly: true, atcCode: 'C10AA07', dosageForm: '??', singleCompoundFlag: '?格', manufacturer: 'AstraZeneca', temperatureReq: 'Room', expiryDays: 250, batchNo: 'R12934', stock_DEYI: 12, stock_SHISHENG_FX: 50, stock_GREAT_TREE: 70, stock_SHISHENG_KZ: 40, stock_ZISHENG: 30 }
    );
}

// Deduplicate inventory as we did in script.js
let uniqueDb = {};
inventoryList.forEach(item => {
    if (!uniqueDb[item.drugCode]) {
        uniqueDb[item.drugCode] = { ...item };
    } else {
        ['DEYI', 'SHISHENG_FX', 'GREAT_TREE', 'SHISHENG_KZ', 'ZISHENG', 'FUXING_HC', 'KAO_CLINIC'].forEach(st => {
            let field = 'stock_' + st;
            uniqueDb[item.drugCode][field] = (uniqueDb[item.drugCode][field] || 0) + (item[field] || 0);
        });
    }
});
inventoryList = Object.values(uniqueDb);

// Initial Mock Requests
const initialRequests = [
    { id: 'REQ-1001', date: '2026-06-05', from: 'FUXING_HC', to: 'DEYI', item: '??????(Tamiflu) - 瘚??刻', qty: 10, status: 'approved' },
    { id: 'REQ-1002', date: '2026-06-06', from: 'KAO_CLINIC', to: 'GREAT_TREE', item: '撣??祆迫????(Ibuprofen) - ?訾撮?蹂誨??, qty: 5, status: 'pending' }
];

db.serialize(() => {
    // 1. Create inventory table
    db.run(`DROP TABLE IF EXISTS inventory`);
    db.run(`CREATE TABLE inventory (
        drugCode TEXT PRIMARY KEY,
        drugChineseName TEXT,
        drugEnglishName TEXT,
        price INTEGER,
        rxOnly INTEGER,
        atcCode TEXT,
        dosageForm TEXT,
        singleCompoundFlag TEXT,
        manufacturer TEXT,
        temperatureReq TEXT,
        stock_DEYI INTEGER DEFAULT 0,
        stock_FUXING_HC INTEGER DEFAULT 0,
        stock_KAO_CLINIC INTEGER DEFAULT 0,
        stock_SHISHENG_FX INTEGER DEFAULT 0,
        stock_GREAT_TREE INTEGER DEFAULT 0,
        stock_SHISHENG_KZ INTEGER DEFAULT 0,
        stock_ZISHENG INTEGER DEFAULT 0
    )`);

    // 2. Create requests table
    db.run(`DROP TABLE IF EXISTS requests`);
    db.run(`CREATE TABLE requests (
        id TEXT PRIMARY KEY,
        date TEXT,
        from_station TEXT,
        to_station TEXT,
        item TEXT,
        qty INTEGER,
        status TEXT,
        targetTime TEXT,
        relatedReserveId TEXT,
        dispatchTime TEXT,
        logisticsCondition TEXT,
        payment TEXT,
        pickupTime TEXT,
        paidStatus TEXT,
        price INTEGER,
        prescriptionImg TEXT
    )`);

    // Insert Inventory
    const stmt = db.prepare(`INSERT INTO inventory (drugCode, drugChineseName, drugEnglishName, price, rxOnly, atcCode, dosageForm, singleCompoundFlag, manufacturer, temperatureReq, stock_DEYI, stock_FUXING_HC, stock_KAO_CLINIC, stock_SHISHENG_FX, stock_GREAT_TREE, stock_SHISHENG_KZ, stock_ZISHENG) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    inventoryList.forEach(item => {
        stmt.run(
            item.drugCode, item.drugChineseName, item.drugEnglishName, item.price || 0, item.rxOnly ? 1 : 0, item.atcCode, item.dosageForm, item.singleCompoundFlag, item.manufacturer, item.temperatureReq,
            item.stock_DEYI || 0, item.stock_FUXING_HC || 0, item.stock_KAO_CLINIC || 0, item.stock_SHISHENG_FX || 0, item.stock_GREAT_TREE || 0, item.stock_SHISHENG_KZ || 0, item.stock_ZISHENG || 0
        );
    });
    stmt.finalize();

    // Insert Initial Requests
    const stmtReq = db.prepare(`INSERT INTO requests (id, date, from_station, to_station, item, qty, status, targetTime, relatedReserveId, dispatchTime, logisticsCondition, payment, pickupTime, paidStatus, price, prescriptionImg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    initialRequests.forEach(req => {
        stmtReq.run(req.id, req.date, req.from, req.to, req.item, req.qty, req.status, req.targetTime || null, req.relatedReserveId || null, req.dispatchTime || null, req.logisticsCondition || null, req.payment || null, req.pickupTime || null, req.paidStatus || null, req.price || 0, req.prescriptionImg || null);
    });
    stmtReq.finalize();

    console.log("鞈?摨怠?憪?摰?嚗歇?臬 Mock Data嚗?);
});

db.close();
