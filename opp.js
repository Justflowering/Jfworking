// [UX 고도화] 전역 스타일 및 UI/UX 테마 주입 (스타일 변수는 style.css에 통합)
const injectGlobalStyles = () => {
    if (document.getElementById('seomu-dynamic-styles')) return;
    const style = document.createElement('style');
    style.id = 'seomu-dynamic-styles';
    style.innerHTML = `
        /* 스피너 애니메이션 */
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        /* 데이터 없음(Empty State) 디자인 */
        .empty-state { text-align: center; padding: 50px 20px; color: var(--text-muted); background: var(--bg-main); border: 1px dashed var(--border-color); border-radius: 12px; margin: 20px 0; }
        .empty-state-icon { font-size: 3.5rem; margin-bottom: 15px; opacity: 0.7; }
        .empty-state-title { font-size: 1.2rem; font-weight: bold; color: var(--text-dark); margin-bottom: 8px; }
        .empty-state-desc { font-size: 0.95rem; }
        .danger-btn { background-color: var(--danger-color); color: white; border: none; border-radius: 8px; transition: all 0.2s; padding: 8px 16px; }
        .danger-btn:hover { filter: brightness(0.9); transform: translateY(-1px); box-shadow: 0 4px 6px rgba(0,0,0,0.15); }
        
        /* 비고란 체크박스 스타일 */
        .remark-label { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 6px; transition: background-color 0.2s; cursor: pointer; }
        .remark-label input[type="checkbox"] { margin-right: 5px; }
        .remark-label input[type="checkbox"]:checked + .remark-text {
            background-color: #e0f2fe;
            color: #0369a1;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 4px;
        }
    `;
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    }
};
injectGlobalStyles();

// [UX 고도화] 전역 로딩 스피너 함수
window.showLoadingSpinner = function(message = '처리 중입니다...') {
    let overlay = document.getElementById('globalSpinnerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'globalSpinnerOverlay';
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '99999'; // 최상단
        overlay.style.background = 'rgba(0, 0, 0, 0.6)';
        overlay.innerHTML = `
            <div style="text-align: center; color: white; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 60px; height: 60px; border: 6px solid rgba(255,255,255,0.3); border-top: 6px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
                <div id="globalSpinnerMessage" style="font-size: 1.2em; font-weight: bold; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); background: rgba(0,0,0,0.4); padding: 5px 15px; border-radius: 20px;">${message}</div>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('globalSpinnerMessage').textContent = message;
    }
    overlay.style.display = 'flex';
};

window.hideLoadingSpinner = function() {
    const overlay = document.getElementById('globalSpinnerOverlay');
    if (overlay) overlay.style.display = 'none';
};

// 모달 큐 시스템
window._modalQueue = [];
window._isModalActive = false;

window._processModalQueue = function() {
    if (window._isModalActive || window._modalQueue.length === 0) return;
    window._isModalActive = true;
    const task = window._modalQueue.shift();
    task();
};

// 공통 커스텀 모달 함수 (Promise 기반)
window.showCustomAlert = function(message, onConfirm) {
    return new Promise((resolve) => {
        window._modalQueue.push(() => {
            let overlay = document.getElementById('customAlertOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'customAlertOverlay';
                overlay.className = 'modal-overlay';
                overlay.style.zIndex = '9999';
                overlay.innerHTML = `
                    <div class="modal-content card" style="width: 350px; text-align: center;">
                        <h3 style="margin-top: 0; margin-bottom: 15px; color: var(--primary-color);">💡 안내</h3>
                        <p id="customAlertMessage" style="white-space: pre-wrap; line-height: 1.5; margin-bottom: 20px; font-size: 1.05em; text-align: left;"></p>
                        <button id="btnCustomAlertConfirm" class="primary-btn" style="width: 100%;">확인</button>
                    </div>
                `;
                document.body.appendChild(overlay);
                document.getElementById('btnCustomAlertConfirm').addEventListener('click', () => {
                    overlay.style.display = 'none';
                    window._isModalActive = false;
                    if (overlay.onConfirmCallback) overlay.onConfirmCallback();
                    if (overlay.resolvePromise) overlay.resolvePromise(true);
                    window._processModalQueue();
                });
            }
            document.getElementById('customAlertMessage').textContent = String(message).replace(/\\n/g, '\n');
            overlay.onConfirmCallback = onConfirm;
            overlay.resolvePromise = resolve;
            overlay.style.display = 'flex';
            setTimeout(() => document.getElementById('btnCustomAlertConfirm').focus(), 10);
        });
        window._processModalQueue();
    });
};

window.showCustomConfirm = function(message, onConfirm, onCancel) {
    return new Promise((resolve) => {
        window._modalQueue.push(() => {
            let overlay = document.getElementById('customConfirmOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'customConfirmOverlay';
                overlay.className = 'modal-overlay';
                overlay.style.zIndex = '9999';
                overlay.innerHTML = `
                    <div class="modal-content card" style="width: 350px; text-align: center;">
                        <h3 style="margin-top: 0; margin-bottom: 15px; color: var(--primary-color);">❓ 확인</h3>
                        <p id="customConfirmMessage" style="white-space: pre-wrap; line-height: 1.5; margin-bottom: 20px; font-size: 1.05em; text-align: left;"></p>
                        <div style="display: flex; gap: 10px;">
                            <button id="btnCustomConfirmOk" class="primary-btn" style="flex: 1;">확인</button>
                            <button id="btnCustomConfirmCancel" class="primary-btn" style="flex: 1; background-color: var(--btn-cancel-bg);">취소</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);
                document.getElementById('btnCustomConfirmOk').addEventListener('click', () => {
                    overlay.style.display = 'none';
                    window._isModalActive = false;
                    if (overlay.onConfirmCallback) overlay.onConfirmCallback();
                    if (overlay.resolvePromise) overlay.resolvePromise(true);
                    window._processModalQueue();
                });
                document.getElementById('btnCustomConfirmCancel').addEventListener('click', () => {
                    overlay.style.display = 'none';
                    window._isModalActive = false;
                    if (overlay.onCancelCallback) overlay.onCancelCallback();
                    if (overlay.resolvePromise) overlay.resolvePromise(false);
                    window._processModalQueue();
                });
            }
            document.getElementById('customConfirmMessage').textContent = String(message).replace(/\\n/g, '\n');
            overlay.onConfirmCallback = onConfirm;
            overlay.onCancelCallback = onCancel;
            overlay.resolvePromise = resolve;
            overlay.style.display = 'flex';
            setTimeout(() => document.getElementById('btnCustomConfirmOk').focus(), 10);
        });
        window._processModalQueue();
    });
};

window.showCustomPrompt = function(message, defaultValue = '') {
    return new Promise((resolve) => {
        window._modalQueue.push(() => {
            let overlay = document.getElementById('customPromptOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'customPromptOverlay';
                overlay.className = 'modal-overlay';
                overlay.style.zIndex = '9999';
                overlay.innerHTML = `
                    <div class="modal-content card" style="width: 350px; text-align: center;">
                        <h3 style="margin-top: 0; margin-bottom: 15px; color: var(--primary-color);">✏️ 입력</h3>
                        <p id="customPromptMessage" style="white-space: pre-wrap; line-height: 1.5; margin-bottom: 15px; font-size: 1.05em; text-align: left;"></p>
                        <input type="text" id="customPromptInput" style="width: 100%; padding: 8px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
                        <div style="display: flex; gap: 10px;">
                            <button id="btnCustomPromptOk" class="primary-btn" style="flex: 1;">확인</button>
                            <button id="btnCustomPromptCancel" class="primary-btn" style="flex: 1; background-color: var(--btn-cancel-bg);">취소</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);
                document.getElementById('btnCustomPromptOk').addEventListener('click', () => {
                    const val = document.getElementById('customPromptInput').value;
                    overlay.style.display = 'none';
                    window._isModalActive = false;
                    if (overlay.resolvePromise) overlay.resolvePromise(val);
                    window._processModalQueue();
                });
                document.getElementById('btnCustomPromptCancel').addEventListener('click', () => {
                    overlay.style.display = 'none';
                    window._isModalActive = false;
                    if (overlay.resolvePromise) overlay.resolvePromise(null);
                    window._processModalQueue();
                });
                document.getElementById('customPromptInput').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') document.getElementById('btnCustomPromptOk').click();
                });
            }
            document.getElementById('customPromptMessage').textContent = String(message).replace(/\\n/g, '\n');
            const inputEl = document.getElementById('customPromptInput');
            inputEl.value = defaultValue;
            overlay.resolvePromise = resolve;
            overlay.style.display = 'flex';
            setTimeout(() => {
                inputEl.focus();
                inputEl.select();
            }, 10);
        });
        window._processModalQueue();
    });
};

// [DRY 최적화] 전역 공통 유틸리티 객체 선언 (엑셀 파싱 및 날짜 변환)
window.AppUtils = {
    setupFileNameDisplay(inputId, displayId) {
        const inputEl = document.getElementById(inputId);
        const displayEl = document.getElementById(displayId);
        if (inputEl && displayEl) {
            inputEl.addEventListener('change', () => {
                if (inputEl.files.length > 0) {
                    displayEl.textContent = `선택된 파일: ${Array.from(inputEl.files).map(f => f.name).join(', ')}`;
                } else {
                    displayEl.textContent = '';
                }
            });
        }
    },
    readExcel(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.name) {
                window.showCustomAlert('파일을 인식할 수 없습니다.');
                return reject(new Error('파일을 인식할 수 없습니다.'));
            }
            const fileName = file.name.toLowerCase();
            if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
                window.showCustomAlert(`[파일 형식 오류]\n엑셀 파일(.xls, .xlsx)만 업로드할 수 있습니다.\n\n업로드된 파일: ${file.name}`);
                return reject(new Error(`엑셀 파일이 아닙니다: ${file.name}`));
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const workbook = XLSX.read(e.target.result, { type: 'binary' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    resolve(XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }));
                } catch (err) { reject(err); }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsBinaryString(file);
        });
    },
    simulateTextToColumns(data) {
        return data.map(row => {
            let processedRow = row;
            if (row.length > 0 && typeof row[0] === 'string' && row[0].includes('\t')) {
                processedRow = row[0].split('\t').concat(row.slice(1));
            }
            const maxColIndex = 31;
            for (let i = 0; i <= maxColIndex && i < processedRow.length; i++) {
                const cellValue = processedRow[i];
                if (typeof cellValue === 'string') {
                    const trimmedValue = cellValue.trim();
                    if (trimmedValue !== '' && !isNaN(trimmedValue)) {
                        processedRow[i] = Number(trimmedValue);
                    }
                }
            }
            return processedRow;
        });
    },
    toJsDate(excelValue) {
        if (!excelValue) return null;
        if (excelValue instanceof Date) return excelValue;
        let str = String(excelValue).trim();
        if (str === '') return null;
        if (str.includes('-') || str.includes('/')) {
            const parts = str.split(/[-/]/);
            if (parts.length === 3) {
                const [y, m, d] = parts.map(p => parseInt(p, 10));
                if (!isNaN(y) && !isNaN(m) && !isNaN(d) && y > 1900) return new Date(y, m - 1, d);
            }
        }
        if (/^\d{8}$/.test(str)) {
            const y = parseInt(str.substring(0, 4), 10), m = parseInt(str.substring(4, 6), 10), d = parseInt(str.substring(6, 8), 10);
            if (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return new Date(y, m - 1, d);
        }
        if (str.includes(':')) {
            const parts = str.split(':');
            if (parts.length >= 2) {
                const h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
                if (!isNaN(h) && !isNaN(m)) return new Date(1970, 0, 1, h, m, 0);
            }
        }
        if (!isNaN(str)) {
            const serial = Number(str);
            if (serial >= 0 && typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
                const d = XLSX.SSF.parse_date_code(serial);
                if (d) return new Date(d.y > 0 ? d.y : 1970, (d.m > 0 ? d.m : 1) - 1, d.d > 0 ? d.d : 1, d.H || 0, d.M || 0, d.S || 0);
            }
        }
        return null;
    },
    formatDate(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    formatTime(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
};

// 특정 부서명에 대한 주소 하드코딩 매핑 테이블
window.CUSTOM_ADDRESS_MAP = {
    '공공시설과': '울산 남구 돋질로 239번길 8',
    '보육지원과': '울산 남구 돋질로 239번길 8',
    '소상공인진흥과': '울산 남구 삼산중로131번길 36',
    '체육지원과': '울산 남구 삼산중로131번길 36',
    '본청': '울산 남구 돋질로 233',
    '남구청': '울산 남구 돋질로 233',
    '시청': '울산 남구 중앙로 201'
};

window.openUilessMap = function(dest) {
    const apiSettings = typeof DB !== 'undefined' && DB.settings && DB.settings.kakaoApi ? DB.settings.kakaoApi : {};
    const jsKey = apiSettings.javascriptKey || '6e18fe849bf66bff676eb7d51cfebcb1';
    const cleanJsKey = jsKey.replace(/[^a-zA-Z0-9]/g, '');
    const safeDest = dest.replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '');
    const customMapJson = JSON.stringify(window.CUSTOM_ADDRESS_MAP || {});
    
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>${safeDest} 지도 확인</title>
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }</style>
    <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${cleanJsKey}&libraries=services"></script>
</head>
<body>
    <div id="map" style="width:100%;height:100%;"></div>
    <script>
        kakao.maps.load(function() {
            var mapContainer = document.getElementById('map');
            var map = new kakao.maps.Map(mapContainer, { center: new kakao.maps.LatLng(33.450701, 126.570667), level: 3 });
            var geocoder = new kakao.maps.services.Geocoder();
            var ps = new kakao.maps.services.Places();
            
            function displayMarker(loc, name) {
                map.setCenter(loc);
                var marker = new kakao.maps.Marker({ map: map, position: loc });
                var infowindow = new kakao.maps.InfoWindow({ content: '<div style="padding:5px;font-size:12px;color:black;white-space:nowrap;">' + name + '</div>' });
                infowindow.open(map, marker);
            }

            var originalQuery = '${safeDest}';
            var cleanQuery = originalQuery.replace(/\\([^)]*\\)/g, '').trim();
            var queries = [];
            var customAddressMap = ${customMapJson};
            
            var foundCustom = null;
            for (var key in customAddressMap) {
                if (originalQuery.includes(key)) {
                    foundCustom = customAddressMap[key];
                    break;
                }
            }
            if (foundCustom) queries.push(foundCustom);
            
            if (!cleanQuery.includes('울산')) {
                queries.push('울산 남구 ' + cleanQuery);
                queries.push('울산 ' + cleanQuery);
            }
            queries.push(cleanQuery);
            queries.push(originalQuery);

            var tryIdx = 0;
            function trySearch() {
                if (tryIdx >= queries.length) {
                    document.body.innerHTML = '<div style="padding:20px;text-align:center;font-family:sans-serif;background:#fff;height:100%;">검색 결과가 없습니다.<br><br>검색어: ' + originalQuery + '</div>';
                    return;
                }
                var q = queries[tryIdx++];
                
                geocoder.addressSearch(q, function(result, status) {
                    if (status === kakao.maps.services.Status.OK) {
                        displayMarker(new kakao.maps.LatLng(result[0].y, result[0].x), q);
                    } else {
                        ps.keywordSearch(q, function(data, status) {
                            if (status === kakao.maps.services.Status.OK) {
                                displayMarker(new kakao.maps.LatLng(data[0].y, data[0].x), data[0].place_name);
                            } else {
                                trySearch();
                            }
                        });
                    }
                });
            }
            trySearch();
        });
    </script>
</body>
</html>`;
    const newWin = window.open('', '_blank', 'width=800,height=600');
    if (newWin) {
        newWin.document.open();
        newWin.document.write(html);
        newWin.document.close();
    } else {
        alert('팝업 차단이 설정되어 있습니다. 팝업 차단을 해제해주세요.');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 탭 전환 로직
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.target);
            if (target) target.classList.add('active');
        });
    });

    // 비밀번호 보이기/숨기기 토글 이벤트
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    this.classList.replace('fa-eye-slash', 'fa-eye');
                } else {
                    input.type = 'password';
                    this.classList.replace('fa-eye', 'fa-eye-slash');
                }
            }
        });
    });

    // 모달 오버레이(배경) 클릭 시 이벤트 전파 차단
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) e.stopPropagation();
        });
    });

    // ESC 키 모달창 닫기 기능
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const confirmOverlay = document.getElementById('customConfirmOverlay');
            if (confirmOverlay && confirmOverlay.style.display === 'flex') {
                const cancelBtn = document.getElementById('btnCustomConfirmCancel');
                if (cancelBtn) cancelBtn.click();
                return;
            }
            
            const alertOverlay = document.getElementById('customAlertOverlay');
            if (alertOverlay && alertOverlay.style.display === 'flex') {
                const confirmBtn = document.getElementById('btnCustomAlertConfirm');
                if (confirmBtn) confirmBtn.click();
                return;
            }

            const promptOverlay = document.getElementById('customPromptOverlay');
            if (promptOverlay && promptOverlay.style.display === 'flex') {
                const cancelBtn = document.getElementById('btnCustomPromptCancel');
                if (cancelBtn) cancelBtn.click();
                return;
            }

            const openModals = Array.from(document.querySelectorAll('.modal-overlay')).filter(m => m.style.display === 'flex' || m.style.display === 'block');
            if (openModals.length > 0) {
                const lastModal = openModals[openModals.length - 1];
                if (lastModal.id === 'localTripMapModal') {
                    const iframe = document.getElementById('ltMapIframe');
                    if (iframe) iframe.src = '';
                }
                lastModal.style.display = 'none';
            }
        }
    });

    // 파일명 표시 바인딩
    window.AppUtils.setupFileNameDisplay('dbFiles', 'dbFilesName');
    window.AppUtils.setupFileNameDisplay('rosterFile', 'rosterFileName');

    // 거래처 정보 아코디언 토글
    const vendorToggleHeader = document.getElementById('vendorToggleHeader');
    const vendorSettingsDiv = document.getElementById('vendorSettings');
    const vendorToggleIcon = document.getElementById('vendorToggleIcon');
    if (vendorToggleHeader && vendorSettingsDiv && vendorToggleIcon) {
        vendorToggleHeader.addEventListener('click', () => {
            if (vendorSettingsDiv.style.display === 'none') {
                vendorSettingsDiv.style.display = 'block';
                vendorToggleIcon.textContent = '▲';
            } else {
                vendorSettingsDiv.style.display = 'none';
                vendorToggleIcon.textContent = '▼';
            }
        });
    }

    // 환경 설정 UI 렌더링 및 저장 핸들러
    renderSettings();
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            const priceInputs = document.querySelectorAll('.setting-price');
            const newUnitPrices = {};
            priceInputs.forEach(input => {
                newUnitPrices[input.dataset.key] = parseInt(input.value) || 0;
            });

            const newMealPrice = parseInt(document.getElementById('settingMealPrice')?.value) || (DB.settings.mealPrice || 9000);
            const newMaxConsecutiveDuty = parseInt(document.getElementById('settingMaxConsecutiveDuty')?.value) || 3;
            
            const vendorItems = document.querySelectorAll('#vendorList > div');
            const newMealVendors = [];
            vendorItems.forEach(item => {
                newMealVendors.push({
                    name: item.querySelector('.vendor-name').value,
                    representative: item.querySelector('.vendor-rep').value,
                    phone: item.querySelector('.vendor-phone').value,
                    address: item.querySelector('.vendor-address').value,
                    account: item.querySelector('.vendor-account').value
                });
            });
            
            const newIncludeGrade5Overtime = document.getElementById('settingIncludeGrade5Overtime') ? document.getElementById('settingIncludeGrade5Overtime').checked : DB.settings.includeGrade5Overtime;

            const newLocalTrip = {
                sangsiAmount: parseInt(document.getElementById('settingSangsiAmount')?.value) || (DB.settings.localTrip?.sangsiAmount || 0),
                normalVehOver4: parseInt(document.getElementById('settingNormalVehOver4')?.value) || (DB.settings.localTrip?.normalVehOver4 || 0),
                normalVehUnder4: parseInt(document.getElementById('settingNormalVehUnder4')?.value) || (DB.settings.localTrip?.normalVehUnder4 || 0),
                normalNoVehOver4: parseInt(document.getElementById('settingNormalNoVehOver4')?.value) || (DB.settings.localTrip?.normalNoVehOver4 || 0),
                normalNoVehUnder4: parseInt(document.getElementById('settingNormalNoVehUnder4')?.value) || (DB.settings.localTrip?.normalNoVehUnder4 || 0),
                useSangsiDeduction: document.getElementById('settingUseSangsiDeduction') ? document.getElementById('settingUseSangsiDeduction').checked : (DB.settings.localTrip?.useSangsiDeduction !== false),
                sangsiDeductionExemptDays: document.getElementById('settingSangsiDeductionExemptDays') ? (parseInt(document.getElementById('settingSangsiDeductionExemptDays').value) || 0) : (DB.settings.localTrip?.sangsiDeductionExemptDays !== undefined ? DB.settings.localTrip?.sangsiDeductionExemptDays : 4)
            };

            const newOutTrip = {
                dailyAllowance: parseInt(document.getElementById('settingOutTripDaily')?.value) || (DB.settings.outTrip?.dailyAllowance || 0),
                mealAllowance: parseInt(document.getElementById('settingOutTripMeal')?.value) || (DB.settings.outTrip?.mealAllowance || 0),
                lodgingSeoul: parseInt(document.getElementById('settingOutTripLodgingSeoul')?.value) || (DB.settings.outTrip?.lodgingSeoul || 0),
                lodgingMetro: parseInt(document.getElementById('settingOutTripLodgingMetro')?.value) || (DB.settings.outTrip?.lodgingMetro || 0),
                lodgingOther: parseInt(document.getElementById('settingOutTripLodgingOther')?.value) || (DB.settings.outTrip?.lodgingOther || 0),
                useTimeMealDeduction: document.getElementById('settingUseTimeMealDeduction') ? document.getElementById('settingUseTimeMealDeduction').checked : (DB.settings.outTrip?.useTimeMealDeduction !== false)
            };

            const newKakaoApi = {
                restApiKey: (document.getElementById('settingKakaoRestApiKey')?.value || '').replace(/[^a-zA-Z0-9]/g, '') || '41360366fe8aa573b45f73c82e4aa34a',
                javascriptKey: (document.getElementById('settingKakaoJsApiKey')?.value || '').replace(/[^a-zA-Z0-9]/g, '') || '6e18fe849bf66bff676eb7d51cfebcb1',
                startAddress: document.getElementById('settingStartAddress')?.value || DB.settings.kakaoApi?.startAddress || ''
            };
            
            const newDeptName = document.getElementById('settingDeptName')?.value || '';
            const newDeptType = document.getElementById('settingDeptType')?.value || '실과';
            const newPublicDataApiKey = document.getElementById('settingPublicDataApiKey')?.value || '502703e3209d16cee77a91c35223e14190e22823704ead8ff756104506e6711e';

            DB.saveSettings({
                unitPrices: newUnitPrices,
                mealPrice: newMealPrice,
                mealVendors: newMealVendors,
                includeGrade5Overtime: newIncludeGrade5Overtime,
                maxConsecutiveDuty: newMaxConsecutiveDuty,
                localTrip: newLocalTrip,
                outTrip: newOutTrip,
                kakaoApi: newKakaoApi,
                departmentName: newDeptName,
                departmentType: newDeptType,
                publicDataApiKey: newPublicDataApiKey
            });
            window.showCustomAlert('설정이 저장되었습니다.');
            updateDutyTabVisibility();
        });
    }

    // 설정 백업(다운로드)
    const btnExportSettings = document.getElementById('btnExportSettings');
    if (btnExportSettings) {
        btnExportSettings.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(DB.settings, null, 4));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            const now = new Date();
            const datePrefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + " ";
            downloadAnchorNode.setAttribute("download", `${datePrefix}seomu_settings.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    // [HTML 수정 반영] 설정 복구 버튼 클릭 시 파일 선택 트리거
    const btnImportSettings = document.getElementById('btnImportSettings');
    const importSettingsFile = document.getElementById('importSettingsFile');
    if (btnImportSettings && importSettingsFile) {
        btnImportSettings.addEventListener('click', () => {
            importSettingsFile.click();
        });
    }

    // 설정 복구(업로드) 파일 체인지 이벤트
    if (importSettingsFile) {
        importSettingsFile.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedSettings = JSON.parse(e.target.result);
                    if (typeof importedSettings === 'object' && importedSettings !== null) {
                        DB.saveSettings(importedSettings);
                        window.showCustomAlert('설정이 성공적으로 복구(업로드) 되었습니다.');
                        renderSettings();
                        updateDutyTabVisibility();
                    } else {
                        window.showCustomAlert('유효하지 않은 설정 파일입니다.');
                    }
                } catch (error) {
                    console.error('설정 파일 파싱 오류:', error);
                    window.showCustomAlert('파일을 읽는 중 오류가 발생했습니다. 올바른 JSON 파일인지 확인하세요.');
                }
                importSettingsFile.value = '';
            };
            reader.readAsText(file);
        });
    }

    // 저장 폴더 열기 (Electron 지원)
    const btnOpenStoreFolder = document.getElementById('btnOpenStoreFolder');
    if (btnOpenStoreFolder) {
        btnOpenStoreFolder.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.openStoreFolder) {
                window.electronAPI.openStoreFolder();
            } else {
                window.showCustomAlert('Electron 환경에서만 지원되는 기능입니다.');
            }
        });
    }

    // 데이터 완전 초기화
    const btnFactoryReset = document.getElementById('btnFactoryReset');
    if (btnFactoryReset) {
        btnFactoryReset.addEventListener('click', async () => {
            const confirmed = await window.showCustomConfirm('⚠️ 경고: 모든 설정, 거래처, 명세서 데이터가 영구적으로 삭제되며 처음 상태로 돌아갑니다.\n정말 초기화하시겠습니까?');
            if (confirmed) {
                const finalConfirm = await window.showCustomConfirm('초기화 후에는 복구할 수 없습니다.\n계속 진행하시겠습니까?');
                if (finalConfirm) {
                    try {
                        if (window.electronAPI && window.electronAPI.deleteStoreValue) {
                            window.electronAPI.deleteStoreValue('seomuSettings');
                            window.electronAPI.deleteStoreValue('seomuRosterData');
                        } else {
                            localStorage.removeItem('seomuSettings');
                            localStorage.removeItem('seomuRosterData');
                        }
                        window.showCustomAlert('데이터가 초기화되었습니다. 프로그램이 재시작됩니다.', () => {
                            location.reload();
                        });
                    } catch (err) {
                        window.showCustomAlert('초기화 중 오류가 발생했습니다.');
                    }
                }
            }
        });
    }

    function renderSettings() {
        const unitContainer = document.getElementById('unitPriceSettings');
        if (unitContainer) {
            unitContainer.innerHTML = '';
            if (DB.settings && DB.settings.unitPrices) {
                for (let key in DB.settings.unitPrices) {
                    const div = document.createElement('div');
                    div.className = 'setting-row';
                    div.innerHTML = `
                        <label style="width: 150px; font-weight: bold;">${key}</label>
                        <input type="number" class="setting-price" data-key="${key}" value="${DB.settings.unitPrices[key]}">
                    `;
                    unitContainer.appendChild(div);
                }
            }
        }
        
        const deptInput = document.getElementById('settingDeptName');
        if (deptInput) {
            let dName = DB.settings.departmentName || '';
            if (dName.includes('예: 가가과')) dName = '';
            deptInput.value = dName;
        }
        
        const deptTypeInput = document.getElementById('settingDeptType');
        if (deptTypeInput) {
            deptTypeInput.value = DB.settings.departmentType || '실과';
        }

        const startAddressInput = document.getElementById('settingStartAddress');
        if (startAddressInput) {
            let sAddr = (DB.settings.kakaoApi && DB.settings.kakaoApi.startAddress) ? DB.settings.kakaoApi.startAddress : '';
            if (sAddr.includes('예: ') || sAddr.includes('세종대로 110')) sAddr = '';
            startAddressInput.value = sAddr;
            const mapContainer = document.getElementById('mapPreview');
            if (mapContainer && startAddressInput.value) {
                updateMapPreview(startAddressInput.value);
            }
        }

        // 거래처 정보 관리 렌더링
        let mealVendors = (DB.settings && DB.settings.mealVendors) ? DB.settings.mealVendors : [];
        if (mealVendors.length === 0 && DB.settings && DB.settings.mealVendor && typeof DB.settings.mealVendor === 'string') {
            mealVendors.push({ name: DB.settings.mealVendor, address: '', representative: '', account: '', phone: '' });
        }
        if (mealVendors.length === 0) {
            mealVendors.push({ name: '', address: '', representative: '', account: '', phone: '' });
        }

        mealVendors.forEach(v => {
            const clearIfMatch = (val, matches) => matches.some(m => (val || '').trim() === m) ? '' : val;
            v.name = clearIfMatch(v.name || '', ['상호명', '예: 맛집식당', '비단길']);
            v.address = clearIfMatch(v.address || '', ['주소', '예: 울산 남구 돋질로']);
            v.phone = clearIfMatch(v.phone || '', ['전화번호', '예: 052-123']);
            v.representative = clearIfMatch(v.representative || '', ['대표자명', '예: 홍길동']);
            v.account = clearIfMatch(v.account || '', ['계좌번호', '예: 농협 123']);
        });

        const vendorListEl = document.getElementById('vendorList');
        function renderVendorList() {
            if (!vendorListEl) return;
            vendorListEl.innerHTML = '';
            mealVendors.forEach((v, index) => {
                const item = document.createElement('div');
                item.style.border = '1px solid #ccc';
                item.style.padding = '10px 15px 10px 10px';
                item.style.marginBottom = '10px';
                item.style.borderRadius = '4px';
                item.style.backgroundColor = '#f9f9f9';
                item.style.width = 'fit-content';
                item.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <div class="setting-row" style="display: flex; align-items: center; justify-content: flex-start; gap: 20px; margin: 0;">
                            <label style="font-weight: bold; width: 130px;">상호명</label>
                            <div style="display: flex; gap: 5px; width: 300px;">
                                <input type="text" class="vendor-name" placeholder="상호명" style="flex: 1; padding: 4px;">
                                <button class="btn-search-vendor primary-btn" data-index="${index}" style="padding: 0 10px; font-size: 0.9em;">주소 검색</button>
                            </div>
                            <button class="btn-remove-vendor danger-btn" data-index="${index}" style="border-radius: 4px; padding: 4px 10px; font-size: 0.85em;">삭제</button>
                        </div>
                        <div class="setting-row" style="display: flex; align-items: center; justify-content: flex-start; gap: 20px; margin: 0;">
                            <label style="font-weight: bold; width: 130px;">주소</label>
                            <input type="text" class="vendor-address" placeholder="주소" style="width: 300px; padding: 4px;">
                        </div>
                        <div class="setting-row" style="display: flex; align-items: center; justify-content: flex-start; gap: 20px; margin: 0;">
                            <label style="font-weight: bold; width: 130px;">전화번호</label>
                            <input type="text" class="vendor-phone" placeholder="전화번호" style="width: 300px; padding: 4px;">
                        </div>
                        <div class="setting-row" style="display: flex; align-items: center; justify-content: flex-start; gap: 20px; margin: 0;">
                            <label style="font-weight: bold; width: 130px;">대표자명</label>
                            <input type="text" class="vendor-rep" placeholder="대표자명" style="width: 300px; padding: 4px;">
                        </div>
                        <div class="setting-row" style="display: flex; align-items: center; justify-content: flex-start; gap: 20px; margin: 0;">
                            <label style="font-weight: bold; width: 130px;">계좌번호</label>
                            <input type="text" class="vendor-account" placeholder="계좌번호" style="width: 300px; padding: 4px;">
                        </div>
                    </div>
                `;
                item.querySelector('.vendor-name').value = v.name || '';
                item.querySelector('.vendor-address').value = v.address || '';
                item.querySelector('.vendor-phone').value = v.phone || '';
                item.querySelector('.vendor-rep').value = v.representative || '';
                item.querySelector('.vendor-account').value = v.account || '';
                vendorListEl.appendChild(item);
            });

            document.querySelectorAll('.btn-remove-vendor').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const vendorItems = document.querySelectorAll('#vendorList > div');
                    vendorItems.forEach((item, i) => {
                        mealVendors[i].name = item.querySelector('.vendor-name').value;
                        mealVendors[i].representative = item.querySelector('.vendor-rep').value;
                        mealVendors[i].phone = item.querySelector('.vendor-phone').value;
                        mealVendors[i].address = item.querySelector('.vendor-address').value;
                        mealVendors[i].account = item.querySelector('.vendor-account').value;
                    });
                    mealVendors.splice(idx, 1);
                    renderVendorList();
                });
            });

            document.querySelectorAll('.btn-search-vendor').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const vendorItems = document.querySelectorAll('#vendorList > div');
                    if (!vendorItems[idx]) return;
                    
                    const nameInput = vendorItems[idx].querySelector('.vendor-name');
                    const addressInput = vendorItems[idx].querySelector('.vendor-address');
                    
                    const query = nameInput.value.trim();
                    if (!query) {
                        window.showCustomAlert('검색할 상호명을 먼저 입력해주세요.');
                        nameInput.focus();
                        return;
                    }

                    const originalText = e.target.textContent;
                    e.target.textContent = '검색중...';
                    try {
                        const addr = await searchKakaoAddressText(query);
                        if (addr) {
                            if (!addr.includes('울산')) {
                                const proceed = await window.showCustomConfirm(`검색된 주소가 울산지역이 아닙니다.\n\n[ ${addr} ]\n\n이 주소를 계속 사용하시겠습니까?`);
                                if (!proceed) return;
                            }
                            addressInput.value = addr;
                            updateMapPreview(addr);
                        } else {
                            window.showCustomAlert('검색 결과가 없습니다. 정확한 상호명으로 다시 시도해주세요.');
                        }
                    } catch (err) {
                        window.showCustomAlert('검색 중 오류가 발생했습니다.');
                    } finally {
                        e.target.textContent = originalText;
                    }
                });
            });

            document.querySelectorAll('.vendor-address').forEach(inp => {
                inp.addEventListener('change', (e) => {
                    updateMapPreview(e.target.value);
                });
            });
        }
        
        renderVendorList();

        const btnAddVendor = document.getElementById('btnAddVendor');
        if (btnAddVendor) {
            btnAddVendor.replaceWith(btnAddVendor.cloneNode(true));
            document.getElementById('btnAddVendor').addEventListener('click', () => {
                const vendorItems = document.querySelectorAll('#vendorList > div');
                vendorItems.forEach((item, i) => {
                    mealVendors[i].name = item.querySelector('.vendor-name').value;
                    mealVendors[i].representative = item.querySelector('.vendor-rep').value;
                    mealVendors[i].phone = item.querySelector('.vendor-phone').value;
                    mealVendors[i].address = item.querySelector('.vendor-address').value;
                    mealVendors[i].account = item.querySelector('.vendor-account').value;
                });
                mealVendors.push({ name: '', address: '', representative: '', account: '', phone: '' });
                renderVendorList();
            });
        }

        // 관리자 전용 기타 설정 렌더링
        const adminOtherContainer = document.getElementById('adminOtherSettings');
        if (adminOtherContainer) {
            const mealPrice = (DB.settings && DB.settings.mealPrice) ? DB.settings.mealPrice : 9000;
            const includeGrade5Overtime = DB.settings && DB.settings.includeGrade5Overtime;
            const maxConsecutiveDuty = (DB.settings && DB.settings.maxConsecutiveDuty !== undefined) ? DB.settings.maxConsecutiveDuty : 3;
            adminOtherContainer.innerHTML = `
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;">
                    <label style="font-weight: bold; width: 150px;">특근매식비 단가 (원)</label>
                    <input type="number" id="settingMealPrice" value="${mealPrice}">
                </div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px; margin-top: 10px;">
                    <label style="font-weight: bold; width: 150px;">연속 당직 최대 일수</label>
                    <input type="number" id="settingMaxConsecutiveDuty" value="${maxConsecutiveDuty}" min="1">
                </div>
                <div class="setting-row checkbox-group" style="justify-content: flex-start; gap: 10px; margin-top: 10px;">
                    <input type="checkbox" id="settingIncludeGrade5Overtime" ${includeGrade5Overtime ? 'checked' : ''}>
                    <label for="settingIncludeGrade5Overtime" style="cursor: pointer; margin: 0;">5급 직원을 초과근무수당 산출 대상에 포함 (기본값: 제외)</label>
                </div>
            `;
        }
        
        // 관내출장 설정 렌더링
        const localTripContainer = document.getElementById('localTripSettings');
        if (localTripContainer) {
            localTripContainer.innerHTML = '';
            const ltSettings = (DB.settings && DB.settings.localTrip) ? DB.settings.localTrip : {
                sangsiAmount: 200000, normalVehOver4: 10000, normalVehUnder4: 0, normalNoVehOver4: 20000, normalNoVehUnder4: 10000, useSangsiDeduction: true, sangsiDeductionExemptDays: 4
            };
            const ltDiv = document.createElement('div');
            ltDiv.innerHTML = `
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 250px;">상시출장 (월정액)</label><input type="number" id="settingSangsiAmount" value="${ltSettings.sangsiAmount}"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 250px;">미상시 - 공용차량 사용 & 4시간 이상</label><input type="number" id="settingNormalVehOver4" value="${ltSettings.normalVehOver4}"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 250px;">미상시 - 공용차량 사용 & 4시간 미만</label><input type="number" id="settingNormalVehUnder4" value="${ltSettings.normalVehUnder4}"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 250px;">미상시 - 공용차량 미사용 & 4시간 이상</label><input type="number" id="settingNormalNoVehOver4" value="${ltSettings.normalNoVehOver4}"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 250px;">미상시 - 공용차량 미사용 & 4시간 미만</label><input type="number" id="settingNormalNoVehUnder4" value="${ltSettings.normalNoVehUnder4}"></div>
                <div class="setting-row checkbox-group" style="justify-content: flex-start; gap: 10px; margin-top: 10px; margin-bottom: 10px;">
                    <input type="checkbox" id="settingUseSangsiDeduction" ${ltSettings.useSangsiDeduction !== false ? 'checked' : ''} style="cursor: pointer;">
                    <label for="settingUseSangsiDeduction" style="cursor: pointer; margin: 0; font-weight: bold;">상시출장 공용차량 감액 적용 (1일당 1만원)</label>
                </div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;">
                    <label style="font-weight: bold; width: 250px;">상시출장 공용차량 감액 면제일수</label>
                    <input type="number" id="settingSangsiDeductionExemptDays" value="${ltSettings.sangsiDeductionExemptDays !== undefined ? ltSettings.sangsiDeductionExemptDays : 4}">
                </div>
            `;
            localTripContainer.appendChild(ltDiv);
        }

        // 관외출장 설정 렌더링
        const outTripContainer = document.getElementById('outTripSettings');
        if (outTripContainer) {
            outTripContainer.innerHTML = '';
            const otSettings = (DB.settings && DB.settings.outTrip) ? DB.settings.outTrip : {
                dailyAllowance: 25000, mealAllowance: 25000, lodgingSeoul: 100000, lodgingMetro: 80000, lodgingOther: 70000, useTimeMealDeduction: true
            };
            const otDiv = document.createElement('div');
            otDiv.innerHTML = `
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 200px;">일비 (1일)</label><input type="number" id="settingOutTripDaily" value="${otSettings.dailyAllowance}"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 200px;">식비 (1일 3식 기준)</label><input type="number" id="settingOutTripMeal" value="${otSettings.mealAllowance}"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 200px;">숙박비 (서울 상한)</label><input type="number" id="settingOutTripLodgingSeoul" value="${otSettings.lodgingSeoul}"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 200px;">숙박비 (광역시 상한)</label><input type="number" id="settingOutTripLodgingMetro" value="${otSettings.lodgingMetro}"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 200px;">숙박비 (기타 지역 상한)</label><input type="number" id="settingOutTripLodgingOther" value="${otSettings.lodgingOther}"></div>
                <div class="setting-row checkbox-group" style="justify-content: flex-start; gap: 10px; margin-top: 10px;">
                    <input type="checkbox" id="settingUseTimeMealDeduction" ${otSettings.useTimeMealDeduction !== false ? 'checked' : ''} style="cursor: pointer;">
                    <label for="settingUseTimeMealDeduction" style="cursor: pointer; margin: 0; font-weight: bold;">출발/복귀 시각에 따른 식비 자동 삭감 적용 (12시 이후 출발 시 점심 감액, 18시 이전 복귀 시 저녁 감액)</label>
                </div>
            `;
            outTripContainer.appendChild(otDiv);
        }

        // 카카오 API 설정 렌더링
        const kakaoApiContainer = document.getElementById('kakaoApiSettings');
        if (kakaoApiContainer) {
            kakaoApiContainer.innerHTML = '';
            const kakaoSettings = (DB.settings && DB.settings.kakaoApi) ? DB.settings.kakaoApi : {
                restApiKey: '41360366fe8aa573b45f73c82e4aa34a', javascriptKey: '6e18fe849bf66bff676eb7d51cfebcb1', startAddress: ''
            };
            if (!kakaoSettings.restApiKey) kakaoSettings.restApiKey = '41360366fe8aa573b45f73c82e4aa34a';
            if (!kakaoSettings.javascriptKey) kakaoSettings.javascriptKey = '6e18fe849bf66bff676eb7d51cfebcb1';
            const publicApiKey = DB.settings && DB.settings.publicDataApiKey ? DB.settings.publicDataApiKey : '502703e3209d16cee77a91c35223e14190e22823704ead8ff756104506e6711e';
            const kakaoDiv = document.createElement('div');
            kakaoDiv.innerHTML = `
                <div class="setting-row" style="justify-content: flex-start; gap: 20px;"><label style="font-weight: bold; width: 150px;">카카오 REST API 키</label><input type="password" id="settingKakaoRestApiKey" value="${kakaoSettings.restApiKey}" placeholder="발급받은 REST API 키 입력" style="width: 300px;"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px; margin-top:10px;"><label style="font-weight: bold; width: 150px;">카카오 JS API 키<br><span style="font-size:0.8em; font-weight:normal;">(UI 없는 지도용)</span></label><input type="password" id="settingKakaoJsApiKey" value="${kakaoSettings.javascriptKey}" placeholder="발급받은 JavaScript 키 입력" style="width: 300px;"></div>
                <div class="setting-row" style="justify-content: flex-start; gap: 20px; margin-top:10px;"><label style="font-weight: bold; width: 150px;">공공데이터포털 API키<br><span style="font-size:0.8em; font-weight:normal;">(달력 공휴일 자동 업데이트)</span></label><input type="password" id="settingPublicDataApiKey" value="${publicApiKey}" placeholder="한국천문연구원 특일정보 일반 인증키(Encoding) 입력" style="width: 300px;"></div>
            `;
            kakaoApiContainer.appendChild(kakaoDiv);
        }
    }

    // 관리자 로그인 기능
    const btnAdminLogin = document.getElementById('btnAdminLogin');
    const btnAdminLogout = document.getElementById('btnAdminLogout');
    const adminSettingsSection = document.getElementById('adminSettingsSection');
    const adminLoginModal = document.getElementById('adminLoginModal');

    if (btnAdminLogin) {
        btnAdminLogin.addEventListener('click', () => {
            if (adminLoginModal) {
                adminLoginModal.style.display = 'flex';
                const idInput = document.getElementById('adminLoginId');
                const pwInput = document.getElementById('adminLoginPw');
                const errorEl = document.getElementById('adminLoginError');
                if (errorEl) errorEl.style.display = 'none';
                if (idInput) { idInput.value = ''; idInput.focus(); }
                if (pwInput) pwInput.value = '';
            } else {
                const id = prompt('관리자 아이디를 입력하세요:');
                if (id === 'admin') {
                    const pw = prompt('관리자 비밀번호를 입력하세요:');
                    if (pw === 'admin') {
                        adminSettingsSection.style.display = 'block';
                        btnAdminLogin.style.display = 'none';
                        btnAdminLogout.style.display = 'inline-block';
                    } else {
                        window.showCustomAlert('비밀번호가 틀렸습니다.');
                    }
                } else if (id !== null) {
                    window.showCustomAlert('아이디가 틀렸습니다.');
                }
            }
        });
    }

    const btnConfirmAdminLogin = document.getElementById('btnConfirmAdminLogin');
    if (btnConfirmAdminLogin) {
        btnConfirmAdminLogin.addEventListener('click', () => {
            const id = document.getElementById('adminLoginId').value;
            const pw = document.getElementById('adminLoginPw').value;
            const errorEl = document.getElementById('adminLoginError');
            
            if (errorEl) errorEl.style.display = 'none';

            if (id === 'admin' && pw === 'admin') {
                if (adminSettingsSection) adminSettingsSection.style.display = 'block';
                if (btnAdminLogin) btnAdminLogin.style.display = 'none';
                if (btnAdminLogout) btnAdminLogout.style.display = 'inline-block';
                if (adminLoginModal) adminLoginModal.style.display = 'none';
            } else {
                if (errorEl) errorEl.style.display = 'block';
                const pwInput = document.getElementById('adminLoginPw');
                if (pwInput) {
                    pwInput.value = '';
                    pwInput.focus();
                }
            }
        });
    }

    const btnCancelAdminLogin = document.getElementById('btnCancelAdminLogin');
    if (btnCancelAdminLogin) {
        btnCancelAdminLogin.addEventListener('click', () => {
            if (adminLoginModal) adminLoginModal.style.display = 'none';
        });
    }

    const adminLoginPw = document.getElementById('adminLoginPw');
    if (adminLoginPw) {
        adminLoginPw.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (btnConfirmAdminLogin) btnConfirmAdminLogin.click();
            }
        });
    }
    const adminLoginId = document.getElementById('adminLoginId');
    if (adminLoginId) {
        adminLoginId.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (adminLoginPw) adminLoginPw.focus();
            }
        });
    }

    if (btnAdminLogout) {
        btnAdminLogout.addEventListener('click', () => {
            if (adminSettingsSection) adminSettingsSection.style.display = 'none';
            if (btnAdminLogin) btnAdminLogin.style.display = 'inline-block';
            btnAdminLogout.style.display = 'none';
        });
    }

    // UI 토글 (최초 사용자 vs 기존 사용자)
    const modeSelect = document.getElementById('db-mode-select');
    const newSection = document.getElementById('db-new-section');
    const existingSection = document.getElementById('db-existing-section');
    const editorSection = document.getElementById('db-editor-section');
    const dbStatus = document.getElementById('dbStatus');

    function checkInitialSettings() {
        const hasDeptName = DB.settings.departmentName && DB.settings.departmentName.trim() !== '';
        const hasStartAddress = DB.settings.kakaoApi && DB.settings.kakaoApi.startAddress && DB.settings.kakaoApi.startAddress.trim() !== '';
        
        if (!hasDeptName || !hasStartAddress) {
            const settingsTab = document.querySelector('.tab-btn[data-target="tab-settings"]');
            if (settingsTab) settingsTab.click();
            
            const msg = '최초 사용자 안내:\n\n원활한 프로그램 사용을 위해 [환경 설정] 탭에서 \n"부서명", "기본주소(출장 시작점)"를 먼저 등록하고\n오른쪽의 [설정 저장]을 완료해주세요.';
            
            window.showCustomAlert(msg, () => {
                const deptInput = document.getElementById('settingDeptName');
                const addrInput = document.getElementById('settingStartAddress');
                if (deptInput && !hasDeptName) {
                    deptInput.focus();
                } else if (addrInput && !hasStartAddress) {
                    addrInput.focus();
                }
            });
            return false;
        }
        return true;
    }

    // 오프라인 앱 로그인 로직
    let APP_USERS = {
        'user01': '1234',
        'user02': 'abcd',
        'admin': 'admin1234'
    };

    if (window.electronAPI) {
        const storedUsers = window.electronAPI.getStoreValue('appUsers');
        if (storedUsers && typeof storedUsers === 'object') {
            APP_USERS = storedUsers;
        } else if (storedUsers && typeof storedUsers === 'string') {
            try { APP_USERS = JSON.parse(storedUsers); } catch(e) {}
        } else {
            window.electronAPI.setStoreValue('appUsers', APP_USERS);
        }
    }

    const appLoginModal = document.getElementById('appLoginModal');
    const btnAppLogin = document.getElementById('btnAppLogin');
    const appLoginId = document.getElementById('appLoginId');
    const appLoginPw = document.getElementById('appLoginPw');
    const appLoginError = document.getElementById('appLoginError');

    if (appLoginModal && btnAppLogin) {
        const processAppLogin = () => {
            const id = appLoginId.value.trim();
            const pw = appLoginPw.value.trim();
            
            if (appLoginError) appLoginError.style.display = 'none';

            if (APP_USERS[id] && APP_USERS[id] === pw) {
                appLoginModal.style.display = 'none';
                setTimeout(() => checkInitialSettings(), 400);
            } else {
                if (appLoginError) appLoginError.style.display = 'block';
                appLoginPw.value = '';
                appLoginPw.focus();
            }
        };

        btnAppLogin.addEventListener('click', processAppLogin);
        appLoginPw.addEventListener('keydown', (e) => { if (e.key === 'Enter') processAppLogin(); });
        appLoginId.addEventListener('keydown', (e) => { if (e.key === 'Enter') appLoginPw.focus(); });
    } else {
        setTimeout(() => checkInitialSettings(), 400);
    }

    // 카카오 API 기본주소 자동완성 및 검색
    const deptInputNode = document.getElementById('settingDeptName');
    const deptTypeInputNode = document.getElementById('settingDeptType');
    const addrInputNode = document.getElementById('settingStartAddress');
    const btnSearchAddress = document.getElementById('btnSearchAddress');

    async function updateMapPreview(address) {
        const mapContainer = document.getElementById('mapPreview');
        if (!mapContainer) return;
        if (address && address.trim() !== '') {
            const apiSettings = typeof DB !== 'undefined' && DB.settings && DB.settings.kakaoApi ? DB.settings.kakaoApi : {};
            const apiKey = apiSettings.restApiKey || '41360366fe8aa573b45f73c82e4aa34a';
            const jsKey = apiSettings.javascriptKey || '6e18fe849bf66bff676eb7d51cfebcb1';
            const cleanApiKey = apiKey.replace(/[^a-zA-Z0-9]/g, '');
            const cleanJsKey = jsKey.replace(/[^a-zA-Z0-9]/g, '');
            
            try {
                let url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
                
                let fetchKakao = async (u) => {
                    if (window.electronAPI && window.electronAPI.fetchApi) {
                        return await window.electronAPI.fetchApi(u, { headers: { 'Authorization': `KakaoAK ${cleanApiKey}` } });
                    } else {
                        let res = await fetch(u, { headers: { 'Authorization': `KakaoAK ${cleanApiKey}` } });
                        return { success: res.ok, data: await res.json() };
                    }
                };

                let res = await fetchKakao(url);
                let data = res.success ? res.data : {};
                
                let targetDoc = (data.documents && data.documents.length > 0) ? data.documents[0] : null;
                if (!targetDoc) {
                    url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`;
                    res = await fetchKakao(url);
                    data = res.success ? res.data : {};
                    if (data.documents && data.documents.length > 0) targetDoc = data.documents[0];
                }

                if (targetDoc) {
                    const placeName = targetDoc.place_name || targetDoc.road_address_name || targetDoc.address_name || address;
                    const safePlaceName = placeName.replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '');
                    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }</style>
    <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${cleanJsKey}"></script>
</head>
<body>
    <div id="map" style="width:100%;height:100%;"></div>
    <script>
        kakao.maps.load(function() {
            var loc = new kakao.maps.LatLng(${targetDoc.y}, ${targetDoc.x});
            var map = new kakao.maps.Map(document.getElementById('map'), { center: loc, level: 3 });
            var marker = new kakao.maps.Marker({ position: loc });
            marker.setMap(map);
            var infowindow = new kakao.maps.InfoWindow({ content: '<div style="padding:5px;font-size:12px;white-space:nowrap;color:black;">${safePlaceName}</div>' });
            infowindow.open(map, marker);
        });
    </script>
</body>
</html>`;
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = '0';
                    mapContainer.innerHTML = '';
                    mapContainer.appendChild(iframe);
                    iframe.contentWindow.document.open();
                    iframe.contentWindow.document.write(htmlContent);
                    iframe.contentWindow.document.close();
                    return;
                } else {
                    mapContainer.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#7f8c8d; font-size:13px; text-align:center;">검색된 위치를 찾을 수 없습니다.<br>검색어: ${address}</div>`;
                }
            } catch(e) { 
                console.error("Map preview error:", e); 
                mapContainer.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#e74c3c; font-size:13px; text-align:center;">지도 로딩 중 오류가 발생했습니다.</div>`;
            }
        } else {
            mapContainer.innerHTML = `<span style="color: #7f8c8d; font-size: 0.9em; text-align: center;">기본주소를 입력하면<br>지도가 표시됩니다.</span>`;
        }
    }

    if (addrInputNode) {
        addrInputNode.addEventListener('change', () => updateMapPreview(addrInputNode.value));
    }

    async function searchKakaoAddressText(query) {
        const apiSettings = DB.settings.kakaoApi;
        const apiKey = (apiSettings && apiSettings.restApiKey) ? apiSettings.restApiKey : '41360366fe8aa573b45f73c82e4aa34a';
        const cleanApiKey = apiKey.replace(/[^a-zA-Z0-9]/g, '');

        let fetchKakao = async (u) => {
            if (window.electronAPI && window.electronAPI.fetchApi) {
                return await window.electronAPI.fetchApi(u, { headers: { 'Authorization': `KakaoAK ${cleanApiKey}` } });
            } else {
                let res = await fetch(u, { headers: { 'Authorization': `KakaoAK ${cleanApiKey}` } });
                return { success: res.ok, data: await res.json() };
            }
        };

        let regionPrefix1 = '울산 남구';
        let regionPrefix2 = '울산';
        if (apiSettings && apiSettings.startAddress) {
            const addrParts = apiSettings.startAddress.split(' ');
            if (addrParts.length >= 2) {
                regionPrefix1 = `${addrParts[0]} ${addrParts[1]}`;
                regionPrefix2 = addrParts[0];
            }
        }
        
        const customAddressMap = window.CUSTOM_ADDRESS_MAP || {};
        for (const [dept, addr] of Object.entries(customAddressMap)) {
            if (query.includes(dept)) return addr;
        }
        
        const queriesToTry = [];
        if (!query.includes(regionPrefix2)) {
            queriesToTry.push(regionPrefix1 + ' ' + query);
            queriesToTry.push(regionPrefix2 + ' ' + query);
        }
        queriesToTry.push(query);

        for (const q of queriesToTry) {
            let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}`;
            let res = await fetchKakao(url);
            let data = res.success ? res.data : {};
            
            if (data.documents && data.documents.length > 0) {
                let doc = data.documents.find(d => (d.address_name && d.address_name.includes(regionPrefix1)) || (d.road_address_name && d.road_address_name.includes(regionPrefix1)))
                       || data.documents.find(d => (d.address_name && d.address_name.includes(regionPrefix2)) || (d.road_address_name && d.road_address_name.includes(regionPrefix2)))
                       || data.documents[0];
                return doc.road_address_name || doc.address_name || doc.place_name;
            }
            
            url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}`;
            res = await fetchKakao(url);
            data = res.success ? res.data : {};
            
            if (data.documents && data.documents.length > 0) {
                let doc = data.documents.find(d => (d.address_name && d.address_name.includes(regionPrefix1)) || (d.road_address_name && d.road_address_name.includes(regionPrefix1)))
                       || data.documents.find(d => (d.address_name && d.address_name.includes(regionPrefix2)) || (d.road_address_name && d.road_address_name.includes(regionPrefix2)))
                       || data.documents[0];
                return doc.road_address_name || doc.address_name;
            }
        }
        return null;
    }

    if (btnSearchAddress) {
        btnSearchAddress.addEventListener('click', async () => {
            let query = deptInputNode ? deptInputNode.value.trim() : '';
            
            if (!query) {
                window.showCustomAlert('검색할 부서명이나 장소명을 먼저 입력해주세요.');
                if (deptInputNode) deptInputNode.focus();
                return;
            }

            const deptType = deptTypeInputNode ? deptTypeInputNode.value : '';

            if (deptType === '동' && !query.includes('행정복지센터')) {
                query += ' 행정복지센터';
            } else if (deptType.includes('본청') || deptType.includes('실과')) {
                const customAddressMap = {
                    '공공시설과': '울산 남구 돋질로 239번길 8',
                    '보육지원과': '울산 남구 돋질로 239번길 8',
                    '소상공인진흥과': '울산 남구 삼산중로131번길 36',
                    '체육지원과': '울산 남구 삼산중로131번길 36'
                };
                let foundCustomAddr = null;
                for (const [dept, addr] of Object.entries(customAddressMap)) {
                    if (query.includes(dept)) {
                        foundCustomAddr = addr;
                        break;
                    }
                }
                const finalAddr = foundCustomAddr ? foundCustomAddr : '울산 남구 돋질로 233';
                if (addrInputNode) addrInputNode.value = finalAddr;
                updateMapPreview(finalAddr);
                return;
            }
            
            const originalText = btnSearchAddress.textContent;
            btnSearchAddress.textContent = '검색중...';
            try {
                const addr = await searchKakaoAddressText(query);
                if (addr) {
                    if (!addr.includes('울산')) {
                        const proceed = await window.showCustomConfirm(`검색된 주소가 울산지역이 아닙니다.\n\n[ ${addr} ]\n\n이 주소를 계속 사용하시겠습니까?`);
                        if (!proceed) return;
                    }
                    if (addrInputNode) addrInputNode.value = addr;
                    updateMapPreview(addr);
                } else {
                    window.showCustomAlert('검색 결과가 없습니다. 정확한 부서명이나 장소명으로 다시 시도해주세요.');
                }
            } catch (e) { 
                window.showCustomAlert('검색 중 오류가 발생했습니다.'); 
            } finally { 
                btnSearchAddress.textContent = originalText; 
            }
        });
    }

    const btnModeNew = document.getElementById('btnModeNew');
    if (btnModeNew) {
        btnModeNew.addEventListener('click', () => {
            if (!checkInitialSettings()) return;
            if (modeSelect) modeSelect.style.display = 'none';
            if (newSection) newSection.style.display = 'block';
        });
    }

    const btnModeExisting = document.getElementById('btnModeExisting');
    if (btnModeExisting) {
        btnModeExisting.addEventListener('click', () => {
            if (!checkInitialSettings()) return;
            if (modeSelect) modeSelect.style.display = 'none';
            if (existingSection) existingSection.style.display = 'block';
        });
    }

    const resetDbUI = () => {
        if (newSection) newSection.style.display = 'none';
        if (existingSection) existingSection.style.display = 'none';
        if (editorSection) editorSection.style.display = 'none';
        if (modeSelect) modeSelect.style.display = 'flex';
        if (dbStatus) dbStatus.textContent = '';
    };

    const btnBackFromNew = document.getElementById('btnBackFromNew');
    if (btnBackFromNew) btnBackFromNew.addEventListener('click', resetDbUI);
    
    const btnBackFromExisting = document.getElementById('btnBackFromExisting');
    if (btnBackFromExisting) btnBackFromExisting.addEventListener('click', resetDbUI);

    // 자동 저장된 명세서 존재 시 복원
    if (DB.rosterData && DB.rosterData.length > 0) {
        if (modeSelect) modeSelect.style.display = 'none';
        if (editorSection) editorSection.style.display = 'block';
        renderRosterEditor();
        if (window.Overtime) window.Overtime.initializeTable();
        if (window.Duty) window.Duty.renderEmployeeList();
        if (dbStatus) dbStatus.textContent = `자동 저장된 명세서를 불러왔습니다. (총 ${DB.employees.length}명)`;
    }

    // 명세서 초기화 버튼
    const btnResetRoster = document.getElementById('btnResetRoster');
    if (btnResetRoster) {
        btnResetRoster.addEventListener('click', async () => {
            const confirmed = await window.showCustomConfirm('현재 저장된 명세서를 화면에서 지우고 새로운 작업을 시작하시겠습니까?\n(다운로드하지 않은 수정사항은 사라집니다.)');
            if (confirmed) {
                DB.rosterData = [];
                DB.employees = [];
                if (window.electronAPI) {
                    window.electronAPI.deleteStoreValue('seomuRosterData');
                }
                
                if (editorSection) editorSection.style.display = 'none';
                if (modeSelect) modeSelect.style.display = 'flex';
                if (dbStatus) dbStatus.textContent = '명세서가 초기화되었습니다. 새로운 작업을 선택해주세요.';
                
                if (window.Overtime) window.Overtime.initializeTable();
                if (window.Duty) window.Duty.renderEmployeeList();
            }
        });
    }

    // 직원신상명세서 신규 생성
    const btnProcessExcel = document.getElementById('btnProcessExcel');
    if (btnProcessExcel) {
        btnProcessExcel.addEventListener('click', async () => {
            const fileInput = document.getElementById('dbFiles');
            const files = fileInput.files;
            const statusEl = document.getElementById('dbStatus');

            if (!files || files.length === 0) {
                window.showCustomAlert("엑셀 파일을 최소 1개 이상 업로드해주세요.");
                return;
            }

            try {
                if (statusEl) statusEl.textContent = "데이터 읽는 중...";
                
                let data1 = null;
                let data2 = [];

                for (let i = 0; i < files.length; i++) {
                    const data = await window.AppUtils.readExcel(files[i]);
                    const headerStr = data.slice(0, 5).flat().join('').replace(/\s+/g, '');
                    if (headerStr.includes('근무형태') || headerStr.includes('직급') || headerStr.includes('직책')) {
                        data1 = data;
                    } else if (headerStr.includes('금융기관') || headerStr.includes('계좌번호') || headerStr.includes('거래처')) {
                        data2 = data;
                    }
                }

                if (!data1) {
                    data1 = await window.AppUtils.readExcel(files[0]);
                    if (files.length > 1) {
                        data2 = await window.AppUtils.readExcel(files[1]);
                    }
                }
                
                const names = [];
                data1.forEach((row, i) => {
                    if (i > 0 && row[5]) names.push(String(row[5]).trim());
                });
                const uniqueNames = [...new Set(names)].sort();

                const roleMap = await new Promise((resolve) => {
                    const modal = document.getElementById('roleModal');
                    const nameRankMap = {};
                    data1.forEach((row, i) => {
                        if (i > 0 && row[5]) {
                            nameRankMap[String(row[5]).trim()] = String(row[4] || '').trim();
                        }
                    });
                    
                    const isRank56 = (rank) => rank.includes('5급') || rank.includes('6급');
                    const isRank6 = (rank) => rank.includes('6급');
                    const isOtherRank = (rank) => !rank.includes('5급') && !rank.includes('6급');
                    
                    const buildOptions = (filterFn, label) => {
                        let recommended = [];
                        let others = [];
                        uniqueNames.forEach(name => {
                            const rank = nameRankMap[name] || '';
                            if (filterFn(rank)) recommended.push({ name, rank });
                            else others.push({ name, rank });
                        });
                        
                        let html = '<option value="">선택 안함</option>';
                        if (recommended.length > 0) {
                            html += `<optgroup label="★ ${label} 추천">`;
                            recommended.forEach(e => { html += `<option value="${e.name}">${e.name} (${e.rank})</option>`; });
                            html += '</optgroup>';
                        }
                        if (others.length > 0) {
                            html += '<optgroup label="─ 기타 전체">';
                            others.forEach(e => { html += `<option value="${e.name}">${e.name} (${e.rank})</option>`; });
                            html += '</optgroup>';
                        }
                        return html;
                    };
                    
                    document.getElementById('selManager').innerHTML = buildOptions(isRank56, '5~6급');
                    document.getElementById('selTeamLeader').innerHTML = buildOptions(isRank6, '6급');
                    document.getElementById('selClerk').innerHTML = buildOptions(isOtherRank, '7급 이하');
                    
                    modal.style.display = 'flex';
                    document.getElementById('btnConfirmRoles').onclick = () => {
                        modal.style.display = 'none';
                        resolve({ 
                            manager: document.getElementById('selManager').value, 
                            teamLeader: document.getElementById('selTeamLeader').value, 
                            clerk: document.getElementById('selClerk').value 
                        });
                    };
                });

                DB.processExcelFiles(data1, data2 || [], roleMap);
                DB.sortEmployees();

                if (statusEl) statusEl.textContent = "명세서 생성이 완료되었습니다.";
                
                if (editorSection) editorSection.style.display = 'block';
                renderRosterEditor();
                
                if (window.Overtime) window.Overtime.initializeTable();
                if (window.Duty) window.Duty.renderEmployeeList();

            } catch (error) {
                console.error(error);
                if (statusEl) statusEl.textContent = `처리 중 오류가 발생했습니다: ${error.message}`;
            }
        });
    }

    // 기존 명세서 파일 불러오기
    const btnLoadRoster = document.getElementById('btnLoadRoster');
    if (btnLoadRoster) {
        btnLoadRoster.addEventListener('click', async () => {
            const rosterFile = document.getElementById('rosterFile').files[0];
            const statusEl = document.getElementById('dbStatus');

            if (!rosterFile) {
                window.showCustomAlert("불러올 직원신상명세서 파일을 선택해주세요.");
                return;
            }

            try {
                if (statusEl) statusEl.textContent = "기존 명세서 파일을 읽는 중...";
                const rosterData = await window.AppUtils.readExcel(rosterFile);
                
                DB.loadFromRoster(rosterData);
                DB.sortEmployees();

                if (statusEl) statusEl.textContent = `직원 목록 로딩 완료. (총 ${DB.employees.length}명)`;
                
                if (editorSection) editorSection.style.display = 'block';
                renderRosterEditor();

                if (window.Overtime) window.Overtime.initializeTable();
                if (window.Duty) window.Duty.renderEmployeeList();

            } catch (error) {
                console.error(error);
                if (statusEl) statusEl.textContent = `처리 중 오류가 발생했습니다: ${error.message}`;
            }
        });
    }

    // 명세서 에디터 렌더링
    function renderRosterEditor() {
        const container = document.getElementById('rosterEditorTable');
        if (!container) return;
        if (!DB.rosterData || DB.rosterData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <div class="empty-state-title">표시할 데이터가 없습니다</div>
                    <div class="empty-state-desc">상단의 <strong>'기존 명세서 불러오기'</strong> 또는 <strong>'새로운 명세서 생성'</strong>을 통해 데이터를 로드해주세요.</div>
                </div>
            `;
            return;
        }

        let html = '<table class="data-table"><thead><tr>';
        const headers = DB.rosterData[0];
        headers.forEach((h, j) => {
            const displayStyle = (j === 5 || j === 11) ? 'display: none;' : '';
            let headerContent = h || '';
            if (j >= 7 && j <= 10) {
                const tipMsg = (j === 7 || j === 8) ? "직원의 기본 수당 수령 계좌 정보입니다." : "비고란의 '출장' 체크 시, 별도 계좌를 요청하는 경우에<br>대상 직원에 대해 은행과 계좌를 입력해 주세요.";
                headerContent = `<span style="cursor: help; border-bottom: 1px dashed #7f8c8d; position: relative;" onmouseenter="this.querySelector('.cell-tooltip').style.display='block'" onmouseleave="this.querySelector('.cell-tooltip').style.display='none'">${headerContent}
                        <span class="cell-tooltip" style="display:none;">${tipMsg}</span>
                    </span>`;
            }
            html += `<th style="position: sticky; top: 0; z-index: 1; ${displayStyle}">${headerContent}</th>`;
        });
        html += '</tr></thead><tbody>';

        for (let i = 1; i < DB.rosterData.length; i++) {
            html += `<tr class="roster-row" data-row="${i}" style="cursor: pointer;">`;
            const row = DB.rosterData[i];
            for (let j = 0; j < headers.length; j++) {                
                let cellVal = (j === 11 && String(row[j] || '').trim() !== '') ? (parseInt(String(row[j]).replace(/,/g, '')) || 0).toLocaleString() : (row[j] || '');
                const displayStyle = (j === 5 || j === 11) ? 'display: none;' : '';
                
                if (j === 14) {
                    const promoMatch = String(cellVal).match(/승진\((.*?)\)/);
                    const promoDate = promoMatch ? promoMatch[1] : '';
                    const otherRemarks = String(cellVal).replace(/승진\([^)]*\),?/, '').trim();

                    html += `<td class="roster-cell" data-row="${i}" data-col="${j}" style="${displayStyle} text-align: center; min-width: 150px;">
                        <label class="remark-label" style="margin-right: 10px;">
                            <input type="checkbox" class="remark-chk" data-type="초과" ${otherRemarks.includes('초과')?'checked':''}> 
                            <span class="remark-text">초과</span>
                        </label>
                        <label class="remark-label">
                            <input type="checkbox" class="remark-chk" data-type="출장" ${otherRemarks.includes('출장')?'checked':''}> 
                            <span class="remark-text">출장</span>
                        </label>
                        ${promoDate ? `<div style="font-size:0.8em; color:#8e44ad; margin-top:4px; font-weight:bold;">[승진] ${promoDate}</div>` : ''}
                    </td>`;
                } else {
                    html += `<td contenteditable="${j !== 5 && j !== 11 && j !== 14}" class="roster-cell" data-row="${i}" data-col="${j}" style="${displayStyle} text-align: center;">${cellVal}</td>`;
                }
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // 에디터 직접 수정 디바운스 처리
    let rosterInputTimeout = null;
    const rosterEditorTable = document.getElementById('rosterEditorTable');
    if (rosterEditorTable) {
        rosterEditorTable.addEventListener('input', (e) => {
            if (e.target.tagName === 'TD' && e.target.isContentEditable) {
                const r = parseInt(e.target.dataset.row);
                const c = parseInt(e.target.dataset.col);
                DB.rosterData[r][c] = e.target.textContent;
                
                if (c === 4) {
                    DB.rosterData[r][5] = DB.generateOriginalRank(e.target.textContent);
                }

                clearTimeout(rosterInputTimeout);
                rosterInputTimeout = setTimeout(() => {
                    DB.loadFromRoster(DB.rosterData);
                    if (window.Overtime) window.Overtime.initializeTable();
                    if (window.Duty) window.Duty.renderEmployeeList();
                }, 400);
            }
        });

        // 행 선택 토글
        rosterEditorTable.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
            const tr = e.target.closest('.roster-row');
            if (tr) tr.classList.toggle('selected-row');
        });

        // 체크박스 변경
        rosterEditorTable.addEventListener('change', (e) => {
            if (e.target.classList.contains('remark-chk')) {
                const td = e.target.closest('td');
                const r = parseInt(td.dataset.row);
                const c = parseInt(td.dataset.col);

                const existingRemark = DB.rosterData[r][c] || '';
                const promoMatch = existingRemark.match(/승진\((.*?)\)/);
                const promoPart = promoMatch ? promoMatch[0] : '';
                
                const checkedBoxes = td.querySelectorAll('.remark-chk:checked');
                const types = Array.from(checkedBoxes).map(cb => cb.dataset.type);
                
                const newRemarkParts = [];
                if (promoPart) newRemarkParts.push(promoPart);
                newRemarkParts.push(...types);

                DB.rosterData[r][c] = newRemarkParts.join(', ');
                DB.loadFromRoster(DB.rosterData);
                renderRosterEditor();
            }
        });
    }

    // 선택항목 삭제
    const btnDeleteSelectedRoster = document.getElementById('btnDeleteSelectedRoster');
    if (btnDeleteSelectedRoster) {
        btnDeleteSelectedRoster.addEventListener('click', async () => {
            const selectedRows = document.querySelectorAll('.roster-row.selected-row');
            if (selectedRows.length === 0) {
                window.showCustomAlert('삭제할 항목을 선택해주세요.');
                return;
            }
            const confirmed = await window.showCustomConfirm(`선택한 ${selectedRows.length}명의 직원을 명세서에서 완전히 삭제하시겠습니까?`);
            if (confirmed) {
                const rowsToDelete = Array.from(selectedRows).map(tr => parseInt(tr.dataset.row)).sort((a, b) => b - a);
                rowsToDelete.forEach(r => {
                    DB.rosterData.splice(r, 1);
                });
                
                for (let i = 1; i < DB.rosterData.length; i++) {
                    DB.rosterData[i][0] = i;
                }
                DB.loadFromRoster(DB.rosterData);
                renderRosterEditor();
                if (window.Overtime) window.Overtime.initializeTable();
                if (window.Duty) window.Duty.renderEmployeeList();
            }
        });

        // 승진자 관리 버튼 동적 추가 (중복 방지)
        const buttonContainer = document.getElementById('rosterActionButtons');
        if (buttonContainer && !document.getElementById('btnManagePromotions')) {
            const btnManagePromotions = document.createElement('button');
            btnManagePromotions.id = 'btnManagePromotions';
            btnManagePromotions.className = 'primary-btn';
            btnManagePromotions.textContent = '🧑‍🎓 승진자 관리';
            btnManagePromotions.style.backgroundColor = 'var(--info-color)';
            buttonContainer.appendChild(btnManagePromotions);
            btnManagePromotions.addEventListener('click', () => openPromotionModal());
        }
    }

    // 엑셀 다운로드
    const btnDownloadRoster = document.getElementById('btnDownloadRoster');
    if (btnDownloadRoster) {
        btnDownloadRoster.addEventListener('click', () => {
            if (!DB.rosterData || DB.rosterData.length === 0) return;
            const deptName = DB.settings.departmentName || '부서미상';
            const newWb = XLSX.utils.book_new();
            const newWs = XLSX.utils.aoa_to_sheet(DB.rosterData);
            XLSX.utils.book_append_sheet(newWb, newWs, "직원신상명세서");
            
            window.showLoadingSpinner('직원신상명세서 엑셀 파일을 생성하는 중입니다...');
            requestAnimationFrame(() => {
                setTimeout(() => {
                    try {
                        const now = new Date();
                        const datePrefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + " ";
                        XLSX.writeFile(newWb, `${datePrefix}직원신상명세서(${deptName}).xlsx`);
                        window.hideLoadingSpinner();
                        window.showCustomAlert("직원신상명세서 다운로드가 완료되었습니다.");
                    } catch (error) {
                        window.hideLoadingSpinner();
                        window.showCustomAlert(`다운로드 중 오류가 발생했습니다: ${error.message}`);
                    }
                }, 100);
            });
        });
    }

    // 승진자 관리 모달 함수
    function openPromotionModal() {
        let modal = document.getElementById('promotionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'promotionModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content card" style="width: 600px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin-top:0;">승진자 관리</h3>
                        <button id="btnClosePromoModal" class="btn-close-modal" style="background:none; border:none; font-size: 1.5rem; cursor:pointer;">&times;</button>
                    </div>
                    <p class="hint" style="margin-top:0;">승진 발령일을 설정/해제합니다. 이 정보는 초과근무 정액분 일할 계산에 사용됩니다.</p>
                    <div id="promoEmployeeList" style="max-height: 50vh; overflow-y: auto; border: 1px solid #ddd; padding: 10px;"></div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('btnClosePromoModal').addEventListener('click', () => modal.style.display = 'none');
        }
        renderPromotionList();
        modal.style.display = 'flex';
    }

    function renderPromotionList() {
        const container = document.getElementById('promoEmployeeList');
        if (!container) return;

        const employees = DB.employees || [];
        if (employees.length === 0) {
            container.innerHTML = '<p>직원 명단이 없습니다.</p>';
            return;
        }

        let html = '<table class="data-table" style="width:100%;"><thead><tr><th>성명</th><th>계급</th><th>승진 정보</th><th>관리</th></tr></thead><tbody>';
        employees.forEach((emp, index) => {
            const promoMatch = (emp.remarks || '').match(/승진\((.*?)\)/);
            const promoDate = promoMatch ? promoMatch[1] : '-';
            html += `
                <tr>
                    <td>${emp.name}</td>
                    <td>${emp.rank}</td>
                    <td>${promoDate}</td>
                    <td>
                        <button class="btn-set-promo" data-emp-index="${index}" style="padding: 2px 6px; font-size: 0.8em;">설정/변경</button>
                        <button class="btn-clear-promo" data-emp-index="${index}" style="padding: 2px 6px; font-size: 0.8em; background-color: var(--btn-cancel-bg); color: white; border: none; border-radius: 3px;">해제</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        container.querySelectorAll('.btn-set-promo').forEach(btn => btn.addEventListener('click', handleSetPromotion));
        container.querySelectorAll('.btn-clear-promo').forEach(btn => btn.addEventListener('click', handleClearPromotion));
    }

    async function handleSetPromotion(e) {
        const empIndex = parseInt(e.target.dataset.empIndex);
        const employee = DB.employees[empIndex];
        if (!employee) return;

        let dateStr = await window.showCustomPrompt(`[${employee.name}] 직원의 승진 발령일자를 입력하세요 (예: 2024-10-15)`);
        if (dateStr !== null) {
            dateStr = dateStr.trim();
            let parsedDate = null;
            
            if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(dateStr)) {
                parsedDate = new Date(dateStr.replace(/[-./]/g, '-'));
            } else {
                const numStr = dateStr.replace(/[^0-9]/g, '');
                if (numStr.length === 8) {
                    parsedDate = new Date(`${numStr.substring(0, 4)}-${numStr.substring(4, 6)}-${numStr.substring(6, 8)}`);
                } else if (numStr.length === 6) {
                    const yearPrefix = parseInt(numStr.substring(0, 2)) > 50 ? '19' : '20';
                    parsedDate = new Date(`${yearPrefix}${numStr.substring(0, 2)}-${numStr.substring(2, 4)}-${numStr.substring(4, 6)}`);
                }
            }

            if (parsedDate && !isNaN(parsedDate.getTime())) {
                const formattedDate = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth()+1).padStart(2,'0')}-${String(parsedDate.getDate()).padStart(2,'0')}`;
                updatePromotionInfo(employee.name, formattedDate);
            } else {
                window.showCustomAlert('올바른 날짜 형식이 아니어 취소되었습니다.');
            }
        }
    }

    function handleClearPromotion(e) {
        const empIndex = parseInt(e.target.dataset.empIndex);
        const employee = DB.employees[empIndex];
        if (!employee) return;
        updatePromotionInfo(employee.name, null);
    }

    function updatePromotionInfo(employeeName, promoDate) {
        const rosterRowIndex = DB.rosterData.findIndex(row => row[2] === employeeName);
        if (rosterRowIndex > -1) {
            let remarks = DB.rosterData[rosterRowIndex][14] || '';
            remarks = remarks.replace(/승진\([^)]*\),?/, '').trim().replace(/^,|,$/g, '').trim();
            if (promoDate) {
                const newPromo = `승진(${promoDate})`;
                remarks = remarks ? `${newPromo}, ${remarks}` : newPromo;
            }
            DB.rosterData[rosterRowIndex][14] = remarks;
            DB.loadFromRoster(DB.rosterData);
            renderPromotionList();
            renderRosterEditor();
        }
    }

    // 당직관리 탭 활성화 토글
    function updateDutyTabVisibility() {
        const isDong = DB.settings.departmentType === '동';
        const btn = document.getElementById('tabBtnDuty');
        if (btn) {
            btn.style.display = isDong ? 'flex' : 'none';
        }
        const dutyText = document.getElementById('dutyOrderRequiredText');
        if (dutyText) {
            dutyText.style.display = isDong ? 'inline' : 'none';
        }
    }
    updateDutyTabVisibility();
});