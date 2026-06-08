const fs = require('fs');

let js = fs.readFileSync('script.js', 'utf8');

const firebaseInit = `
// Firebase Configuration & Initialization
const firebaseConfig = {
  apiKey: "AIzaSyCc5DBRqZ8Krrfv5kJJyI7LJmXXOTx68VE",
  authDomain: "smartpharma-91480.firebaseapp.com",
  projectId: "smartpharma-91480",
  storageBucket: "smartpharma-91480.firebasestorage.app",
  messagingSenderId: "1022205674044",
  appId: "1:1022205674044:web:09c7e4324de2345778f939",
  measurementId: "G-HTGTL0ZR5J",
  databaseURL: "https://smartpharma-91480-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const firebaseDb = firebase.database();
let isFirebaseInitialized = false;

`;

if (!js.includes('firebaseConfig')) {
    js = js.replace('let dbRequests = [];', 'let dbRequests = [];\n' + firebaseInit);
}

// 2. Replace ONLY fetchSystemData
// It spans from `async function fetchSystemData() {` up to `updateSystemState();\s*}`
const fetchRegex = /async function fetchSystemData\(\) \{[\s\S]*?updateSystemState\(\);\s*\}/;

const newFetchSync = `async function fetchSystemData() {
    // Attach listeners to Firebase for REAL-TIME updates!
    const invRef = firebaseDb.ref('inventory');
    const reqRef = firebaseDb.ref('requests');

    if (!isFirebaseInitialized) {
        invRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                dbInventory = data;
                updateSystemState();
            } else {
                // Initialize Firebase with mock data if completely empty
                fetch('mock_nhi_data.json')
                    .then(res => res.json())
                    .then(nhi => {
                        dbInventory = nhi.inventory || [];
                        invRef.set(dbInventory);
                        updateSystemState();
                    }).catch(e => {
                        dbInventory = [];
                        updateSystemState();
                    });
            }
        });

        reqRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                dbRequests = Array.isArray(data) ? data : Object.values(data);
                dbRequests = dbRequests.filter(req => req !== null && req !== undefined);
            } else {
                dbRequests = []; // start empty if no requests
            }
            updateSystemState();
        });
        isFirebaseInitialized = true;
    }
}`;

js = js.replace(fetchRegex, newFetchSync);

// 3. Replace ONLY syncToDatabase
const syncRegex = /\/\/ API SYNC LOGIC\s*async function syncToDatabase\(\) \{[\s\S]*?\}\s*\}\s*\}/;
const newSync = `// API SYNC LOGIC
async function syncToDatabase() {
    try {
        await firebaseDb.ref('inventory').set(dbInventory);
        await firebaseDb.ref('requests').set(dbRequests);
    } catch (error) {
        console.error("Firebase sync failed:", error);
    }
}`;

js = js.replace(syncRegex, newSync);

// 4. Clean up localStorage.setItem occurrences
js = js.replace(/localStorage\.setItem\('SmartPharma_Inventory', JSON\.stringify\(dbInventory\)\); syncToDatabase\(\);/g, "syncToDatabase();");
js = js.replace(/localStorage\.setItem\('SmartPharma_Requests', JSON\.stringify\(dbRequests\)\); syncToDatabase\(\);/g, "syncToDatabase();");
js = js.replace(/localStorage\.setItem\('SmartPharma_Requests', JSON\.stringify\(requests\)\); syncToDatabase\(\);/g, "syncToDatabase();");

fs.writeFileSync('script.js', js, 'utf8');
console.log('Firebase integration complete!');
