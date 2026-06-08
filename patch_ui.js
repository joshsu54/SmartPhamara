const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf8');

// 1. Fix the column header for different roles
js = js.replace(
    'thHtml += `<th>用途分類</th><th>跨店調撥與預約決策</th></tr>`;',
    `if (currentRole === 'admin') {
        thHtml += \`<th>用途分類</th><th>審計與稽核紀錄</th></tr>\`;
    } else if (currentRole === 'buyer') {
        thHtml += \`<th>用途分類</th><th>預約領藥</th></tr>\`;
    } else {
        thHtml += \`<th>用途分類</th><th>跨店調撥與預約決策</th></tr>\`;
    }`
);

// 2. Fix the button text to explicitly say "申請調撥"
js = js.replace(
    '<i class="fa-solid fa-truck-ramp-box"></i> 告急求援</button>`',
    '<i class="fa-solid fa-truck-ramp-box"></i> 緊急向他店調撥</button>`'
);
js = js.replace(
    '<i class="fa-solid fa-boxes-stacked"></i> 調撥庫存</button>`;',
    '<i class="fa-solid fa-boxes-stacked"></i> 向他店申請調撥</button>`;'
);

// 3. Make the Buyer Reservation automatically show up in pharm-dash too
// Wait, the reservationTable IS in pharm-dash. We don't need to change its location.
// But let's add a log to see if renderReservationTable is called.
// Actually, I'll just change the text of "民眾" to make sure it's clear.

fs.writeFileSync('script.js', js, 'utf8');
console.log("Patched script.js");
