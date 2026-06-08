const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

// Replace the role text assignment
code = code.replace(
    /document\.getElementById\('display-role'\)\.innerText = role === 'buyer' \? '復興鄉居民' : \(role === 'pharmacist' \? '社區藥局藥師' : \(role === 'driver' \? '物流專車司機' : '衛生局主管\/管理員'\)\);/,
    "document.getElementById('display-role').innerText = role === 'buyer' ? '一般民眾帳號' : (role === 'pharmacist' ? '藥局管理員帳號' : (role === 'driver' ? '物流配送司機' : '系統管理員'));"
);

fs.writeFileSync('script.js', code, 'utf8');
console.log('Fixed display-role text');
