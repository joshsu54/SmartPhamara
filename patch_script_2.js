const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

// Replace duplicate occurrences in seedMockInventory
// Actually, it's easier to just overwrite the whole function.
const seedFuncStart = "function seedMockInventory() {";
const startIndex = code.indexOf(seedFuncStart);
const endIndex = code.indexOf("}", startIndex) + 1;

if (startIndex !== -1 && endIndex > 0) {
    const newSeedFunc = `function seedMockInventory() {
    return [
        { drugCode: 'A012345678', drugChineseName: '胰島素注射劑 (Insulin) - 糖尿病慢箋', drugEnglishName: 'Insulin Injection', price: 150, rxOnly: true, atcCode: 'A10AB01', dosageForm: '注射劑', singleCompoundFlag: '是', manufacturer: 'Novo Nordisk', temperatureReq: 'Cold', expiryDays: 365, batchNo: 'N84912', stock_DEYI: 15, stock_FUXING_HC: 0, stock_KAO_CLINIC: 5, stock_SHISHENG_FX: 40, stock_GREAT_TREE: 30, stock_SHISHENG_KZ: 20, stock_ZISHENG: 25 },
        { drugCode: 'B023245199', drugChineseName: '布洛芬止痛膠囊 (Ibuprofen) - 相似替代藥', drugEnglishName: 'Ibuprofen 400mg', price: 20, rxOnly: false, atcCode: 'N02BE99', dosageForm: '膠囊', singleCompoundFlag: '是', manufacturer: 'AstraZeneca', temperatureReq: 'Room', expiryDays: 190, batchNo: 'B33842', stock_DEYI: 25, stock_FUXING_HC: 20, stock_KAO_CLINIC: 10, stock_SHISHENG_FX: 90, stock_GREAT_TREE: 100, stock_SHISHENG_KZ: 70, stock_ZISHENG: 50 },
        { drugCode: 'I012345699', drugChineseName: '美獲平糖適錠 (Metformin) - 糖尿病相似替代藥', drugEnglishName: 'Metformin 500mg', price: 10, rxOnly: true, atcCode: 'A10BA02', dosageForm: '錠劑', singleCompoundFlag: '是', manufacturer: 'Sandoz', temperatureReq: 'Room', expiryDays: 160, batchNo: 'B78129', stock_DEYI: 8, stock_FUXING_HC: 10, stock_KAO_CLINIC: 5, stock_SHISHENG_FX: 100, stock_GREAT_TREE: 80, stock_SHISHENG_KZ: 60, stock_ZISHENG: 40 },
        { drugCode: 'P987654321', drugChineseName: '普拿疼止痛錠 (Panadol) - 退燒止痛', drugEnglishName: 'Acetaminophen 500mg', price: 15, rxOnly: false, atcCode: 'N02BE01', dosageForm: '錠劑', singleCompoundFlag: '是', manufacturer: 'GSK', temperatureReq: 'Room', expiryDays: 730, batchNo: 'G10045', stock_DEYI: 50, stock_FUXING_HC: 30, stock_KAO_CLINIC: 20, stock_SHISHENG_FX: 120, stock_GREAT_TREE: 200, stock_SHISHENG_KZ: 80, stock_ZISHENG: 60 },
        { drugCode: 'C888999111', drugChineseName: '倍拉維 (Paxlovid) - COVID-19專用藥', drugEnglishName: 'Nirmatrelvir/Ritonavir', price: 20000, rxOnly: true, atcCode: 'J05AE30', dosageForm: '錠劑', singleCompoundFlag: '否', manufacturer: 'Pfizer', temperatureReq: 'Room', expiryDays: 180, batchNo: 'P99281', stock_DEYI: 2, stock_FUXING_HC: 5, stock_KAO_CLINIC: 0, stock_SHISHENG_FX: 10, stock_GREAT_TREE: 15, stock_SHISHENG_KZ: 8, stock_ZISHENG: 5 },
        { drugCode: 'T111222333', drugChineseName: '克流感膠囊 (Tamiflu) - 流感用藥', drugEnglishName: 'Oseltamivir 75mg', price: 950, rxOnly: true, atcCode: 'J05AH02', dosageForm: '膠囊', singleCompoundFlag: '是', manufacturer: 'Roche', temperatureReq: 'Room', expiryDays: 360, batchNo: 'R55421', stock_DEYI: 0, stock_FUXING_HC: 10, stock_KAO_CLINIC: 0, stock_SHISHENG_FX: 50, stock_GREAT_TREE: 80, stock_SHISHENG_KZ: 30, stock_ZISHENG: 20 },
        { drugCode: 'L444555666', drugChineseName: '樂必寧膠囊 (Loperamide) - 緩解腹瀉', drugEnglishName: 'Loperamide 2mg', price: 12, rxOnly: false, atcCode: 'A07DA03', dosageForm: '膠囊', singleCompoundFlag: '是', manufacturer: 'Johnson', temperatureReq: 'Room', expiryDays: 500, batchNo: 'J33411', stock_DEYI: 30, stock_FUXING_HC: 15, stock_KAO_CLINIC: 5, stock_SHISHENG_FX: 60, stock_GREAT_TREE: 120, stock_SHISHENG_KZ: 40, stock_ZISHENG: 35 },
        { drugCode: 'K777888999', drugChineseName: '伊普芬液 (Ibuprofen) - 兒童腸病毒退燒', drugEnglishName: 'Ibuprofen Suspension', price: 80, rxOnly: false, atcCode: 'N02BE01', dosageForm: '液劑', singleCompoundFlag: '是', manufacturer: 'GSK', temperatureReq: 'Room', expiryDays: 240, batchNo: 'G88902', stock_DEYI: 10, stock_FUXING_HC: 5, stock_KAO_CLINIC: 2, stock_SHISHENG_FX: 25, stock_GREAT_TREE: 40, stock_SHISHENG_KZ: 15, stock_ZISHENG: 10 },
        { drugCode: 'D333444555', drugChineseName: '莫敵咳 (Dextromethorphan) - 鎮咳祛痰', drugEnglishName: 'Dextromethorphan 15mg', price: 8, rxOnly: false, atcCode: 'R05DA09', dosageForm: '錠劑', singleCompoundFlag: '是', manufacturer: 'Bayer', temperatureReq: 'Room', expiryDays: 400, batchNo: 'B11234', stock_DEYI: 40, stock_FUXING_HC: 25, stock_KAO_CLINIC: 15, stock_SHISHENG_FX: 80, stock_GREAT_TREE: 150, stock_SHISHENG_KZ: 50, stock_ZISHENG: 45 },
        { drugCode: 'A666777888', drugChineseName: '敏肝寧 (Chlorpheniramine) - 抗過敏', drugEnglishName: 'Chlorpheniramine 4mg', price: 5, rxOnly: false, atcCode: 'R06AB04', dosageForm: '錠劑', singleCompoundFlag: '是', manufacturer: 'Takeda', temperatureReq: 'Room', expiryDays: 600, batchNo: 'T99081', stock_DEYI: 60, stock_FUXING_HC: 40, stock_KAO_CLINIC: 30, stock_SHISHENG_FX: 100, stock_GREAT_TREE: 200, stock_SHISHENG_KZ: 70, stock_ZISHENG: 50 },
        { drugCode: 'H222333444', drugChineseName: '脈優錠 (Amlodipine) - 高血壓用藥', drugEnglishName: 'Amlodipine 5mg', price: 18, rxOnly: true, atcCode: 'C08CA01', dosageForm: '錠劑', singleCompoundFlag: '是', manufacturer: 'Pfizer', temperatureReq: 'Room', expiryDays: 700, batchNo: 'P33211', stock_DEYI: 20, stock_FUXING_HC: 15, stock_KAO_CLINIC: 10, stock_SHISHENG_FX: 70, stock_GREAT_TREE: 130, stock_SHISHENG_KZ: 50, stock_ZISHENG: 40 },
        { drugCode: 'R555666777', drugChineseName: '冠脂妥 (Rosuvastatin) - 降血脂用藥', drugEnglishName: 'Rosuvastatin 10mg', price: 25, rxOnly: true, atcCode: 'C10AA07', dosageForm: '錠劑', singleCompoundFlag: '是', manufacturer: 'AstraZeneca', temperatureReq: 'Room', expiryDays: 800, batchNo: 'A44567', stock_DEYI: 15, stock_FUXING_HC: 10, stock_KAO_CLINIC: 5, stock_SHISHENG_FX: 50, stock_GREAT_TREE: 100, stock_SHISHENG_KZ: 40, stock_ZISHENG: 30 }
    ];
}`;
    code = code.substring(0, startIndex) + newSeedFunc + code.substring(endIndex);
    fs.writeFileSync('script.js', code, 'utf8');
    console.log('Fixed seedMockInventory');
}
