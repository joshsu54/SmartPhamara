let currentRole = ''; 
let currentStation = ''; 
let currentStationName = '';
let dbInventory = []; 
let dbRequests = []; 
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
                    ? '<span class="badge badge-danger" style="font-size:0.7rem; padding:2px 6px;">Rx ??踵?撱箄降 (?????靽?脩垢?交風?梯撣怎Ⅱ隤蒂?餉?)</span>' 
                    : '<span class="badge badge-success" style="font-size:0.7rem; padding:2px 6px;">OTC ??霅隡潸?湔?蹂誨</span>';

                let substText = `?? ?祆?暺?{tempReserveData.item}??澈摮? ${availableStock} ??銝雲?券?蝝? ${tempReserveData.qty} ??br>
                ? ?刻?訾撮?蹂誨?亙?嚗?strong>${subMed.drugChineseName}</strong> (?砍??曇疏?拚? ${subStock} ??瘥? $${subMed.price})??br>
                ${labelText}<br><br>
                ?典隞伐?<br>
                ??<b>?賊? A (撠?隤踵)</b>嚗????嚗憭扳漯瘥?亙?撠???(???蝑??詨?????br>
                ??<b>?賊? B (?訾撮?蹂誨)</b>嚗??單????賣隞?嚗?湔?函?渡??喳??伐???敺?`;
                
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

    showToast(`撌脫??蝝?蹂誨?亙?嚗?{sub.item}嚗, 'success');
    delete tempReserveData.substitute;
    document.getElementById('substituteAlertBox').style.display = 'none';
}

function keepOriginalOption() {
    if (tempReserveData) {
        tempReserveData.rejectedSubstitute = true;
    }
    document.getElementById('substituteAlertBox').style.display = 'none';
    showToast("撌脤?????伐?撠?刻矽摨衣瘚?頠?, "info");
}

function loadSamplePrescription() {
    const sampleMed = "?格?潭迫?? (Panadol) - ??迫??;
    tempPrescriptionImgBase64 = generateDummyPrescriptionBase64(sampleMed, 1);
    isCustomUploaded = false; // Set to false because this is a simulated template
    
    const preview = document.getElementById('uploadPreview');
    if (preview) {
        preview.src = tempPrescriptionImgBase64;
        preview.style.display = 'block';
        showToast("撌脫????亦?靘??寧??貊?嚗?, "success");
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
            badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> CWA ?芸??單??郊';
        }
        fetchRealTimeWeather();
    } else {
        if (badge) {
            badge.style.background = '#fffbeb';
            badge.style.color = '#d97706';
            badge.style.borderColor = '#fef3c7';
            badge.innerHTML = '<i class="fa-solid fa-flask"></i> 蝟餌絞璅⊥?璅∪?';
        }
        if (val === 'sunny') {
            updateWeatherState('sunny', 10, 0);
            showToast("撌脫??芋?穿??湔?撣豢?憭拇除 (?疏瘞港? 1.0x)", "success");
        } else if (val === 'rainy') {
            updateWeatherState('rainy', 85, 15);
            showToast("撌脫??芋?穿?憭折?孵?郎 (?脫??疏 1.5x)", "warning");
        } else if (val === 'typhoon') {
            updateWeatherState('typhoon', 99, 65);
            showToast("撌脫??芋?穿?憸梢◢霅行?霅行? (??瑁 2.0x)", "error");
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
            badge.innerHTML = '<i class="fa-solid fa-flask"></i> 蝟餌絞璅⊥?璅∪?';
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
        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> CWA ?芸??單??郊';
    }
    const refreshBtn = document.querySelector('#shared-weather-card button');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 頛銝?..';
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
                showToast(`撌脫???甇交??唳除鞊∟???敺抵???仿??隡?${rainSum}mm嚗??冽???${rainProb}%?, 'success');
            }
        }
    } catch (e) {
        console.warn("?? 瘞?情 API ??憭望?嚗?券蝺風?脣像?????嚗?, e);
        let mode = currentWeatherMode || 'sunny';
        updateWeatherState(mode, mode === 'sunny' ? 10 : (mode === 'rainy' ? 85 : 99), mode === 'sunny' ? 0 : (mode === 'rainy' ? 150 : 450));
        if (!isInitial && currentRole) {
            showToast("撌脫????冽除鞊∠蔡甇瑕撟喳??疏靽??? (?Ｙ?璅∪?)", "info");
        }
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> ??渡?瘞?情';
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
        if (icon) icon.innerText = '?儭?;
        if (statusText) statusText.innerText = '?嗅?憭拇除嚗?虜??(?∟郎??';
        if (rainProbLabel) rainProbLabel.innerText = `?璈??摯: ${rainProb}% (?亦敞蝛??${rainSum}mm)`;
        
        if (summaryText) {
            summaryText.innerHTML = `
                <div style="font-weight: 800; color: var(--primary-color); margin-bottom: 6px;"><i class="fa-solid fa-circle-info"></i> CWA 閰喟敦憭拇除?郎?勗???瘣餅?撘?</div>
                <strong>憭?嚗予瘞?帘摰??</strong><br>
                <span style="color: var(--text-muted); font-size: 0.78rem;">??唳???${currentMonth}/${currentDate} ${updateHour}:${updateMin}??/span><br>
                隞??單??剁?${tom.getDate()}?伐?憭拇除?箏??脫??堆??璈?0%嚗?憭拍憭抵??箏??脫??湛??璈??10%?除皞?5??4摨佗??死??單?晞?br>
                憸冽答嚗??◢5????◢8蝝?瘚芷?1???砍偕嚗惇?澆?瘚芾銝剜答??br>
                ???剁???賢予瘞?澈??嚗?鈭憭暑???拇?鋆?瘞游?嚗??摨行??研撥憸函?梧?瘜冽?憸典??頠??具?
            `;
        }
    } else if (mode === 'rainy') {
        if (icon) icon.innerText = '??';
        if (statusText) statusText.innerText = '?嗅?憭拇除嚗之?函??(?脫??疏 1.5x)';
        if (rainProbLabel) rainProbLabel.innerText = `?璈??摯: ${rainProb}% (?亦敞蝛??${rainSum}mm)`;
        
        if (summaryText) {
            summaryText.innerHTML = `
                <div style="font-weight: 800; color: #d97706; margin-bottom: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> CWA 閰喟敦憭拇除?郎?勗???瘣餅?撘?</div>
                <strong>?儭?憭折?孵嚗?瘚蝟餌撅??撅?典??之?函??璈?</strong><br>
                <span style="color: var(--text-muted); font-size: 0.78rem;">??唳???${currentMonth}/${currentDate} ${updateHour}:${updateMin}??/span><br>
                隞??單?憭拙儔?控??趙???Ｗ蔣?選?憭拇除?粹??冽??琿嚗??冽?? ${rainProb}%嚗?隡唳蝝舐??券???${rainSum}mm?除皞?2??8摨佗??死瞈飲??br>
                憸冽答嚗?镼踹?憸?????◢7蝝?瘚芷?1.5?砍偕嚗??撥??◢???br>
                ???剁?撘琿??冽???撅勗??楝閬?銝?楝?Ｘ?皛7蝺???頝舀挾嚗?璁株畾萸毀?菜挾嚗?瘜冽??賜??頠???憭抒?銝行??銵??踹???撅勗?皞芾健敺?瘞港?瘣餃???
            `;
        }
    } else if (mode === 'typhoon') {
        if (icon) icon.innerText = '??';
        if (statusText) statusText.innerText = '?嗅?憭拇除嚗２憸刻郎??(??瑁 2.0x)';
        if (rainProbLabel) rainProbLabel.innerText = `?璈??摯: ${rainProb}% (?亦敞蝛??${rainSum}mm)`;
        
        if (summaryText) {
            summaryText.innerHTML = `
                <div style="font-weight: 800; color: var(--danger-color); margin-bottom: 6px;"><i class="fa-solid fa-circle-exclamation"></i> CWA 閰喟敦憭拇除?郎?勗???瘣餅?撘?</div>
                <strong>?? ?訾?憸梢◢霅血嚗?銝剖漲憸梢◢?唳?敶梢嚗儔?控??脣撘琿◢鞊芷霅行?蝭?</strong><br>
                <span style="color: var(--text-muted); font-size: 0.78rem;">??唳???${currentMonth}/${currentDate} ${updateHour}:${updateMin}??/span><br>
                隞??單?憭拙儔???２憸函??憭??唳??湔敶梢嚗??冽???9%嚗?4撠??摯蝝舐??券???${Math.max(200, Math.round(rainSum * 3))}mm嚗?頞之鞊芷蝑?嚗除皞?0??4摨佗?憸典璆萇撘瑕???br>
                憸冽答嚗??梢◢頧正?◢8????◢11蝝?瘚芷?5?砍偕隞乩?嚗惇?澆楊瘚芥?br>
                ???剁?敺抵?撅勗?撌脣??亙??單?暺???脰郎???7蝺?璈怠頝舫??賢祕?賡??脫批?頝荔?隢控?撅??戎3憭拐遢撣詨??亙?嚗?撠?敹?憭嚗??釣???圈?質??胯?
            `;
        }
    }

    const adminAlertBox = document.getElementById('adminWeatherAlertBox');
    if (adminAlertBox) {
        if (mode === 'sunny') {
            adminAlertBox.style.background = '#f0fdf4';
            adminAlertBox.style.borderLeft = '5px solid var(--secondary-color)';
            adminAlertBox.innerHTML = `
                <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">?儭?/div>
                <div>
                    <h4 style="margin: 0 0 6px 0; color: var(--secondary-color); font-size: 1.1rem; font-weight: 800;">?儭?CWA 銝剖亢瘞?情蝵脤??嚗??儔?控? ?湔?撣豢?</h4>
                    <p style="margin: 0; font-size: 0.92rem; color: var(--text-dark); line-height: 1.6;">
                        ?嗅?憭拇除?瘜?憟踝??楝??⊿??br>
                        <span class="badge badge-success" style="font-size:0.75rem; margin-top:4px;">[AI 瘙箇??瑁?]</span> 蝟餌絞蝬剜?璅?摰?疏瘞港? (摰憭拇 7 憭?/ 1.0x 摰摨怠?)??
                    </p>
                </div>
            `;
        } else if (mode === 'rainy') {
            adminAlertBox.style.background = '#fffbeb';
            adminAlertBox.style.borderLeft = '5px solid var(--warning-color)';
            adminAlertBox.innerHTML = `
                <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">??</div>
                <div>
                    <h4 style="margin: 0 0 6px 0; color: var(--warning-color); font-size: 1.1rem; font-weight: 800;">?? CWA 銝剖亢瘞?情蝵脩?脤??嚗??儔?控? 憭折?孵</h4>
                    <p style="margin: 0; font-size: 0.92rem; color: var(--text-dark); line-height: 1.6;">
                        敺抵?撅勗??璈??摯 <strong>${rainProb}%</strong> (蝝舐??券? ${rainSum}mm)嚗銝??航?潛??嗆???賜憸券??br>
                        <span class="badge badge-danger" style="font-size:0.75rem; margin-top:4px;">[AI 瘙箇??瑁?]</span> 蝟餌絞撌脰??敺瑟∟撅銋?b>摰?疏憭拇??7 憭抵矽? 10.5 憭?(1.5x)</b>嚗蝭??券?頝臬??颱葉?瑯?
                    </p>
                </div>
            `;
        } else if (mode === 'typhoon') {
            adminAlertBox.style.background = '#fff1f2';
            adminAlertBox.style.borderLeft = '5px solid var(--danger-color)';
            adminAlertBox.innerHTML = `
                <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">??</div>
                <div>
                    <h4 style="margin: 0 0 6px 0; color: var(--danger-color); font-size: 1.1rem; font-weight: 800;">? CWA 銝剖亢瘞?情蝵脤憸梁霅佗?獢?敺抵?? 憸梢◢霅血</h4>
                    <p style="margin: 0; font-size: 0.92rem; color: var(--text-dark); line-height: 1.6;">
                        敺抵?撅勗??澆??瘚??脰郎??撅?刻楝畾菟?霅行批???(?亦敞蝛?歇??${rainSum}mm)??br>
                        <span class="badge badge-danger" style="font-size:0.75rem; margin-top:4px;">[AI 瘙箇??瑁?]</span> 蝟餌絞撌脰???典????寧???<b>摰?脣?憭拇隤踹???14 憭?(2.0x)</b>嚗?瘙之皞芣??西撅?瑁???批之摰矽?乓?
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
    let activeTasks = dbRequests.filter(req => req.status === '撌脫?摨? || req.status === '撠??葉');
    
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
                actions.push(`<span style="color:var(--info-color); font-weight:800;"><i class="fa-solid fa-circle-arrow-down"></i> ? 暺鋆?嚗?{task.item} (x${task.qty}??</span>`);
            }
            if (task.to === locCode) {
                actions.push(`<span style="color:var(--secondary-color); font-weight:800;"><i class="fa-solid fa-circle-arrow-up"></i> ?貉疏蝪賣暺?${task.item} (x${task.qty}??</span>`);
            }
        });
        
        let actionText = actions.length > 0 
            ? actions.join('<br>') 
            : `<span style="color:var(--text-muted);"><i class="fa-solid fa-house-chimney"></i> 頠?蝮賡/?箇?游?暺?/span>`;
            
        let distLabel = idx > 0 ? `<div class="roadmap-leg">+ ${legDist.toFixed(1)} km (頠?蝝?${Math.round(legDist * 2)} ??)</div>` : '';
        
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
    let activeTasks = dbRequests.filter(req => req.status === '撌脫?摨?);
    if (activeTasks.length === 0) {
        showToast("?嗅??∪??箇?矽?乩遙??", "warning");
        return;
    }
    
    activeTasks.forEach(req => {
        req.status = '撠??葉';
        req.dispatchTime = getCurrentTime();
        req.logisticsCondition = '撣豢澈?撓銝?;
    });
    
    syncToDatabase();
    showToast("?? ?雿喲??楝蝺歇?嚗?頠歇???箇?蝺?押?, "success");
    updateSystemState();
}

// Coordinates and details for Fuxing & Daxi joint network
const STATIONS_METADATA = {
    'DEYI': { name: '敺瑟∟撅', address: '敺抵??瞉支???摮楝34??, phone: '(03) 382-1686', hours: '08:30-18:30 (?望隡?', lat: 24.8210, lng: 121.3526, district: '敺抵??' },
    'SHISHENG_FX': { name: '?啗?????亙? (敺抵?摨?', address: '憭扳漯?敺抵?頝?6??, phone: '(03) 388-2206', hours: '08:00-22:00 (?典僑?∩?)', lat: 24.8809, lng: 121.2890, district: '憭扳漯?' },
    'GREAT_TREE': { name: '憭扳邦????亙? (憭扳漯摨瑁?摨?', address: '憭扳漯?摨瑁?頝?60??, phone: '(03) 387-3873', hours: '08:00-22:00 (?典僑?∩?)', lat: 24.8801, lng: 121.2872, district: '憭扳漯?' },
    'SHISHENG_KZ': { name: '?啗?????亙? (摨瑁?摨?', address: '憭扳漯?摨瑁?頝?32??, phone: '(03) 388-2276', hours: '08:00-22:00 (?典僑?∩?)', lat: 24.8812, lng: 121.2876, district: '憭扳漯?' },
    'ZISHENG': { name: '鞈?憭扯撅', address: '憭扳漯?敺抵?頝?2-1??, phone: '(03) 388-2026', hours: '08:00-21:30 (?典僑?∩?)', lat: 24.8810, lng: 121.2889, district: '憭扳漯?' }
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
    ctx.fillText('嚗?, 308, 48);

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('銵?蝳?其葉憭桀摨瑚??芰蔡', 30, 45);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#0d9488';
    ctx.fillText('?Ｘ抒?????蝞?(?箸?撽???', 30, 70);

    // Dividers
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(25, 85); ctx.lineTo(335, 85); ctx.stroke();
    
    // Patient info
    ctx.fillStyle = '#334155';
    ctx.font = '13px sans-serif';
    ctx.fillText('憪?: ?之??(WANG DA-MING)', 30, 115);
    ctx.fillText('頨怠?霅??? H123456***', 30, 140);
    ctx.fillText('?箇??交?: 瘞? 68 撟?08 ??23 ??, 30, 165);
    ctx.fillText('?風?Ⅳ: L-908234-A', 30, 190);
    
    ctx.beginPath(); ctx.moveTo(25, 210); ctx.lineTo(335, 210); ctx.stroke();
    
    // Medical Diagnosis & Rx Details
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('??蝡??寡??????, 30, 235);
    
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`[Rx] ${medName}`, 30, 265);
    ctx.fillStyle = '#334155';
    ctx.font = '12px sans-serif';
    ctx.fillText(`蝮賡?: ${qty} ??(靘靽蝡舫?摨行??`, 30, 290);
    ctx.fillText(`?冽?: 瘥摰??嚗?折??蝷槁, 30, 315);
    
    ctx.beginPath(); ctx.moveTo(25, 340); ctx.lineTo(335, 340); ctx.stroke();
    
    // Signature and Stamp
    ctx.font = '12px sans-serif';
    ctx.fillText('??璈?: ??瑕?蝝敹菟??(?寧?隞??: 1132010011)', 30, 365);
    ctx.fillText('銝餅祥?怠葦: ?喳?鞈??怠葦 (蝪賜?撌脤摮??', 30, 390);
    
    // Stamp box
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(240, 395, 75, 55);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('?瑕?蝝敹菟??, 246, 418);
    ctx.fillText('?Ｗ??Ｙ?撠', 246, 438);
    
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
                showToast("??銝銝血?蝮株??寧??抒?嚗?, "success");
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
        showToast(`撌脰??亙董?? ${user}嚗迤?函??..`, 'success');
        setTimeout(() => {
            doLogin();
        }, 400);
    }
}

// Authentication login routing
function doLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pwd = document.getElementById('loginPwd').value;
    if (pwd !== '123') { showToast('撖Ⅳ?航炊嚗?皜祈岫?典?蝣潛 123)', 'error'); return; }
    
    if (user === 'wang') loginAs('buyer', 'none', '?之??);
    else if (user === 'deyi_wang') loginAs('pharmacist', 'DEYI', '敺瑟∟撅');
    else if (user === 'daxi_lin') loginAs('pharmacist', 'SHISHENG_FX', '?啗??儔??');
    else if (user === 'daxi_kz') loginAs('pharmacist', 'SHISHENG_KZ', '?啗??熒??');
    else if (user === 'daxi_tree') loginAs('pharmacist', 'GREAT_TREE', '憭扳邦?亙?摨瑁?摨?);
    else if (user === 'daxi_zisheng') loginAs('pharmacist', 'ZISHENG', '鞈?憭扯撅');
    else if (user === 'admin') loginAs('admin', 'HQ', '獢?撣???蝞∠???敺抵????);
    else if (user === 'driver') loginAs('driver', 'TRUCK', '?拇?隤踵?豢?');
    else showToast('?亦甇文董??隢??牧??, 'error');
}

function loginAs(role, sCode, dName) {
    currentRole = role; 
    currentStation = sCode; 
    currentStationName = dName;
    
    document.getElementById('display-name').innerText = dName;
    document.getElementById('display-role').innerText = role === 'buyer' ? '敺抵??撅?' : (role === 'pharmacist' ? '?寧??亙??亙葦' : (role === 'driver' ? '?拇?撠??豢?' : '銵?撅銝餌恣/???));
    
    document.querySelectorAll('.nav-list .nav-item').forEach(item => {
        item.classList.contains('role-' + role) ? item.classList.add('show') : item.classList.remove('show');
    });
    
    document.getElementById('login-screen').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('login-screen').style.visibility = 'hidden';
        switchPage(role === 'buyer' ? 'buyer-dash' : (role === 'pharmacist' ? 'pharm-dash' : (role === 'driver' ? 'driver-dash' : 'admin-dash')), '銝駁??);
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
    if (confirm("蝣箏?閬?閮剜??澈摮?蝝??拇?隤踵蝝??嚗?皜?冽????芾?皜祈岫鞈?銝行敺拙?憪?閮剔???)) {
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
            from: "瘞",
            to: "DEYI",
            item: "?啣雀蝝釣撠? (Insulin) - 蝟倏?蝞?,
            drugCode: "I012345678",
            qty: 2,
            status: "?平隤踵銝?,
            time: "05/22 08:30",
            payment: "?曉隞",
            pickupTime: "2026-05-22 20:00",
            paidStatus: "?芣隞?,
            price: 1600,
            prescriptionImg: generateDummyPrescriptionBase64("?啣雀蝝釣撠? (Insulin) - 蝟倏?蝞?, 2),
            prescriptionStatus: "敺撖?
        },
        {
            id: "REQ-5401",
            relatedReserveId: "RES-8201",
            from: "SHISHENG_FX",
            to: "DEYI",
            item: "?啣雀蝝釣撠? (Insulin) - 蝟倏?蝞?,
            drugCode: "I012345678",
            qty: 2,
            status: "撠??葉",
            time: "05/22 08:35",
            targetTime: "2026-05-22 20:00",
            dispatchTime: "05/22 10:15",
            logisticsCondition: "撣豢澈?撓銝?
        }
    ];
    dbRequests = requests; syncToDatabase();
    return requests;
}

function getDrugCategory(item) {
    if (item.usageCategory) return item.usageCategory;
    const name = item.drugChineseName || '';
    if (name.includes('????) || name.includes('隡?祆雯') || name.includes('??蝬?) || name.includes('Paxlovid') || name.includes('Tamiflu')) {
        return '蝺亦';
    }
    return '?亙虜??;
}

async function fetchSystemData() {
    try {
        const invRes = await fetch('http://localhost:3000/api/inventory');
        dbInventory = await invRes.json();
        
        dbInventory.forEach(item => {
            item.usageCategory = getDrugCategory(item);
        });

        const reqRes = await fetch('http://localhost:3000/api/requests');
        dbRequests = await reqRes.json();
        
        if (!dbRequests || dbRequests.length === 0) {
            dbRequests = seedMockRequests();
        }
    } catch (e) {
        console.error("?⊥?????喳?蝡航??澈:", e);
        showToast("鞈?摨恍??憭望?嚗?蝣箄?敺垢隡箸??冽?血???, "error");
    }
    
    updateSystemState();
    fetchRealTimeWeather(true);
}

function triggerReservationFlow(drugChineseName, stationCode, isRx) {
    let targetMed = dbInventory.find(m => m.drugChineseName === drugChineseName);
    let uPrice = targetMed ? targetMed.price : 150;
    
    // Check if prescription uploaded for Rx drugs
    if (isRx && (!tempPrescriptionImgBase64 || !isCustomUploaded)) {
        tempPrescriptionImgBase64 = generateDummyPrescriptionBase64(drugChineseName, 1);
        const preview = document.getElementById('uploadPreview');
        if (preview) {
            preview.src = tempPrescriptionImgBase64;
            preview.style.display = 'block';
        }
        showToast("撌脰??刻????湔???貊泵銋摮蝞?霅?", "success");
    }

    tempReserveData = {
        item: drugChineseName,
        drugCode: targetMed ? targetMed.drugCode : '',
        station: stationCode,
        unitPrice: uPrice,
        qty: 1,
        totalPrice: uPrice,
        prescriptionImg: isRx ? tempPrescriptionImgBase64 : ''
    };
    
    if (isRx) {
        document.getElementById('nhiModal').style.display = 'flex';
        document.getElementById('nhiSuccessMsg').style.display = 'none';
        setTimeout(() => { document.getElementById('nhiProgressBar').style.width = '100%'; }, 100);
        setTimeout(() => {
            document.getElementById('nhiSuccessMsg').style.display = 'block';
            setTimeout(() => {
                document.getElementById('nhiModal').style.display = 'none'; 
                document.getElementById('nhiProgressBar').style.width = '0%'; 
                showPaymentModal();
            }, 1200); 
        }, 1500);
    } else { 
        showPaymentModal(); 
    }
}

function buyerSubmitReservation() {
    const drugName = document.getElementById('buyerReserveDrug').value;
    const stationCode = document.getElementById('buyerReserveStation').value;
    
    const med = dbInventory.find(m => m.drugChineseName === drugName);
    const isRx = med ? med.rxOnly : false;
    
    triggerReservationFlow(drugName, stationCode, isRx);
}

function showPaymentModal() {
    document.getElementById('payItemName').innerText = tempReserveData.item;
    document.getElementById('payItemUnitPrice').innerText = tempReserveData.unitPrice;
    document.getElementById('reserveQtyInput').value = 1;
    document.getElementById('payItemTotalPrice').innerText = tempReserveData.unitPrice;
    
    let localStr = new Date(Date.now() + 8*3600*1000).toISOString().slice(0, 16);
    document.getElementById('pickupTimeInput').value = localStr;
    document.getElementById('paymentModal').style.display = 'flex';
    checkSubstitution();
}

function updateTotalPrice() {
    let q = parseInt(document.getElementById('reserveQtyInput').value) || 1;
    if (q < 1) { q = 1; document.getElementById('reserveQtyInput').value = 1; }
    tempReserveData.qty = q;
    tempReserveData.totalPrice = q * tempReserveData.unitPrice;
    document.getElementById('payItemTotalPrice').innerText = tempReserveData.totalPrice;
    
    // Regenerate prescription template to match quantity
    if (tempReserveData.prescriptionImg && !isCustomUploaded) {
        tempReserveData.prescriptionImg = generateDummyPrescriptionBase64(tempReserveData.item, q);
    }
    checkSubstitution();
}

function closePaymentModal() { document.getElementById('paymentModal').style.display = 'none'; }

function processPaymentBranch() {
    let pTime = document.getElementById('pickupTimeInput').value;
    if (!pTime) { showToast("隢??蝝??交???", "warning"); return; }
    updateTotalPrice(); 
    tempReserveData.pickupTime = pTime.replace("T", " ");
    let pMethod = document.querySelector('input[name="payMethod"]:checked').value;
    tempReserveData.payment = pMethod;
    closePaymentModal();
    
    if (pMethod === "靽∠?∠?銝??) { 
        document.getElementById('creditCardModal').style.display = 'flex'; 
    } else { 
        tempReserveData.paidStatus = "?芣隞?; 
        executeReservationAPI(); 
    }
}

function closeCreditCardModal() { document.getElementById('creditCardModal').style.display = 'none'; }
function simulateCardAuthorization() {
    closeCreditCardModal(); 
    document.getElementById('successModal').style.display = 'flex';
    setTimeout(() => { 
        document.getElementById('successModal').style.display = 'none'; 
        tempReserveData.paidStatus = "撌脩?銝隞?; 
        executeReservationAPI(); 
    }, 1800);
}

// Core reservation submission with automatic shuttle routing if low stock
async function executeReservationAPI() {
    let med = dbInventory.find(m => m.drugChineseName === tempReserveData.item);
    if (!med) return;
    
    let targetStationStockField = 'stock_' + tempReserveData.station;
    let availableStock = med[targetStationStockField] || 0;
    
    let needTransfer = false;
    let transferFromStation = '';
    
    // Check if we need to dispatch a shuttle from Daxi district
    if (availableStock < tempReserveData.qty) {
        needTransfer = true;
        // Search Daxi district pharmacies (GREAT_TREE, SHISHENG_FX, etc.) for a donor
        if (med.stock_GREAT_TREE >= tempReserveData.qty) transferFromStation = 'GREAT_TREE';
        else if (med.stock_SHISHENG_FX >= tempReserveData.qty) transferFromStation = 'SHISHENG_FX';
        else if (med.stock_SHISHENG_KZ >= tempReserveData.qty) transferFromStation = 'SHISHENG_KZ';
        else transferFromStation = 'ZISHENG';
        
        showToast("? ?砍?摨怠?銝雲嚗頂蝯勗歇?箸?芸???憭扳漯?舀?亙?嚗????頠矽摨虫葉嚗?, "warning");
    }

    let reserveId = "RES-" + Math.floor(Math.random() * 9000 + 1000);
    let rxStatus = tempReserveData.prescriptionImg ? "敺撖? : "?撽?;
    
    // Deduct stock or generate dispatch
    if (!needTransfer) {
        med[targetStationStockField] -= tempReserveData.qty;
    }

    let newReservation = {
        id: reserveId,
        from: "瘞",
        to: tempReserveData.station,
        item: tempReserveData.item,
        drugCode: tempReserveData.drugCode,
        qty: tempReserveData.qty,
        status: needTransfer ? "?平隤踵銝? : "敺????,
        time: getCurrentTime(),
        payment: tempReserveData.payment,
        pickupTime: tempReserveData.pickupTime,
        paidStatus: tempReserveData.paidStatus,
        price: tempReserveData.totalPrice,
        prescriptionImg: tempReserveData.prescriptionImg,
        prescriptionStatus: rxStatus
    };

    dbRequests.push(newReservation);

    if (needTransfer) {
        // Create matching peer-to-peer shuttle transfer request
        let reqId = "REQ-" + Math.floor(Math.random() * 9000 + 1000);
        let transferReq = {
            id: reqId,
            relatedReserveId: reserveId,
            from: transferFromStation,
            to: tempReserveData.station,
            item: tempReserveData.item,
            drugCode: tempReserveData.drugCode,
            qty: tempReserveData.qty,
            status: "敺祟??,
            time: getCurrentTime(),
            targetTime: tempReserveData.pickupTime,
            dispatchTime: '敺祟??,
            logisticsCondition: '敺鞎?
        };
        dbRequests.push(transferReq);
    }

    try {
        syncToDatabase();
    } catch (error) {
        console.error("LocalStorage write failed:", error);
        showToast("?? ?脣?蝛粹?撌脫遛嚗?蝝摮仃??隢??銝???閮剛??誑皜?蝛粹???, "error");
        return;
    }
    
    // Reset uploader
    tempPrescriptionImgBase64 = '';
    isCustomUploaded = false;
    const preview = document.getElementById('uploadPreview');
    if (preview) preview.style.display = 'none';

    showToast("???Ｙ?鞈??漱??嚗?, "success");
    updateSystemState();
}

// Pharmacist actions
function openPrescriptionVerifyModal(reqId) {
    let req = dbRequests.find(r => r.id === reqId);
    if (!req || !req.prescriptionImg) return;
    activeViewPrescriptionId = reqId;
    document.getElementById('modalPrescriptionImg').src = req.prescriptionImg;
    document.getElementById('prescriptionViewModal').style.display = 'flex';
}

function closePrescriptionViewModal() {
    document.getElementById('prescriptionViewModal').style.display = 'none';
    activeViewPrescriptionId = null;
}

function verifyPrescriptionAction(status) {
    if (!activeViewPrescriptionId) return;
    let req = dbRequests.find(r => r.id === activeViewPrescriptionId);
    if (req) {
        req.prescriptionStatus = status;
        if (status === '撌脫撖行?? && req.status === '敺????) {
            req.status = '敺???;
            showToast(`?撌脤?霅?????脰??亙??游??, 'success');
        } else if (status === '?詨祕?剝??) {
            req.status = '?詨祕?剝??;
            showToast(`撌脤?府???, 'error');
            // rollback inventory
            let med = dbInventory.find(m => m.drugChineseName === req.item);
            if (med) {
                let stockField = 'stock_' + req.to;
                med[stockField] += req.qty;
                syncToDatabase();
            }
        }
        syncToDatabase();
        closePrescriptionViewModal();
        updateSystemState();
    }
}

function apiCompleteReservation(reqId) {
    let r = dbRequests.find(req => req.id === reqId);
    if (r) {
        r.status = '撌脤??亦?獢?;
        r.paidStatus = '撌脫隞?;
        syncToDatabase();
        showToast(`?潸摰?嚗漱??獢?`, 'success');
        updateSystemState();
    }
}

function apiCancelReservation(reqId) {
    if (!confirm('蝣箄???甇日?蝝蒂?遝摰摨怠?嚗?)) return;
    let r = dbRequests.find(req => req.id === reqId);
    if (r) {
        r.status = '撌脣?瘨?;
        let med = dbInventory.find(m => m.drugChineseName === r.item);
        if (med) {
            let stockField = 'stock_' + r.to;
            med[stockField] += r.qty;
            syncToDatabase();
        }
        syncToDatabase();
        showToast(`??撌脣?瘨?`, 'warning');
        updateSystemState();
    }
}

function deleteReservation(id) {
    if (!confirm("蝣箏?閬?斗迨??蝝??嚗迨??撠???方??嗥????矽?亦瘚?瘙?)) {
        return;
    }
    // Delete reservation from dbRequests
    dbRequests = dbRequests.filter(req => req.id !== id);
    // Cascade delete any linked transfer requests matching relatedReserveId
    dbRequests = dbRequests.filter(req => req.relatedReserveId !== id);
    
    try {
        syncToDatabase();
        showToast("撌脫???日?蝝????隤踵?殷?", "success");
    } catch (e) {
        showToast("?脣?憭望?嚗??身鞈?敺?閰?, "error");
    }
    
    updateSystemState();
}

function deleteTransfer(id) {
    if (!confirm("蝣箏?閬?斗迨隤踵蝝??嚗?)) {
        return;
    }
    dbRequests = dbRequests.filter(req => req.id !== id);
    
    try {
        syncToDatabase();
        showToast("撌脫???方矽?亦???", "success");
    } catch (e) {
        showToast("?脣?憭望?嚗??身鞈?敺?閰?, "error");
    }
    
    updateSystemState();
}

// Peer-to-peer transfer dialog
function openTransferModal(drugChineseName) {
    let med = dbInventory.find(m => m.drugChineseName === drugChineseName);
    if (!med) return;
    tempTransferData = { item: drugChineseName, drugCode: med.drugCode };
    document.getElementById('transferItemName').innerText = drugChineseName;

    // Calculate distances and gather candidates
    let candidates = [];
    Object.keys(STATIONS_METADATA).forEach(code => {
        if (code !== currentStation && code !== 'HQ' && code !== 'TRUCK') {
            let meta = STATIONS_METADATA[code];
            let currentStock = med['stock_' + code] || 0;
            let distance = getDistance(currentStation, code);
            candidates.push({
                code: code,
                meta: meta,
                stock: currentStock,
                distance: distance
            });
        }
    });

    // Sort candidates by distance (closest first)
    candidates.sort((a, b) => a.distance - b.distance);

    let optionsHtml = '';
    candidates.forEach(cand => {
        let code = cand.code;
        let meta = cand.meta;
        let dist = cand.distance;
        let currentStock = cand.stock;
        
        let distStr = dist > 0 ? `${dist.toFixed(1)} km` : '0.0 km';
        
        optionsHtml += `
            <label class="payment-method">
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                    <input type="radio" name="transferTarget" value="${code}">
                    <i class="fa-solid fa-store" style="color: var(--secondary-color); font-size: 1.2rem; flex-shrink: 0;"></i> 
                    <div style="min-width: 0;">
                        <span style="font-weight: 750; color: var(--primary-color); font-size: 0.95rem; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${meta.name}</span>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                            ${meta.district} | ?拚?摨怠?: <strong style="color: ${currentStock > 0 ? 'var(--secondary-color)' : 'var(--danger-color)'}; font-weight: 800;">${currentStock}</strong> ??
                        </div>
                    </div>
                </div>
                <span class="badge" style="font-size: 0.8rem; font-weight: 800; background: var(--info-light); color: var(--info-color); border: 1px solid rgba(37, 99, 235, 0.15); display: inline-flex; align-items: center; gap: 4px; border-radius: 9999px; padding: 6px 12px; flex-shrink: 0;">
                    <i class="fa-solid fa-map-pin"></i> 頝 ${distStr}
                </span>
            </label>
        `;
    });

    document.getElementById('transferTargetOptions').innerHTML = optionsHtml;
    document.getElementById('transferQtyInput').value = 5; 
    document.getElementById('transferModal').style.display = 'flex';
}

function closeTransferModal() {
    document.getElementById('transferModal').style.display = 'none';
}

function submitTransferRequest() {
    let checkedRadio = document.querySelector('input[name="transferTarget"]:checked');
    if (!checkedRadio) { showToast("隢??渲撅嚗?, "warning"); return; }
    
    let targetStation = checkedRadio.value;
    let qty = parseInt(document.getElementById('transferQtyInput').value) || 1;
    let targetTime = document.getElementById('transferTargetTime').value;
    let timeStr = targetTime ? targetTime.replace('T', ' ') : '?⊥?摰?;
    
    closeTransferModal();

    let reqId = "REQ-" + Math.floor(Math.random() * 9000 + 1000);
    dbRequests.push({
        id: reqId,
        from: targetStation, // Donor station
        to: currentStation, // Receiver station
        item: tempTransferData.item,
        drugCode: tempTransferData.drugCode,
        qty: qty,
        status: "敺祟??,
        time: getCurrentTime(),
        targetTime: timeStr,
        dispatchTime: '敺祟??,
        logisticsCondition: '敺鞎?
    });
    
    syncToDatabase();
    showToast(`????${STATIONS_METADATA[targetStation].name} ?澆隤踹漲?唾?嚗, 'success');
    updateSystemState();
}

function apiApproveRequest(reqId) {
    let r = dbRequests.find(req => req.id === reqId);
    if (r) {
        r.status = '撌脫?摨?;
        r.dispatchTime = '皞?瘣曇?';
        r.logisticsCondition = '撣豢澈?撓銝?;
        
        let med = dbInventory.find(m => m.drugChineseName === r.item);
        if (med) {
            let fromField = 'stock_' + r.from;
            med[fromField] -= r.qty; // Deduct from donor
            syncToDatabase();
        }
        syncToDatabase();
        showToast(`?詨?隤踵嚗?蝑?頠??嗡辣?, 'success');
        updateSystemState();
    }
}

function apiRejectRequest(reqId) {
    if (!confirm('蝣箏???迨?唾?嚗?)) return;
    let r = dbRequests.find(req => req.id === reqId);
    if (r) {
        r.status = '撌脤??;
        syncToDatabase();
        showToast(`撌脫?蝯矽?亥?瘙, 'warning');
        updateSystemState();
    }
}

// Switch dashboard page
function switchPage(pageId, pageTitle) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active')); 
    document.querySelectorAll('.nav-list .nav-item').forEach(n => n.classList.remove('active'));
    
    const pageElement = document.getElementById(pageId);
    if(pageElement) pageElement.classList.add('active');
    
    if (event && event.currentTarget && event.currentTarget.classList) {
        event.currentTarget.classList.add('active');
    }
    document.getElementById('header-title').innerText = pageTitle;

    const weatherCard = document.getElementById('shared-weather-card');
    if (weatherCard) {
        if (currentRole === 'pharmacist' || currentRole === 'admin' || currentRole === 'buyer') {
            weatherCard.style.display = 'flex';
        } else {
            weatherCard.style.display = 'none';
        }
    }
}

function filterTable() { 
    renderInventoryTable(); 
}

// Master state updates & rendering
function updateSystemState() {
    renderInventoryTable(); 
    renderInboxTable(); 
    renderReservationTable(); 
    renderBuyerOrderTable();
    renderPharmacyHours();
    

    if (currentRole === 'driver') {
        renderDriverTasks();
        optimizeDriverRoute();
        
        let activeTask = dbRequests.find(req => req.status === '撠??葉');
        if (activeTask) {
            if (!liveNavInterval) {
                startLiveNavigationLoop(activeTask);
            }
        } else {
            if (liveNavInterval) {
                stopLiveNavigationLoop();
            }
        }
    } else {
        if (liveNavInterval) {
            stopLiveNavigationLoop();
        }
    }
    if (currentRole === 'admin') { 
        renderAdminCharts(); 
        renderAdminTransferTable(); 
    }
    
    let myStockField = 'stock_' + currentStation;
    let threshold = getSafetyStockThreshold();
    let urgentCount = dbInventory.filter(item => (item[myStockField] || 0) < threshold).length;
    let todoCount = dbRequests.filter(req => req.from === currentStation && req.status === '敺祟??).length;
    let resCount = dbRequests.filter(req => req.to === currentStation && req.from === '瘞' && (req.prescriptionStatus === '敺撖? || req.status === '?平隤踵銝?)).length;
    
    if (document.getElementById('dash-urgent-count')) {
        document.getElementById('dash-urgent-count').innerText = urgentCount;
        let urgentTitle = document.getElementById('dash-urgent-count').previousElementSibling;
        if (urgentTitle) {
            urgentTitle.innerText = `摰瘞港???(<${threshold}??`;
        }
    }
    if (document.getElementById('dash-todo-count')) document.getElementById('dash-todo-count').innerText = todoCount;
    if (document.getElementById('dash-res-count')) document.getElementById('dash-res-count').innerText = resCount;

    let aiCard = document.getElementById('aiAdjustmentCard'); 
    let aiText = document.getElementById('aiAdjustmentText');
    if (aiCard && aiText && currentRole === 'pharmacist') {
        let factor = currentWeatherMode === 'rainy' ? '1.5' : (currentWeatherMode === 'typhoon' ? '2.0' : '1.0');
        let modeChinese = currentWeatherMode === 'rainy' ? '憭折?孵' : (currentWeatherMode === 'typhoon' ? '憸梢◢霅行?' : '?湔?撣豢?');
        let futureOrders = dbRequests.filter(req => req.to === currentStation && req.from === '瘞' && (req.status === '敺??? || req.status === '敺????));
        
        if (currentWeatherMode !== 'sunny' || futureOrders.length > 0) {
            aiCard.style.backgroundColor = '#fff1f2'; 
            aiCard.style.borderTop = '4px solid var(--danger-color)';
            aiText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-color);"></i> <b>AI 摨怠??脩撩?郎 (${modeChinese})嚗?/b> ?嗅?摰瘞港?隤踵??<b>${threshold} ??(${factor}x)</b>??br>?砍??桀???<b>${futureOrders.length} 蝑?/b> ?Ｙ??????I撌脖蜓?矽??瘙??銝血??亙之皞芾?瘚??`;
        } else {
            aiCard.style.backgroundColor = '#f0fdfa'; 
            aiCard.style.borderTop = '4px solid var(--secondary-color)';
            aiText.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--secondary-color);"></i> ?典??刻瘨?瘞?情? (${modeChinese}) ?摰???改?摨怠?蝬剜??箸? <b>${threshold} ??(1.0x)</b>?;
        }
    }
    
    const badge = document.getElementById('inbox-badge'); 
    if (badge) { 
        if (todoCount > 0) { 
            badge.innerText = todoCount; 
            badge.style.display = 'inline-block'; 
        } else { 
            badge.style.display = 'none'; 
        } 
    }
}

// Render joint pharmacy hours
function renderPharmacyHours() {
    const grid = document.getElementById('pharmacyHoursGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    Object.keys(STATIONS_METADATA).forEach(code => {
        if (code === 'HQ' || code === 'TRUCK') return;
        let p = STATIONS_METADATA[code];
        let card = document.createElement('div');
        card.className = 'pharmacy-hours-card';
        
        let isOpen = code === 'DEYI' || p.hours.includes('?典僑?∩?') ? '<span class="badge badge-success">?平銝?/span>' : '<span class="badge badge-warning">????</span>';
        
        card.innerHTML = `
            <div class="pharmacy-hours-name">${p.name} ${isOpen}</div>
            <div class="pharmacy-hours-detail"><b>?? ???啣?:</b> ${p.address}</div>
            <div class="pharmacy-hours-detail"><b>?? ??窗?餉店:</b> ${p.phone}</div>
            <div class="pharmacy-hours-detail"><b>???平??:</b> ${p.hours}</div>
        `;
        grid.appendChild(card);
    });
}

function setInventoryFilter(filterType) {
    currentInventoryFilter = filterType;
    const tabs = {
        'all': 'tab-all',
        'daily': 'tab-daily',
        'emergency': 'tab-emergency'
    };
    Object.keys(tabs).forEach(k => {
        const btn = document.getElementById(tabs[k]);
        if (btn) {
            if (k === filterType) {
                btn.style.background = 'white';
                btn.style.color = 'var(--primary-color)';
                btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-muted)';
                btn.style.boxShadow = 'none';
            }
        }
    });
    renderInventoryTable();
}

// Render dynamic stock tables matching INAE3000S01 columns
function renderInventoryTable() {
    const thead = document.getElementById('inventoryThead');
    const tbody = document.querySelector('#inventoryTable tbody'); 
    if (!tbody || !thead) return; 

    let threshold = getSafetyStockThreshold();

    // Generate table header depending on user role
    let thHtml = `<tr><th>?乩??亦Ⅳ / ATC</th><th>?亙????惇??/th><th>?芯?憿?/th>`;
    if (currentRole === 'buyer') {
        thHtml += `<th>敺瑟∟撅(敺抵?)</th>`;
    } else {
        // admin, driver, or pharmacist
        thHtml += `<th>敺瑟?敺抵?)</th><th>?啗??儔??憭扳漯)</th><th>憭扳邦摨瑁?(憭扳漯)</th><th>?啗??熒??憭扳漯)</th><th>鞈?(憭扳漯)</th>`;
    }
    thHtml += `<th>?券?憿?/th><th>頝典?隤踵??蝝捱蝑?/th></tr>`;
    thead.innerHTML = thHtml;

    tbody.innerHTML = '';
    const kw = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    
    dbInventory.filter(item => {
        // Keyword text match
        const matchKw = item.drugChineseName.toLowerCase().includes(kw) || 
                        item.drugCode.toLowerCase().includes(kw) ||
                        item.atcCode.toLowerCase().includes(kw);
        if (!matchKw) return false;
        
        // Category filter match
        const category = getDrugCategory(item);
        if (currentInventoryFilter === 'daily') {
            return category === '?亙虜??;
        } else if (currentInventoryFilter === 'emergency') {
            return category === '蝺亦';
        }
        return true;
    }).forEach(item => {
        let actionBtn = '';
        if (currentRole === 'buyer') {
            actionBtn = `
                <div style="display:flex; gap:5px; flex-direction:column;">
                    <button class="btn btn-info" style="font-size:0.75rem;padding:4px 8px;" onclick="triggerReservationFlow('${item.drugChineseName}', 'DEYI', ${item.rxOnly})">??敺瑟?/button>
                </div>
            `;
        } else if (currentRole === 'pharmacist') {
            let myStock = item['stock_' + currentStation] || 0;
            actionBtn = myStock < threshold 
                ? `<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem;" onclick="openTransferModal('${item.drugChineseName}')"><i class="fa-solid fa-truck-ramp-box"></i> ?交???/button>` 
                : `<button class="btn btn-primary" style="padding:6px 12px;font-size:0.8rem; background:var(--primary-light);" onclick="openTransferModal('${item.drugChineseName}')"><i class="fa-solid fa-boxes-stacked"></i> 隤踵摨怠?</button>`;
        } else if (currentRole === 'admin') { 
            actionBtn = `<button class="btn btn-primary" style="background:#475569;padding:6px 12px;font-size:0.8rem;" onclick="showFlowLog('${item.drugChineseName}')">撖抵?蝔賣</button>`; 
        }

        let nameHtml = item.rxOnly 
            ? `<strong>${item.drugChineseName}</strong> <br><small style="color:var(--text-muted);">${item.drugEnglishName}</small> <span class="badge badge-danger" style="font-size:0.65rem; padding:2px 6px;">Rx ?蝞</span>` 
            : `<strong>${item.drugChineseName}</strong> <br><small style="color:var(--text-muted);">${item.drugEnglishName}</small> <span class="badge badge-success" style="font-size:0.65rem; padding:2px 6px;">OTC ?</span>`;
        
        let stockCells = '';
        if (currentRole === 'buyer') {
            stockCells = `
                <td style="${item.stock_DEYI < threshold ? 'color:var(--danger-color);font-weight:bold;' : ''}">${item.stock_DEYI} ??/td>
            `;
        } else {
            stockCells = `
                <td style="${item.stock_DEYI < threshold ? 'color:var(--danger-color);font-weight:bold;' : ''}">${item.stock_DEYI} ??/td>
                <td style="${item.stock_SHISHENG_FX < threshold ? 'color:var(--danger-color);font-weight:bold;' : ''}">${item.stock_SHISHENG_FX} ??/td>
                <td style="${item.stock_GREAT_TREE < threshold ? 'color:var(--danger-color);font-weight:bold;' : ''}">${item.stock_GREAT_TREE} ??/td>
                <td style="${item.stock_SHISHENG_KZ < threshold ? 'color:var(--danger-color);font-weight:bold;' : ''}">${item.stock_SHISHENG_KZ} ??/td>
                <td style="${item.stock_ZISHENG < threshold ? 'color:var(--danger-color);font-weight:bold;' : ''}">${item.stock_ZISHENG} ??/td>
            `;
        }

        const category = getDrugCategory(item);
        let categoryBadge = '';
        if (category === '蝺亦') {
            categoryBadge = `<span class="badge" style="background:#fff1f2; color:#e11d48; font-weight:800;"><i class="fa-solid fa-kit-medical"></i> 蝺亦</span>`;
        } else {
            categoryBadge = `<span class="badge" style="background:#f0fdf4; color:#16a34a; font-weight:800;"><i class="fa-solid fa-calendar-day"></i> ?亙虜??/span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${item.drugCode}</code><br><small style="color:var(--text-muted);">${item.atcCode}</small></td>
            <td>${nameHtml}</td>
            <td style="font-weight:bold; color:var(--text-dark);">$ ${item.price}</td>
            ${stockCells}
            <td>${categoryBadge}</td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Render resident reservations & transport stepper
function renderBuyerOrderTable() {
    const tbody = document.querySelector('#buyerOrderTable tbody'); 
    if (!tbody) return; 
    tbody.innerHTML = '';
    
    let myOrders = dbRequests.filter(req => req.from === '瘞');
    if (myOrders.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding: 30px;">?桀??⊥蝞?蝝???/td></tr>`; 
        return; 
    }
    
    myOrders.forEach(req => {
        let pName = STATIONS_METADATA[req.to] ? STATIONS_METADATA[req.to].name : req.to;
        let paidBadge = req.paidStatus.includes('撌?) 
            ? `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> ${req.paidStatus}</span>` 
            : `<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> ${req.paidStatus}</span>`;
            
        let rxImgBadge = req.prescriptionImg 
            ? `<span class="badge badge-info" style="cursor:pointer;" onclick="viewOnlyPrescription('${req.id}')"><i class="fa-solid fa-image"></i> ?亦??蝪賢?</span>` 
            : `<span class="badge badge-success">??霅?/span>`;

        // Check if there is an active peer-to-peer shuttle transfer linked
        let linkedTransfer = dbRequests.find(t => t.relatedReserveId === req.id);
        
        let statusBadge = '';
        let stepperHtml = '';
        
        if (linkedTransfer) {
            // Low stock, shuttle transport routing activated!
            if (linkedTransfer.status === '敺祟??) {
                statusBadge = `<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> 隤踵敺Ⅱ隤?/span>`;
                stepperHtml = generateStepperMarkup(2, '蝑??舀?亙?蝣箄?隤踵');
            } else if (linkedTransfer.status === '撌脫?摨?) {
                statusBadge = `<span class="badge badge-warning"><i class="fa-solid fa-truck-ramp-box"></i> 憭扳漯?葉</span>`;
                stepperHtml = generateStepperMarkup(3, '憭扳漯隤踹漲撠??葉');
            } else if (linkedTransfer.status === '撠??葉') {
                statusBadge = `<span class="badge badge-warning"><i class="fa-solid fa-truck fa-spin"></i> ?拇??葉</span>`;
                stepperHtml = generateStepperMarkup(3, `?拇?頠?銵葉`);
            } else if (linkedTransfer.status === '撌脤?蝪賣') {
                statusBadge = `<span class="badge badge-success"><i class="fa-solid fa-store"></i> 撌脤?敺?</span>`;
                stepperHtml = generateStepperMarkup(4, '?亙?撌脤?敺瑟∟撅');
            } else if (linkedTransfer.status === '撌脤??) {
                statusBadge = `<span class="badge badge-danger"><i class="fa-solid fa-xmark"></i> 隤踵鋡急?蝯?/span>`;
                stepperHtml = '<div style="color:var(--danger-color); font-size:0.8rem; font-weight:bold;">???舀?亙???隤踵嚗??舐窗?亙?嚗?/div>';
            }
        } else {
            // Standard direct stock
            if (req.prescriptionStatus === '敺撖?) {
                statusBadge = `<span class="badge badge-warning">?撖拇銝?/span>`;
                stepperHtml = generateStepperMarkup(1, '敺噸?∟撣怎???);
            } else if (req.prescriptionStatus === '撌脫撖行?? && req.status !== '撌脤??亦?獢?) {
                statusBadge = `<span class="badge badge-info">?銝?/span>`;
                stepperHtml = generateStepperMarkup(2, '?亙葦?詨祕嚗迤?券???);
            } else if (req.status === '撌脤??亦?獢?) {
                statusBadge = `<span class="badge badge-success">?蝯?</span>`;
                stepperHtml = generateStepperMarkup(4, '撌脤??亦?獢?);
            } else if (req.status === '?詨祕?剝??) {
                statusBadge = `<span class="badge badge-danger">撖拇?芷?</span>`;
                stepperHtml = '<div style="color:var(--danger-color); font-size:0.8rem; font-weight:bold;">???蝞?霅祟?詨仃??隢??唬??喉?</div>';
            } else {
                statusBadge = `<span class="badge badge-info">敺???/span>`;
                stepperHtml = generateStepperMarkup(2, '隢?撣嗅靽甇??啣?');
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code style="background:#e2e8f0; padding:3px 6px; border-radius:4px;">${req.id}</code></td>
            <td><b>${pName}</b></td>
            <td>${rxImgBadge}</td>
            <td><strong>${req.item}</strong> (x${req.qty}??</td>
            <td style="color:var(--primary-color); font-weight:600;">${req.pickupTime}</td>
            <td>$ ${req.price}<br>${paidBadge}</td>
            <td>
                <div style="margin-bottom:5px;">${statusBadge}</div>
                ${stepperHtml}
            </td>
            <td>
                <button class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="deleteReservation('${req.id}')">
                    <i class="fa-solid fa-trash-can"></i> ?芷
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function viewOnlyPrescription(reqId) {
    let req = dbRequests.find(r => r.id === reqId);
    if (req && req.prescriptionImg) {
        document.getElementById('modalPrescriptionImg').src = req.prescriptionImg;
        document.getElementById('prescriptionViewModal').style.display = 'flex';
        // hide buttons to make it view-only
        document.querySelectorAll('#prescriptionViewModal .btn').forEach(btn => {
            if (btn.innerText.includes('??')) btn.style.display = 'inline-flex';
            else btn.style.display = 'none';
        });
    }
}

// Interactive stepper builder
function generateStepperMarkup(activeStep, note) {
    let steps = [
        { num: 1, label: '????' },
        { num: 2, label: '?撖拚?' },
        { num: 3, label: '撠?隤踵' },
        { num: 4, label: '????' }
    ];
    let widthPercent = ((activeStep - 1) / 3) * 100;
    
    let stepsHtml = steps.map(s => {
        let isActive = s.num <= activeStep ? 'active' : '';
        return `
            <div class="logistics-step ${isActive}">
                <div class="logistics-dot">${s.num}</div>
                <div class="logistics-label">${s.label}</div>
            </div>
        `;
    }).join('');

    return `
        <div style="min-width: 260px; padding: 5px 0;">
            <div class="logistics-timeline" style="margin: 15px 0;">
                <div class="logistics-progress-bar" style="width: ${widthPercent}%;"></div>
                ${stepsHtml}
            </div>
            <div style="font-size:0.75rem; text-align:center; color:var(--secondary-color); font-weight:800;">
                ? ${note}
            </div>
        </div>
    `;
}

// Render pharmacist reservation verification list
function renderReservationTable() {
    const tbody = document.querySelector('#reservationTable tbody'); 
    if (!tbody) return; 
    tbody.innerHTML = '';
    
    let myRes = dbRequests.filter(req => req.to === currentStation && req.from === '瘞');
    if (myRes.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">?嗅??∪?瘞蝞?蝝?/td></tr>`; 
        return; 
    }
    
    myRes.forEach(req => {
        let verifyBtn = '';
        if (req.prescriptionImg) {
            if (req.prescriptionStatus === '敺撖?) {
                verifyBtn = `<button class="btn btn-info" style="padding:4px 8px; font-size:0.75rem;" onclick="openPrescriptionVerifyModal('${req.id}')"><i class="fa-solid fa-file-signature"></i> 撖拇??貊?</button>`;
            } else {
                verifyBtn = `<span class="badge badge-success" style="cursor:pointer;" onclick="openPrescriptionVerifyModal('${req.id}')">${req.prescriptionStatus} (暺??亦?)</span>`;
            }
        } else {
            verifyBtn = `<span class="badge badge-success">??霅?/span>`;
        }

        let actionCell = '';
        if (req.status === '敺???? || req.status === '敺???) {
            actionCell = `
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-success" style="padding:5px 10px; font-size:0.78rem;" onclick="apiCompleteReservation('${req.id}')">?潸蝯?</button>
                    <button class="btn btn-danger" style="padding:5px 10px; font-size:0.78rem;" onclick="apiCancelReservation('${req.id}')">??澈摮?/button>
                </div>
            `;
        } else {
            actionCell = `<span style="color:var(--text-muted); font-weight:700;"><i class="fa-solid fa-check-double"></i> ${req.status}</span>`;
        }

        let paidBadge = req.paidStatus.includes('撌?) 
            ? `<span class="badge badge-success">${req.paidStatus}</span>` 
            : `<span class="badge badge-danger">${req.paidStatus}</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; color:var(--primary-light);">${req.pickupTime}</td>
            <td><b>?之??/b> <br><small style="color:var(--text-muted);">?乩??⊥?撠迤撣?/small></td>
            <td>${verifyBtn}</td>
            <td><strong>${req.item}</strong> (x${req.qty} ??</td>
            <td>$ ${req.price}<br>${paidBadge}</td>
            <td>${actionCell}</td>
            <td>
                <button class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="deleteReservation('${req.id}')">
                    <i class="fa-solid fa-trash-can"></i> ?芷
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render pharmacist peer-to-peer transfer table
function renderInboxTable() {
    const tbodyInbox = document.querySelector('#inboxTable tbody'); 
    const tbodyOutbox = document.querySelector('#outboxTable tbody'); 
    if (!tbodyInbox || !tbodyOutbox) return; 
    
    tbodyInbox.innerHTML = '';
    tbodyOutbox.innerHTML = '';
    
    // Inbound: other pharmacies requesting help from currentStation (currentStation is the donor 'from')
    let myInbox = dbRequests.filter(req => req.from === currentStation && req.to !== '瘞');
    myInbox.forEach(req => {
        let btns = '';
        if (req.status === '敺祟??) {
            btns = `
                <button class="btn btn-success" style="padding:5px 10px;" onclick="apiApproveRequest('${req.id}')"><i class="fa-solid fa-check"></i> ?迂?箏澈</button>
                <button class="btn btn-danger" style="padding:5px 10px;" onclick="apiRejectRequest('${req.id}')"><i class="fa-solid fa-xmark"></i> ??</button>
            `;
        } else {
            btns = `<span style="font-weight:800;color:var(--secondary-color);">${req.status}</span>`;
        }
        
        let badgeStr = '';
        if (req.status === '敺祟??) badgeStr = `<span class="badge badge-warning"><i class="fa-solid fa-spinner fa-spin"></i> 敺?撖拚?</span>`;
        else if (req.status === '撌脫?摨?) badgeStr = `<span class="badge badge-info"><i class="fa-solid fa-box"></i> 撌脫???嗡辣</span>`;
        else if (req.status === '撠??葉') badgeStr = `<span class="badge badge-warning"><i class="fa-solid fa-truck"></i> ?拇?頠疏銝?/span>`;
        else if (req.status === '撌脤?蝪賣') badgeStr = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> 隤踵摰?</span>`;
        else badgeStr = `<span class="badge badge-danger">${req.status}</span>`;

        let toName = STATIONS_METADATA[req.to] ? STATIONS_METADATA[req.to].name : req.to;

        const tr = document.createElement('tr'); 
        tr.innerHTML = `
            <td>${req.time}</td>
            <td><b>${toName}</b></td>
            <td><strong>${req.item}</strong></td>
            <td>${req.qty} ??/td>
            <td>${badgeStr}</td>
            <td>${btns}</td>
            <td>
                <button class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="deleteTransfer('${req.id}')">
                    <i class="fa-solid fa-trash-can"></i> ?芷
                </button>
            </td>
        `; 
        tbodyInbox.appendChild(tr);
    });
    
    // Outbound: currentStation requesting help from other pharmacies (currentStation is the receiver 'to')
    let myOutbox = dbRequests.filter(req => req.to === currentStation && req.from !== '瘞');
    myOutbox.forEach(req => {
        let badgeStr = '';
        if (req.status === '敺祟??) badgeStr = `<span class="badge badge-warning"><i class="fa-solid fa-spinner fa-spin"></i> 敺??孵祟??/span>`;
        else if (req.status === '撌脫?摨?) badgeStr = `<span class="badge badge-info"><i class="fa-solid fa-box"></i> 皞??箇</span>`;
        else if (req.status === '撠??葉') badgeStr = `<span class="badge badge-warning"><i class="fa-solid fa-truck fa-spin"></i> 隤輸?撠??葉</span>`;
        else if (req.status === '撌脤?蝪賣') badgeStr = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> 撌脤??嗥偷??/span>`;
        else badgeStr = `<span class="badge badge-danger">${req.status}</span>`;
        
        let fromName = STATIONS_METADATA[req.from] ? STATIONS_METADATA[req.from].name : req.from;

        const tr = document.createElement('tr'); 
        tr.innerHTML = `
            <td>${req.time}</td>
            <td><b>${fromName}</b></td>
            <td><strong>${req.item}</strong></td>
            <td>${req.qty} ??/td>
            <td>${badgeStr}</td>
            <td>
                <button class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="deleteTransfer('${req.id}')">
                    <i class="fa-solid fa-trash-can"></i> ?芷
                </button>
            </td>
        `; 
        tbodyOutbox.appendChild(tr);
    });
}



// Render logistics vehicle shuttle list
function renderDriverTasks() {
    const container = document.getElementById('driverTaskList'); 
    if (!container) return; 
    container.innerHTML = '';
    
    let driverTasks = dbRequests.filter(req => req.status === '撌脫?摨? || req.status === '撠??葉');
    if (driverTasks.length === 0) { 
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color:var(--text-muted);">
                <i class="fa-solid fa-mug-hot" style="font-size:3rem; margin-bottom:15px; color:var(--border-color);"></i><br>
                ?桀??∟楊?隤踵隞餃?嚗瘚?敺隡銝准?
            </div>
        `; 
        return; 
    }
    
    driverTasks.forEach(req => {
        let card = document.createElement('div'); 
        card.style = "background: #fff; border: 1px solid var(--border-color); border-left: 6px solid var(--info-color); padding: 20px; border-radius: var(--radius-md); box-shadow: var(--card-shadow);";
        
        let fromMeta = STATIONS_METADATA[req.from];
        let toMeta = STATIONS_METADATA[req.to];
        let fromName = fromMeta ? fromMeta.name : req.from;
        let toName = toMeta ? toMeta.name : req.to;
        
        let targetTimeHtml = `
            <div style="font-size:0.85rem; color:var(--warning-color); margin-bottom:10px; font-weight:bold;">
                <i class="fa-solid fa-clock"></i> ??????嚗?{req.targetTime || '靘璈?蝔?}
            </div>
        `;

        let actionHtml = '';
        if (req.status === '撌脫?摨?) {
            actionHtml = `
                <div style="background:#f8fafc; padding:12px; border-radius:var(--radius-sm); margin-top:12px; border:1px solid var(--border-color);">
                    <label style="font-size:0.8rem; font-weight:bold; color:var(--primary-color); display:block; margin-bottom:8px;">閮剖?隤踵撠????箇??嚗?/label>
                    <input type="datetime-local" id="dispatchTime_${req.id}" class="login-input" style="width:100%; padding:8px; font-size:0.9rem; margin-bottom:8px;">
                    <button class="btn btn-info" style="width:100%;" onclick="apiDriverDepart('${req.id}')"><i class="fa-solid fa-calendar-check"></i> 蝣箏??亙銝血?潮???/button>
                </div>
            `;
        } else if (req.status === '撠??葉') {
            actionHtml = `
                <button class="btn btn-success" style="width:100%; margin-top:12px;" onclick="apiDriverArrive('${req.id}')">
                    <i class="fa-solid fa-map-location-dot"></i> 蝣箄??菟?蝯?銝阡??嗥偷??
                </button>
            `;
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
                <span style="font-weight:800; color:var(--primary-color);">${req.item} (x${req.qty} ??</span>
                <span class="badge badge-warning">${req.status}</span>
            </div>
            ${targetTimeHtml}
            <div style="font-size:0.88rem; color:var(--text-muted); margin-bottom: 6px;"><i class="fa-solid fa-circle" style="color:var(--secondary-color); font-size:0.6rem;"></i> <b>韏琿? (?箄疏瘥)嚗?/b> ${fromName}</div>
            <div style="font-size:0.88rem; color:var(--text-muted); margin-bottom: 6px;"><i class="fa-solid fa-location-dot" style="color:var(--danger-color); font-size:0.6rem;"></i> <b>蝯? (???亙?)嚗?/b> ${toName}</div>
            ${actionHtml}
        `;
        container.appendChild(card);
    });
}

function apiDriverDepart(reqId) {
    let tInput = document.getElementById('dispatchTime_' + reqId);
    let departTime = tInput && tInput.value ? tInput.value.replace('T', ' ') : '蝡?箇';
    
    let r = dbRequests.find(req => req.id === reqId);
    if (r) {
        r.status = '撠??葉';
        r.dispatchTime = departTime;
        r.logisticsCondition = '撣豢澈?撓銝?;
        syncToDatabase();
        showToast(`撌脫?桀頠??箇??嚗?{departTime}`, 'success');
        updateSystemState();
    }
}

function apiDriverArrive(reqId) {
    let r = dbRequests.find(req => req.id === reqId);
    if (r) {
        r.status = '撌脤?蝪賣';
        r.logisticsCondition = '撌脤?';
        
        // Add stock to target station
        let med = dbInventory.find(m => m.drugChineseName === r.item);
        if (med) {
            let toField = 'stock_' + r.to;
            med[toField] = (med[toField] || 0) + r.qty;
            syncToDatabase();
        }

        // If this transfer was linked to a resident reservation, update its state as well!
        if (r.relatedReserveId) {
            let res = dbRequests.find(req => req.id === r.relatedReserveId);
            if (res) {
                res.status = '敺???; // Transition resident status from '?平隤踵銝? to '敺???
                res.prescriptionStatus = '撌脫撖行??; // Automatically set verified because the transfer completed
            }
        }

        syncToDatabase();
        showToast(`隤踵?亙?撌脤??塚?摰?亙澈嚗, 'success');
        updateSystemState();
    }
}

// =========================================================================
// ?妣 DRIVER LIVE GPS NAVIGATION SIMULATOR
// =========================================================================

function startLiveNavigationLoop(task) {
    activeNavTask = task;
    navProgressPct = 0;

    const navCard = document.getElementById('driverLiveNavCard');
    if (navCard) navCard.style.display = 'block';

    if (liveNavInterval) clearInterval(liveNavInterval);

    // Weather linkage: advisory based on weather
    const hazardText = document.getElementById('hazardText');
    const hazardBox = document.getElementById('mountainHazardAlert');
    if (hazardText && hazardBox) {
        if (currentWeatherMode === 'rainy' || currentWeatherMode === 'typhoon') {
            hazardText.innerText = 'CWA ?賡?????嚗?儔?控?甇??/?郎?晞控?頝舀挾??憭折???喉???蝺?璈怠頝臬歇????30km/h嚗????抒?銝行??銵?瘜冽?銵?摰嚗?;
            hazardBox.style.background = '#fef2f2';
            hazardBox.style.borderColor = '#fee2e2';
            hazardBox.style.color = '#b91c1c';
        } else {
            hazardText.innerText = '?帖?祈楝憭拙憟賬楝?Ｖ嗾?伐?閬?皜????50km/h嚗?靽?摰頠?嚗?頠像摰?;
            hazardBox.style.background = '#f0fdf4';
            hazardBox.style.borderColor = '#bbf7d0';
            hazardBox.style.color = '#15803d';
        }
    }

    // Inject alert keyframes style if not exists
    if (!document.getElementById('nav-style-inject')) {
        const style = document.createElement('style');
        style.id = 'nav-style-inject';
        style.innerHTML = `
            @keyframes blinker {
                50% { opacity: 0.3; }
            }
        `;
        document.head.appendChild(style);
    }

    liveNavInterval = setInterval(updateLiveNavigation, 1000);

    updateLiveNavigation();

    if (isVoiceNavEnabled) {
        speakText("撠??單?撠?????楝畾萇?? + (STATIONS_METADATA[task.from] ? STATIONS_METADATA[task.from].name : task.from) + "??" + (STATIONS_METADATA[task.to] ? STATIONS_METADATA[task.to].name : task.to));
    }
}

function stopLiveNavigationLoop() {
    if (liveNavInterval) clearInterval(liveNavInterval);
    liveNavInterval = null;
    activeNavTask = null;

    const navCard = document.getElementById('driverLiveNavCard');
    if (navCard) navCard.style.display = 'none';
}

function updateLiveNavigation() {
    if (!activeNavTask) {
        stopLiveNavigationLoop();
        return;
    }

    navProgressPct += 2.5; // Complete in 40 intervals (~40s)
    if (navProgressPct > 100) navProgressPct = 100;

    const startMeta = STATIONS_METADATA[activeNavTask.from] || { lat: 24.8809, lng: 121.2890, name: activeNavTask.from };
    const endMeta = STATIONS_METADATA[activeNavTask.to] || { lat: 24.8210, lng: 121.3526, name: activeNavTask.to };

    // Linear interpolation for simulated GPS coordinates
    const currentLat = startMeta.lat + (endMeta.lat - startMeta.lat) * (navProgressPct / 100);
    const currentLng = startMeta.lng + (endMeta.lng - startMeta.lng) * (navProgressPct / 100);

    const latEl = document.getElementById('liveLat');
    const lngEl = document.getElementById('liveLng');
    if (latEl && lngEl) {
        latEl.innerText = currentLat.toFixed(4);
        lngEl.innerText = currentLng.toFixed(4);
    }

    // Animate SVG path and truck positioning
    const pathElement = document.getElementById('highwayPath');
    const progressPathElement = document.getElementById('highwayProgressPath');
    const truckGroup = document.getElementById('mapTruckGroup');
    if (pathElement && progressPathElement && truckGroup) {
        const pathLength = pathElement.getTotalLength();
        const distance = (navProgressPct / 100) * pathLength;
        
        const point = pathElement.getPointAtLength(distance);
        truckGroup.setAttribute('transform', `translate(${point.x}, ${point.y})`);
        
        progressPathElement.setAttribute('stroke-dasharray', pathLength);
        progressPathElement.setAttribute('stroke-dashoffset', pathLength - distance);
    }

    // Navigation prompt logic
    let directionText = "";
    if (navProgressPct === 0) {
        directionText = `?歇?箇??頠歇敺?${startMeta.name} ???箇嚗?頛?${activeNavTask.item} (x${activeNavTask.qty}???;
    } else if (navProgressPct > 0 && navProgressPct <= 25) {
        directionText = "??擏葉??憭扳漯銝惜頝舀挾嚗迤擏??蝺?璈怠頝胯??寥脣敶?嚗控頝舫?擏?瘜冽?頠?;
    } else if (navProgressPct > 25 && navProgressPct <= 50) {
        directionText = "??擏葉???曉??折???迤?券脣撅勗?頝舀挾嚗絲?撓銝???;
    } else if (navProgressPct > 50 && navProgressPct <= 75) {
        directionText = "??擏葉??頛歇頞?敺抵?璈??桀?憭拙?瘜憟賬??萄儐摰頠?;
    } else if (navProgressPct > 75 && navProgressPct < 100) {
        directionText = `?撠????500 ?砍偕?箇? ${endMeta.name}??皞?????脰?暺蝪賢?;
    } else {
        directionText = `?歇?菟??歇??菟?蝯? ${endMeta.name}嚗?蝡颲衣??亙?暺蝪賜嚗??漱隞;
    }

    const navDirElement = document.getElementById('navDirectionText');
    if (navDirElement && navDirElement.innerText !== directionText) {
        navDirElement.innerText = directionText;
        if (isVoiceNavEnabled) {
            speakText(directionText);
        }
    }

    // Update Status Badge
    const statusBadge = document.getElementById('navLiveStatus');
    if (statusBadge) {
        if (navProgressPct < 100) {
            statusBadge.innerHTML = `<i class="fa-solid fa-truck fa-spin"></i> ?葉 (${navProgressPct.toFixed(0)}%)`;
            statusBadge.style.background = 'var(--warning-light)';
            statusBadge.style.color = 'var(--warning-color)';
        } else {
            statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> 撌脫??`;
            statusBadge.style.background = '#d1fae5';
            statusBadge.style.color = '#065f46';
        }
    }

    // Google Maps dir link update
    const gmapLink = document.getElementById('realGoogleMapLink');
    if (gmapLink) {
        gmapLink.href = `https://www.google.com/maps/dir/?api=1&origin=${startMeta.lat},${startMeta.lng}&destination=${endMeta.lat},${endMeta.lng}&travelmode=driving`;
    }

    if (navProgressPct >= 100) {
        clearInterval(liveNavInterval);
        liveNavInterval = null;
    }
}

function toggleVoiceNavigation() {
    isVoiceNavEnabled = !isVoiceNavEnabled;
    const icon = document.getElementById('voiceToggleIcon');
    const text = document.getElementById('voiceToggleText');
    if (icon && text) {
        if (isVoiceNavEnabled) {
            icon.className = 'fa-solid fa-volume-high';
            text.innerText = '隤撌脣???;
            speakText("隤頝舀挾??撌脤???銵?撟喳???);
        } else {
            icon.className = 'fa-solid fa-volume-mute';
            text.innerText = '?隤';
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        }
    }
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/????|??|?腮暺??|?儭?育?儭?/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'zh-TW';
        window.speechSynthesis.speak(utterance);
    }
}

// Render admin transfer list
function renderAdminTransferTable() {
    const tbody = document.querySelector('#adminTransferTable tbody');
    if (!tbody) return; 
    tbody.innerHTML = '';
    
    let transfers = dbRequests.filter(req => req.from !== '瘞');
    if (transfers.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">?∠瘚矽摨衣???/td></tr>'; 
        return; 
    }
    
    transfers.forEach(req => {
        let fromName = STATIONS_METADATA[req.from] ? STATIONS_METADATA[req.from].name : req.from;
        let toName = STATIONS_METADATA[req.to] ? STATIONS_METADATA[req.to].name : req.to;
        
        let progressStr = `????嚗?{req.targetTime || '?⊥?摰?}`;
        if (req.dispatchTime && req.dispatchTime !== '摰?銝?) {
            progressStr += `<br><span style="color:var(--info-color);">?豢??箄?: ${req.dispatchTime}</span>`;
        }
        
        let badgeClass = 'badge-warning';
        if (req.status === '撠??葉') badgeClass = 'badge-info';
        else if (req.status === '撌脤?蝪賣') badgeClass = 'badge-success';
        else if (req.status === '撌脤??) badgeClass = 'badge-danger';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${req.time}</td>
            <td><b>${fromName}</b> ??<b>${toName}</b></td>
            <td><strong>${req.item}</strong> (x${req.qty}??</td>
            <td>${progressStr}</td>
            <td><span class="badge ${badgeClass}">${req.status}</span></td>
            <td>
                <button class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="deleteTransfer('${req.id}')">
                    <i class="fa-solid fa-trash-can"></i> ?芷
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showFlowLog(drugChineseName) {
    const modal = document.getElementById('logModal'); 
    const logList = document.getElementById('logList'); 
    
    document.getElementById('logItemName').innerText = `???亙?嚗?{drugChineseName}`; 
    logList.innerHTML = '';
    
    let relatedReqs = dbRequests.filter(r => r.item === drugChineseName && r.status === '撌脤?蝪賣');
    if (relatedReqs.length === 0) { 
        logList.innerHTML = '<li style="color:var(--text-muted); text-align:center; padding:15px;">?典?撠?府??銋???頧???/li>'; 
    } else {
        relatedReqs.forEach(req => {
            let li = document.createElement('li'); 
            li.style = "padding:12px; border-bottom:1px solid var(--border-color); font-size:0.9rem; display:flex; align-items:center; gap:10px;";
            li.innerHTML = `
                <span style="color:var(--text-muted); font-weight:700; min-width:85px;">${req.time}</span>
                <span class="badge badge-success">?拇???</span> 
                <span>??<b>${STATIONS_METADATA[req.from].name}</b> ??隤輸???<b>${STATIONS_METADATA[req.to].name}</b></span>
                <span style="margin-left:auto; font-weight:bold; color:var(--danger-color);">${req.qty} ??/span>
            `; 
            logList.appendChild(li);
        });
    }
    modal.style.display = 'flex';
}

// Chart.js renderings for waste rate & seasonal patterns (CDC NIDSS format)
let seasonalChartInstance = null;

function renderAdminCharts() {
    const ctxSeasonal = document.getElementById('seasonalChart');
    if (!ctxSeasonal) return;
    
    if (seasonalChartInstance) seasonalChartInstance.destroy();
    // CDC NIDSS disease distribution & corresponding seasonal drug demand
    seasonalChartInstance = new Chart(ctxSeasonal, {
        type: 'line',
        data: {
            labels: ['1??, '2??, '3??, '4??, '5??, '6??, '7??, '8??, '9??, '10??, '11??, '12??],
            datasets: [
                { label: '瘚???擃? (??????', data: [14000, 11000, 7500, 3000, 1200, 900, 800, 900, 1500, 4200, 8000, 13000], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)', fill: true, tension: 0.3 },
                { label: '?貊?瘥?撜?(???瞍?', data: [500, 400, 900, 2800, 7500, 11000, 8500, 5000, 7800, 2500, 1100, 600], borderColor: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.05)', fill: true, tension: 0.3 },
                { label: '?駁?勗?雿?(??)', data: [10, 8, 12, 45, 120, 250, 380, 490, 450, 310, 90, 25], borderColor: '#fbbf24', fill: false, tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { font: { family: 'Inter', weight: '600' } } }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// Initial setup
window.onload = function() {
    setupDragAndDrop();
    fetchSystemData();
};
// =========================================================================
// API SYNC LOGIC (Replaces LocalStorage)
// =========================================================================
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
        console.error("Database sync failed:", error);
    }
}
