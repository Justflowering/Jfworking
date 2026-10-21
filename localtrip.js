// 전역 LocalTrip 객체 선언
window.LocalTrip = {
    originalRecords: [],
    backupCorrections: null,
    sortState: { key: null, asc: true },
    parsedData: null, // 인쇄용(상시/일반 분리) 저장 객체

    extractDateKey(val) {
        if (!val) return "";
        if (typeof val === 'number') {
            const d = window.AppUtils.toJsDate(val);
            return d ? window.AppUtils.formatDate(d) : String(val);
        }
        const s = String(val).trim();
        const match = s.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
        if (match) return match[1];
        return s.split(' ')[0]; // Fallback
    },

    // 계급별 정렬 우선순위
    getRankSortOrder(rank) {
        if (!rank) return 99;
        if (rank.includes('4급')) return 4;
        if (rank.includes('5급')) return 5;
        if (rank.includes('6급')) return 6;
        if (rank.includes('7급')) return 7;
        if (rank.includes('8급')) return 8;
        if (rank.includes('9급')) return 9;
        if (rank.includes('가급')) return 10;
        if (rank.includes('나급')) return 11;
        if (rank.includes('다급')) return 12;
        if (rank.includes('라급')) return 13;
        if (rank.includes('마급')) return 14;
        if (rank.includes('경위')) return 20; // 청원경찰
        if (rank.includes('실무원') || rank.includes('공무직')) return 30;
        if (rank.includes('기간제')) return 31;
        return 90; // 기타
    },

    // --- 카카오 지도 API 거리 계산 ---
    async getCoordinates(address) {
        try {
            const apiSettings = DB.settings.kakaoApi;
            const apiKey = (apiSettings && apiSettings.restApiKey) ? apiSettings.restApiKey : '41360366fe8aa573b45f73c82e4aa34a';
            if (!apiKey) {
                return null;
            }

            const cleanApiKey = apiKey.replace(/[^a-zA-Z0-9]/g, '');
            
            // [수정] 기본주소에서 지역명 동적 추출 (예: '울산 남구 돋질로...' -> '울산 남구', '울산')
            let regionPrefix1 = '울산 남구';
            let regionPrefix2 = '울산';
            if (apiSettings && apiSettings.startAddress) {
                const addrParts = apiSettings.startAddress.split(' ');
                if (addrParts.length >= 2) {
                    regionPrefix1 = `${addrParts[0]} ${addrParts[1]}`; // 예: 서울 강남구
                    regionPrefix2 = addrParts[0];                      // 예: 서울
                }
            }

            const originalQuery = address.replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '');
            const cleanQuery = originalQuery.replace(/\([^)]*\)/g, '').trim();
            const queries = [];
            
            const customAddressMap = {
                '공공시설과': '울산 남구 돋질로 239번길 8',
                '보육지원과': '울산 남구 돋질로 239번길 8',
                '소상공인진흥과': '울산 남구 삼산중로131번길 36',
                '체육지원과': '울산 남구 삼산중로131번길 36',
                '본청': '울산 남구 돋질로 233',
                '남구청': '울산 남구 돋질로 233',
                '시청': '울산 남구 중앙로 201'
            };
            
            let foundCustom = null;
            for (let key in customAddressMap) {
                if (originalQuery.includes(key)) {
                    foundCustom = customAddressMap[key];
                    break;
                }
            }
            if (foundCustom) queries.push(foundCustom);
            
            if (!cleanQuery.includes(regionPrefix2)) {
                queries.push(regionPrefix1 + ' ' + cleanQuery);
                queries.push(regionPrefix2 + ' ' + cleanQuery);
            }
            queries.push(cleanQuery);
            queries.push(originalQuery);

            for (const q of queries) {
                // 1차 시도: 카카오 로컬 API (주소 검색)
                const addressUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}`;
                
                let response = await window.electronAPI.fetchApi(addressUrl, { headers: { 'Authorization': `KakaoAK ${cleanApiKey}` } });
                if (response && response.success) {
                    let data = response.data;
                    if (data.documents && data.documents.length > 0) {
                        return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
                    }
                }
                
                // 2차 시도: 주소 검색 결과가 없으면 키워드(장소명) 검색 API 시도
                const keywordUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}`;
                
                response = await window.electronAPI.fetchApi(keywordUrl, { headers: { 'Authorization': `KakaoAK ${cleanApiKey}` } });
                if (response && response.success) {
                    let data = response.data;
                    if (data.documents && data.documents.length > 0) {
                        return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
                    }
                }
            }
        } catch (error) {
            console.error('getCoordinates error:', error);
        }
        return null;
    },

    // --- WGS84 좌표를 카카오맵 길찾기용 WCONGNAMUL 좌표로 변환 ---
    async transCoordToWcongnamul(coord) {
        const apiSettings = DB.settings.kakaoApi;
        const apiKey = (apiSettings && apiSettings.restApiKey) ? apiSettings.restApiKey : '41360366fe8aa573b45f73c82e4aa34a';
        const cleanApiKey = apiKey.replace(/[^a-zA-Z0-9]/g, '');
        
        const url = `https://dapi.kakao.com/v2/local/geo/transcoord.json?x=${coord.lng}&y=${coord.lat}&input_coord=WGS84&output_coord=WCONGNAMUL`;
        
        try {
            let response = await window.electronAPI.fetchApi(url, { headers: { 'Authorization': `KakaoAK ${cleanApiKey}` } });
            if (response.success) {
                let data = response.data;
                if (data.documents && data.documents.length > 0) {
                    return { x: data.documents[0].x, y: data.documents[0].y };
                }
            }
        } catch(e) { console.error(e); }
        return null;
    },

    // --- 지도 모달 표시 (REST API 기반) ---
    async showMapModal(dest) {
        window.showLoadingSpinner('자동차 경로를 찾는 중...');

        const apiSettings = typeof DB !== 'undefined' && DB.settings && DB.settings.kakaoApi ? DB.settings.kakaoApi : {};
        const startAddress = apiSettings.startAddress;

        const safeDest = dest.replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '');
        let cleanDest = safeDest.replace(/\([^)]*\)/g, '').trim();
        
        let regionPrefix2 = '울산';
        if (startAddress) {
            const addrParts = startAddress.split(' ');
            if (addrParts.length > 0) regionPrefix2 = addrParts[0];
        }

        const customAddressMap = {
            '공공시설과': '울산 남구 돋질로 239번길 8',
            '보육지원과': '울산 남구 돋질로 239번길 8',
            '소상공인진흥과': '울산 남구 삼산중로131번길 36',
            '체육지원과': '울산 남구 삼산중로131번길 36',
            '본청': '울산 남구 돋질로 233',
            '남구청': '울산 남구 돋질로 233',
            '시청': '울산 남구 중앙로 201'
        };

        for (let key in customAddressMap) {
            if (safeDest.includes(key)) {
                cleanDest = customAddressMap[key];
                break;
            }
        }

        if (!cleanDest.includes(regionPrefix2)) cleanDest = regionPrefix2 + ' ' + cleanDest;

        let cleanStart = startAddress ? startAddress.replace(/\([^)]*\)/g, '').trim() : '출발지';
        let url = '';

        let startCoord = startAddress ? await this.getCoordinates(startAddress) : null;
        let destCoord = await this.getCoordinates(dest);

        if (startCoord && destCoord) {
            // 좌표가 모두 있으면 자동차 경로를 즉시 그려주는 WCONGNAMUL 기반 URL 생성
            let startW = await this.transCoordToWcongnamul(startCoord);
            let destW = await this.transCoordToWcongnamul(destCoord);
            
            if (startW && destW) {
                url = `https://map.kakao.com/?target=car&rt=${startW.x},${startW.y},${destW.x},${destW.y}&rt1=${encodeURIComponent(cleanStart)}&rt2=${encodeURIComponent(cleanDest)}&layout=route`;
            } else {
                url = `https://map.kakao.com/?sName=${encodeURIComponent(cleanStart)}&eName=${encodeURIComponent(cleanDest)}`;
            }
        } else if (startAddress) {
            url = `https://map.kakao.com/?sName=${encodeURIComponent(cleanStart)}&eName=${encodeURIComponent(cleanDest)}`;
        } else if (destCoord) {
            url = `https://map.kakao.com/link/to/${encodeURIComponent(cleanDest)},${destCoord.lat},${destCoord.lng}`;
        } else {
            url = `https://map.kakao.com/link/search/${encodeURIComponent(cleanDest)}`;
        }

        window.hideLoadingSpinner();

        let modal = document.getElementById('localTripMapModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'localTripMapModal';
            modal.className = 'modal-overlay';
            modal.style.zIndex = '9999';
            modal.innerHTML = `
                <div class="modal-content card" style="width: 90%; height: 90%; max-width: 1200px; display: flex; flex-direction: column; padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 id="ltMapModalTitle" style="margin: 0; color: var(--primary-color);">경로(지도) 확인</h3>
                        <button id="btnLtMapModalClose" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--text-muted);">&times;</button>
                    </div>
                    <div style="flex: 1; border: 1px solid var(--border-light); border-radius: 4px; overflow: hidden;">
                        <iframe id="ltMapIframe" src="" width="100%" height="100%" frameborder="0" style="border:0;"></iframe>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btnLtMapModalClose').addEventListener('click', () => { modal.style.display = 'none'; document.getElementById('ltMapIframe').src = ''; });
            modal.addEventListener('click', (e) => { if (e.target === modal) { modal.style.display = 'none'; document.getElementById('ltMapIframe').src = ''; } });
        }

        document.getElementById('ltMapModalTitle').textContent = `[${dest}] 경로 확인`;
        document.getElementById('ltMapIframe').src = url;
        modal.style.display = 'flex';
    },

    // --- 카카오 내비 API를 이용한 실제 자동차 주행거리 계산 ---
    async getDrivingDistance(startCoord, goalCoord) {
        try {
            const apiSettings = DB.settings.kakaoApi;
            const apiKey = (apiSettings && apiSettings.restApiKey) ? apiSettings.restApiKey : '41360366fe8aa573b45f73c82e4aa34a';
            if (!apiKey) {
                return null;
            }

            const startStr = `${startCoord.lng},${startCoord.lat}`;
            const goalStr = `${goalCoord.lng},${goalCoord.lat}`;
            const targetUrl = `https://apis-navi.kakaomobility.com/v1/directions?origin=${startStr}&destination=${goalStr}`;

            const cleanApiKey = apiKey.replace(/[^a-zA-Z0-9]/g, '');

            const response = await window.electronAPI.fetchApi(targetUrl, {
                headers: { 'Authorization': `KakaoAK ${cleanApiKey}` }
            });

            if (!response || !response.success) {
                return null;
            }

            const data = response.data;
            // 정상적으로 경로가 탐색되었을 경우 주행거리(미터) 반환
            if (data && data.routes && data.routes.length > 0) {
                return data.routes[0].summary.distance;
            }
        } catch (error) {
            console.error('getDrivingDistance error:', error);
        }
        return null; // 경로를 찾을 수 없는 경우
    },

    async verifyDistances() {
        const apiSettings = DB.settings.kakaoApi;
        const apiKey = (apiSettings && apiSettings.restApiKey) ? apiSettings.restApiKey : '41360366fe8aa573b45f73c82e4aa34a';
        if (!apiSettings || !apiSettings.startAddress || !apiKey) {
            window.showCustomAlert('환경 설정 탭에서 출발지 주소와 카카오 API Key를 먼저 설정해주세요.');
            return;
        }

        const statusEl = document.getElementById('localTripStatus');
        window.showLoadingSpinner('출발지 좌표를 가져오는 중...');

        let startCoord;
        try {
            startCoord = await this.getCoordinates(apiSettings.startAddress);
            if (!startCoord) {
                window.hideLoadingSpinner();
                window.showCustomAlert('출발지 주소의 좌표를 찾을 수 없습니다. 정확한 도로명/지번 주소를 입력해주세요.');
                statusEl.textContent = '';
                return;
            }
        } catch (error) {
            console.error(error);
            window.hideLoadingSpinner();
            window.showCustomAlert(`API 호출 오류: ${error.message}\n(브라우저 CORS 정책 차단이거나 설정 오류일 수 있습니다.)`);
            statusEl.textContent = '';
            return;
        }

        // 2km 초과(N)로 체크되어 있고 다수 장소가 아닌 단일 출장지만 검증 대상 추출
        const targets = this.originalRecords.filter(r => {
            const dest = r.destination;
            const hasMultiple = dest.includes(' 외 ') || dest.includes('외 ') || dest.includes(' 외') || dest.includes(' 등 ') || dest.includes(' 등') || dest.includes('등 ') || dest.includes('개소') || dest.includes('일원') || dest.includes('관내');
            return r.within2km === 'N' && !hasMultiple && !r.verified;
        });

        if (targets.length === 0) {
            window.hideLoadingSpinner();
            window.showCustomAlert('검증할 출장지가 없거나 모두 검증되었습니다.');
            statusEl.textContent = '';
            return;
        }

        window.hideLoadingSpinner();
        const confirmed = await window.showCustomConfirm(`총 ${targets.length}건의 출장지에 대해 거리 검증을 수행하시겠습니까?\n(API 호출이 발생합니다)`);
        if (!confirmed) {
            statusEl.textContent = '';
            return;
        }

        window.showLoadingSpinner(`거리 검증 중... (0 / ${targets.length})`);
        let checkedCount = 0;
        let under2kmCount = 0;

        // Rate limit(API 호출 제한)을 고려하여 5개씩 Batch 병렬 처리로 속도 최적화
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        const batchSize = 5;

        for (let i = 0; i < targets.length; i += batchSize) {
            const batch = targets.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (r) => {
                try {
                    const searchDest = r.destination.replace(/\([^)]*\)/g, '').trim();
                    const targetCoord = await this.getCoordinates(searchDest);
                    r.verified = true; // 중복 검사 방지 플래그
                    if (targetCoord) {
                        const dist = await this.getDrivingDistance(startCoord, targetCoord);
                        if (dist !== null) {
                            const roundTripDist = dist * 2;
                            if (roundTripDist < 2000) { // 왕복 2000m (2km) 미만
                                r.verifyMessage = `<span style="color: var(--danger-color); font-weight: bold;">⚠️ 왕복 2km미만(${Math.round(roundTripDist)}m)</span>`;
                                under2kmCount++;
                            } else {
                                r.verifyMessage = `<span style="color: var(--success-color);">✅ 왕복 2km이상(${Math.round(roundTripDist/100)/10}km)</span>`;
                            }
                        } else {
                            r.verifyMessage = `<span style="color: var(--warning-color);">경로탐색불가</span>`;
                        }
                    } else {
                        r.verifyMessage = `<span style="color: var(--warning-color);">좌표확인불가</span>`;
                    }
                } catch(e) {
                    console.error(e);
                    r.verifyMessage = `<span style="color: var(--warning-color);">API에러</span>`;
                }
            }));
            
            checkedCount += batch.length;
            
            const spinnerMsg = document.getElementById('globalSpinnerMessage');
            if (spinnerMsg) spinnerMsg.textContent = `거리 검증 중... (${checkedCount} / ${targets.length})`;
            statusEl.textContent = `거리 검증 중... (${checkedCount} / ${targets.length})`;
            this.updateMainTable(); // UI 갱신
            
            if (i + batchSize < targets.length) {
                await delay(200); // Rate Limit 방지용 Batch 간 딜레이
            }
        }

        window.hideLoadingSpinner();
        
        this.calculateAllowance();
        this.updateMainTable();
        this.renderSummaryTable();
        statusEl.textContent = `거리 검증 완료: 총 ${targets.length}건 중 2km 미만 의심 ${under2kmCount}건 발견.`;
        window.showCustomAlert(`거리 검증이 완료되었습니다.\n2km 미만으로 계산된 의심 내역이 ${under2kmCount}건 있습니다.`);
    },

    restoreCorrections() {
        if (!this.backupCorrections || this.backupCorrections.length === 0) {
            window.showCustomAlert('복구할 이전 보정 내역이 없습니다.');
            return;
        }

        let restoreCount = 0;
        const backupMap = new Map();
        this.backupCorrections.forEach(bc => {
            const key = `${bc.id}_${bc.startDate}_${bc.destination}`;
            backupMap.set(key, bc);
        });

        this.originalRecords.forEach(r => {
            const key = `${r.id}_${r.startDate}_${r.destination}`;
            if (backupMap.has(key)) {
                const bc = backupMap.get(key);
                r.excludeAllowance = bc.excludeAllowance;
                r.transitFare = bc.transitFare;
                restoreCount++;
            }
        });

        if (restoreCount > 0) {
            this.calculateAllowance();
            this.updateMainTable();
            this.renderSummaryTable();
            window.showCustomAlert(`이전 보정 내역 ${restoreCount}건을 성공적으로 복구하여 재적용했습니다.`);
        } else {
            window.showCustomAlert('현재 업로드된 데이터에서 일치하는 이전 보정 대상을 찾을 수 없습니다.');
        }
    },

    // --- 메인 로직 ---
    async processFile() {
        const fileInput = document.getElementById('localTripFile');
        const statusEl = document.getElementById('localTripStatus');
        const file = fileInput.files[0];

        if (!file) {
            window.showCustomAlert('관내출장내역 파일을 업로드해주세요.');
            return;
        }

        window.showLoadingSpinner('관내출장 데이터를 분석하는 중...');

        try {
            if (this.originalRecords && this.originalRecords.length > 0) {
                this.backupCorrections = this.originalRecords.map(r => ({
                    id: r.id,
                    startDate: r.startDate,
                    destination: r.destination,
                    excludeAllowance: r.excludeAllowance,
                    transitFare: r.transitFare
                }));
                const btnRestore = document.getElementById('btnRestoreLocalTripCorrections');
                if (btnRestore) btnRestore.style.display = 'inline-block';
            }

            const rawData = await window.AppUtils.readExcel(file);
            this.extractData(rawData);
            this.calculateAllowance();
            
            this.renderSummaryTable();
            this.updateMainTable();
            document.getElementById('localTripFilterContainer').style.display = 'flex';
            
            statusEl.textContent = '분석이 완료되었습니다.';
            window.hideLoadingSpinner();
        } catch (error) {
            console.error('관내출장 파일 처리 중 오류:', error);
            window.hideLoadingSpinner();
            statusEl.textContent = `오류가 발생했습니다: ${error.message}`;
        }
    },

    extractData(rawData) {
        const COL = { NAME: 2, ID: 3, START: 5, END: 6, TIME: 7, DEST: 8, PURP: 9, VEH: 10, OVER4: 11, IN2KM: 12 };
        let records = [];
        
        // 헤더 1행 또는 2행 고려 (데이터 시작점 찾기)
        let startIdx = 0;
        for(let i = 0; i < Math.min(5, rawData.length); i++) {
            if(rawData[i] && (String(rawData[i][COL.ID]).includes('-') || String(rawData[i][COL.NAME]) !== '')) {
                const nameStr = String(rawData[i][COL.NAME]).trim();
                // 헤더 텍스트인 경우 무시
                if(nameStr !== '성명' && nameStr !== '출장자' && nameStr !== '') {
                    startIdx = i;
                    break;
                }
            }
        }

        let recIdCounter = 0;
        // 원본 데이터 추출
        for(let i = startIdx; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || !row[COL.ID]) continue; // 식별번호 없는 행 무시
            
            const name = String(row[COL.NAME] || '').trim();
            const id = String(row[COL.ID] || '').trim();
            if (!name || name === '성명' || name === '출장자') continue;

            records.push({
                recordId: 'rec_' + (recIdCounter++), // 고유 식별자 추가
                name,
                id,
                startDate: String(row[COL.START] || '').trim(),
                endDate: String(row[COL.END] || '').trim(),
                totalTime: String(row[COL.TIME] || '').trim(),
                destination: String(row[COL.DEST] || '').trim(),
                purpose: String(row[COL.PURP] || '').trim(),
                vehicle: String(row[COL.VEH] || '').trim().toUpperCase(),
                over4h: String(row[COL.OVER4] || '').trim().toUpperCase(),
                within2km: String(row[COL.IN2KM] || '').trim().toUpperCase(),
                excludeAllowance: false, // 여비 제외 플래그 (체크박스용)
                verified: false,
                remark: '',
                verifyMessage: '', // 검증 메시지 저장용
                transitFare: 0 // 근거리 교통비 실비 초기값
            });
        }
        this.originalRecords = records;
    },

    calculateAllowance() {
        const grouped = new Map();
        this.originalRecords.forEach(r => {
            if(!grouped.has(r.id)) grouped.set(r.id, { records: [], isSangsiUser: false });
            grouped.get(r.id).records.push(r);
            if(r.totalTime.includes('상시')) {
                grouped.get(r.id).isSangsiUser = true;
            }
        });

        const summary = [];
        const parsedData = { normalUsers: [], sangsiUsers: [] };
        
        const ltSettings = (typeof DB !== 'undefined' && DB.settings && DB.settings.localTrip) ? DB.settings.localTrip : {
            sangsiAmount: 200000, normalVehOver4: 10000, normalVehUnder4: 0, normalNoVehOver4: 20000, normalNoVehUnder4: 10000
        };

        // 여비 계산
        grouped.forEach((data, id) => {
            const userRecs = data.records;
            const isSangsiUser = data.isSangsiUser;
            const name = userRecs[0].name;

            let sangsiAmount = 0;
            let normalAmount = 0;
            let count10k = 0;
            let count20k = 0;
            let vehicleUseCount = 0;
            let vehicleNoUseCount = 0;

            const uniqueDays = new Set();
            userRecs.forEach(r => {
                if (!r.excludeAllowance) uniqueDays.add(this.extractDateKey(r.startDate || r.endDate));
            });

            if (isSangsiUser) {
                const sangsiRecs = userRecs.filter(r => r.totalTime.includes('상시'));
                const sUniqueDays = new Set();
                const sVehicleDays = new Set();
                sangsiRecs.forEach(r => {
                    r.allowance = 0; 
                    r.isSangsiTrip = true;
                    if (!r.excludeAllowance) {
                        const dk = this.extractDateKey(r.startDate || r.endDate);
                        sUniqueDays.add(dk);
                        if (r.vehicle === 'Y' || r.vehicle === '사용') sVehicleDays.add(dk);
                    }
                });
                const U = sUniqueDays.size;
                const V = sVehicleDays.size;

                const useSangsiDeduction = ltSettings.useSangsiDeduction !== false; // 기본값 true
                const exemptDays = ltSettings.sangsiDeductionExemptDays !== undefined ? parseInt(ltSettings.sangsiDeductionExemptDays) : 4; // 기본값 4

                const actual_V = useSangsiDeduction ? Math.max(0, V - exemptDays) : 0; // 감액 대상 일수

                vehicleUseCount = V;
                vehicleNoUseCount = U - V;
                
                // 기본액 산정: U가 15일 이상이면 전액, 15일 미만이면 비례 배분
                let baseAmount = ltSettings.sangsiAmount;
                if (U < 15) {
                    baseAmount = Math.floor(((ltSettings.sangsiAmount / 15) * U) / 10) * 10;
                }

                // 공용차량 감액 계산 (1일당 1만원)
                const vehicleDeduction = useSangsiDeduction ? (actual_V * 10000) : 0;

                // 최종 지급액 = 기본액 - 감액액 (최소 0원 한도)
                sangsiAmount = Math.max(0, baseAmount - vehicleDeduction);
            }

            // 개인당 여비 총액 산출 (20만원 상한 제한)
            let totalAccumulated = sangsiAmount;

            const normalRecs = userRecs.filter(r => !r.totalTime.includes('상시'));
            const dailySpent = {}; // dateKey -> spentAmount

            normalRecs.forEach(r => {
                let amt = 0;
                const v = (r.vehicle === 'Y' || r.vehicle === '사용');
                const o = r.over4h === 'Y';
                const w = r.within2km === 'Y';
                const dateKey = this.extractDateKey(r.startDate || r.endDate);

                if (r.excludeAllowance) {
                    amt = 0;
                } else if (w) {
                    // 근거리 출장은 입력된 transitFare(실비) 기준으로 한도 내 지급 (4시간 미만 1만, 4시간 이상 2만 한도)
                    const fareLimit = o ? 20000 : 10000;
                    amt = Math.min(parseInt(r.transitFare) || 0, fareLimit);
                } else {
                    if (v && o) amt = ltSettings.normalVehOver4;
                    else if (v && !o) amt = ltSettings.normalVehUnder4;
                    else if (!v && o) amt = ltSettings.normalNoVehOver4;
                    else if (!v && !o) amt = ltSettings.normalNoVehUnder4;
                }

                // 1일 지급 한도(2만원) 적용
                const originalAmt = amt;
                const alreadySpentToday = dailySpent[dateKey] || 0;
                const dailyRemaining = Math.max(0, 20000 - alreadySpentToday);
                const allowedDaily = Math.min(originalAmt, dailyRemaining);
                
                // 최대 20만 원 한도 내에서만 금액 지급
                let allowed = Math.min(allowedDaily, Math.max(0, 200000 - totalAccumulated));
                r.allowance = allowed;
                r.isSangsiTrip = false;
                
                // 1일 지출 누적
                dailySpent[dateKey] = alreadySpentToday + allowed;
                    
                let remarkText = '';
                const dest = r.destination;
                const hasMultiple = dest.includes(' 외 ') || dest.includes('외 ') || dest.includes(' 외') || dest.includes(' 등 ') || dest.includes(' 등') || dest.includes('등 ') || dest.includes('개소') || dest.includes('일원') || dest.includes('관내');
                
                if (r.within2km === 'Y') {
                    remarkText += `<span style="color:var(--primary-color); font-weight:bold;">근거리 실비</span>`;
                } else if (r.within2km === 'N' && !hasMultiple) {
                    remarkText += `<a onclick="window.LocalTrip.showMapModal('${dest.replace(/'/g, "\\'").replace(/\n/g, ' ')}')" style="text-decoration: none; font-size: 0.9em; cursor: pointer; background: var(--bg-light); padding: 2px 5px; border-radius: 4px; color: var(--primary-dark);" title="카카오 지도에서 확인">🗺️확인</a>`;
                }

                if (r.verifyMessage) {
                    remarkText = (remarkText ? remarkText + '<br>' : '') + r.verifyMessage;
                }

                if (r.excludeAllowance) {
                    remarkText += (remarkText ? '<br>' : '') + '<span style="color:var(--warning-color); font-weight:bold;">수동제외(0원)</span>';
                } else {
                    if (originalAmt > allowedDaily) {
                        remarkText += (remarkText ? '<br>' : '') + `<span style="color:var(--warning-color); font-weight:bold;">1일한도(2만)초과 감액</span>`;
                    }
                    if (allowedDaily > allowed && allowed === 0) {
                        remarkText += (remarkText ? '<br>' : '') + '<span style="color:var(--danger-color); font-weight:bold;">한도(20만)초과 지급제외</span>';
                    } else if (allowedDaily > allowed && allowed > 0) {
                        remarkText += (remarkText ? '<br>' : '') + `<span style="color:var(--danger-color); font-weight:bold;">한도초과 일부감액(${allowed}원 지급)</span>`;
                    }
                }

                r.remark = remarkText;
                totalAccumulated += allowed;
                normalAmount += allowed;

                if (allowed === 10000) count10k++;
                else if (allowed === 20000) count20k++;
            });

            // 고유식별번호 기호 제거 후 확실한 매칭 (실패 시 성명으로 대체 검색)
            let matchedEmp = null;
            if (typeof DB !== 'undefined') {
                const cleanId = id.replace(/[^0-9]/g, '');
                matchedEmp = DB.employees.find(e => e.idNumber && e.idNumber.replace(/[^0-9]/g, '') === cleanId);
                if (!matchedEmp) {
                    matchedEmp = DB.employees.find(e => e.name === name);
                }
            }
            
            let finalBank = '';
            let finalAccount = '';
            if (matchedEmp) {
                finalBank = matchedEmp.bank;
                finalAccount = matchedEmp.account;
                // 비고란에 '출장'이 포함되어 있고, 추가계좌 정보가 있다면 해당 계좌를 사용
                if (matchedEmp.remarks && matchedEmp.remarks.includes('출장')) {
                    finalBank = matchedEmp.extraBank || finalBank;
                    finalAccount = matchedEmp.extraAccount || finalAccount;
                }
            }

            const userObj = {
                name,
                id,
                rank: matchedEmp ? matchedEmp.rank : '',
                bank: finalBank,
                account: finalAccount,
                isSangsiUser,
                records: userRecs,
                uniqueDays: uniqueDays.size,
                sangsiAmount,
                normalAmount,
                totalAmount: totalAccumulated,
                count10k,
                count20k,
                vehicleUseCount,
                vehicleNoUseCount
            };

            summary.push({ name, id, type: isSangsiUser ? '상시' : '일반', allowance: totalAccumulated, detail: isSangsiUser ? `상시 ${sangsiAmount.toLocaleString()}원 + 일반 ${normalAmount.toLocaleString()}원` : `일반 건별 합산` });

            if (isSangsiUser) parsedData.sangsiUsers.push(userObj);
            else parsedData.normalUsers.push(userObj);
        });

        // 계급 및 성명 오름차순 정렬
        const sortUsers = (users) => {
            return users.sort((a, b) => {
                const rankA = this.getRankSortOrder(a.rank);
                const rankB = this.getRankSortOrder(b.rank);
                if (rankA !== rankB) return rankA - rankB;
                return a.name.localeCompare(b.name, 'ko-KR');
            });
        };
        parsedData.sangsiUsers = sortUsers(parsedData.sangsiUsers);
        parsedData.normalUsers = sortUsers(parsedData.normalUsers);

        parsedData.sangsiUsers.forEach(u => {
            u.records.filter(r => r.isSangsiTrip).forEach(r => {
                let remarkText = '상시 (월정액)';
                const dest = r.destination;
                const hasMultiple = dest.includes(' 외 ') || dest.includes('외 ') || dest.includes(' 외') || dest.includes(' 등 ') || dest.includes(' 등') || dest.includes('등 ') || dest.includes('개소') || dest.includes('일원') || dest.includes('관내');
                if (r.within2km === 'N' && !hasMultiple) {
                    remarkText += ` <a onclick="window.LocalTrip.showMapModal('${dest.replace(/'/g, "\\'").replace(/\n/g, ' ')}')" style="text-decoration: none; font-size: 0.9em; cursor: pointer; background: var(--bg-light); padding: 2px 5px; border-radius: 4px; color: var(--primary-dark);" title="카카오 지도에서 확인">🗺️확인</a>`;
                }
                if (r.verifyMessage) remarkText += '<br>' + r.verifyMessage;
                if (r.excludeAllowance) remarkText += '<br><span style="color:var(--warning-color); font-weight:bold;">수동제외(일수차감)</span>';
                r.remark = remarkText;
            });
        });

        this.parsedData = parsedData;
        this.summary = summary;
    },

    updateMainTable() {
        let filtered = [...this.originalRecords];
        
        const filterName = (document.getElementById('ltFilterName')?.value || '').trim().toLowerCase();
        const filterId = (document.getElementById('ltFilterId')?.value || '').trim().toLowerCase();

        if (filterName) {
            filtered = filtered.filter(r => r.name.toLowerCase().includes(filterName));
        }
        if (filterId) {
            filtered = filtered.filter(r => r.id.toLowerCase().includes(filterId));
        }

        if (this.sortState.key) {
            filtered.sort((a, b) => {
                const valA = a[this.sortState.key] || '';
                const valB = b[this.sortState.key] || '';
                if (valA < valB) return this.sortState.asc ? -1 : 1;
                if (valA > valB) return this.sortState.asc ? 1 : -1;
                return 0;
            });
        }

        this.renderMainTableInner(filtered);
    },

    handleSort(key) {
        if (this.sortState.key === key) {
            this.sortState.asc = !this.sortState.asc;
        } else {
            this.sortState.key = key;
            this.sortState.asc = true;
        }
        this.updateMainTable();
    },

    renderMainTableInner(records) {
        const container = document.getElementById('localTripResultTable');
        if (!records || records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚙</div>
                    <div class="empty-state-title">표시할 출장 내역이 없습니다.</div>
                    <div class="empty-state-desc">엑셀 파일을 업로드하면 이곳에 상세 내역이 표시됩니다.</div>
                </div>
            `;
            return;
        }

        const getSortIcon = (key) => {
            if (this.sortState.key === key) {
                return this.sortState.asc ? ' ▲' : ' ▼';
            }
            return '';
        };

        const tableHtml = `
            <table class="data-table" style="font-size: 0.95em; table-layout: fixed; width: 100%; text-align: center; word-wrap: break-word;">
                <thead>
                    <tr>
                        <th style="width: 3%;">연번</th>
                        <th style="width: 5%; cursor:pointer;" onclick="window.LocalTrip.handleSort('name')">성명${getSortIcon('name')}</th>
                        <th style="width: 5%; cursor:pointer;" onclick="window.LocalTrip.handleSort('id')">식별번호${getSortIcon('id')}</th>
                        <th style="width: 17%; cursor:pointer;" onclick="window.LocalTrip.handleSort('startDate')">출장기간${getSortIcon('startDate')}</th>
                        <th style="width: 5%;">총시간</th>
                        <th style="width: 20%; cursor:pointer;" onclick="window.LocalTrip.handleSort('destination')">출장지${getSortIcon('destination')}</th>
                        <th style="width: 20%;">목적</th>
                        <th style="width: 5%;">차량</th>
                        <th style="width: 5%;">여비</th>
                        <th style="width: 10%;">비고</th>
                        <th style="width: 5%;">여비<br>제외</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map((r, i) => `
                        <tr style="height: 55px; text-align: center;">
                            <td>${i + 1}</td>
                            <td>${r.name}</td>
                            <td>${r.id}</td>
                            <td>${r.startDate} ~ ${r.endDate}</td>
                            <td>${r.totalTime}</td>
                            <td>${r.destination}</td>
                            <td>${r.purpose}</td>
                            <td>${r.vehicle}</td>
                            <td style="font-weight:bold; color: var(--primary-dark);">
                                ${r.allowance === 0 && r.isSangsiTrip ? '상시' : 
                                  (r.within2km === 'Y' ? 
                                    `<div>
                                       <input type="number" class="transit-fare-input" data-id="${r.recordId}" value="${r.transitFare || 0}" min="0" style="width: 75px; text-align: right; padding: 2px 4px; font-size: 0.9em; font-weight: bold; border: 1px solid var(--border-light); border-radius: 4px;" title="근거리 출장 실비(운임) 입력">
                                       <span style="font-size:0.8em; color:var(--text-muted); display:block; font-weight:normal;">지급: ${(r.allowance || 0).toLocaleString()}원</span>
                                     </div>` : 
                                    (r.allowance || 0).toLocaleString() + '원'
                                  )
                                }
                            </td>
                            <td>${r.remark || ''}</td>
                            <td><input type="checkbox" class="exclude-allowance-chk" data-id="${r.recordId}" ${r.excludeAllowance ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" title="체크 시 여비가 0원 처리됩니다."></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = tableHtml;
    },

    renderSummaryTable() {
        const container = document.getElementById('localTripSummaryTable');
        if (!this.parsedData) return;

        const { normalUsers, sangsiUsers } = this.parsedData;

        let html = '';

        const generateTable = (title, users) => {
            if (!users || users.length === 0) return '';
            const totalSum = users.reduce((acc, curr) => acc + curr.totalAmount, 0);
            return `
                <h4 style="margin-top: 15px; margin-bottom: 5px; color: var(--primary-dark);">${title}</h4>
                <table class="data-table" style="width: 100%; margin-bottom: 20px;">
                    <thead>
                        <tr><th>계급</th><th>성명</th><th>식별번호</th><th>지급액</th><th>산출내역</th></tr>
                    </thead>
                    <tbody>
                        ${users.map(s => `<tr><td>${s.rank}</td><td>${s.name}</td><td>${s.id}</td><td style="text-align:right;font-weight:bold;">${s.totalAmount.toLocaleString()}원</td><td>${s.isSangsiUser ? `상시 ${s.sangsiAmount.toLocaleString()}원 + 일반 ${s.normalAmount.toLocaleString()}원` : `일반 건별 합산`}</td></tr>`).join('')}
                    </tbody>
                    <tfoot><tr><td colspan="3" style="text-align:center; font-weight:bold;">총 지급액 합계</td><td style="text-align:right; font-weight:bold; color: var(--danger-color);">${totalSum.toLocaleString()}원</td><td></td></tr></tfoot>
                </table>
            `;
        };

        html += generateTable('■ 일반출장 개인별 합계', normalUsers);
        html += generateTable('■ 상시출장 개인별 합계', sangsiUsers);

        if (html === '') html = '<p style="text-align:center;">표시할 요약 데이터가 없습니다.</p>';

        container.innerHTML = html;
    },

    // 문서 인쇄 공통 로직
    async printDocument(docType, userType) {
        const monthStr = document.getElementById('printLtMonth').value;
        const dateStr = document.getElementById('printLtDate').value;
        if (!monthStr || !dateStr) {
            window.showCustomAlert('출장 연월과 작성 일자를 입력해주세요.');
            return;
        }

        const targetUsers = userType === '상시' ? this.parsedData.sangsiUsers : this.parsedData.normalUsers;
        if (!targetUsers || targetUsers.length === 0) {
            window.showCustomAlert(`출력할 ${userType}출장 데이터가 없습니다.`);
            return;
        }

        const [y, m] = monthStr.split('-');
        const [cy, cm, cd] = dateStr.split('-');
        const titleMonth = `${parseInt(m)}월`;
        const printDate = `${cy}. ${parseInt(cm)}. ${parseInt(cd)}.`;

        const printTeamLeader = typeof DB !== 'undefined' ? (DB.employees.find(emp => emp.role === '주무계장(사무장)')?.name || '공란') : '';
        const printClerk = typeof DB !== 'undefined' ? (DB.employees.find(emp => emp.role === '서무')?.name || '공란') : '';

        let contentHtml = '';

        if (docType === '내역서') {
            const trs = [];
            let globalIndex = 1;
            targetUsers.forEach(user => {
                user.records.forEach((r, idx) => {
                    trs.push(`
                        <tr>
                            <td>${globalIndex++}</td>
                            <td>관내</td>
                            <td>${r.startDate}</td>
                            <td>${r.endDate}</td>
                            <td>${r.totalTime}</td>
                            <td>${r.destination}</td>
                            <td style="text-align:left;">${r.purpose}</td>
                            <td>${r.vehicle}</td>
                            ${idx === 0 ? `<td rowspan="${user.records.length}">${user.name}</td>` : ''}
                            <td style="text-align:right;">${r.allowance === 0 && r.isSangsiTrip ? '상시' : (r.allowance || 0).toLocaleString()}</td>
                            ${idx === 0 ? `<td rowspan="${user.records.length}" style="text-align:right; font-weight:bold;">${user.totalAmount.toLocaleString()}</td>` : ''}
                            ${idx === 0 ? `<td rowspan="${user.records.length}"></td>` : ''}
                        </tr>
                    `);
                });
            });

            contentHtml = `
                <style>@page { size: A4 landscape; margin: 5mm; }</style>
                <div style="padding: 5mm;">
                    <h2 style="text-align: center; margin-bottom: 20px; font-size: 18pt;">${titleMonth} 관내출장 내역서(${userType})</h2>
                    <table class="data-table" style="font-size: 6pt;">
                        <thead>
                            <tr>
                                <th style="width:40px;">연번</th>
                                <th style="width:40px;">구분</th>
                                <th style="width:80px;">출장시작</th>
                                <th style="width:80px;">출장종료</th>
                                <th style="width:60px;">총시간</th>
                                <th style="width:120px;">출장지</th>
                                <th>출장목적</th>
                                <th style="width:50px;">공용차량</th>
                                <th style="width:60px;">성명</th>
                                <th style="width:60px;">여비</th>
                                <th style="width:70px;">개인별합계</th>
                                <th style="width:50px;">서명</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trs.join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (docType === '지급내역서' && userType === '일반') {
            const trs = [];
            let sumPeople = targetUsers.length;
            let sumDays = 0;
            let sum10k = 0;
            let sum20k = 0;
            let sumTotal = 0;

            targetUsers.forEach((user, idx) => {
                sumDays += user.uniqueDays;
                sum10k += user.count10k;
                sum20k += user.count20k;
                sumTotal += user.totalAmount;
                
                trs.push(`
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${user.rank}</td>
                        <td>${user.name}</td>
                        <td>${user.id}</td>
                        <td>${user.uniqueDays}</td>
                        <td>${user.count10k}</td>
                        <td>${user.count20k}</td>
                        <td>0</td>
                        <td style="text-align:right;">${user.totalAmount.toLocaleString()}</td>
                        <td>${user.bank}</td>
                        <td style="text-align:left; font-size: 0.9em; padding-left: 5px;">${user.account}</td>
                    </tr>
                `);
            });

            contentHtml = `
                <style>@page { size: A4 landscape; margin: 5mm; }</style>
                <div style="padding: 5mm;">
                    <h2 style="text-align: center; margin-bottom: 20px; font-size: 18pt;">${titleMonth} 관내출장여비 지급내역서(${userType})</h2>
                    <div style="float: right; margin-bottom: 10px;">
                        <table style="border-collapse: collapse; text-align: center;">
                            <tr>
                                <td rowspan="2" style="padding: 0 10px; border: 1px solid black;">결<br>재</td>
                                <td style="width: 80px; border: 1px solid black; padding: 5px; font-size: 10pt;">작성자</td>
                                <td style="width: 140px; border: 1px solid black; padding: 5px; font-size: 10pt;">확인자</td>
                            </tr>
                            <tr>
                                <td style="height: 30px; border: 1px solid black; vertical-align: middle; font-size: 10pt;">${printClerk} (인)</td>
                                <td style="height: 30px; border: 1px solid black; vertical-align: middle; font-size: 10pt;">${printTeamLeader} (인)</td>
                            </tr>
                        </table>
                    </div>
                    <div style="clear: both;"></div>
                    <table class="data-table" style="font-size: 8pt;">
                        <thead>
                            <tr>
                                <th rowspan="2">연번</th>
                                <th>계급</th>
                                <th>성명</th>
                                <th>고유식별번호</th>
                                <th>출장일수</th>
                                <th colspan="2">여비등급</th>
                                <th>근거리<br>출장여비</th>
                                <th>지급액</th>
                                <th colspan="2">은행 및 계좌번호</th>
                            </tr>
                            <tr style="background-color: var(--bg-light); font-weight:bold;">
                                <th>합계</th>
                                <th>${sumPeople}명</th>
                                <th></th>
                                <th>${sumDays}</th>
                                <th>${sum10k}</th>
                                <th>${sum20k}</th>
                                <th>0</th>
                                <th>${sumTotal.toLocaleString()}</th>
                                <th>은행</th>
                                <th>계좌번호</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trs.join('')}
                        </tbody>
                    </table>
                    <p style="text-align: center; margin-top: 30px; font-size: 12pt;">위와 같이 지급하고자 합니다.</p>
                    <p style="text-align: center; margin-top: 15px; font-size: 12pt;">${printDate}</p>
                </div>
            `;
        } else if (docType === '지급내역서' && userType === '상시') {
            const trs = [];
            let sumPeople = targetUsers.length;
            let sumDays = 0;
            let sumVehUse = 0;
            let sumVehNoUse = 0;
            let sumTotal = 0;

            targetUsers.forEach((user, idx) => {
                sumDays += user.uniqueDays;
                sumVehUse += user.vehicleUseCount;
                sumVehNoUse += user.vehicleNoUseCount;
                sumTotal += user.totalAmount;
                
                trs.push(`
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${user.rank}</td>
                        <td>${user.name}</td>
                        <td>${user.id}</td>
                        <td>${user.uniqueDays}</td>
                        <td>${user.vehicleUseCount}</td>
                        <td>${user.vehicleNoUseCount}</td>
                        <td style="text-align:right;">${user.totalAmount.toLocaleString()}</td>
                        <td>${user.bank}</td>
                        <td style="text-align:left; font-size: 0.9em; padding-left: 5px;">${user.account}</td>
                    </tr>
                `);
            });

            contentHtml = `
                <style>@page { size: A4 landscape; margin: 5mm; }</style>
                <div style="padding: 5mm;">
                    <h2 style="text-align: center; margin-bottom: 20px; font-size: 18pt;">${titleMonth} 관내출장여비 지급내역서(${userType})</h2>
                    <div style="float: right; margin-bottom: 10px;">
                        <table style="border-collapse: collapse; text-align: center;">
                            <tr>
                                <td rowspan="2" style="padding: 0 10px; border: 1px solid black;">결<br>재</td>
                                <td style="width: 80px; border: 1px solid black; padding: 5px; font-size: 10pt;">작성자</td>
                                <td style="width: 140px; border: 1px solid black; padding: 5px; font-size: 10pt;">확인자</td>
                            </tr>
                            <tr>
                                <td style="height: 30px; border: 1px solid black; vertical-align: middle; font-size: 10pt;">${printClerk} (인)</td>
                                <td style="height: 30px; border: 1px solid black; vertical-align: middle; font-size: 10pt;">${printTeamLeader} (인)</td>
                            </tr>
                        </table>
                    </div>
                    <div style="clear: both;"></div>
                    <table class="data-table" style="font-size: 8pt;">
                        <thead>
                            <tr>
                                <th rowspan="2">연번</th>
                                <th>계급</th>
                                <th>성명</th>
                                <th>고유식별번호</th>
                                <th>출장일수</th>
                                <th colspan="2">공용차량</th>
                                <th>지급액</th>
                                <th colspan="2">은행 및 계좌번호</th>
                            </tr>
                            <tr style="background-color: var(--bg-light); font-weight:bold;">
                                <th>합계</th>
                                <th>${sumPeople}명</th>
                                <th></th>
                                <th>${sumDays}</th>
                                <th>${sumVehUse}</th>
                                <th>${sumVehNoUse}</th>
                                <th>${sumTotal.toLocaleString()}</th>
                                <th>은행</th>
                                <th>계좌번호</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trs.join('')}
                        </tbody>
                    </table>
                    <p style="text-align: center; margin-top: 30px; font-size: 12pt;">위와 같이 지급하고자 합니다.</p>
                    <p style="text-align: center; margin-top: 15px; font-size: 12pt;">${printDate}</p>
                </div>
            `;
        }

        document.getElementById('printLtModal').style.display = 'none';
        
        if (window.electronAPI && window.electronAPI.openPrintWindow) {
            await window.electronAPI.openPrintWindow(contentHtml, { landscape: true });
        } else {
            window.showCustomAlert('Electron API를 사용할 수 없습니다.');
        }
    }
};

function initLocalTrip() {
    // 파일명 표시 설정
    if (window.AppUtils) window.AppUtils.setupFileNameDisplay('localTripFile', 'localTripFileName');

    const btn = document.getElementById('btnProcessLocalTrip');
    if (btn) btn.addEventListener('click', () => window.LocalTrip.processFile());

    const filterNameInput = document.getElementById('ltFilterName');
    const filterIdInput = document.getElementById('ltFilterId');
    
    if (filterNameInput) {
        filterNameInput.addEventListener('input', () => window.LocalTrip.updateMainTable());
    }
    if (filterIdInput) {
        filterIdInput.addEventListener('input', () => window.LocalTrip.updateMainTable());
    }
    
    // 여비 제외 체크박스 및 실비 입력 이벤트 감지 (위임)
    const resultTable = document.getElementById('localTripResultTable');
    if (resultTable) {
        resultTable.addEventListener('change', (e) => {
            if (e.target.classList.contains('exclude-allowance-chk')) {
                const recId = e.target.dataset.id;
                const rec = window.LocalTrip.originalRecords.find(r => r.recordId === recId);
                if (rec) {
                    rec.excludeAllowance = e.target.checked;
                    window.LocalTrip.calculateAllowance();
                    window.LocalTrip.updateMainTable();
                    window.LocalTrip.renderSummaryTable();
                }
            } else if (e.target.classList.contains('transit-fare-input')) {
                const recId = e.target.dataset.id;
                const rec = window.LocalTrip.originalRecords.find(r => r.recordId === recId);
                if (rec) {
                    rec.transitFare = parseInt(e.target.value) || 0;
                    window.LocalTrip.calculateAllowance();
                    window.LocalTrip.updateMainTable();
                    window.LocalTrip.renderSummaryTable();
                    // 포커스를 새로 그린 해당 입력란으로 부드럽게 복구
                    setTimeout(() => {
                        const input = document.querySelector(`.transit-fare-input[data-id="${recId}"]`);
                        if (input) {
                            input.focus();
                            const val = input.value;
                            input.value = '';
                            input.value = val; // 커서를 끝으로 이동
                        }
                    }, 50);
                }
            }
        });

        resultTable.addEventListener('input', (e) => {
            if (e.target.classList.contains('transit-fare-input')) {
                const recId = e.target.dataset.id;
                const rec = window.LocalTrip.originalRecords.find(r => r.recordId === recId);
                if (rec) {
                    rec.transitFare = parseInt(e.target.value) || 0;
                }
            }
        });
    }

    const btnVerify = document.getElementById('btnVerifyDistance');
    if (btnVerify) {
        btnVerify.addEventListener('click', () => window.LocalTrip.verifyDistances());
    }

    const btnRestoreLocalTrip = document.getElementById('btnRestoreLocalTripCorrections');
    if (btnRestoreLocalTrip) {
        btnRestoreLocalTrip.addEventListener('click', () => window.LocalTrip.restoreCorrections());
    }

    const btnDownloadLocalTrip = document.getElementById('btnDownloadLocalTrip');
    if (btnDownloadLocalTrip) {
        btnDownloadLocalTrip.addEventListener('click', () => {
            const table = document.querySelector('#localTripResultTable table');
            if (!table) {
                window.showCustomAlert('출력할 데이터가 없습니다.');
                return;
            }
            
            const aoa = [];
            table.querySelectorAll('tr').forEach(row => {
                const rowData = [];
                row.querySelectorAll('th, td').forEach((cell) => {
                    const chk = cell.querySelector('input[type="checkbox"]');
                    if (chk) {
                        rowData.push(chk.checked ? '제외' : '');
                    } else {
                        rowData.push(cell.innerText.replace(/\n/g, ' ').trim());
                    }
                });
                aoa.push(rowData);
            });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "관내출장비");
            
            window.showLoadingSpinner('관내출장비 엑셀 파일을 생성하는 중입니다...');
            setTimeout(() => {
                try {
                    const now = new Date();
                    const datePrefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + " ";
                    XLSX.writeFile(wb, `${datePrefix}관내출장비_산출결과.xlsx`);
                    window.hideLoadingSpinner();
                    window.showCustomAlert("관내출장비 다운로드가 완료되었습니다.");
                } catch (error) {
                    window.hideLoadingSpinner();
                    window.showCustomAlert(`다운로드 중 오류가 발생했습니다: ${error.message}`);
                }
            }, 500);
        });
    }

    // 모달 및 인쇄 관련 이벤트 바인딩
    const btnShowLtSummary = document.getElementById('btnShowLtSummary');
    if (btnShowLtSummary) {
        btnShowLtSummary.addEventListener('click', () => {
            if (!window.LocalTrip.parsedData) {
                window.showCustomAlert('먼저 데이터를 분석해주세요.');
                return;
            }
            document.getElementById('ltSummaryModal').style.display = 'flex';
        });
    }

    const btnOpenLtPrint = document.getElementById('btnOpenLtPrint');
    if (btnOpenLtPrint) {
        btnOpenLtPrint.addEventListener('click', () => {
            if (!window.LocalTrip.parsedData) {
                window.showCustomAlert('먼저 데이터를 분석해주세요.');
                return;
            }
            const now = new Date();
            document.getElementById('printLtMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            document.getElementById('printLtDate').value = now.toISOString().split('T')[0];
            document.getElementById('printLtModal').style.display = 'flex';
        });
    }

    ['btnLtPrintNormalList', 'btnLtPrintNormalPay', 'btnLtPrintSangsiList', 'btnLtPrintSangsiPay'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                const isSangsi = id.includes('Sangsi');
                const isPay = id.includes('Pay');
                window.LocalTrip.printDocument(isPay ? '지급내역서' : '내역서', isSangsi ? '상시' : '일반');
            });
        }
    });

    const btnCancelLtPrint = document.getElementById('btnCancelLtPrint');
    if (btnCancelLtPrint) {
        btnCancelLtPrint.addEventListener('click', () => {
            document.getElementById('printLtModal').style.display = 'none';
        });
    }

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) modal.style.display = 'none';
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocalTrip);
} else {
    initLocalTrip();
}