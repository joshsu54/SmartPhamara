let currentRole = ''; 
let currentStation = ''; 
let currentStationName = '';
let dbInventory = []; 
let dbRequests = [];

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

 
let tempReserveData = null; 
let tempTransferData = null; 
let activeViewPrescriptionId = null; // For pharmacist verification

// Dynamic Local Base64 Prescription Generator
let tempPrescriptionImgBase64 = '';
let isCustomUploaded = false; 
let currentWeatherMode = 'sunny';
let weatherSimulationMode = 'sunny';
let currentInventoryFilter = 'all';

// --- Driver Live Navigation Variables ---
let isVoiceNavEnabled = false;
let liveNavInterval = null;
let navProgressPct = 0; // 0 to 100
let activeNavTask = null;

function getSafetyStockThreshold() {
    if (currentWeatherMode === 'rainy') {
        return 15;
    } else if (currentWeatherMode === 'typhoon') {
        return 20;
    }
    return 10; // default sunny
}

function findSubstituteDrug(med, stationCode) {
    if (!med || !med.atcCode) return null;
    const atcPrefix = med.atcCode.substring(0, 3); // e.g. "N02" or "A10"
    const stockField = 'stock_' + stationCode;
    return dbInventory.find(item => 
        item.drugCode !== med.drugCode && 
        item.atcCode.startsWith(atcPrefix) && 
        (item[stockField] || 0) > 0
    );
}

function checkSubstitution() {
    const alertBox = document.getElementById('substituteAlertBox');
    if (!alertBox) return;

    if (tempReserveData && tempReserveData.rejectedSubstitute) {
        alertBox.style.display = 'none';
        return;
    }

    let med = dbInventory.find(m => m.drugChineseName === tempReserveData.item);
    if (!med) {
        alertBox.style.display = 'none';
        return;
    }

    let stockField = 'stock_' + tempReserveData.station;
    let availableStock = med[stockField] || 0;

    if (availableStock < tempReserveData.qty) {
        // Look for similar drug in the same station
        let subMed = findSubstituteDrug(med, tempReserveData.station);
        if (subMed) {
            let subStock = subMed[stockField] || 0;
            // Only suggest if the substitute itself has enough stock for the request!
            if (subStock >= tempReserveData.qty) {
                tempReserveData.substitute = {
                    item: subMed.drugChineseName,
                    drugCode: subMed.drugCode,
                    unitPrice: subMed.price,
                    rxOnly: subMed.rxOnly
                };

                let labelText = subMed.rxOnly 
                    ? '<span class="badge badge-danger" style="font-size:0.7rem; padding:2px 6px;">Rx 處方替換建議 (需取藥時配合健保卡雲端藥歷由藥師確認並登記)</span>' 
                    : '<span class="badge badge-success" style="font-size:0.7rem; padding:2px 6px;">OTC 免憑證相似藥直接替代</span>';

                let substText = `⚠️ 本據點「${tempReserveData.item}」現有庫存僅 ${availableStock} 盒，不足您預約的 ${tempReserveData.qty} 盒。<br>
                💡 推薦相似替代藥品：<strong>${subMed.drugChineseName}</strong> (本店現貨剩餘 ${subStock} 盒，每盒 $${subMed.price})。<br>
                ${labelText}<br><br>
                您可以：<br>
                • <b>選項 A (專車調撥)</b>：仍預約原藥，由大溪母艦藥局專車配送 (預計需等待數小時)。<br>
                • <b>選項 B (相似替代)</b>：立即更換為同效能替代藥，可直接在現場立即取藥，免等待！`;
                
                document.getElementById('substituteText').innerHTML = substText;
                alertBox.style.display = 'block';
                return;
            }
        }
    }
    
    alertBox.style.display = 'none';
    if (tempReserveData) {
        delete tempReserveData.substitute;
    }
}

function chooseSubstituteOption() {
    if (!tempReserveData || !tempReserveData.substitute) return;
    const sub = tempReserveData.substitute;
    
    tempReserveData.item = sub.item;
    tempReserveData.drugCode = sub.drugCode;
    tempReserveData.unitPrice = sub.unitPrice;
    tempReserveData.totalPrice = tempReserveData.qty * sub.unitPrice;
    
    document.getElementById('payItemName').innerText = tempReserveData.item;
    document.getElementById('payItemUnitPrice').innerText = tempReserveData.unitPrice;
    document.getElementById('payItemTotalPrice').innerText = tempReserveData.totalPrice;
    
    if (sub.rxOnly) {
        if (!isCustomUploaded) {
            tempReserveData.prescriptionImg = generateDummyPrescriptionBase64(tempReserveData.item, tempReserveData.qty);
        }
    } else {
        if (!isCustomUploaded) {
            tempReserveData.prescriptionImg = '';
        }
    }

    showToast(`已更換預約為替代藥品：${sub.item}！`, 'success');
    delete tempReserveData.substitute;
    document.getElementById('substituteAlertBox').style.display = 'none';
}

function keepOriginalOption() {
    if (tempReserveData) {
        tempReserveData.rejectedSubstitute = true;
    }
    document.getElementById('substituteAlertBox').style.display = 'none';
    showToast("已選擇保留原藥，將為您調度物流專車。", "info");
}

function loadSamplePrescription() {
    const sampleMed = "普拿疼止痛錠 (Panadol) - 退燒止痛";
    tempPrescriptionImgBase64 = generateDummyPrescriptionBase64(sampleMed, 1);
    isCustomUploaded = false; // Set to false because this is a simulated template
    
    const preview = document.getElementById('uploadPreview');
    if (preview) {
        preview.src = tempPrescriptionImgBase64;
        preview.style.display = 'block';
        showToast("已成功載入範例處方箋相片！", "success");
    }
}

function simulateWeatherChange(val) {
    weatherSimulationMode = val;
    const badge = document.getElementById('weather-sync-badge');
    if (val === 'api') {
        if (badge) {
            badge.style.background = '#e2fbe8';
            badge.style.color = '#10b981';
            badge.style.borderColor = '#a7f3d0';
            badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> CWA 自動即時同步';
        }
        fetchRealTimeWeather();
    } else {
        if (badge) {
            badge.style.background = '#fffbeb';
            badge.style.color = '#d97706';
            badge.style.borderColor = '#fef3c7';
            badge.innerHTML = '<i class="fa-solid fa-flask"></i> 系統模擬開發模式';
        }
        if (val === 'sunny') {
            updateWeatherState('sunny', 10, 0);
            showToast("已手動模擬：晴朗常態天氣 (備貨水位 1.0x)", "success");
        } else if (val === 'rainy') {
            updateWeatherState('rainy', 85, 15);
            showToast("已手動模擬：大雨特報預警 (防汛備貨 1.5x)", "warning");
        } else if (val === 'typhoon') {
            updateWeatherState('typhoon', 99, 65);
            showToast("已手動模擬：颱風警戒警戒 (預防斷藥 2.0x)", "error");
        }
        updateSystemState();
    }
}

async function fetchRealTimeWeather(isInitial = false) {
    const badge = document.getElementById('weather-sync-badge');
    if (weatherSimulationMode !== 'api') {
        let mode = weatherSimulationMode;
        if (badge) {
            badge.style.background = '#fffbeb';
            badge.style.color = '#d97706';
            badge.style.borderColor = '#fef3c7';
            badge.innerHTML = '<i class="fa-solid fa-flask"></i> 系統模擬開發模式';
        }
        if (mode === 'sunny') updateWeatherState('sunny', 10, 0);
        else if (mode === 'rainy') updateWeatherState('rainy', 85, 15);
        else if (mode === 'typhoon') updateWeatherState('typhoon', 99, 65);
        return;
    }
    if (badge) {
        badge.style.background = '#e2fbe8';
        badge.style.color = '#10b981';
        badge.style.borderColor = '#a7f3d0';
        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> CWA 自動即時同步';
    }
    const refreshBtn = document.querySelector('#shared-weather-card button');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 載入中...';
    }
    
    try {
        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=24.8210&longitude=121.3526&daily=weather_code,precipitation_probability_max,precipitation_sum&timezone=Asia/Taipei&forecast_days=1");
        if (!response.ok) throw new Error("API response error");
        const data = await response.json();
        
        const daily = data.daily;
        if (daily && daily.weather_code && daily.weather_code.length > 0) {
            const weatherCode = daily.weather_code[0];
            const rainProb = daily.precipitation_probability_max[0] || 0;
            const rainSum = daily.precipitation_sum[0] || 0;
            
            let mode = 'sunny';
            if (rainSum >= 30 || [95, 96, 99].includes(weatherCode)) {
                mode = 'typhoon';
            } else if (rainSum >= 5 || rainProb >= 50 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
                mode = 'rainy';
            }
            
            updateWeatherState(mode, rainProb, rainSum);
            if (!isInitial && currentRole) {
                showToast(`已成功同步最新氣象資料！復興區日雨量預估 ${rainSum}mm，降雨機率 ${rainProb}%。`, 'success');
            }
        }
    } catch (e) {
        console.warn("⚠️ 氣象 API 取得失敗，改用離線歷史平均資料連動！", e);
        let mode = currentWeatherMode || 'sunny';
        updateWeatherState(mode, mode === 'sunny' ? 10 : (mode === 'rainy' ? 85 : 99), mode === 'sunny' ? 0 : (mode === 'rainy' ? 150 : 450));
        if (!isInitial && currentRole) {
            showToast("已成功啟用氣象署歷史平均備貨係數連動 (離線模式)", "info");
        }
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> 重新整理氣象';
        }
    }
}

function updateWeatherState(mode, rainProb, rainSum) {
    currentWeatherMode = mode;
    
    const icon = document.getElementById('weather-icon');
    const statusText = document.getElementById('weather-status-text');
    const rainProbLabel = document.getElementById('weather-rain-prob');
    const summaryText = document.getElementById('weather-summary-text');
    
    // Calculate dates dynamically
    const d = new Date();
    const tom = new Date(d);
    tom.setDate(d.getDate() + 1);
    const currentMonth = String(d.getMonth() + 1).padStart(2, '0');
    const currentDate = String(d.getDate()).padStart(2, '0');
    
    // For sunny simulation, use 17:16 to match CWA regular issue. Otherwise use current hour/min.
    const isSunnySim = (mode === 'sunny' && weatherSimulationMode === 'sunny');
    const updateHour = isSunnySim ? '17' : String(d.getHours()).padStart(2, '0');
    const updateMin = isSunnySim ? '16' : String(d.getMinutes()).padStart(2, '0');
    
    if (mode === 'sunny') {
        if (icon) icon.innerText = '☀️';
        if (statusText) statusText.innerText = '當前天氣：晴朗常態 (無警報)';
        if (rainProbLabel) rainProbLabel.innerText = `降雨機率預估: ${rainProb}% (日累積雨量 ${rainSum}mm)`;
        
        if (summaryText) {
            summaryText.innerHTML = `
                <div style="font-weight: 800; color: var(--primary-color); margin-bottom: 6px;"><i class="fa-solid fa-circle-info"></i> CWA 詳細天氣預警報告及生活指引：</div>
                <strong>多雲時陰，天氣穩定且舒適</strong><br>
                <span style="color: var(--text-muted); font-size: 0.78rem;">【更新時間：${currentMonth}/${currentDate} ${updateHour}:${updateMin}】</span><br>
                今晚至明晨（${tom.getDate()}日）天氣為多雲時陰，降雨機率0%；明天白天轉為多雲時晴，降雨機率則為10%。氣溫25至34度，感覺舒適至悶熱。<br>
                風浪：偏南風5至6陣風8級，浪高1至2公尺，屬於小浪至中浪。<br>
                提醒您，明日白天氣溫舒適偏熱，從事戶外活動請適時補充水分，避免過度曝曬。強風特報，注意風勢與行車安全。
            `;
        }
    } else if (mode === 'rainy') {
        if (icon) icon.innerText = '⛈️';
        if (statusText) statusText.innerText = '當前天氣：大雨特報 (防汛備貨 1.5x)';
        if (rainProbLabel) rainProbLabel.innerText = `降雨機率預估: ${rainProb}% (日累積雨量 ${rainSum}mm)`;
        
        if (summaryText) {
            summaryText.innerHTML = `
                <div style="font-weight: 800; color: #d97706; margin-bottom: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> CWA 詳細天氣預警報告及生活指引：</div>
                <strong>🌧️ 大雨特報：對流雲系發展旺盛，局部地區有大雨發生的機率</strong><br>
                <span style="color: var(--text-muted); font-size: 0.78rem;">【更新時間：${currentMonth}/${currentDate} ${updateHour}:${updateMin}】</span><br>
                今晚至明天復興山區受滯留鋒面影響，天氣為陰有陣雨或雷雨，降雨機率為 ${rainProb}%，預估日累積雨量達 ${rainSum}mm。氣溫22至28度，感覺濕涼。<br>
                風浪：偏西南風4至5陣風7級，浪高1.5公尺，易有強陣風與雷擊。<br>
                提醒您，強降雨易造成山區道路視線不良與路面濕滑。台7線部分易坍方路段（如榮華段、巴陵段）請注意落石。行車請開啟大燈並減速慢行，避免前往山區溪谷從事水上活動。
            `;
        }
    } else if (mode === 'typhoon') {
        if (icon) icon.innerText = '🌀';
        if (statusText) statusText.innerText = '當前天氣：颱風警戒 (預防斷藥 2.0x)';
        if (rainProbLabel) rainProbLabel.innerText = `降雨機率預估: ${rainProb}% (日累積雨量 ${rainSum}mm)`;
        
        if (summaryText) {
            summaryText.innerHTML = `
                <div style="font-weight: 800; color: var(--danger-color); margin-bottom: 6px;"><i class="fa-solid fa-circle-exclamation"></i> CWA 詳細天氣預警報告及生活指引：</div>
                <strong>🌀 陸上颱風警報：受中度颱風環流影響，復興山區進入強風豪雨警戒範圍</strong><br>
                <span style="color: var(--text-muted); font-size: 0.78rem;">【更新時間：${currentMonth}/${currentDate} ${updateHour}:${updateMin}】</span><br>
                今晚至明天復興區受颱風眼牆或外圍環流直接影響，降雨機率99%，24小時預估累積雨量達 ${Math.max(200, Math.round(rainSum * 3))}mm（達超大豪雨等級）。氣溫20至24度，風勢極為強勁。<br>
                風浪：偏東風轉西北風8至9陣風11級，浪高5公尺以上，屬於巨浪。<br>
                提醒您，復興山區已列入土石流黃色或紅色警戒區域。台7線北橫公路隨時可能實施預防性封路，請山區居民備妥3天份常備藥品，減少非必要外出，密切注意最新防災訊息。
            `;
        }
    }

    const adminAlertBox = document.getElementById('adminWeatherAlertBox');
    if (adminAlertBox) {
        if (mode === 'sunny') {
            adminAlertBox.style.background = '#f0fdf4';
            adminAlertBox.style.borderLeft = '5px solid var(--secondary-color)';
            adminAlertBox.innerHTML = `
                <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">☀️</div>
                <div>
                    <h4 style="margin: 0 0 6px 0; color: var(--secondary-color); font-size: 1.1rem; font-weight: 800;">☀️ CWA 中央氣象署連動：桃園復興山區 晴朗常態</h4>
                    <p style="margin: 0; font-size: 0.92rem; color: var(--text-dark); line-height: 1.6;">
                        當前天氣狀況晴朗良好，道路通暢無阻。<br>
                        <span class="badge badge-success" style="font-size:0.75rem; margin-top:4px;">[AI 決策執行]</span> 系統維持標準安全備貨水位 (安全天數 7 天 / 1.0x 安全庫存)。
                    </p>
                </div>
            `;
        } else if (mode === 'rainy') {
            adminAlertBox.style.background = '#fffbeb';
            adminAlertBox.style.borderLeft = '5px solid var(--warning-color)';
            adminAlertBox.innerHTML = `
                <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">⛈️</div>
                <div>
                    <h4 style="margin: 0 0 6px 0; color: var(--warning-color); font-size: 1.1rem; font-weight: 800;">⚠️ CWA 中央氣象署災防連動：桃園復興山區 大雨特報</h4>
                    <p style="margin: 0; font-size: 0.92rem; color: var(--text-dark); line-height: 1.6;">
                        復興山區降雨機率預估 <strong>${rainProb}%</strong> (累積雨量 ${rainSum}mm)，台七線可能發生零星坍方落石風險。<br>
                        <span class="badge badge-danger" style="font-size:0.75rem; margin-top:4px;">[AI 決策執行]</span> 系統已自動將德怡藥局之<b>安全備貨天數由 7 天調升至 10.5 天 (1.5x)</b>，防範因雨道路受阻中斷。
                    </p>
                </div>
            `;
        } else if (mode === 'typhoon') {
            adminAlertBox.style.background = '#fff1f2';
            adminAlertBox.style.borderLeft = '5px solid var(--danger-color)';
            adminAlertBox.innerHTML = `
                <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">🌀</div>
                <div>
                    <h4 style="margin: 0 0 6px 0; color: var(--danger-color); font-size: 1.1rem; font-weight: 800;">🚨 CWA 中央氣象署防颱特警：桃園復興區 颱風警報</h4>
                    <p style="margin: 0; font-size: 0.92rem; color: var(--text-dark); line-height: 1.6;">
                        復興山區發布土石流黃色警戒，局部路段預警性封閉 (日累積雨量已達 ${rainSum}mm)。<br>
                        <span class="badge badge-danger" style="font-size:0.75rem; margin-top:4px;">[AI 決策執行]</span> 系統已自動將全區偏鄉特約據點<b>安全儲備天數調升至 14 天 (2.0x)</b>，要求大溪母艦藥局執行預防性大宗調撥。
                    </p>
                </div>
            `;
        }
    }
    updateSystemState();
}

function getDistance(codeA, codeB) {
    let a = STATIONS_METADATA[codeA];
    let b = STATIONS_METADATA[codeB];
    if (!a || !b) return 0;
    
    const R = 6371; // Earth radius in km
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    
    const x = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLng/2) * Math.sin(dLng/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
    return R * c;
}

function optimizeDriverRoute() {
    let activeTasks = dbRequests.filter(req => req.status === '已核准出庫' || req.status === '專車配送中');
    
    const routePlanner = document.getElementById('driverRoutePlanner');
    const routeEmpty = document.getElementById('driverRouteEmpty');
    
    if (!routePlanner || !routeEmpty) return;
    
    if (activeTasks.length === 0) {
        routePlanner.style.display = 'none';
        routeEmpty.style.display = 'block';
        return;
    }
    
    routePlanner.style.display = 'block';
    routeEmpty.style.display = 'none';
    
    let locations = new Set();
    activeTasks.forEach(task => {
        if (STATIONS_METADATA[task.from]) locations.add(task.from);
        if (STATIONS_METADATA[task.to]) locations.add(task.to);
    });
    
    let currentLoc = 'SHISHENG_FX';
    let route = [currentLoc];
    let candidates = Array.from(locations).filter(loc => loc !== currentLoc);
    
    while (candidates.length > 0) {
        let nearestIndex = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < candidates.length; i++) {
            let dist = getDistance(currentLoc, candidates[i]);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIndex = i;
            }
        }
        currentLoc = candidates[nearestIndex];
        route.push(currentLoc);
        candidates.splice(nearestIndex, 1);
    }
    
    let totalDist = 0;
    let legs = [];
    for (let i = 0; i < route.length - 1; i++) {
        let dist = getDistance(route[i], route[i+1]);
        totalDist += dist;
        legs.push(dist);
    }
    let totalTime = Math.round(totalDist * 2) + route.length * 5; // 2 min/km + 5 min per stop
    
    document.getElementById('routeTotalDistance').innerText = totalDist.toFixed(1);
    document.getElementById('routeTotalTime').innerText = totalTime;
    
    const roadmap = document.getElementById('optimizedRoadmap');
    roadmap.innerHTML = '';
    
    route.forEach((locCode, idx) => {
        let meta = STATIONS_METADATA[locCode];
        let isStart = idx === 0;
        let legDist = idx > 0 ? legs[idx - 1] : 0;
        
        let actions = [];
        activeTasks.forEach(task => {
            if (task.from === locCode) {
                actions.push(`<span style="color:var(--info-color); font-weight:800;"><i class="fa-solid fa-circle-arrow-down"></i> 📥 點收裝車：${task.item} (x${task.qty}盒)</span>`);
            }
            if (task.to === locCode) {
                actions.push(`<span style="color:var(--secondary-color); font-weight:800;"><i class="fa-solid fa-circle-arrow-up"></i> 卸貨簽收點：${task.item} (x${task.qty}盒)</span>`);
            }
        });
        
        let actionText = actions.length > 0 
            ? actions.join('<br>') 
            : `<span style="color:var(--text-muted);"><i class="fa-solid fa-house-chimney"></i> 車隊總部/出發整備點</span>`;
            
        let distLabel = idx > 0 ? `<div class="roadmap-leg">+ ${legDist.toFixed(1)} km (車程約 ${Math.round(legDist * 2)} 分鐘)</div>` : '';
        
        let nodeHtml = `
            ${distLabel}
            <div class="roadmap-node ${isStart ? 'start-node' : ''}">
                <div class="roadmap-circle">${idx + 1}</div>
                <div class="roadmap-content">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="margin:0; color:var(--primary-color); font-weight:850; font-size:1.1rem;">${meta.name}</h4>
                        <span class="badge ${isStart ? 'badge-info' : 'badge-success'}" style="font-size:0.75rem;">${meta.district}</span>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin:6px 0 10px 0;"><i class="fa-solid fa-location-dot"></i> ${meta.address}</div>
                    <div class="roadmap-actions">${actionText}</div>
                </div>
            </div>
        `;
        roadmap.innerHTML += nodeHtml;
    });
}

function startOptimizedRoute() {
    let activeTasks = dbRequests.filter(req => req.status === '已核准出庫');
    if (activeTasks.length === 0) {
        showToast("當前無待出發的調撥任務！", "warning");
        return;
    }
    
    activeTasks.forEach(req => {
        req.status = '專車配送中';
        req.dispatchTime = getCurrentTime();
        req.logisticsCondition = '常溫運輸中';
    });
    
    syncToDatabase();
    showToast("🚚 最佳配送路線已啟用！專車已啟程出發配送全線藥物。", "success");
    updateSystemState();
}

// Coordinates and details for Fuxing & Daxi joint network
const STATIONS_METADATA = {
    'DEYI': { name: '德怡藥局', address: '復興區澤仁里忠孝路34號', phone: '(03) 382-1686', hours: '08:30-18:30 (週日休)', lat: 24.8210, lng: 121.3526, district: '復興區' },
    'SHISHENG_FX': { name: '新資生連鎖藥局 (復興店)', address: '大溪區復興路96號', phone: '(03) 388-2206', hours: '08:00-22:00 (全年無休)', lat: 24.8809, lng: 121.2890, district: '大溪區' },
    'GREAT_TREE': { name: '大樹連鎖藥局 (大溪康莊店)', address: '大溪區康莊路160號', phone: '(03) 387-3873', hours: '08:00-22:00 (全年無休)', lat: 24.8801, lng: 121.2872, district: '大溪區' },
    'SHISHENG_KZ': { name: '新資生連鎖藥局 (康莊店)', address: '大溪區康莊路132號', phone: '(03) 388-2276', hours: '08:00-22:00 (全年無休)', lat: 24.8812, lng: 121.2876, district: '大溪區' },
    'ZISHENG': { name: '資生大藥局', address: '大溪區復興路92-1號', phone: '(03) 388-2026', hours: '08:00-21:30 (全年無休)', lat: 24.8810, lng: 121.2889, district: '大溪區' }
};

// Toast notification helper
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation')}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function getCurrentTime() {
    let d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Dummy Prescription Sheet Builder
function generateDummyPrescriptionBase64(medName, qty) {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    // Background card
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 360, 480);
    
    // Green border
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 340, 460);
    
    // Decorative medical cross
    ctx.fillStyle = '#ccfbf1';
    ctx.fillRect(300, 20, 40, 40);
    ctx.fillStyle = '#0d9488';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('＋', 308, 48);

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('衛生福利部中央健康保險署', 30, 45);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#0d9488';
    ctx.fillText('慢性病連續處方箋 (智慧領藥驗證用)', 30, 70);

    // Dividers
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(25, 85); ctx.lineTo(335, 85); ctx.stroke();
    
    // Patient info
    ctx.fillStyle = '#334155';
    ctx.font = '13px sans-serif';
    ctx.fillText('姓名: 王大明 (WANG DA-MING)', 30, 115);
    ctx.fillText('身分證字號: H123456***', 30, 140);
    ctx.fillText('出生日期: 民國 68 年 08 月 23 日', 30, 165);
    ctx.fillText('病歷號碼: L-908234-A', 30, 190);
    
    ctx.beginPath(); ctx.moveTo(25, 210); ctx.lineTo(335, 210); ctx.stroke();
    
    // Medical Diagnosis & Rx Details
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('【開立處方藥品與劑量】', 30, 235);
    
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`[Rx] ${medName}`, 30, 265);
    ctx.fillStyle = '#334155';
    ctx.font = '12px sans-serif';
    ctx.fillText(`總量: ${qty} 盒 (依健保雲端額度核撥)`, 30, 290);
    ctx.fillText(`用法: 每日定時服用，遵照醫囑指示`, 30, 315);
    
    ctx.beginPath(); ctx.moveTo(25, 340); ctx.lineTo(335, 340); ctx.stroke();
    
    // Signature and Stamp
    ctx.font = '12px sans-serif';
    ctx.fillText('開立機構: 林口長庚紀念醫院 (特約代號: 1132010011)', 30, 365);
    ctx.fillText('主治醫師: 陳宗賢 醫師 (簽章已電子核備)', 30, 390);
    
    // Stamp box
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(240, 395, 75, 55);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('長庚紀念醫院', 246, 418);
    ctx.fillText('院外慢箋專用', 246, 438);
    
    return canvas.toDataURL('image/jpeg');
}

// Drag & drop handlers
function setupDragAndDrop() {
    const zone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('prescriptionFile');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', () => fileInput.click());
    
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect(fileInput);
        }
    });
}

function handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const max_width = 300;
            const scale = max_width / img.width;
            if (img.width > max_width) {
                canvas.width = max_width;
                canvas.height = img.height * scale;
            } else {
                canvas.width = img.width;
                canvas.height = img.height;
            }
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Compress image to JPEG at 70% quality
            tempPrescriptionImgBase64 = canvas.toDataURL('image/jpeg', 0.7);
            isCustomUploaded = true; // Mark as custom uploaded!
            const preview = document.getElementById('uploadPreview');
            if (preview) {
                preview.src = tempPrescriptionImgBase64;
                preview.style.display = 'block';
                showToast("成功上傳並壓縮處方箋照片！", "success");
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function fillTestAccount(user) {
    const userEl = document.getElementById('loginUser');
    const pwdEl = document.getElementById('loginPwd');
    if (userEl && pwdEl) {
        userEl.value = user;
        pwdEl.value = '123';
        showToast(`已載入帳號: ${user}，正在登入...`, 'success');
        setTimeout(() => {
            doLogin();
        }, 400);
    }
}

// Authentication login routing
function doLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pwd = document.getElementById('loginPwd').value;
    if (pwd !== '123') { showToast('密碼錯誤！(測試用密碼為 123)', 'error'); return; }
    
    if (user === 'wang') loginAs('buyer', 'none', '王大明');
    else if (user === 'deyi_wang') loginAs('pharmacist', 'DEYI', '德怡藥局');
    else if (user === 'daxi_lin') loginAs('pharmacist', 'SHISHENG_FX', '新資生復興店');
    else if (user === 'daxi_kz') loginAs('pharmacist', 'SHISHENG_KZ', '新資生康莊店');
    else if (user === 'daxi_tree') loginAs('pharmacist', 'GREAT_TREE', '大樹藥局康莊店');
    else if (user === 'daxi_zisheng') loginAs('pharmacist', 'ZISHENG', '資生大藥局');
    else if (user === 'admin') loginAs('admin', 'HQ', '桃園市衛生局管理者/復興區長');
    else if (user === 'driver') loginAs('driver', 'TRUCK', '物流調撥司機');
    else showToast('查無此帳號！請參考說明。', 'error');
}

function loginAs(role, sCode, dName) {
    currentRole = role; 
    currentStation = sCode; 
    currentStationName = dName;
    
    document.getElementById('display-name').innerText = dName;
    document.getElementById('display-role').innerText = role === 'buyer' ? '復興區居民' : (role === 'pharmacist' ? '特約藥局藥師' : (role === 'driver' ? '物流專車司機' : '衛生局主管/區長'));
    
    document.querySelectorAll('.nav-list .nav-item').forEach(item => {
        item.classList.contains('role-' + role) ? item.classList.add('show') : item.classList.remove('show');
    });
    
    document.getElementById('login-screen').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('login-screen').style.visibility = 'hidden';
        switchPage(role === 'buyer' ? 'buyer-dash' : (role === 'pharmacist' ? 'pharm-dash' : (role === 'driver' ? 'driver-dash' : 'admin-dash')), '主選單');
        fetchSystemData();
    }, 400);
}

function logout() {
    document.getElementById('loginUser').value = ''; 
    document.getElementById('loginPwd').value = '';
    const ls = document.getElementById('login-screen'); 
    ls.style.visibility = 'visible'; 
    ls.style.opacity = '1';
}

function resetSystemData() {
    if (confirm("確定要重設所有庫存、預約與物流調撥紀錄嗎？這會清除您所有的自訂測試資料並恢復初始預設狀態。")) {
        localStorage.removeItem('SmartPharma_Requests');
        localStorage.removeItem('SmartPharma_Inventory');
        location.reload();
    }
}

// Fetch DB & LocalStorage data
function seedMockRequests() {
    let requests = [
        {
            id: "RES-8201",
            from: "民眾",
            to: "DEYI",
            item: "胰島素注射劑 (Insulin) - 糖尿病慢箋",
            drugCode: "I012345678",
            qty: 2,
            status: "同業調撥中",
            time: "05/22 08:30",
            payment: "現場付現",
            pickupTime: "2026-05-22 20:00",
            paidStatus: "未支付",
            price: 1600,
            prescriptionImg: generateDummyPrescriptionBase64("胰島素注射劑 (Insulin) - 糖尿病慢箋", 2),
            prescriptionStatus: "待核實"
        },
        {
            id: "REQ-5401",
            relatedReserveId: "RES-8201",
            from: "SHISHENG_FX",
            to: "DEYI",
            item: "胰島素注射劑 (Insulin) - 糖尿病慢箋",
            drugCode: "I012345678",
            qty: 2,
            status: "專車配送中",
            time: "05/22 08:35",
            targetTime: "2026-05-22 20:00",
            dispatchTime: "05/22 10:15",
            logisticsCondition: "常溫運輸中"
        }
    ];
    syncToDatabase();
    return requests;
}

function getDrugCategory(item) {
    if (item.usageCategory) return item.usageCategory;
    const name = item.drugChineseName || '';
    if (name.includes('克流感') || name.includes('伊普芬液') || name.includes('倍拉維') || name.includes('Paxlovid') || name.includes('Tamiflu')) {
        return '緊急用';
    }
    return '日常用';
}

async function fetchSystemData() {
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
}

async function syncToDatabase() {
    try {
        await firebaseDb.ref('inventory').set(dbInventory);
        await firebaseDb.ref('requests').set(dbRequests);
    } catch (error) {
        console.error("Firebase sync failed:", error);
    }
}
