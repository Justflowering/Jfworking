window.Duty = {
    allowanceRecords: [], // 인쇄용 데이터 보존 배열
    currentPrintMode: 'payment', // 인쇄 모드 (history / payment)
    weekdayOrder: [], // 평일 당직 순서
    weekendOrder: [], // 주말 당직 순서
    draggedOrderType: null, // 드래그 중인 순서 목록 타입
    draggedOrderIndex: null, // 드래그 중인 항목 인덱스

    // 공휴일 데이터 캐시 (2024~2025년 하드코딩 기본값 제공, 이후 API 호출로 채움)
    holidaysCache: new Map([
        ['2024-01-01', '1월1일'], ['2024-02-09', '설날연휴'], ['2024-02-10', '설날'], ['2024-02-11', '설날연휴'], ['2024-02-12', '대체공휴일'], ['2024-03-01', '삼일절'], ['2024-04-10', '국회의원선거'], ['2024-05-05', '어린이날'], ['2024-05-06', '대체공휴일'], ['2024-05-15', '부처님오신날'], ['2024-06-06', '현충일'], ['2024-08-15', '광복절'], ['2024-09-16', '추석연휴'], ['2024-09-17', '추석'], ['2024-09-18', '추석연휴'], ['2024-10-01', '국군의날'], ['2024-10-03', '개천절'], ['2024-10-09', '한글날'], ['2024-12-25', '기독탄신일'],
        ['2025-01-01', '1월1일'], ['2025-01-28', '설날연휴'], ['2025-01-29', '설날'], ['2025-01-30', '설날연휴'], ['2025-03-01', '삼일절'], ['2025-03-03', '대체공휴일'], ['2025-05-05', '어린이날'], ['2025-05-06', '대체공휴일'], ['2025-06-06', '현충일'], ['2025-08-15', '광복절'], ['2025-10-03', '개천절'], ['2025-10-05', '추석연휴'], ['2025-10-06', '추석'], ['2025-10-07', '추석연휴'], ['2025-10-08', '대체공휴일'], ['2025-10-09', '한글날'], ['2025-12-25', '기독탄신일']
    ]),
    fetchedYears: new Set([2024, 2025]), // 이미 가져온 연도

    // 공공데이터포털 특일정보 API 호출
    async fetchHolidays(year) {
        if (this.fetchedYears.has(year)) return;
        const apiKey = typeof DB !== 'undefined' && DB.settings && DB.settings.publicDataApiKey ? DB.settings.publicDataApiKey : '502703e3209d16cee77a91c35223e14190e22823704ead8ff756104506e6711e';
        if (!apiKey) {
            this.fetchedYears.add(year); // 키 없으면 Fallback 유지
            return; 
        }

        try {
            // 공공데이터포털은 SSL 인증서 오류 방지를 위해 http 통신 사용
            const targetUrl = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&ServiceKey=${apiKey}&_type=json&numOfRows=100`;
            
            const response = await window.electronAPI.fetchApi(targetUrl, { timeout: 10000 });
            if (!response.success) throw new Error(response.error);
            
            const data = response.data;
            const items = data?.response?.body?.items?.item;
            
            if (items) {
                const itemArray = Array.isArray(items) ? items : [items];
                itemArray.forEach(item => {
                    const locdate = String(item.locdate); // YYYYMMDD
                    if (locdate.length === 8) {
                        const dateStr = `${locdate.substring(0,4)}-${locdate.substring(4,6)}-${locdate.substring(6,8)}`;
                        this.holidaysCache.set(dateStr, item.dateName || '공휴일');
                    }
                });
            }
            // 성공 시에만 연도 캐시에 등록하여 다음에 재시도할 수 있도록 함
            this.fetchedYears.add(year);
        } catch (error) {
            console.error(`[공휴일 API 오류 - ${year}년]`, error);
        }
    },

    isHoliday(dateObj) {
        if (!(dateObj instanceof Date)) return false;
        const day = dateObj.getDay();
        if (day === 0 || day === 6) return true; // 일요일(0), 토요일(6)
        const ds = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        return this.holidaysCache.has(ds);
    },

    getHolidayName(dateObj) {
        if (!(dateObj instanceof Date)) return '';
        const ds = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        const name = this.holidaysCache.get(ds) || '';
        return name.replace(/\(.*?\)/g, '').trim(); // 괄호와 내부 텍스트 제거하여 가독성 개선
    },

    init() {
        // 하위 탭 전환 이벤트
        document.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sub-tab-btn').forEach(b => {
                    b.style.backgroundColor = 'var(--bg-light)';
                    b.style.color = 'var(--text-main)';
                });
                e.target.style.backgroundColor = 'var(--primary-color)';
                e.target.style.color = 'white';

                document.querySelectorAll('.sub-tab-content').forEach(c => c.style.display = 'none');
                document.getElementById(e.target.dataset.target).style.display = 'block';

                if (e.target.dataset.target === 'duty-order') {
                    this.renderEmployeeList();
                }
            });
        });

        // 이벤트 리스너 바인딩
        const btnGen = document.getElementById('btnGenerateDutyCal');
        if (btnGen) btnGen.addEventListener('click', () => this.generateCalendar());

        const btnExportList = document.getElementById('btnExportDutyListExcel');
        if (btnExportList) btnExportList.addEventListener('click', () => this.exportListExcel());

        const btnExportCal = document.getElementById('btnExportDutyCalExcel');
        if (btnExportCal) btnExportCal.addEventListener('click', () => this.exportCalendarExcel());

        const btnProcess = document.getElementById('btnProcessDutyAllowance');
        if (btnProcess) btnProcess.addEventListener('click', () => this.processAllowanceFile());

        const btnResetOrder = document.getElementById('btnResetDutyOrder');
        if (btnResetOrder) btnResetOrder.addEventListener('click', async () => await this.resetDutyOrder());

        const btnSaveOrder = document.getElementById('btnSaveDutyOrder');
        if (btnSaveOrder) btnSaveOrder.addEventListener('click', async () => await this.saveDutyOrder());

        const btnAutoAssign = document.getElementById('btnAutoAssignDuty');
        if (btnAutoAssign) btnAutoAssign.addEventListener('click', () => this.openAutoAssignModal());

        const btnConfirmAutoAssign = document.getElementById('btnConfirmAutoAssign');
        if (btnConfirmAutoAssign) btnConfirmAutoAssign.addEventListener('click', () => this.executeAutoAssign());

        const btnCancelAutoAssign = document.getElementById('btnCancelAutoAssign');
        if (btnCancelAutoAssign) btnCancelAutoAssign.addEventListener('click', () => document.getElementById('dutyAutoAssignModal').style.display = 'none');

        // 예외 기간 모달 바인딩
        const btnManageExclusions = document.getElementById('btnManageExclusions');
        if (btnManageExclusions) {
            btnManageExclusions.addEventListener('click', () => {
                this.renderExclusions();
                document.getElementById('dutyExclusionModal').style.display = 'flex';
            });
        }
        const btnCloseExclusionModal = document.getElementById('btnCloseExclusionModal');
        if (btnCloseExclusionModal) btnCloseExclusionModal.addEventListener('click', () => document.getElementById('dutyExclusionModal').style.display = 'none');
        
        const btnAddExclusion = document.getElementById('btnAddExclusion');
        if (btnAddExclusion) {
            btnAddExclusion.addEventListener('click', async () => {
                const name = document.getElementById('excEmployee').value;
                const start = document.getElementById('excStartDate').value;
                const end = document.getElementById('excEndDate').value;
                const type = document.getElementById('excType').value;
                if (!name || !start || !end) return window.showCustomAlert('모든 값을 입력해주세요.');
                if (start > end) return window.showCustomAlert('종료일이 시작일보다 빠를 수 없습니다.');
                if (!DB.settings.dutyExclusions) DB.settings.dutyExclusions = [];
                DB.settings.dutyExclusions.push({ name, startDate: start, endDate: end, type: type, id: Date.now() });
                DB.saveSettings({});
                this.renderExclusions();
            });
        }

        // 인쇄 버튼 모달 바인딩
        const btnPrintDutyHistory = document.getElementById('btnPrintDutyHistory');
        if (btnPrintDutyHistory) {
            btnPrintDutyHistory.addEventListener('click', () => {
                if (!this.allowanceRecords || this.allowanceRecords.length === 0) {
                    window.showCustomAlert('먼저 당직 엑셀 파일을 업로드하여 내역서를 생성해주세요.');
                    return;
                }
                this.currentPrintMode = 'history';
                document.getElementById('printDutyModal').querySelector('h3').textContent = '당직내역서 인쇄 설정';
                document.getElementById('printDutyModal').style.display = 'flex';
                const now = new Date();
                document.getElementById('printDutyMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                document.getElementById('printDutyDate').value = now.toISOString().split('T')[0];
            });
        }

        const btnPrintDuty = document.getElementById('btnPrintDutyAllowance');
        if (btnPrintDuty) {
            btnPrintDuty.addEventListener('click', () => {
                if (!this.allowanceRecords || this.allowanceRecords.length === 0) {
                    window.showCustomAlert('먼저 당직 엑셀 파일을 업로드하여 내역서를 생성해주세요.');
                    return;
                }
                this.currentPrintMode = 'payment';
                document.getElementById('printDutyModal').querySelector('h3').textContent = '당직수당 지급내역서 인쇄 설정';
                document.getElementById('printDutyModal').style.display = 'flex';
                const now = new Date();
                document.getElementById('printDutyMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                document.getElementById('printDutyDate').value = now.toISOString().split('T')[0];
            });
        }

        const btnCancelPrintDuty = document.getElementById('btnCancelPrintDuty');
        if (btnCancelPrintDuty) btnCancelPrintDuty.addEventListener('click', () => document.getElementById('printDutyModal').style.display = 'none');
        const btnConfirmPrintDuty = document.getElementById('btnConfirmPrintDuty');
        if (btnConfirmPrintDuty) btnConfirmPrintDuty.addEventListener('click', () => this.currentPrintMode === 'history' ? this.printHistory() : this.printAllowance());

        // 파일명 표시 설정
        if (window.AppUtils) window.AppUtils.setupFileNameDisplay('dutyAllowanceFile', 'dutyAllowanceFileName');

        // 초기 월 세팅
        const dm = document.getElementById('dutyMonth');
        if (dm) {
            const now = new Date();
            dm.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        // 달력 변경(타이핑) 실시간 감지
        const calContainer = document.getElementById('dutyCalendarContainer');
        if (calContainer) {
            calContainer.addEventListener('input', () => this.updateCalendarSummary());
        }

        // 편의 기능 버튼들
        const btnAutoLoad = document.getElementById('btnAutoLoadEmployees');
        if (btnAutoLoad) btnAutoLoad.addEventListener('click', () => {
            if (!DB.employees || DB.employees.length === 0) return window.showCustomAlert('직원신상명세서가 없습니다.');
            const mode = document.querySelector('input[name="dutyOrderMode"]:checked').value;
            if (mode === 'weekday') this.weekdayOrder = DB.employees.map(e => e.name);
            else this.weekendOrder = DB.employees.map(e => e.name);
            this.renderDutyOrderLists();
            this._autoSaveDutyOrder();
        });

        const btnCopyWeekdayToWeekend = document.getElementById('btnCopyWeekdayToWeekend');
        if (btnCopyWeekdayToWeekend) btnCopyWeekdayToWeekend.addEventListener('click', () => {
            this.weekendOrder = [...this.weekdayOrder];
            this.renderDutyOrderLists();
            this._autoSaveDutyOrder();
        });

        // 수동 직원 추가 기능 버튼
        const btnAddManual = document.getElementById('btnAddManualEmployee');
        if (btnAddManual) btnAddManual.addEventListener('click', () => {
            const manualNameInput = document.getElementById('manualAddEmployeeName');
            const name = manualNameInput.value.trim();
            if (!name) return window.showCustomAlert('추가할 직원 이름을 입력해주세요.');

            const mode = document.querySelector('input[name="dutyOrderMode"]:checked').value;
            if (mode === 'weekday') {
                if (!this.weekdayOrder.includes(name)) this.weekdayOrder.push(name);
                else return window.showCustomAlert('이미 평일 순서에 추가된 직원입니다.');
            } else {
                if (!this.weekendOrder.includes(name)) this.weekendOrder.push(name);
                else return window.showCustomAlert('이미 주말 순서에 추가된 직원입니다.');
            }
            manualNameInput.value = ''; // 입력 필드 초기화
            this.renderDutyOrderLists();
            this._autoSaveDutyOrder();
        });

        // 초기 로드 시 당직 순서 목록 렌더링
        this.renderEmployeeList();
    },

    toggleOperationMode(mode, fromUser = false) {
        const isCombined = mode === 'combined';
        const orderModeContainer = document.getElementById('dutyOrderModeContainer');
        const weekendOrderContainer = document.getElementById('containerWeekendOrder');
        const labelWeekday = document.getElementById('labelWeekdayOrder');
        
        if (orderModeContainer) orderModeContainer.style.display = isCombined ? 'none' : 'block';
        if (weekendOrderContainer) weekendOrderContainer.style.display = isCombined ? 'none' : 'flex';
        
        if (labelWeekday) labelWeekday.innerText = isCombined ? '[통합] 순서' : '[평일] 순서';
        
        if (isCombined) {
            const wRadio = document.querySelector('input[name="dutyOrderMode"][value="weekday"]');
            if (wRadio) wRadio.checked = true;
        }

        if (fromUser) {
            this._autoSaveDutyOrder();
        }
    },

    renderExclusions() {
        const tbody = document.getElementById('dutyExclusionList');
        if (!tbody) return;
        const exclusions = DB.settings.dutyExclusions || [];
        if (exclusions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">등록된 예외 기간이 없습니다.</td></tr>';
        } else {
            tbody.innerHTML = exclusions.map(ex => {
                const typeStr = ex.type === 'skip' ? '순번 건너뛰기' : '대기열 우선';
                return `<tr><td>${ex.name}</td><td>${ex.startDate}</td><td>${ex.endDate}</td><td>${typeStr}</td><td><button onclick="window.Duty.removeExclusion(${ex.id})" class="danger-btn" style="padding:2px 8px; font-size:0.8em; border-radius:3px; cursor:pointer;">삭제</button></td></tr>`;
            }).join('');
        }

        // excEmployee 드롭다운 목록 채우기
        const excSelect = document.getElementById('excEmployee');
        if (excSelect) {
            let excOptions = '<option value="">선택</option>'; // 기본 "선택" 옵션 추가
            DB.employees.forEach(emp => { excOptions += `<option value="${emp.name}">${emp.name}</option>`; });
            excSelect.innerHTML = excOptions;
        }
    },

    removeExclusion(id) {
        if (!DB.settings.dutyExclusions) return;
        DB.settings.dutyExclusions = DB.settings.dutyExclusions.filter(ex => ex.id !== id);
        DB.saveSettings({});
        this.renderExclusions();
    },

    // 왼쪽 사이드바에 드래그할 수 있는 직원 명단 렌더링
    renderEmployeeList() {
        const container = document.getElementById('dutyEmployeeList');
        if (!container) return;
        container.innerHTML = '';

        if (!DB.employees || DB.employees.length === 0) {
            container.innerHTML = '<p class="hint">직원신상명세서를 먼저 생성해주세요.</p>';
            return;
        }

        // 설정 로드
        if (DB.settings && DB.settings.dutyOrder) {
            this.weekdayOrder = [...(DB.settings.dutyOrder.weekday || [])];
            this.weekendOrder = [...(DB.settings.dutyOrder.weekend || [])];
        }

        const modeSelect = document.getElementById('dutyOperationMode');
        if (modeSelect) {
            if (DB.settings && DB.settings.dutyOrder && DB.settings.dutyOrder.mode) {
                modeSelect.value = DB.settings.dutyOrder.mode;
            }
            this.toggleOperationMode(modeSelect.value, false); // 초기 로드 시에는 저장 안함
            if (!modeSelect.dataset.listenerAdded) {
                modeSelect.addEventListener('change', (e) => this.toggleOperationMode(e.target.value, true)); // 사용자 변경 시에만 저장
                modeSelect.dataset.listenerAdded = 'true';
            }
        }        

        const frag = document.createDocumentFragment();
        DB.employees.forEach(emp => {
            const div = document.createElement('div');
            div.textContent = emp.name;
            div.style.padding = '3px 8px';
            div.style.backgroundColor = 'var(--text-dark)';
            div.style.color = 'white';
            div.style.borderRadius = '3px';
            div.style.cursor = 'pointer';
            div.draggable = true;
            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', emp.name);
            });
            div.addEventListener('click', () => {
                const mode = document.querySelector('input[name="dutyOrderMode"]:checked').value;
                if (mode === 'weekday') this.weekdayOrder.push(emp.name);
                else this.weekendOrder.push(emp.name);
                this.renderDutyOrderLists();
                this._autoSaveDutyOrder();
            });
            frag.appendChild(div);
        });
        container.appendChild(frag);

        this.renderDutyOrderLists();
        this.toggleOperationMode(document.getElementById('dutyOperationMode').value, false); // 초기 로드 시 모드 설정
    },

    renderDutyOrderLists() {
        const wContainer = document.getElementById('dutyWeekdayList');
        const eContainer = document.getElementById('dutyWeekendList');
        if(!wContainer || !eContainer) return;

        const makeHtml = (arr, type) => {
            return arr.map((name, i) => `
                <div draggable="true"
                     ondragstart="window.Duty.handleDragStart(event, '${type}', ${i}, '${name}')"
                     ondragover="window.Duty.handleDragOver(event)"
                     ondragleave="window.Duty.handleDragLeave(event)"
                     ondrop="window.Duty.handleDrop(event, '${type}', ${i})"
                     ondragend="window.Duty.handleDragEnd(event)"
                     style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-light); padding:6px 10px; border-radius:4px; font-size:1.0em; cursor:grab; border-top: 2px solid transparent; transition: border 0.1s;">
                    <span><span style="cursor:grab; color:var(--text-muted); margin-right:4px;" title="드래그하여 순서 변경">☰</span> <b>${i+1}.</b> ${name}</span>
                    <span style="color:var(--danger-color); cursor:pointer; font-weight:bold; padding: 0 5px;" onclick="window.Duty.removeDutyOrder('${type}', ${i})" title="삭제">X</span>
                </div>
            `).join('');
        };

        wContainer.innerHTML = makeHtml(this.weekdayOrder, 'weekday');
        eContainer.innerHTML = makeHtml(this.weekendOrder, 'weekend');
    },

    handleDragStart(e, type, index, name) {
        this.draggedOrderType = type;
        this.draggedOrderIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', name); // 달력으로 직접 드래그&드롭 가능하도록 이름 정보 전달
        setTimeout(() => { e.target.style.opacity = '0.5'; }, 0);
    },
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.style.borderTop = '2px solid var(--primary-dark)'; // 드롭될 위치 표시
    },
    handleDragLeave(e) {
        e.currentTarget.style.borderTop = '2px solid transparent';
    },
    handleDrop(e, targetType, targetIndex) {
        e.preventDefault();
        e.currentTarget.style.borderTop = '2px solid transparent';
        const sourceType = this.draggedOrderType;
        const sourceIndex = this.draggedOrderIndex;
        
        if (sourceType === null || sourceIndex === null || sourceType !== targetType || sourceIndex === targetIndex) return;
        
        const arr = targetType === 'weekday' ? this.weekdayOrder : this.weekendOrder;
        const [movedItem] = arr.splice(sourceIndex, 1);
        arr.splice(targetIndex, 0, movedItem);
        
        this.draggedOrderType = null;
        this.draggedOrderIndex = null;
        this.renderDutyOrderLists();
        this._autoSaveDutyOrder();
    },
    handleDragEnd(e) {
        e.target.style.opacity = '1';
        this.draggedOrderType = null;
        this.draggedOrderIndex = null;
    },

    removeDutyOrder(type, index) {
        if(type === 'weekday') this.weekdayOrder.splice(index, 1);
        else this.weekendOrder.splice(index, 1);
        this.renderDutyOrderLists();
        this._autoSaveDutyOrder();
    },

    // 당직 순서 자동 저장을 위한 내부 함수 (알림 없음)
    _autoSaveDutyOrder() {
        const mode = document.getElementById('dutyOperationMode')?.value || 'separate';
        
        const newDutyOrder = {
            ...DB.settings.dutyOrder,
            mode: mode,
            weekday: [...this.weekdayOrder],
            weekend: [...this.weekendOrder]
        };
        DB.saveSettings({ dutyOrder: newDutyOrder }); // 명시적 병합 저장 트리거
    },

    async saveDutyOrder() {
        this._autoSaveDutyOrder();
        await window.showCustomAlert('당직 순서 및 운영 방식이 저장되었습니다.');
    },

    async resetDutyOrder() {
        if(await window.showCustomConfirm('지정된 평일 및 주말 순서를 모두 초기화하시겠습니까?')) {
            this.weekdayOrder = [];
            this.weekendOrder = [];
            this.renderDutyOrderLists();
            this._autoSaveDutyOrder();
        }
    },

    openAutoAssignModal() {
        const cells = document.querySelectorAll('.duty-cell');
        if (cells.length === 0) return window.showCustomAlert('먼저 당직 달력을 생성해주세요.');
        
        const mode = document.getElementById('dutyOperationMode').value;
        const isCombined = mode === 'combined';
        if (this.weekdayOrder.length === 0 || (!isCombined && this.weekendOrder.length === 0)) {
            return window.showCustomAlert('당직 순서를 1명 이상 지정해주세요.');
        }

        const prevWSelect = document.getElementById('autoAssignPrevWeekday');
        const prevESelect = document.getElementById('autoAssignPrevWeekend');
        const eGroup = document.getElementById('autoAssignPrevWeekendGroup');
        const labelW = document.getElementById('autoAssignLabelWeekday');

        let wOptions = '<option value="">선택안함 (처음부터)</option>';
        this.weekdayOrder.forEach(name => { wOptions += `<option value="${name}">${name}</option>`; });
        if (prevWSelect) prevWSelect.innerHTML = wOptions;

        let eOptions = '<option value="">선택안함 (처음부터)</option>';
        this.weekendOrder.forEach(name => { eOptions += `<option value="${name}">${name}</option>`; });
        if (prevESelect) prevESelect.innerHTML = eOptions;

        if (DB.settings && DB.settings.dutyOrder) {
            if (prevWSelect) prevWSelect.value = DB.settings.dutyOrder.prevWeekday || '';
            if (prevESelect) prevESelect.value = DB.settings.dutyOrder.prevWeekend || '';
        }

        if (isCombined) {
            if(eGroup) eGroup.style.display = 'none';
            if(labelW) labelW.textContent = '전월 마지막 당직자 (통합)';
        } else {
            if(eGroup) eGroup.style.display = 'block';
            if(labelW) labelW.textContent = '전월 평일 마지막 당직자';
        }

        document.getElementById('dutyAutoAssignModal').style.display = 'flex';
    },

    executeAutoAssign() {
        document.getElementById('dutyAutoAssignModal').style.display = 'none';

        const cells = document.querySelectorAll('.duty-cell');
        const mode = document.getElementById('dutyOperationMode').value;
        const isCombined = mode === 'combined';

        const prevW = document.getElementById('autoAssignPrevWeekday').value;
        const prevE = document.getElementById('autoAssignPrevWeekend').value;

        if (!DB.settings.dutyOrder) DB.settings.dutyOrder = {};
        DB.settings.dutyOrder.prevWeekday = prevW;
        DB.settings.dutyOrder.prevWeekend = prevE;
        DB.saveSettings({});

        let wIdx = 0, eIdx = 0;
        const wIndexInList = this.weekdayOrder.indexOf(prevW);
        if(wIndexInList >= 0) wIdx = (wIndexInList + 1) % this.weekdayOrder.length;

        if (!isCombined) {
            const eIndexInList = this.weekendOrder.indexOf(prevE);
            if(eIndexInList >= 0) eIdx = (eIndexInList + 1) % this.weekendOrder.length;
        }

        // 예외(제외) 로직 처리를 위한 함수와 대기열(Waiting Queue)
        const exclusions = (DB.settings && DB.settings.dutyExclusions) ? DB.settings.dutyExclusions : [];
        const getExclusionInfo = (name, dateStr) => exclusions.find(ex => ex.name === name && dateStr >= ex.startDate && dateStr <= ex.endDate);

        let skippedW = [], skippedE = [];

        const getNextW = (dateStr) => {
            // 1. 대기열(skipped)에 복귀한 사람이 있는지 최우선 확인
            for (let i = 0; i < skippedW.length; i++) {
                if (!getExclusionInfo(skippedW[i], dateStr)) return skippedW.splice(i, 1)[0];
            }
            // 2. 대기 인원이 없으면 메인 순번 진행
            let count = 0;
            while (count < this.weekdayOrder.length) {
                const name = this.weekdayOrder[wIdx];
                wIdx = (wIdx + 1) % this.weekdayOrder.length;
                
                const exInfo = getExclusionInfo(name, dateStr);
                if (exInfo) { 
                    if (exInfo.type === 'skip') {
                        // 건너뛰기: 아무것도 안 하고 다음 사람으로 루프 진행
                    } else {
                        // 대기열 우선 (queue): 큐에 넣음
                        if (!skippedW.includes(name)) skippedW.push(name); 
                    }
                }
                else return name;
                count++;
            }
            return "배정불가";
        };

        const getNextE = (dateStr) => {
            if (isCombined) return getNextW(dateStr);
            for (let i = 0; i < skippedE.length; i++) {
                if (!getExclusionInfo(skippedE[i], dateStr)) return skippedE.splice(i, 1)[0];
            }
            let count = 0;
            while (count < this.weekendOrder.length) {
                const name = this.weekendOrder[eIdx];
                eIdx = (eIdx + 1) % this.weekendOrder.length;
                
                const exInfo = getExclusionInfo(name, dateStr);
                if (exInfo) { 
                    if (exInfo.type === 'skip') {
                        // 건너뛰기
                    } else {
                        if (!skippedE.includes(name)) skippedE.push(name); 
                    }
                }
                else return name;
                count++;
            }
            return "배정불가";
        };

        const dates = [];
        cells.forEach(cell => {
            const dateStr = cell.dataset.date;
            const dateObj = new Date(dateStr);
            dates.push({
                dateStr, dateObj, isHoliday: this.isHoliday(dateObj),
                dayOfWeek: dateObj.getDay(), assigned: null, cell: cell
            });
        });

        let lastWAssignee = prevW;
        let lastEAssignee = prevE;

        for(let i=0; i<dates.length; i++) {
            if(dates[i].assigned) continue;
            
            let d = dates[i];
            let assignee = '';

            let isNextHoliday = (i + 1 < dates.length) ? dates[i+1].isHoliday : false;

            // 휴일(당일), 주말(금토일), 또는 다음날이 휴일인 경우 주말(E)로 배정
            if (d.isHoliday || d.dayOfWeek === 5 || d.dayOfWeek === 6 || d.dayOfWeek === 0 || isNextHoliday) {
                assignee = getNextE(d.dateStr);
                d.assigned = assignee;
                if (!isCombined) lastEAssignee = assignee;
                else lastWAssignee = assignee;
                
                // 공휴일 전날(또는 금요일) 당직자가 출근하지 않는 이어지는 휴일(주말 포함)을 모두 커버
                // 단, 연휴가 길어질 경우 설정된 최대 일수 단위로 끊어서 다음 사람에게 배정
                let j = i + 1;
                let consecutiveCount = 1;
                const maxConsecutive = (DB.settings && DB.settings.maxConsecutiveDuty !== undefined) ? DB.settings.maxConsecutiveDuty : 3;
                while (j < dates.length && dates[j].isHoliday) {
                    if (consecutiveCount >= maxConsecutive) {
                        assignee = getNextE(dates[j].dateStr);
                        if (!isCombined) lastEAssignee = assignee;
                        else lastWAssignee = assignee;
                        consecutiveCount = 0;
                    }
                    dates[j].assigned = assignee;
                    consecutiveCount++;
                    j++;
                }
            }
            else {
                // 내일도 평일인, 순수 평일
                assignee = getNextW(d.dateStr);
                d.assigned = assignee;
                lastWAssignee = assignee;
            }
        }

        let hasLongConsecutive = false;
        let currentConsecutive = 0;
        let lastPerson = '';

        dates.forEach(d => {
            if(d.assigned) {
                if(d.assigned === lastPerson) {
                    currentConsecutive++;
                    if(currentConsecutive >= 5) hasLongConsecutive = true;
                } else {
                    currentConsecutive = 1;
                    lastPerson = d.assigned;
                }
                d.cell.innerText = d.assigned;
            }
        });

        // 자동 배치 후 모달 Select도 마지막으로 배정된 사람으로 갱신
        if (!DB.settings.dutyOrder) DB.settings.dutyOrder = {};
        DB.settings.dutyOrder.prevWeekday = lastWAssignee || '';
        if (!isCombined) {
            DB.settings.dutyOrder.prevWeekend = lastEAssignee || '';
        }
        DB.saveSettings({});

        this.updateCalendarSummary();
    },

    // 지정한 월의 당직 달력 생성
    async generateCalendar() {
        const monthVal = document.getElementById('dutyMonth').value;
        if (!monthVal) return window.showCustomAlert('월을 선택해주세요.');

        const [y, m] = monthVal.split('-');
        const year = parseInt(y, 10);
        const month = parseInt(m, 10);

        window.showLoadingSpinner('달력 생성 및 공휴일 정보 가져오는 중...');

        // 연도별 공휴일 API 정보 호출 대기
        await this.fetchHolidays(year);

        const firstDay = new Date(year, month - 1, 1).getDay();
        const lastDate = new Date(year, month, 0).getDate();

        let html = '<table class="data-table" style="table-layout: fixed; width: 100%; min-height: 450px;"><thead><tr>';
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        days.forEach((d, i) => {
            let color = i === 0 ? 'var(--danger-color)' : (i === 6 ? 'var(--primary-dark)' : 'var(--text-main)');
            html += `<th style="color: ${color}; width: 14.28%;">${d}</th>`;
        });
        html += '</tr></thead><tbody><tr>';

        let dayCount = 1;
        for (let i = 0; i < 42; i++) {
            if (i % 7 === 0 && i !== 0) html += '</tr><tr>';
            
            if (i < firstDay || dayCount > lastDate) {
                html += '<td style="background-color: var(--bg-light);"></td>';
            } else {
                const targetDate = new Date(year, month - 1, dayCount);
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;
                let color = this.isHoliday(targetDate) ? 'var(--danger-color)' : ((i % 7) === 6 ? 'var(--primary-dark)' : 'var(--text-main)');
                const hName = this.getHolidayName(targetDate);
                const hTag = hName ? ` <span style="font-size: 0.75em; font-weight: normal; color: var(--danger-color); background-color: #fdeaea; padding: 1px 4px; border-radius: 3px; margin-left: 2px;">${hName}</span>` : '';
                
                // 드래그 앤 드롭 및 타이핑이 자유로운 ContentEditable Div 추가
                html += `
                    <td style="vertical-align: top; padding: 5px;">
                        <div style="font-weight: bold; color: ${color}; margin-bottom: 5px;">${dayCount}${hTag}</div>
                        <div class="duty-cell" data-date="${dateStr}" contenteditable="true" 
                            style="min-height: 50px; border: 1px dashed var(--border-color); padding: 5px; outline: none; font-size: 0.95em;" 
                            ondragover="event.preventDefault()" 
                            ondrop="event.preventDefault(); const t = event.dataTransfer.getData('text/plain'); if(t) { this.innerText = this.innerText ? this.innerText + '\\n' + t : t; window.Duty.updateCalendarSummary(); }">
                        </div>
                    </td>
                `;
                dayCount++;
            }
            
            if (dayCount > lastDate && (i + 1) % 7 === 0) break;
        }
        html += '</tbody></table>';
        document.getElementById('dutyCalendarContainer').innerHTML = html;
        this.updateCalendarSummary();
        window.hideLoadingSpinner();
    },

    // 달력 데이터를 추출하여 당직명단 엑셀 다운로드
    exportListExcel() {
        const cells = document.querySelectorAll('.duty-cell');
        if (cells.length === 0) return window.showCustomAlert('달력을 먼저 생성해주세요.');

        const deptName = DB.settings.departmentName || '';
        const aoa = [['당직일자', '당직구분', '당직직책', '부서', '직급', '성명', '개인식별번호', '휴일구분', '비고']];

        cells.forEach(cell => {
            const dateStr = cell.dataset.date;
            const nameStr = cell.innerText.trim();
            
            if (nameStr) {
                const names = nameStr.split(/[\n,\s]+/).map(n => n.trim()).filter(n => n !== '');
                names.forEach(name => {
                    // [FIX] '홍길동(대직)' 처럼 괄호 안에 적힌 메모를 제거하여 순수 이름만 추출
                    const cleanName = name.replace(/\([^)]*\)/g, '').trim();
                    const emp = DB.employees.find(e => e.name === cleanName) || {};
                    aoa.push([
                        dateStr, '재택', '당직원', deptName, emp.rank || '', cleanName, emp.idNumber || '', '', ''
                    ]);
                });
            }
        });

        if (aoa.length === 1) return window.showCustomAlert('달력에 입력된 당직자가 없습니다.');

        const wb = XLSX.utils.book_new();
        
        const ws1 = XLSX.utils.aoa_to_sheet(aoa);
        ws1['!cols'] = [{wpx:80}, {wpx:60}, {wpx:60}, {wpx:120}, {wpx:60}, {wpx:60}, {wpx:100}, {wpx:60}, {wpx:120}];
        
        for (let cellAddress in ws1) {
            if (cellAddress.startsWith('!')) continue;
            const decoded = XLSX.utils.decode_cell(cellAddress);
            ws1[cellAddress].s = {
                alignment: { vertical: "center", horizontal: "center", wrapText: true },
                border: {
                    top: { style: "thin", color: { rgb: "D4D4D4" } },
                    bottom: { style: "thin", color: { rgb: "D4D4D4" } },
                    left: { style: "thin", color: { rgb: "D4D4D4" } },
                    right: { style: "thin", color: { rgb: "D4D4D4" } }
                }
            };
            if (decoded.r === 0) { // 헤더 서식
                ws1[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "F8F9FA" } };
                ws1[cellAddress].s.font = { bold: true };
            }
        }
        
        XLSX.utils.book_append_sheet(wb, ws1, "당직명단(목록)");
        XLSX.utils.book_append_sheet(wb, ws1, "Sheet1");
        
        window.showLoadingSpinner('당직명단 엑셀 파일을 생성하는 중입니다...');
        setTimeout(() => {
            try {
                const now = new Date();
                const datePrefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + " ";
                XLSX.writeFile(wb, `${datePrefix}당직명단.xlsx`);
                window.hideLoadingSpinner();
                window.showCustomAlert("당직명단 다운로드가 완료되었습니다.");
            } catch (error) {
                window.hideLoadingSpinner();
                window.showCustomAlert(`다운로드 중 오류가 발생했습니다: ${error.message}`);
            }
        }, 500); // 파일 생성 후 알림이 뜨도록 UI 렌더링 지연
    },

    // 달력 데이터를 추출하여 달력보기 시각화 엑셀 다운로드
    exportCalendarExcel() {
        const cells = document.querySelectorAll('.duty-cell');
        if (cells.length === 0) return window.showCustomAlert('달력을 먼저 생성해주세요.');

        const calTable = document.querySelector('#dutyCalendarContainer table');
        if (!calTable) return;

        // 상단 제목용 텍스트 추출 (예: 2024년 5월 당직 달력)
        const monthVal = document.getElementById('dutyMonth').value;
        let titleStr = "당직 달력";
        if (monthVal) {
            const [y, m] = monthVal.split('-');
            titleStr = `${y}년 ${parseInt(m, 10)}월 당직 달력`;
        }

        const wb = XLSX.utils.book_new();
        const cloneTable = calTable.cloneNode(true);
        
        const aoa = [];
        aoa.push([titleStr, "", "", "", "", "", ""]); // 1행 (병합될 제목)
        const daysHeader = ['일', '월', '화', '수', '목', '금', '토'];
        aoa.push(daysHeader); // 2행 (요일)
        
        const counts = new Map(); // 당직 횟수 요약용 카운터
        
        const rows = cloneTable.querySelectorAll('tbody tr');
        rows.forEach(tr => {
            const rowDate = [];
            const rowHoliday = [];
            const rowName = [];
            
            tr.querySelectorAll('td').forEach(td => {
                const dayDiv = td.querySelector('div:first-child');
                const nameDiv = td.querySelector('.duty-cell');
                
                // 유효한 날짜 셀인 경우
                if (dayDiv && nameDiv && dayDiv.innerText.trim() !== '') {
                    const dateStr = nameDiv.dataset.date;
                    const dateObj = new Date(dateStr);
                    const dayText = `${dateObj.getDate()}`;
                    
                    const hName = window.Duty.getHolidayName(dateObj);
                    const nameText = nameDiv.innerText.trim();
                    
                    // 당직 횟수 카운트 기록
                    if (nameText) {
                        const names = nameText.split(/[\n,\s]+/).map(n => n.trim()).filter(n => n !== '');
                        names.forEach(n => {
                            const cleanName = n.replace(/\([^)]*\)/g, '').trim();
                            counts.set(cleanName, (counts.get(cleanName) || 0) + 1);
                        });
                    }
                    
                    rowDate.push(dayText);
                    rowHoliday.push(hName);
                    rowName.push(nameText);
                } else {
                    // 이전 달/다음 달 등의 빈 칸
                    rowDate.push("EMPTY");
                    rowHoliday.push("EMPTY");
                    rowName.push("EMPTY");
                }
            });
            if (rowDate.length > 0) {
                aoa.push(rowDate);
                aoa.push(rowHoliday);
                aoa.push(rowName);
            }
        });

        const calendarEndRow = aoa.length - 1; // 달력 영역의 마지막 행 인덱스

        // 당직 횟수 요약표 데이터 추가
        const sortedCounts = Array.from(counts.entries()).sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0]));
        aoa.push(["", "", "", "", "", "", ""]); // 빈 줄 (간격 띄우기)
        const summaryStartRow = aoa.length;
        aoa.push(["■ 당직 배정 횟수 요약", "", "", "", "", "", ""]);
        aoa.push(["성명", "횟수", "성명", "횟수", "성명", "횟수", ""]);
        
        let currentRow = [];
        for (let i = 0; i < sortedCounts.length; i++) {
            currentRow.push(sortedCounts[i][0]);
            currentRow.push(sortedCounts[i][1] + "회");
            if (currentRow.length === 6) {
                currentRow.push(""); // 7열 채우기용
                aoa.push(currentRow);
                currentRow = [];
            }
        }
        if (currentRow.length > 0) {
            while (currentRow.length < 7) currentRow.push("");
            aoa.push(currentRow);
        }
        const summaryEndRow = aoa.length - 1;

        const ws2 = XLSX.utils.aoa_to_sheet(aoa);
        ws2['!cols'] = Array(7).fill({ wpx: 120 });
        
        ws2['!rows'] = [];
        ws2['!rows'].push({ hpt: 40 }); // 제목 행 높이
        ws2['!rows'].push({ hpt: 30 }); // 요일 헤더 행 높이
        for (let i = 2; i <= calendarEndRow; i += 3) {
            ws2['!rows'].push({ hpt: 25 }); // 날짜 행
            ws2['!rows'].push({ hpt: 20 }); // 휴일명 행
            ws2['!rows'].push({ hpt: 45 }); // 성명 행
        }
        ws2['!rows'].push({ hpt: 20 }); // 요약표 위 간격
        ws2['!rows'].push({ hpt: 30 }); // 요약표 제목 행 높이
        for (let i = summaryStartRow + 1; i <= summaryEndRow; i++) {
            ws2['!rows'].push({ hpt: 25 }); // 요약표 본문 행 높이
        }
        
        // 병합 설정
        ws2['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // 달력 메인 제목
            { s: { r: summaryStartRow, c: 0 }, e: { r: summaryStartRow, c: 6 } } // 요약표 제목
        ];
        
        // 모든 셀을 순회하며 분리된 블록에 통합 서식 적용
        for (let R = 0; R < aoa.length; R++) {
            for (let C = 0; C < 7; C++) {
                const cellAddress = XLSX.utils.encode_cell({r: R, c: C});
                if (!ws2[cellAddress]) ws2[cellAddress] = { t: 's', v: '' };
                
                const cell = ws2[cellAddress];
                const isEmpty = (cell.v === "EMPTY");
                if (isEmpty) cell.v = ""; // 더미 텍스트 제거
                
                cell.s = {
                    alignment: { vertical: "center", horizontal: "center", wrapText: true },
                    font: { name: "맑은 고딕", sz: 11 }
                };

                // --- 달력 영역 서식 처리 ---
                if (R <= calendarEndRow) {
                    let borderSetup = {
                        top: { style: "thin", color: { rgb: "CCCCCC" } },
                        bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                        left: { style: "thin", color: { rgb: "CCCCCC" } },
                        right: { style: "thin", color: { rgb: "CCCCCC" } }
                    };

                    if (R === 0) {
                        cell.s.font.sz = 16;
                        cell.s.font.bold = true;
                        borderSetup = {}; 
                    }
                    else if (R === 1) { 
                        cell.s.fill = { patternType: "solid", fgColor: { rgb: "F2F2F2" } };
                        cell.s.font.bold = true;
                        if (C === 0) cell.s.font.color = { rgb: "E74C3C" };
                        else if (C === 6) cell.s.font.color = { rgb: "2980B9" };
                    }
                    else {
                        const weekRowIdx = (R - 2) % 3;
                        
                        // 위/아래 내부 얇은 선을 제거하여 한 세트(하나의 칸)처럼 보이도록 연출
                        if (weekRowIdx === 0) {
                            delete borderSetup.bottom;
                            cell.s.alignment.vertical = "bottom"; 
                            cell.s.font.bold = true; // 날짜는 굵게
                        } else if (weekRowIdx === 1) {
                            delete borderSetup.top;
                            delete borderSetup.bottom;
                            cell.s.font.sz = 10; // 휴일명 글씨는 조금 작게
                        } else if (weekRowIdx === 2) {
                            delete borderSetup.top;
                            cell.s.alignment.vertical = "top";
                        }

                        if (isEmpty) {
                            // 이전달, 다음달 빈 날짜 회색 배경
                            cell.s.fill = { patternType: "solid", fgColor: { rgb: "EAEAEA" } };
                        } else {
                            // 색상 처리 (공휴일 판별)
                            const holidayRowOffset = R - weekRowIdx + 1;
                            const holidayCellVal = aoa[holidayRowOffset] ? aoa[holidayRowOffset][C] : "";
                            const isHoliday = (holidayCellVal && holidayCellVal !== "EMPTY" && /[가-힣]/.test(holidayCellVal));

                            if (C === 0 || isHoliday) {
                                cell.s.font.color = { rgb: "E74C3C" };
                            } else if (C === 6) {
                                cell.s.font.color = { rgb: "2980B9" };
                            }
                        }
                    }
                    
                    // 달력 테두리를 굵은 선으로 변경 (R >= 1 요일 행부터)
                    if (R >= 1) {
                        if (R === 1) borderSetup.top = { style: "medium", color: { rgb: "000000" } };
                        if (R === calendarEndRow) borderSetup.bottom = { style: "medium", color: { rgb: "000000" } };
                        if (C === 0) borderSetup.left = { style: "medium", color: { rgb: "000000" } };
                        if (C === 6) borderSetup.right = { style: "medium", color: { rgb: "000000" } };
                    }
                    
                    cell.s.border = borderSetup;
                }
                // --- 요약표 영역 서식 처리 ---
                else {
                    if (R === summaryStartRow) {
                        cell.s.font.sz = 13;
                        cell.s.font.bold = true;
                        cell.s.alignment.horizontal = "left";
                        cell.s.border = {};
                    } else if (R > summaryStartRow) {
                        if (C < 6 && cell.v !== "") { // 내용이 있는 데이터 셀
                            cell.s.border = {
                                top: { style: "thin", color: { rgb: "A0A0A0" } },
                                bottom: { style: "thin", color: { rgb: "A0A0A0" } },
                                left: { style: "thin", color: { rgb: "A0A0A0" } },
                                right: { style: "thin", color: { rgb: "A0A0A0" } }
                            };
                            
                            if (R === summaryStartRow + 1) { // 테이블 헤더
                                cell.s.fill = { patternType: "solid", fgColor: { rgb: "F2F2F2" } };
                                cell.s.font.bold = true;
                            } else {
                                if (C % 2 === 1) { // 횟수 셀 열은 붉은 글씨
                                    cell.s.font.color = { rgb: "E74C3C" };
                                    cell.s.font.bold = true;
                                }
                            }
                        } else if (C < 6 && cell.v === "") { // 빈칸이더라도 테두리는 채움
                            cell.s.border = {
                                top: { style: "thin", color: { rgb: "A0A0A0" } },
                                bottom: { style: "thin", color: { rgb: "A0A0A0" } },
                                left: { style: "thin", color: { rgb: "A0A0A0" } },
                                right: { style: "thin", color: { rgb: "A0A0A0" } }
                            };
                        } else {
                            cell.s.border = {}; // 7번째 여백 열은 외곽선 없음
                        }
                    }
                }
            }
        }
        
        XLSX.utils.book_append_sheet(wb, ws2, "달력보기");
        
        window.showLoadingSpinner('당직달력 엑셀 파일을 생성하는 중입니다...');
        setTimeout(() => {
            try {
                const now = new Date();
                const datePrefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + " ";
                XLSX.writeFile(wb, `${datePrefix}당직달력.xlsx`);
                window.hideLoadingSpinner();
                window.showCustomAlert("당직달력 다운로드가 완료되었습니다.");
            } catch (error) {
                window.hideLoadingSpinner();
                window.showCustomAlert(`다운로드 중 오류가 발생했습니다: ${error.message}`);
            }
        }, 500); // 파일 생성 후 알림이 뜨도록 UI 렌더링 지연
    },

    // 당직수당 엑셀 파일 분석 로직
    async processAllowanceFile() {
        const fileInput = document.getElementById('dutyAllowanceFile');
        const file = fileInput.files[0];
        if (!file) return window.showCustomAlert('당직수당 엑셀 파일을 업로드해주세요.');

        const status = document.getElementById('dutyAllowanceStatus');
        window.showLoadingSpinner('당직 데이터를 분석하는 중...');

        try {
            const data = await window.AppUtils.readExcel(file);

            // 1~6행 사이에서 실제 헤더를 찾아 매핑
            let headerIdx = -1;
            for (let i = 0; i < Math.min(6, data.length); i++) {
                const rowStr = data[i].join('').replace(/\s/g, '');
                if (rowStr.includes('당직일자') && rowStr.includes('성명')) {
                    headerIdx = i;
                    break;
                }
            }

            if (headerIdx === -1) throw new Error('상단 1~6행 내에서 [당직일자] 및 [성명] 헤더를 찾을 수 없습니다.');

            const headers = data[headerIdx].map(h => String(h).replace(/\s/g, ''));
            const dateCol = headers.findIndex(h => h.includes('당직일자'));
            const nameCol = headers.findIndex(h => h.includes('성명'));

            if (dateCol === -1 || nameCol === -1) throw new Error('당직일자 또는 성명 열을 명확히 식별할 수 없습니다.');

            const records = [];
            let seq = 1;

            for (let i = headerIdx + 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue; 
                
                const name = String(row[nameCol] || '').trim();
                if (!name) continue; 

                let dateObj = window.AppUtils.toJsDate(row[dateCol]);
                let dateStr = dateObj ? window.AppUtils.formatDate(dateObj) : String(row[dateCol]).trim().split(' ')[0];

                // 직원신상명세서에서 고유식별번호 및 계급 매칭
                const emp = DB.employees.find(e => e.name === name) || {};
                records.push({
                    seq: seq++,
                    date: dateStr,
                    rank: emp.rank || '',
                    name: name,
                    idNumber: emp.idNumber || ''
                });
            }

            if (records.length === 0) throw new Error('데이터를 찾을 수 없습니다. 파일 양식을 확인해주세요.');

            window.Duty.allowanceRecords = records; // 인쇄용 데이터 보존

            let html = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>연번</th>
                            <th>당직일자</th>
                            <th>계급</th>
                            <th>성명</th>
                            <th>고유식별번호</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.map(r => `
                            <tr>
                                <td>${r.seq}</td>
                                <td>${r.date}</td>
                                <td>${r.rank}</td>
                                <td>${r.name}</td>
                                <td>${r.idNumber}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            document.getElementById('dutyAllowanceTable').innerHTML = html;
            status.innerText = '당직 내역서 생성이 완료되었습니다.';
            window.hideLoadingSpinner();

        } catch (err) {
            window.hideLoadingSpinner();
            status.innerText = `오류가 발생했습니다: ${err.message}`;
        }
    },

    // 당직수당 지급내역서 인쇄 로직 (연속된 날짜 묶음 산출)
    async printAllowance() {
        const monthStr = document.getElementById('printDutyMonth').value;
        const dateStr = document.getElementById('printDutyDate').value;
        if (!monthStr || !dateStr) return window.showCustomAlert('지급대상연월과 작성일자를 모두 입력해주세요.');

        document.getElementById('printDutyModal').style.display = 'none';

        // 엑셀 데이터의 모든 연도를 추출하여 공휴일 API 호출 (미래 년도 대비)
        const yearsToFetch = new Set();
        this.allowanceRecords.forEach(r => {
            const y = new Date(r.date).getFullYear();
            if (!isNaN(y)) yearsToFetch.add(y);
        });
        for (const y of yearsToFetch) await this.fetchHolidays(y);

        // 직원별 날짜 데이터 그룹화
        const summaryMap = new Map();
        this.allowanceRecords.forEach(r => {
            if (!summaryMap.has(r.name)) {
                const emp = DB.employees.find(e => e.idNumber === r.idNumber || e.name === r.name) || {};
                summaryMap.set(r.name, {
                    rank: r.rank,
                    name: r.name,
                    idNumber: r.idNumber,
                    bank: emp.bank || '',
                    account: emp.account || '',
                    dates: []
                });
            }
            summaryMap.get(r.name).dates.push(new Date(r.date));
        });

        const targetUsers = Array.from(summaryMap.values());
        let sumPeople = targetUsers.length;
        let sumDays = 0;
        let sumBlocks = 0;
        let sumAllowance = 0;

        // 연속 근무 블록 계산
        targetUsers.forEach(user => {
            user.dates.sort((a, b) => a - b);
            
            let blocks = [];
            let currentBlock = [];
            
            for (let i = 0; i < user.dates.length; i++) {
                if (i === 0) {
                    currentBlock.push(user.dates[i]);
                } else {
                    const diffTime = user.dates[i].getTime() - user.dates[i-1].getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 1) { // 1일 초과 차이 시 새로운 블록으로 인식
                        blocks.push(currentBlock);
                        currentBlock = [user.dates[i]];
                    } else {
                        currentBlock.push(user.dates[i]);
                    }
                }
            }
            if (currentBlock.length > 0) blocks.push(currentBlock);

            // 유효 블록 필터링 (블록 내에 평일이 하나라도 포함되어 있어야 지급 대상 인정)
            let validBlocks = [];
            blocks.forEach(blk => {
                const hasWeekday = blk.some(d => !this.isHoliday(d));
                if (hasWeekday) validBlocks.push(blk);
            });

            user.dutyCount = user.dates.length;
            user.blocksCount = validBlocks.length;
            user.allowance = validBlocks.length * 30000;
            
            const formatDay = (d, defColor) => {
                return `<span style="color:${this.isHoliday(d) ? 'var(--danger-color)' : defColor};">${d.getDate()}</span>`;
            };

            const allDaysStr = user.dates.map(d => formatDay(d, 'var(--primary-dark)')).join(', ');
            user.daysHtml = `<span style="font-size: 1.1em; font-weight: bold;">${user.dutyCount}</span><br><span style="font-size:0.85em; font-weight:normal;">${allDaysStr}</span>`;
            
            if (validBlocks.length > 0) {
                const blocksStrArr = validBlocks.map(blk => {
                    const first = formatDay(blk[0], 'var(--primary-dark)');
                    if (blk.length === 1) return first;
                    const rest = blk.slice(1).map(d => formatDay(d, 'var(--text-main)')).join(', ');
                    return `(${first}, ${rest})`;
                });
                user.blocksHtml = `<span style="font-size: 1.1em; font-weight: bold;">${user.blocksCount}</span><br><span style="font-size:0.85em; font-weight:normal; color:var(--text-main);">${blocksStrArr.join(', ')}</span>`;
            } else {
                user.blocksHtml = `<span style="font-size: 1.1em; font-weight: bold;">0</span><br><span style="font-size:0.85em; font-weight:normal; color:#333;">-</span>`;
            }

            sumDays += user.dutyCount;
            sumBlocks += user.blocksCount;
            sumAllowance += user.allowance;
        });

        // 정렬: 계급 우선, 이름 순
        const getRankSortOrder = (rank) => {
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
            if (rank.includes('경위')) return 20;
            if (rank.includes('실무원') || rank.includes('공무직')) return 30;
            if (rank.includes('기간제')) return 31;
            return 90;
        };
        
        targetUsers.sort((a, b) => {
            const rankA = getRankSortOrder(a.rank);
            const rankB = getRankSortOrder(b.rank);
            if (rankA !== rankB) return rankA - rankB;
            return a.name.localeCompare(b.name, 'ko-KR');
        });

        const [y, m] = monthStr.split('-');
        const titleMonth = `${y}년 ${parseInt(m)}월`;
        const [cy, cm, cd] = dateStr.split('-');
        const printDate = `${cy}. ${parseInt(cm)}. ${parseInt(cd)}.`;

        const printTeamLeader = typeof DB !== 'undefined' ? (DB.employees.find(emp => emp.role === '주무계장(사무장)')?.name || '공란') : '';
        const printClerk = typeof DB !== 'undefined' ? (DB.employees.find(emp => emp.role === '서무')?.name || '공란') : '';

        const trs = targetUsers.map((user, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${user.rank}</td>
                <td>${user.name}</td>
                <td>${user.idNumber}</td>
                <td style="line-height: 1.4;">${user.daysHtml}</td>
                <td style="line-height: 1.4;">${user.blocksHtml}</td>
                <td style="text-align:right; font-weight:bold;">${user.allowance.toLocaleString()}</td>
                <td>${user.bank}</td>
                <td style="text-align:left; padding-left: 5px;">${user.account}</td>
            </tr>
        `).join('');

        const contentHtml = `
            <style>@page { size: A4 portrait; margin: 10mm; }</style>
            <div style="padding: 10mm;">
                <h2 style="text-align: center; margin-bottom: 20px; font-size: 20pt;">${titleMonth} 당직수당 지급내역서</h2>
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
                <table class="data-table" style="font-size: 10pt; width: 100%;">
                    <thead>
                        <tr>
                            <th rowspan="2">연번</th>
                            <th>계급</th>
                            <th>성명</th>
                            <th>고유식별번호</th>
                            <th>당직일수</th>
                            <th>지급대상일수</th>
                            <th>지급액</th>
                            <th colspan="2">은행 및 계좌번호</th>
                        </tr>
                        <tr style="background-color: var(--bg-light); font-weight:bold;">
                            <th>합계</th>
                            <th>${sumPeople}명</th>
                            <th></th>
                            <th>${sumDays}일</th>
                            <th>${sumBlocks}일</th>
                            <th>${sumAllowance.toLocaleString()}원</th>
                            <th>은행</th>
                            <th>계좌번호</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trs}
                    </tbody>
                </table>
                <p style="text-align: center; margin-top: 30px; font-size: 12pt;">위와 같이 지급하고자 합니다.</p>
                <p style="text-align: center; margin-top: 15px; font-size: 12pt;">${printDate}</p>
            </div>
        `;

        if (window.electronAPI && window.electronAPI.openPrintWindow) {
            await window.electronAPI.openPrintWindow(contentHtml, { landscape: false }); // 세로 인쇄
        } else {
            window.showCustomAlert('Electron API를 사용할 수 없습니다.');
        }
    },

    // 당직내역서(결재란 없는 요약 출력본) 인쇄 로직
    async printHistory() {
        const monthStr = document.getElementById('printDutyMonth').value;
        const dateStr = document.getElementById('printDutyDate').value;
        if (!monthStr || !dateStr) return window.showCustomAlert('연월과 작성일자를 모두 입력해주세요.');

        document.getElementById('printDutyModal').style.display = 'none';

        const [y, m] = monthStr.split('-');
        const titleMonth = `${y}년 ${parseInt(m)}월`;
        const [cy, cm, cd] = dateStr.split('-');
        const printDate = `${cy}. ${parseInt(cm)}. ${parseInt(cd)}.`;

        const trs = this.allowanceRecords.map((r, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${r.date}</td>
                <td>${r.rank}</td>
                <td>${r.name}</td>
                <td>${r.idNumber}</td>
            </tr>
        `).join('');

        const contentHtml = `
            <style>@page { size: A4 portrait; margin: 10mm; }</style>
            <div style="padding: 10mm;">
                <h2 style="text-align: center; margin-bottom: 30px; font-size: 20pt;">${titleMonth} 당직내역서</h2>
                <table class="data-table" style="font-size: 11pt; width: 100%;">
                    <thead>
                        <tr style="background-color: var(--bg-light);">
                            <th>연번</th><th>당직일자</th><th>계급</th><th>성명</th><th>고유식별번호</th>
                        </tr>
                    </thead>
                    <tbody>${trs}</tbody>
                </table>
                <p style="text-align: center; margin-top: 30px; font-size: 12pt;">위와 같이 당직근무를 수행하였음을 확인함.</p>
                <p style="text-align: center; margin-top: 15px; font-size: 12pt;">${printDate}</p>
            </div>
        `;

        if (window.electronAPI && window.electronAPI.openPrintWindow) {
            await window.electronAPI.openPrintWindow(contentHtml, { landscape: false });
        } else {
            window.showCustomAlert('Electron API를 사용할 수 없습니다.');
        }
    },

    // 달력 하단 당직 배정 횟수 실시간 요약
    updateCalendarSummary() {
        const cells = document.querySelectorAll('.duty-cell');
        const summaryContainer = document.getElementById('dutyCalendarSummary');
        if (!summaryContainer) return;

        if (cells.length === 0) {
            summaryContainer.innerHTML = '';
            return;
        }

        const counts = new Map();
        let hasLongConsecutive = false;
        let currentConsecutive = 0;
        let lastPerson = '';

        cells.forEach(cell => {
            const nameStr = cell.innerText.trim();
            if (nameStr) {
                const names = nameStr.split(/[\n,\s]+/).map(n => n.trim()).filter(n => n !== '');
                names.forEach(name => {
                    const cleanName = name.replace(/\([^)]*\)/g, '').trim();
                    counts.set(cleanName, (counts.get(cleanName) || 0) + 1);
                });
                
                // 연속 5일 체크
                const cleanNamesForCheck = names.map(n => n.replace(/\([^)]*\)/g, '').trim());
                if (lastPerson && cleanNamesForCheck.includes(lastPerson)) {
                    currentConsecutive++;
                    if (currentConsecutive >= 5) hasLongConsecutive = true;
                } else {
                    currentConsecutive = 1;
                    lastPerson = cleanNamesForCheck[0];
                }
            } else {
                currentConsecutive = 0;
                lastPerson = '';
            }
        });

        if (counts.size === 0) {
            summaryContainer.innerHTML = '<p class="hint" style="margin: 0;">달력에 배정된 인원이 없습니다. 직원을 드래그하거나 직접 입력해 보세요.</p>';
            return;
        }

        // 횟수 내림차순, 이름 오름차순 정렬
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0]));

        let html = '<h4 style="margin-top: 0; margin-bottom: 10px;">당직 배정 횟수 요약</h4>';
        if (hasLongConsecutive) {
            html += '<p style="color: var(--danger-color); font-weight: bold; margin-top: 0; margin-bottom: 10px;">⚠️ 연속 5일 이상 당직이 배정된 구간이 있습니다. 달력을 확인 후 수동으로 분리해주세요.</p>';
        }
        html += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
        sorted.forEach(([name, count]) => {
            html += `<span style="background-color: var(--bg-light); border: 1px solid var(--border-light); padding: 4px 10px; border-radius: 12px; font-size: 0.95em;"><b>${name}</b> <span style="color: var(--danger-color); font-weight: bold;">${count}</span>회</span>`;
        });
        html += '</div>';
        summaryContainer.innerHTML = html;
    }
};

document.addEventListener('DOMContentLoaded', () => window.Duty.init());