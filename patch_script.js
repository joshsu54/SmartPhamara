const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

// The original fetchSystemData logic needs to be completely replaced.
// Since it spans multiple lines, we can use a more robust regex or just split.
const funcStart = "async function fetchSystemData() {";
const startIndex = code.indexOf(funcStart);
const endIndex = code.indexOf("}", code.indexOf("updateSystemState();", startIndex)) + 1;

if (startIndex === -1 || endIndex === 0) {
    console.error("Could not find fetchSystemData in script.js");
    process.exit(1);
}

const newFetch = `async function fetchSystemData() {
    try {
        const invRes = await fetch('http://localhost:3000/api/inventory');
        dbInventory = await invRes.json();
        
        const reqRes = await fetch('http://localhost:3000/api/requests');
        dbRequests = await reqRes.json();
        
    } catch (e) {
        console.warn("無法連線至後端資料庫，自動切換至離線LocalStorage模式");
        
        let localInv = localStorage.getItem('SmartPharma_Inventory');
        if (localInv) {
            dbInventory = JSON.parse(localInv);
        } else {
            // Fetch initial data if localStorage is empty
            try {
                const nhiRes = await fetch('mock_nhi_data.json');
                const nhiData = await nhiRes.json();
                dbInventory = nhiData.inventory || [];
                localStorage.setItem('SmartPharma_Inventory', JSON.stringify(dbInventory));
            } catch (err) {
                dbInventory = [];
            }
        }

        let localReqs = localStorage.getItem('SmartPharma_Requests');
        if (localReqs) {
            dbRequests = JSON.parse(localReqs);
        } else {
            dbRequests = seedMockRequests();
            localStorage.setItem('SmartPharma_Requests', JSON.stringify(dbRequests));
        }
    }
    
    updateSystemState();
}`;

code = code.substring(0, startIndex) + newFetch + code.substring(endIndex);

// 2. Add syncToDatabase function
code += `\n\n// API SYNC LOGIC
async function syncToDatabase() {
    try {
        await fetch('http://localhost:3000/api/syncInventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dbInventory)
        });
        await fetch('http://localhost:3000/api/syncRequests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dbRequests)
        });
    } catch (error) {
        // Silently fail API sync (expected for users without local node server)
    }
}
`;

// 3. Append syncToDatabase to localStorage sets
code = code.replace(/localStorage\.setItem\('SmartPharma_Inventory', JSON\.stringify\(dbInventory\)\);/g, "localStorage.setItem('SmartPharma_Inventory', JSON.stringify(dbInventory)); syncToDatabase();");
code = code.replace(/localStorage\.setItem\('SmartPharma_Requests', JSON\.stringify\(dbRequests\)\);/g, "localStorage.setItem('SmartPharma_Requests', JSON.stringify(dbRequests)); syncToDatabase();");
code = code.replace(/localStorage\.setItem\('SmartPharma_Requests', JSON\.stringify\(requests\)\);/g, "localStorage.setItem('SmartPharma_Requests', JSON.stringify(requests)); syncToDatabase();");

fs.writeFileSync('script.js', code, 'utf8');
console.log('Done!');
