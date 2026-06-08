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
const fetchStart = "async function fetchSystemData() {";
const fetchEndToken = "updateSystemState();\n}";
const fetchStartIdx = js.indexOf(fetchStart);
const fetchEndIdx = js.indexOf(fetchEndToken, fetchStartIdx) + fetchEndToken.length;

if (fetchStartIdx === -1 || fetchEndIdx < fetchStartIdx) {
    console.error("Could not find fetchSystemData correctly.");
    process.exit(1);
}

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

js = js.substring(0, fetchStartIdx) + newFetchSync + js.substring(fetchEndIdx);

// 3. Replace ONLY syncToDatabase
const syncStart = "async function syncToDatabase() {";
const syncEndToken = "} catch (error) {\n        // Silently fail API sync (expected for users without local node server)\n    }\n}";
const syncStartIdx = js.indexOf(syncStart);
const syncEndIdx = js.indexOf(syncEndToken, syncStartIdx) + syncEndToken.length;

if (syncStartIdx !== -1 && syncEndIdx > syncStartIdx) {
    const newSync = `async function syncToDatabase() {
    try {
        await firebaseDb.ref('inventory').set(dbInventory);
        await firebaseDb.ref('requests').set(dbRequests);
    } catch (error) {
        console.error("Firebase sync failed:", error);
    }
}`;
    js = js.substring(0, syncStartIdx) + newSync + js.substring(syncEndIdx);
} else {
    console.warn("Could not find syncToDatabase precisely, skipping replace");
}

// 4. Clean up localStorage.setItem occurrences
js = js.replace(/localStorage\.setItem\('SmartPharma_Inventory', JSON\.stringify\(dbInventory\)\); syncToDatabase\(\);/g, "syncToDatabase();");
js = js.replace(/localStorage\.setItem\('SmartPharma_Requests', JSON\.stringify\(dbRequests\)\); syncToDatabase\(\);/g, "syncToDatabase();");
js = js.replace(/localStorage\.setItem\('SmartPharma_Requests', JSON\.stringify\(requests\)\); syncToDatabase\(\);/g, "syncToDatabase();");

fs.writeFileSync('script.js', js, 'utf8');
console.log('Firebase integration complete!');
