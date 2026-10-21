// 전역 Overtime 객체 선언
window.Overtime = {
    transformedData: null, // 정리된 데이터를 저장할 속성
    manualCorrections: {}, // 수당 보정 시간 저장 객체
    backupCorrections: null, // 수기 보정 백업 저장 객체
    tempCorrections: {}, // 모달 창 입력 중 유실 방지를 위한 임시 저장 객체
    currentHistoryId: null, // 현재 상세조회 중인 직원 ID

    /**
     * 직원 명세서 데이터를 기반으로 초과근무수당 테이블의 초기 상태를 렌더링합니다.
     */
    initializeTable() {
        const employees = DB.employees;
        const tableContainer = document.getElementById('overtimeResultTable');

        if (!employees || employees.length === 0) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-title">직원신상명세서 데이터가 없습니다</div>
                    <div class="empty-state-desc">먼저 <strong>'직원신상명세서'</strong> 탭에서 명세서를 생성하거나 불러와주세요.</div>
                </div>
            `;
            return;
        }

        const includeGrade5 = DB.settings && DB.settings.includeGrade5Overtime;

        // 1. 4급 및 5급(설정값에 따라) 직원을 필터링하고 요청된 정렬 순서에 따라 정렬합니다.
        const filteredEmployees = employees.filter(emp => {
            if (emp.rank.includes('4급')) return false;
            if (emp.rank.includes('5급')) return includeGrade5;
            return true;
        });

        const sortedEmployees = [...filteredEmployees].sort(this.employeeSorter);

        // 2. 테이블 HTML 구조를 생성합니다.
        const tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>연번</th>
                        <th>성명</th>
                        <th>계급</th>
                        <th>고유식별<br>번호</th>
                        <th>시간외근무<br>일수(정액분)</th>
                        <th>시간외근무<br>수당(정액분)</th>
                        <th>시간외근무시간<br>(실제근무)</th>
                        <th>비상근무<br>시간</th>
                        <th>시간외근무<br>조정</th>
                        <th>초과<br>근무시간</th>
                        <th>상한<br>(57h)</th>
                        <th>예외<br>(100h)</th>
                        <th>합계</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedEmployees.map((emp, index) => `
                        <tr data-employee-id="${emp.idNumber}">
                            <td>${index + 1}</td>
                            <td>${emp.name}</td>
                            <td>${emp.rank}</td>
                            <td>${emp.idNumber}</td>
                            <td>-</td> <!-- 4: 정액분 일수 -->
                            <td>-</td> <!-- 5: 정액분 수당 -->
                            <td>-</td> <!-- 6: 실제 근무 -->
                            <td><input type="text" class="overtime-input emergency-time" value="00:00"></td> <!-- 7: 비상근무 -->
                            <td><button class="btn-detail" data-id="${emp.idNumber}" data-name="${emp.name}" style="padding:4px 8px; font-size:0.9em; cursor:pointer; background-color:var(--primary-color); color:white; border:none; border-radius:3px;">상세/보정</button></td> <!-- 8: 조정 -->
                            <td>-</td> <!-- 9: 초과근무시간 -->
                            <td><input type="checkbox" class="overtime-input official-doc-chk" style="width: 18px; height: 18px; cursor: pointer;" title="체크 시 초과근무시간 상한이 57시간으로 늘어납니다." disabled></td> <!-- 10: 상한(57h) -->
                            <td><input type="checkbox" class="overtime-input exception-chk" style="width: 18px; height: 18px; cursor: pointer;" title="체크 시 월 상한이 100시간까지 늘어납니다. (선거 등 예외 사유)" disabled></td> <!-- 11: 예외(100h) -->
                            <td>-</td> <!-- 12: 합계 -->
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        tableContainer.innerHTML = tableHtml;
    },

    /**
     * 직원 정렬을 위한 비교 함수입니다. (계급 > 이름순)
     */
    employeeSorter(a, b) {
        const rankOrderA = Overtime.getRankSortOrder(a.rank);
        const rankOrderB = Overtime.getRankSortOrder(b.rank);
        if (rankOrderA !== rankOrderB) return rankOrderA - rankOrderB;
        return a.name.localeCompare(b.name, 'ko-KR');
    },

    /**
     * 계급 문자열을 받아 정렬 우선순위를 숫자로 반환합니다.
     */
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
        if (rank.includes('경위')) return 20;
        return 90;
    },

    /**
     * 초과근무 엑셀 파일을 읽고, 데이터를 집계하여 테이블을 업데이트합니다.
     * [FIX] 파일 재처리 시 기존 보정 데이터 소실에 대한 confirm 경고 추가
     */
    async processOvertimeFile() {
        const filesInput = document.getElementById('overtimeFiles');
        const statusEl = document.getElementById('overtimeStatus');

        let allFiles = [];
        if (filesInput && filesInput.files.length > 0) allFiles.push(...filesInput.files);

        if (allFiles.length < 3) {
            window.showCustomAlert('초과근무목록(실적분), 초과근무정산내역(정액분), 개인별근무상황내역 파일을 모두 업로드해주세요.\n(동 행정복지센터는 당직명령부 포함 4개)');
            return;
        }

        // [FIX] 보정 데이터 백업 및 복구 버튼 표시
        if (Object.keys(this.manualCorrections).length > 0) {
            this.backupCorrections = JSON.parse(JSON.stringify(this.manualCorrections));
            const btnRestore = document.getElementById('btnRestoreOvertimeCorrections');
            if (btnRestore) btnRestore.style.display = 'inline-block';
        }

        window.showLoadingSpinner('데이터를 읽고 분석하는 중...');

        try {
            this.manualCorrections = {};
            
            const parsedFiles = [];
            for (let file of allFiles) {
                const data = await window.AppUtils.readExcel(file);
                const trans = window.AppUtils.simulateTextToColumns(data);
                const header = trans.slice(0, 10).flat().join('').replace(/\s+/g, '');
                parsedFiles.push({ file, data, trans, header, maxCols: Math.max(...trans.map(r => r.length)) });
            }

            let dutyFileObj = parsedFiles.find(p => p.header.includes('당직일자') || p.file.name.includes('당직'));
            let attendanceFileObj = parsedFiles.find(p => p.header.includes('종별') && p.header.includes('일/시간') && p.header.includes('기간'));
            let nonSpecialFiles = parsedFiles.filter(p => p !== dutyFileObj && p !== attendanceFileObj);

            if (!attendanceFileObj) {
                window.hideLoadingSpinner();
                window.showCustomAlert('개인별근무상황내역 파일이 누락되었습니다.\n초과근무목록, 정액분, 개인별근무상황내역 3개 파일은 필수입니다.');
                return;
            }

            const isDong = DB.settings.departmentType === '동';
            if (isDong && !dutyFileObj) {
                window.hideLoadingSpinner();
                window.showCustomAlert('동 행정복지센터의 경우 당직명령부 파일을 반드시 함께 첨부해야 합니다.');
                return;
            }

            if (nonSpecialFiles.length < 2) {
                window.hideLoadingSpinner();
                throw new Error('초과근무목록(실적분)과 초과근무정산내역(정액분) 파일을 올바르게 식별할 수 없습니다.');
            }

            const p1 = nonSpecialFiles[0];
            const p2 = nonSpecialFiles[1];
            const isDetail1 = p1.header.includes('출근시간') || p1.header.includes('퇴근시간') || p1.header.includes('총초과');
            const isDetail2 = p2.header.includes('출근시간') || p2.header.includes('퇴근시간') || p2.header.includes('총초과');

            let rawData = null;
            let fixedRawData = null;

            if (isDetail1 && !isDetail2) {
                rawData = p1.trans; fixedRawData = p2.trans;
            } else if (!isDetail1 && isDetail2) {
                rawData = p2.trans; fixedRawData = p1.trans;
            } else {
                if (p1.maxCols > p2.maxCols) { rawData = p1.trans; fixedRawData = p2.trans; }
                else { rawData = p2.trans; fixedRawData = p1.trans; }
            }
            this.transformedData = rawData;

            // 1. 당직명령부 처리
            let dutyMap = new Map();
            if (dutyFileObj) {
                dutyMap = this.parseDutyOrder(dutyFileObj.data);
            }
                
            // 1-1. 개인별근무상황내역 파싱 (근무시간 보전용)
            let attendanceMap = new Map();
            if (attendanceFileObj) {
                attendanceMap = this.parseAttendanceData(attendanceFileObj.trans);
            }

            // 2. 당직 공제 로직 적용
            this.applyDutyDeduction(this.transformedData, dutyMap);

            const overtimeByEmployee = this.aggregateOvertimeData(rawData);
            const fixedOvertimeByEmployee = this.aggregateFixedOvertimeData(fixedRawData, overtimeByEmployee, attendanceMap);
            this.updateTableWithOvertimeData(overtimeByEmployee, fixedOvertimeByEmployee);
            
            statusEl.textContent = '데이터 분석이 완료되었습니다. 각 항목을 확인해주세요.';
            window.hideLoadingSpinner();

            // 3. 당직 및 보전/승진 적용 안내 메시지 통합 출력
            let alertMessage = "[분석 완료 안내]\n";
            if (dutyFileObj) {
                alertMessage += "\n✅ 당직 공제 로직 적용됨\n(당일/다음날 평일, 휴일 당직 시 수당 삭감)";
            }
            if (attendanceFileObj) {
                alertMessage += "\n✅ 개인별근무상황 보전 로직 적용됨\n(부족한 시간을 초과근무로 채운 경우 정액분 복원)";
            }
            let hasPromo = DB.employees.some(e => e.remarks && e.remarks.includes('승진('));
            if (hasPromo) {
                alertMessage += "\n✅ 승진자 일할 계산 적용됨\n(발령일 전/후 단가 분할 적용)";
            }

            setTimeout(() => {
                window.showCustomAlert(alertMessage);
            }, 500);
        } catch (error) {
            console.error('초과근무 파일 처리 중 오류:', error);
            window.hideLoadingSpinner();
            statusEl.textContent = `오류가 발생했습니다: ${error.message}`;
        }
    },

    /**
     * 개인별근무상황내역 데이터를 파싱하여 일자별로 비운(감액대상) 시간(분)을 맵핑합니다.
     */
    parseAttendanceData(data) {
        const attendanceMap = new Map(); // idNumber -> Map(dateStr -> totalMissingMinutes)
        const COL = { ID: 4, TYPE: 5, PERIOD: 7, TIME: 8 }; // 0-based: E, F, H, I

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[COL.ID]) continue;

            const id = String(row[COL.ID]).trim();
            const type = String(row[COL.TYPE] || '').trim();
            const periodStr = String(row[COL.PERIOD] || '').trim();
            const timeStr = String(row[COL.TIME] || '').trim();

            if (!id || !type || !periodStr || !timeStr) continue;

            // 감액 대상이 아닌 특수 휴가 무시
            if (type.includes('모성보호') || type.includes('육아시간')) continue;

            // 기간 파싱 (예: 2024. 10. 15. 14:00 ~ 2024. 10. 15. 18:00)
            const dateRegex = /(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/g;
            const dates = [];
            let match;
            while ((match = dateRegex.exec(periodStr)) !== null) {
                dates.push(new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])));
            }
            if (dates.length === 0) continue;

            let startDate = dates[0];
            let endDate = dates.length > 1 ? dates[1] : startDate;
            
            // 시간(분) 환산
            let totalMissingMins = 0;
            const dayMatch = timeStr.match(/(\d+)\s*일/);
            const hourMatch = timeStr.match(/(\d+)\s*시간/);
            const minMatch = timeStr.match(/(\d+)\s*분/);

            if (dayMatch) totalMissingMins += parseInt(dayMatch[1]) * 8 * 60; // 1일 = 8근무시간
            if (hourMatch) totalMissingMins += parseInt(hourMatch[1]) * 60;
            if (minMatch) totalMissingMins += parseInt(minMatch[1]);

            // 각 일자별로 하루 최대 480분씩 분배
            let currDate = new Date(startDate);
            let remainingMins = totalMissingMins;

            if (!attendanceMap.has(id)) attendanceMap.set(id, new Map());
            const userAttMap = attendanceMap.get(id);

            // 혹시 모를 무한 루프 방지를 위해 최대 100일 제한
            let loopSafe = 0;
            while (currDate <= endDate && remainingMins > 0 && loopSafe < 100) {
                const dateKey = window.AppUtils.formatDate(currDate);
                const allocMins = Math.min(remainingMins, 480); // 하루 최대 8시간
                
                const existing = userAttMap.get(dateKey) || 0;
                userAttMap.set(dateKey, existing + allocMins);
                
                remainingMins -= allocMins;
                currDate.setDate(currDate.getDate() + 1);
                loopSafe++;
            }
        }
        return attendanceMap;
    },

    /**
     * 당직명령부를 파싱하여 직원별 당직일자 Map을 생성합니다.
     */
    parseDutyOrder(data) {
        const map = new Map();
        for(let i = 1; i < data.length; i++) {
            const row = data[i];
            // C열(2) 당직일자, H열(7) 직급, I열(8) 식별번호, J열(9) 성명
            if (!row || !row[8]) continue;
            
            const dateRaw = row[2];
            const idNumber = String(row[8]).trim();
            
            let dateStr = '';
            if (typeof dateRaw === 'number') {
                const d = window.AppUtils.toJsDate(dateRaw);
                if (d) dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            } else {
                const str = String(dateRaw).trim();
                const match = str.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
                if (match) dateStr = match[1].replace(/\//g, '-');
                else dateStr = str.split(' ')[0];
            }

            if (dateStr && idNumber) {
                if (!map.has(idNumber)) map.set(idNumber, new Set());
                map.get(idNumber).add(dateStr);
            }
        }
        return map;
    },

    /**
     * 당직 Map을 기반으로 초과근무 원본 데이터의 인정시간을 삭감하고 플래그를 추가합니다.
     */
    applyDutyDeduction(rawData, dutyMap) {
        const COL = { DATE: 2, ID: 5, HOLIDAY: 10, CLOCK_IN: 17, CLOCK_OUT: 18, TOTAL_MIN: 19, DED_MIN: 20, PAYABLE_MIN: 21 };
        
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            const id = row[COL.ID];
            const origPayable = parseInt(row[COL.PAYABLE_MIN]) || 0;
            const origTotal = parseInt(row[COL.TOTAL_MIN]) || 0;
            
            row.dutyPayable = origPayable; // 초기값
            row.dutyReason = '';

            if (!id || origTotal === 0 || dutyMap.size === 0) continue;

            const dateObj = window.AppUtils.toJsDate(row[COL.DATE]);
            if (!dateObj) continue;

            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
            const prevDateObj = new Date(dateObj);
            prevDateObj.setDate(prevDateObj.getDate() - 1);
            const prevDateStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth()+1).padStart(2,'0')}-${String(prevDateObj.getDate()).padStart(2,'0')}`;

            const isTodayDuty = dutyMap.has(id) && dutyMap.get(id).has(dateStr);
            const isPrevDuty = dutyMap.has(id) && dutyMap.get(id).has(prevDateStr);

            if (!isTodayDuty && !isPrevDuty) continue;

            const holidayType = String(row[COL.HOLIDAY] || '').trim();
            const clockIn = window.AppUtils.toJsDate(row[COL.CLOCK_IN]);
            const clockOut = window.AppUtils.toJsDate(row[COL.CLOCK_OUT]);

            if (isTodayDuty && holidayType === '휴일') {
                row[COL.TOTAL_MIN] = 0;
                row[COL.DED_MIN] = 0;
                row.dutyPayable = 0;
                row.dutyReason = '휴일 당직(당일 전체 불가)';
                continue;
            }

            if (clockIn && clockOut) {
                const inTotal = clockIn.getHours() * 60 + clockIn.getMinutes();
                const outTotal = clockOut.getHours() * 60 + clockOut.getMinutes();

                let amMins = 0;
                let pmMins = 0;

                if (inTotal < 9 * 60) amMins = 9 * 60 - inTotal;
                
                if (holidayType === '평일') {
                    if (outTotal > 18 * 60) pmMins = outTotal - 18 * 60;
                } else {
                    pmMins = Math.max(0, outTotal - Math.max(9 * 60, inTotal));
                }

                if (isTodayDuty && holidayType === '평일') {
                    if (isPrevDuty) {
                        row[COL.TOTAL_MIN] = 0;
                        row[COL.DED_MIN] = 0;
                        row.dutyPayable = 0;
                        row.dutyReason = '연속 당직(오전/오후 모두 불가)';
                    } else {
                        const newTotal = amMins;
                        const newDed = amMins > 0 ? 60 : 0;
                        const newPayable = Math.max(0, amMins - 60);
                        
                        row[COL.TOTAL_MIN] = newTotal;
                        row[COL.DED_MIN] = newDed;
                        row.dutyPayable = newPayable;
                        
                        // 실제로 오후 초과근무를 했거나 원본 엑셀 시간과 달라진 경우에만 공제 안내 표시
                        if (pmMins > 0 || origPayable !== newPayable) {
                            row.dutyReason = '평일 당직(오후 불가, 오전만 계산)';
                        }
                    }
                } else if (isPrevDuty && holidayType === '평일') {
                    if (amMins > 0) { // 실제로 오전 조기출근이 발생한 경우에만 삭감 개입
                        row[COL.TOTAL_MIN] = pmMins; // 총초과 = 18:00 이후 시간
                        row[COL.DED_MIN] = pmMins > 0 ? 60 : 0; // 제외시간 1시간
                        row.dutyPayable = Math.max(0, pmMins - 60);
                        row.dutyReason = '당직 다음날(오전 불가, 오후만 계산)';
                    }
                }
            }
        }
    },

    /**
     * 엑셀 데이터를 직원별로 집계합니다.
     */
    aggregateOvertimeData(data) {
        const overtimeByEmployee = new Map();
        const COL = { DATE: 2, ID: 5, HOLIDAY: 10, CLOCK_IN: 17, CLOCK_OUT: 18, PAYABLE_MIN: 21 };

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const idNumber = row[COL.ID];
            if (!idNumber) continue;

            if (!overtimeByEmployee.has(idNumber)) {
                overtimeByEmployee.set(idNumber, { totalMinutes: 0, familyDayRecords: [], dailyRecords: new Map() });
            }
            const empData = overtimeByEmployee.get(idNumber);

            const payableMinutes = row.dutyPayable !== undefined ? row.dutyPayable : (parseInt(row[COL.PAYABLE_MIN]) || 0);
            empData.totalMinutes += payableMinutes;

            const workDate = window.AppUtils.toJsDate(row[COL.DATE]);
            const holidayType = String(row[COL.HOLIDAY] || '').trim();
            
            if (workDate) {
                const dateStr = window.AppUtils.formatDate(workDate);
                empData.dailyRecords.set(dateStr, (empData.dailyRecords.get(dateStr) || 0) + payableMinutes);
            }

            if (workDate && holidayType === '평일') {
                const dayOfWeek = workDate.getDay();
                if (dayOfWeek === 3 || dayOfWeek === 5) {
                    const clockIn = window.AppUtils.toJsDate(row[COL.CLOCK_IN]);
                    const clockOut = window.AppUtils.toJsDate(row[COL.CLOCK_OUT]);

                    if (clockIn && clockOut) {
                        const isEarlyStart = clockIn.getHours() < 8;
                        const isLateFinish = clockOut.getHours() >= 19;
                        const isSelectable = !isEarlyStart || isLateFinish;

                        if (isSelectable && payableMinutes > 0) {
                            empData.familyDayRecords.push({
                                date: this.formatDateWithDay(workDate),
                                minutes: payableMinutes,
                                id: `fd-${idNumber}-${workDate.getTime()}`
                            });
                        }
                    }
                }
            }
        }
        return overtimeByEmployee;
    },

    /**
     * 초과근무정산내역 데이터를 직원별로 집계합니다.
     */
    aggregateFixedOvertimeData(data, overtimeByEmployee, attendanceMap) {
        const fixedDataMap = new Map();
        const COL = { ID: 2, ACTUAL_DAYS: 7 };

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;
            const idNumber = String(row[COL.ID] || '').trim();
            if (!idNumber) continue;
            
            let actualDays = parseFloat(row[COL.ACTUAL_DAYS]) || 0;
            let recoveredDays = 0; // 초과근무로 보전(복원)된 출근일수
            let unrecoveredDates = []; // 복원되지 못하고 감액된 날짜 목록

            if (attendanceMap && attendanceMap.has(idNumber)) {
                const userAttMap = attendanceMap.get(idNumber);
                const dailyOvertime = (overtimeByEmployee && overtimeByEmployee.has(idNumber)) ? overtimeByEmployee.get(idNumber).dailyRecords : new Map();

                for (const [dateStr, missingMins] of userAttMap.entries()) {
                    const overMins = dailyOvertime.get(dateStr) || 0;
                    // 비운 시간 이상을 그날 초과근무로 채운 경우, 비운 시간만큼 복원 (8시간=1일 기준)
                    if (overMins >= missingMins && missingMins > 0) {
                        recoveredDays += (missingMins / 480);
                    } else if (missingMins > 0) {
                        // 초과근무로 다 채우지 못해 감액 처리된 날짜 기록 (툴팁 표시용)
                        const missingDays = Math.round((missingMins / 480) * 10) / 10;
                        unrecoveredDates.push(`${dateStr}(-${missingDays}일)`);
                    }
                }
            }
            
            // [FIX] 보전 일수가 1 미만이면 버리고, 1 이상인 경우 정수 부분만 더하도록 처리 (소수점 부동소수점 오차 차단)
            recoveredDays = Math.floor(recoveredDays);

            fixedDataMap.set(idNumber, {
                originalDays: actualDays,
                recoveredDays: recoveredDays,
                finalDays: actualDays + recoveredDays,
                unrecoveredDates: unrecoveredDates
            });
        }
        return fixedDataMap;
    },

    /**
     * 집계된 데이터를 HTML 테이블에 업데이트합니다.
     */
    updateTableWithOvertimeData(overtimeByEmployee, fixedOvertimeByEmployee) {
        const rows = document.querySelectorAll('#overtimeResultTable tbody tr');
        rows.forEach(row => {
            const idNumber = row.dataset.employeeId;
            const empData = overtimeByEmployee.get(idNumber);
            const fixedData = fixedOvertimeByEmployee.get(idNumber) || { originalDays: 0, recoveredDays: 0, finalDays: 0 };

            row.dataset.fixedDays = fixedData.finalDays;
            row.dataset.recoveredDays = fixedData.recoveredDays;
            row.dataset.unrecoveredDates = JSON.stringify(fixedData.unrecoveredDates || []);
            
            let totalCorrection = 0;
            const corrections = this.manualCorrections[idNumber];
            if (corrections) {
                totalCorrection = Object.values(corrections).reduce((acc, val) => {
                    return acc + (typeof val === 'object' ? (val.diff || 0) : val);
                }, 0);
            }
            row.dataset.correctionMinutes = totalCorrection;

            if (empData) {
                row.dataset.totalMinutes = empData.totalMinutes;
            } else {
                row.dataset.totalMinutes = 0;
            }
            this.recalculateRow(row);
        });
    },

    /**
     * 특정 행의 시간외근무시간과 수당을 재계산하고 UI를 업데이트합니다.
     */
    recalculateRow(row) {
        const idNumber = row.dataset.employeeId;
        const rawTotalMinutes = parseInt(row.dataset.totalMinutes) || 0;
        const fixedDays = parseFloat(row.dataset.fixedDays) || 0;
        const recoveredDays = parseFloat(row.dataset.recoveredDays) || 0;
        
        let unrecoveredDates = [];
        try {
            unrecoveredDates = JSON.parse(row.dataset.unrecoveredDates || '[]');
        } catch (e) {}

        const correctionMinutes = parseInt(row.dataset.correctionMinutes) || 0;

        const totalMinutes = rawTotalMinutes + correctionMinutes;

        const emergencyTimeInput = row.querySelector('.emergency-time');
        const officialDocChk = row.querySelector('.official-doc-chk');
        const exceptionChk = row.querySelector('.exception-chk');

        const employee = DB.employees.find(emp => emp.idNumber === idNumber);
        let unitPrice = employee ? employee.unitPrice : 0;
        let oldUnitPrice = unitPrice;

        let promoDateStr = '';
        if (employee && employee.remarks) {
            const promoMatch = employee.remarks.match(/승진\((.*?)\)/);
            if (promoMatch) promoDateStr = promoMatch[1];
        }

        // 정액분 수당 계산
        let fixedAllowance = 0;
        let beforePromoWeekdays = 0, afterPromoWeekdays = 0;
        let beforePromoActualDays = 0, afterPromoActualDays = 0;
        let applyBefore = 0, applyAfter = 0;
        
        if (promoDateStr && fixedDays > 0) {
            let oldRank = employee.rank;
            const rankMatch = oldRank.match(/([4-9])급/);
            if (rankMatch) {
                const oldGrade = parseInt(rankMatch[1]) + 1; // 7급 승진 전은 8급
                oldRank = oldRank.replace(/[4-9]급/, `${oldGrade}급`);
                oldUnitPrice = DB.getUnitPrice(oldRank) || unitPrice;
            }
            
            const pDate = new Date(promoDateStr);
            const y = pDate.getFullYear();
            const m = pDate.getMonth();
            const lastDay = new Date(y, m + 1, 0).getDate();
            
            for (let d = 1; d <= lastDay; d++) {
                const cur = new Date(y, m, d);
                const day = cur.getDay();
                if (day !== 0 && day !== 6) {
                    if (d < pDate.getDate()) beforePromoWeekdays++;
                    else afterPromoWeekdays++;
                }
            }
            const totalWeekdays = beforePromoWeekdays + afterPromoWeekdays;
            afterPromoActualDays = Math.min(afterPromoWeekdays, Math.round(fixedDays * (afterPromoWeekdays / totalWeekdays)));
            beforePromoActualDays = Math.max(0, fixedDays - afterPromoActualDays);
            
            applyAfter = Math.min(15, afterPromoActualDays);
            applyBefore = Math.min(15 - applyAfter, beforePromoActualDays);
            
            fixedAllowance = (applyAfter * (unitPrice * 10)) / 15 + (applyBefore * (oldUnitPrice * 10)) / 15;
            fixedAllowance = Math.floor(fixedAllowance / 10) * 10;
        } else {
            const baseAmount = unitPrice * 10;
            if (fixedDays >= 15) {
                fixedAllowance = Math.floor(baseAmount / 10) * 10;
            } else if (fixedDays > 0) {
                const rawFixedAllowance = baseAmount - (baseAmount * (15 - fixedDays)) / 15;
                fixedAllowance = Math.floor(rawFixedAllowance / 10) * 10;
            }
        }

        const emergencyMinutes = this.HHMMtoMinutes(emergencyTimeInput ? emergencyTimeInput.value : '00:00');

        // 상한/예외 체크박스 활성화 조건 처리
        if (totalMinutes <= 38 * 60) {
            if (officialDocChk) { officialDocChk.disabled = true; officialDocChk.checked = false; }
        } else {
            if (officialDocChk) officialDocChk.disabled = false;
        }

        if (totalMinutes <= 57 * 60) {
            if (exceptionChk) { exceptionChk.disabled = true; exceptionChk.checked = false; }
        } else {
            if (exceptionChk) exceptionChk.disabled = false;
        }

        // 캡핑(Capping) 로직 처리
        let cappedActualMinutes = totalMinutes;
        if (cappedActualMinutes < 0) cappedActualMinutes = 0;
        let capText = '';

        if (exceptionChk && exceptionChk.checked) {
            if (cappedActualMinutes > 100 * 60) cappedActualMinutes = 100 * 60;
        } else if (officialDocChk && officialDocChk.checked) {
            if (cappedActualMinutes > 57 * 60) cappedActualMinutes = 57 * 60;
        } else {
            if (cappedActualMinutes > 38 * 60) {
                cappedActualMinutes = 38 * 60;
                capText = `<br><span style="font-size: 0.8em; color: var(--danger-color); font-weight: bold;">(상한 38h 적용)</span>`;
            }
        }

        if (officialDocChk && officialDocChk.checked && (!exceptionChk || !exceptionChk.checked) && totalMinutes > 57 * 60) {
            capText = `<br><span style="font-size: 0.8em; color: var(--danger-color); font-weight: bold;">(상한 57h 적용)</span>`;
        }

        let totalPayableMinutes = cappedActualMinutes + emergencyMinutes;
        let totalPayableHours = Math.floor(totalPayableMinutes / 60);

        if (totalPayableHours > 100) {
            totalPayableHours = 100;
            capText = `<br><span style="font-size: 0.8em; color: var(--danger-color); font-weight: bold;">(총합 상한 100h 적용)</span>`;
        }

        const rawAllowance = totalPayableHours * unitPrice;
        const performanceAllowance = Math.floor(rawAllowance / 10) * 10;
        const totalSum = fixedAllowance + performanceAllowance;

        let daysText = fixedDays + '일';
        // [FIX] 보전 일수가 1 이상인 경우에만 텍스트 표시
        if (recoveredDays >= 1) daysText += `<br><span style="font-size:0.8em;color:var(--success-color);font-weight:bold;">(보전 +${recoveredDays}일)</span>`;
        row.cells[4].innerHTML = daysText;
        
        let fixedAllowanceText = fixedAllowance.toLocaleString() + '원';
        if (promoDateStr) fixedAllowanceText += `<br><span style="font-size:0.8em;color:var(--info-color);font-weight:bold;">(승진 일할계산)</span>`;

        let tooltipLines = [];
        tooltipLines.push(`[정액분 출근일수]`);
        tooltipLines.push(`- 원본 출근일수: ${fixedDays - recoveredDays}일`);
        // [FIX] 보전 일수가 1 이상인 경우에만 툴팁에 표시
        if (recoveredDays >= 1) {
            tooltipLines.push(`- 초과근무 보전: +${recoveredDays}일`);
        }
        tooltipLines.push(`- 최종 인정일수: ${fixedDays}일`);
        if (fixedDays < 15 && unrecoveredDates.length > 0) {
            tooltipLines.push(`- 감액 일자: ${unrecoveredDates.join(', ')}`);
        }
        
        if (promoDateStr && fixedDays > 0) {
            tooltipLines.push(`\n[승진자 일할계산]`);
            tooltipLines.push(`- 발령일자: ${promoDateStr}`);
            tooltipLines.push(`- ${oldRank} 단가: ${oldUnitPrice.toLocaleString()}원`);
            tooltipLines.push(`- ${employee.rank} 단가: ${unitPrice.toLocaleString()}원`);
            tooltipLines.push(`- 발령 전 평일수: ${beforePromoWeekdays}일, 비례배분: ${beforePromoActualDays}일 (실 인정 ${applyBefore}일)`);
            tooltipLines.push(`- 발령 후 평일수: ${afterPromoWeekdays}일, 비례배분: ${afterPromoActualDays}일 (실 인정 ${applyAfter}일)`);
            tooltipLines.push(`- 최종 수당: ${fixedAllowance.toLocaleString()}원`);
        } else {
            tooltipLines.push(`\n[정액분 수당계산]`);
            tooltipLines.push(`- ${employee.rank} 단가: ${unitPrice.toLocaleString()}원`);
            if (fixedDays >= 15) {
                tooltipLines.push(`- 15일 이상 출근하여 15일치 전액 인정`);
            } else if (fixedDays > 0) {
                tooltipLines.push(`- 15일 미만 출근으로 비례 감액 인정`);
            }
            tooltipLines.push(`- 최종 수당: ${fixedAllowance.toLocaleString()}원`);
        }

        const allowanceTooltipHtml = `
            <div style="display: inline-block; position: relative; width: 100%; text-align: center; cursor: help;" onmouseenter="this.querySelector('.cell-tooltip').style.display='block'" onmouseleave="this.querySelector('.cell-tooltip').style.display='none'">
                <span style="font-size: 0.85em; border-bottom: 1px dashed #7f8c8d;">${fixedAllowanceText}</span>
                <span class="cell-tooltip" style="display:none; white-space: pre-wrap; text-align: left; width: 320px; line-height: 1.5;">${tooltipLines.join('\n')}</span>
            </div>
        `;
        row.cells[5].innerHTML = allowanceTooltipHtml;

        let cell6Text = this.minutesToHHMM(rawTotalMinutes);
        if (correctionMinutes > 0) {
            cell6Text += `<br><span style="font-size:0.8em;color:var(--primary-dark);font-weight:bold;">(+보정 ${this.minutesToHHMM(correctionMinutes)})</span>`;
        } else if (correctionMinutes < 0) {
            cell6Text += `<br><span style="font-size:0.8em;color:var(--danger-color);font-weight:bold;">(-보정 ${this.minutesToHHMM(Math.abs(correctionMinutes))})</span>`;
        }
        row.cells[6].innerHTML = cell6Text;
        row.cells[9].innerHTML = this.minutesToHHMM(totalPayableMinutes) + capText;
        row.cells[12].textContent = totalSum.toLocaleString() + '원';
    },

    /**
     * 상세 팝업에서 입력된 보정 시간 저장 및 메인 표 갱신
     * [FIX] 모달을 먼저 닫은 뒤 alert 호출하여 포커스 탈취 문제 방지
     */
    saveHistoryCorrections() {
        this.manualCorrections = JSON.parse(JSON.stringify(this.tempCorrections || {}));

        const idNumber = this.currentHistoryId;
        if (!idNumber) return;

        const row = document.querySelector(`#overtimeResultTable tbody tr[data-employee-id="${idNumber}"]`);
        if (row) {
            let totalCorrection = 0;
            const corrections = this.manualCorrections[idNumber];
            if (corrections) {
                totalCorrection = Object.values(corrections).reduce((acc, val) => {
                    return acc + (typeof val === 'object' ? (val.diff || 0) : val);
                }, 0);
            }
            row.dataset.correctionMinutes = totalCorrection;
            this.recalculateRow(row);
        }

        // [FIX] Electron alert() 포커스 상실 버그 원천 차단 (경고창 대신 상태 메시지로 대체)
        document.getElementById('empOvertimeHistoryModal').style.display = 'none';
        
        const statusEl = document.getElementById('overtimeStatus');
        if (statusEl) {
            statusEl.innerHTML = '<span style="color: var(--success-color); font-weight: bold;">상세 보정 내역이 성공적으로 적용되었습니다.</span>';
            setTimeout(() => {
                if (statusEl.innerText.includes('성공적으로 적용')) {
                    statusEl.innerHTML = '데이터 분석이 완료되었습니다. 각 항목을 확인해주세요.';
                }
            }, 3000);
        }
    },

    restoreCorrections() {
        if (!this.backupCorrections || Object.keys(this.backupCorrections).length === 0) {
            window.showCustomAlert('복구할 이전 보정 내역이 없습니다.');
            return;
        }

        let restoreCount = 0;
        for (const empId in this.backupCorrections) {
            const empBackup = this.backupCorrections[empId];
            if (!empBackup) continue;

            if (!this.manualCorrections[empId]) {
                this.manualCorrections[empId] = {};
            }

            for (const dateStr in empBackup) {
                this.manualCorrections[empId][dateStr] = empBackup[dateStr];
                restoreCount++;
            }
        }

        if (restoreCount > 0) {
            this.tempCorrections = JSON.parse(JSON.stringify(this.manualCorrections || {}));
            
            const rows = document.querySelectorAll('#overtimeResultTable tbody tr');
            rows.forEach(row => {
                const idNumber = row.dataset.employeeId;
                let totalCorrection = 0;
                const corrections = this.manualCorrections[idNumber];
                if (corrections) {
                    totalCorrection = Object.values(corrections).reduce((acc, val) => {
                        return acc + (typeof val === 'object' ? (val.diff || 0) : val);
                    }, 0);
                }
                row.dataset.correctionMinutes = totalCorrection;
                this.recalculateRow(row);
            });

            window.showCustomAlert(`이전 상세 보정 내역 ${restoreCount}건을 성공적으로 복구하여 재적용했습니다.`);
        } else {
            window.showCustomAlert('복구된 보정 내역이 없습니다.');
        }
    },

    /**
     * 특정 직원의 월별 초과근무 상세 내역을 필터링하여 보정 팝업으로 띄웁니다.
     */
    showEmployeeHistory(idNumber, name) {
        this.currentHistoryId = idNumber;
        this.tempCorrections = JSON.parse(JSON.stringify(this.manualCorrections || {}));

        const COL = {
            DATE: 2, HOLIDAY: 10, CLOCK_IN: 17, CLOCK_OUT: 18,
            TOTAL_MIN: 19, DED_MIN: 20, PAYABLE_MIN: 21, ID: 5
        };
        const records = [];

        if (!this.transformedData) {
            window.showCustomAlert('먼저 초과근무 파일을 분석해주세요.');
            return;
        }

        for (let i = 1; i < this.transformedData.length; i++) {
            const row = this.transformedData[i];
            if (row[COL.ID] === idNumber) records.push(row);
        }

        if (records.length === 0) {
            window.showCustomAlert('해당 직원의 이번 달 초과근무 내역이 없습니다.');
            return;
        }

        records.sort((a, b) => {
            const d1 = window.AppUtils.toJsDate(a[COL.DATE]);
            const d2 = window.AppUtils.toJsDate(b[COL.DATE]);
            return (d1 || 0) - (d2 || 0);
        });

        // [FIX] 항목 다중 선택을 위한 체크박스 열 추가
        let html = `
            <table class="data-table" style="font-size: 1.1em;">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="chkHistoryAll" style="cursor: pointer;" title="전체 선택"></th>
                        <th>근무일자</th>
                        <th>휴일여부</th>
                        <th>출근시간</th>
                        <th>퇴근시간</th>
                        <th>총초과</th>
                        <th>제외</th>
                        <th>수당</th>
                        <th>관리(보정)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let sumTotal = 0, sumDed = 0, sumPayable = 0;

        records.forEach(r => {
            const workDateObj = window.AppUtils.toJsDate(r[COL.DATE]);
            const date = this.formatDateWithDay(workDateObj);
            const holiday = String(r[COL.HOLIDAY] || '').trim();
            const inTime = window.AppUtils.formatTime(window.AppUtils.toJsDate(r[COL.CLOCK_IN]));
            const outTime = window.AppUtils.formatTime(window.AppUtils.toJsDate(r[COL.CLOCK_OUT]));
            const total = parseInt(r[COL.TOTAL_MIN]) || 0;
            
            const origPayable = r.dutyPayable !== undefined ? r.dutyPayable : (parseInt(r[COL.PAYABLE_MIN]) || 0);
            const rawExcelPayable = parseInt(r[COL.PAYABLE_MIN]) || 0;
            const dutyReason = r.dutyReason || '';

            const dateStr = window.AppUtils.formatDate(workDateObj);
            let overlapTripText = '';
            let hasOverlapTrip = false;
            
            if (window.LocalTrip && window.LocalTrip.originalRecords) {
                const hasLocal = window.LocalTrip.originalRecords.some(lt => {
                    if (lt.id !== idNumber || lt.excludeAllowance) return false;
                    return lt.startDate === dateStr || lt.endDate === dateStr;
                });
                if (hasLocal) {
                    overlapTripText += ' [관내출장]';
                    hasOverlapTrip = true;
                }
            }
            
            if (window.OutTrip && window.OutTrip.records) {
                const hasOut = window.OutTrip.records.some(ot => {
                    if (ot.name !== name) return false;
                    return dateStr >= ot.startDate && dateStr <= ot.endDate;
                });
                if (hasOut) {
                    overlapTripText += ' [관외출장]';
                    hasOverlapTrip = true;
                }
            }

            let tripHtml = '';
            if (hasOverlapTrip) {
                const titleMsg = `[⚠️ 출장-초과근무 병급 주의]\\n이 날짜에 ${overlapTripText.trim()} 내역이 있습니다.\\n출장여비 지급과 시간외근무수당 병급은 같은 "날"이 아닌 같은 "시간"에 중복되는지가 기준입니다.\\n\\n1. 출장 시간과 초과근무 시간이 서로 겹치지 않는 경우(예: 낮 동안 관내출장 후 저녁에 복귀하여 시간외근무 수행)에는 병급(이중 수령)이 전적으로 가능합니다.\\n2. 만약 출장 시간(여비 지급 대상 시간) 중에 초과근무를 수행한 시간(같은 시간 중복)이 있다면 그 겹치는 시간에 대해서는 병급이 불가능합니다.\\n\\n서무 담당자께서는 출장 시간과 초과근무 시간의 실제 중복(중첩) 여부를 수기로 확인해 주시기 바랍니다.`;
                const safeTitleMsg = titleMsg.replace(/\\n/g, '\n').replace(/"/g, '&quot;');
                const alertMsg = titleMsg.replace(/'/g, "\\'");
                tripHtml = `<br><span style="color: var(--danger-color); font-weight: bold; font-size: 0.8em; cursor: help; border-bottom: 1px dashed var(--danger-color);" title="${safeTitleMsg}" onclick="window.showCustomAlert('${alertMsg}')">⚠️ 출장병급주의${overlapTripText}</span>`;
            }

            // 중복 판별을 위한 변수 선언
            let isOver4 = total > 240;
            let isFamilyDay = false;

            if (holiday === '평일' && workDateObj) {
                const dayOfWeek = workDateObj.getDay();
                if (dayOfWeek === 3 || dayOfWeek === 5) { // 수(3), 금(5)
                    const clockIn = window.AppUtils.toJsDate(r[COL.CLOCK_IN]);
                    const clockOut = window.AppUtils.toJsDate(r[COL.CLOCK_OUT]);
                    if (clockIn && clockOut) {
                        const isEarlyStart = clockIn.getHours() < 8;
                        const isLateFinish = clockOut.getHours() >= 19;
                        if (!isEarlyStart || isLateFinish) {
                            isFamilyDay = true;
                        }
                    }
                }
            }

            // 행 배경색 적용
            let rowStyle = '';
            if (isOver4 && isFamilyDay) {
                rowStyle = 'background: linear-gradient(90deg, #fffacd 50%, #e6e6fa 50%);';
            } else if (isFamilyDay) {
                rowStyle = 'background-color: #fffacd;';
            } else if (isOver4) {
                rowStyle = 'background-color: #e6e6fa;';
            }
            
            let dutyHtml = '';
            if (dutyReason) {
                const titleMsg = `[당직 공제 상세]\n- 사유: ${dutyReason}\n- 수당시간 삭감: ${this.minutesToHHMM(rawExcelPayable)} → ${this.minutesToHHMM(origPayable)}`;
                const safeTitleMsg = titleMsg.replace(/"/g, '&quot;'); // HTML 속성 깨짐 방지
                const alertMsg = `[당직 공제 상세]\\n- 사유: ${dutyReason.replace(/'/g, "\\'")}\\n- 수당시간 삭감: ${this.minutesToHHMM(rawExcelPayable)} → ${this.minutesToHHMM(origPayable)}`;
                dutyHtml = `<br><span style="color: var(--primary-dark); font-weight: bold; font-size: 0.8em; cursor: pointer; border-bottom: 1px dashed var(--primary-dark);" title="${safeTitleMsg}" onclick="window.showCustomAlert('${alertMsg}')">[당직공제 내역]</span>`;
            }

            // [FIX] tempCorrections 값이 객체일 경우 diff 추출
            const existingRaw = this.tempCorrections[idNumber]?.[date];
            const correctionDiff = (existingRaw && typeof existingRaw === 'object')
                ? (existingRaw.diff || 0)
                : (existingRaw || 0);

            const currentPayable = origPayable + correctionDiff;
            const currentDeduction = Math.max(0, total - currentPayable);

            const safeIdStr = idNumber.replace(/[^a-zA-Z0-9]/g, '');
            const safeDateStr = date.replace(/[^a-zA-Z0-9]/g, '');
            const spanId = `ded_${safeIdStr}_${safeDateStr}`;

            sumTotal += total;
            sumDed += currentDeduction;
            sumPayable += currentPayable;

            html += `
                <tr style="${rowStyle}">
                    <td><input type="checkbox" class="chk-history-row" style="cursor: pointer;"></td>
                    <td>${date}${dutyHtml}${tripHtml}</td>
                    <td>${holiday}</td>
                    <td>${inTime}</td>
                    <td>${outTime}</td>
                    <td>${this.minutesToHHMM(total)}</td>
                    <td style="color:var(--danger-color); font-weight:bold;" id="${spanId}">${this.minutesToHHMM(currentDeduction)}</td>
                    <td>
                        <input type="text" class="overtime-input history-payable-input"
                            data-id="${idNumber}"
                            data-date="${date}"
                            data-safe-id="${spanId}"
                            data-orig="${origPayable}"
                            data-orig-total="${total}"
                            data-current-total="${total}"
                            value="${this.minutesToHHMM(currentPayable)}"
                            style="width: 55px; font-weight: bold; padding: 2px; text-align: center;">
                    </td>
                    <td>
                        <button class="btn-exclude-history" type="button"
                            class="danger-btn" style="padding:2px 5px; font-size:0.8em; border-radius:3px; cursor:pointer;">
                            제외
                        </button>
                    </td>
                </tr>
            `;
        });

        // [FIX] 체크박스 추가로 인한 colspan 증가
        html += `
            </tbody>
            <tfoot>
                <tr style="background-color: var(--bg-light); font-weight: bold;">
                    <td colspan="5">합계</td>
                    <td id="historySumTot">${this.minutesToHHMM(sumTotal)}</td>
                    <td id="historySumDed">${this.minutesToHHMM(sumDed)}</td>
                    <td style="color:var(--danger-color);" id="historySumPay">${this.minutesToHHMM(sumPayable)}</td>
                    <td></td>
                </tr>
            </tfoot>
            </table>
        `;

        document.getElementById('empOvertimeHistoryTitle').textContent = `[${name}] 초과근무 상세 내역`;
        document.getElementById('empOvertimeHistoryTable').innerHTML = html;
        document.getElementById('empOvertimeHistoryModal').style.display = 'flex';

        // [FIX] 동기적 호출을 통해 입력 먹통(lock-up) 현상 완전 해결
        this._bindHistoryModalEvents(idNumber);
    },

    /**
     * 상세 보정 모달 내 이벤트 바인딩을 전담합니다.
     */
    _bindHistoryModalEvents(idNumber) {
        // [FIX] 전체 선택 체크박스 이벤트 바인딩
        const chkAll = document.getElementById('chkHistoryAll');
        if (chkAll) {
            chkAll.addEventListener('change', (e) => {
                document.querySelectorAll('.chk-history-row').forEach(chk => {
                    chk.checked = e.target.checked;
                });
            });
        }

        // [UX 고도화] 보정 모달 내 입력칸 방향키 및 엔터 이동 지원
        const historyTable = document.getElementById('empOvertimeHistoryTable');
        if (historyTable) {
            historyTable.addEventListener('keydown', (e) => {
                if (!e.target.classList.contains('history-payable-input')) return;
                const currentTr = e.target.closest('tr');
                let targetInput = null;
                
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault(); // Enter 폼 제출 방지
                    targetInput = currentTr.nextElementSibling?.querySelector('.history-payable-input');
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    targetInput = currentTr.previousElementSibling?.querySelector('.history-payable-input');
                }
                
                if (targetInput) {
                    targetInput.focus();
                    targetInput.select();
                }
            });
        }

        document.querySelectorAll('.history-payable-input').forEach(input => {
            // [FIX] 클릭/포커스 시 텍스트 전체 선택 (레이스 컨디션 및 입력 먹통 방지)
            input.addEventListener('focus', function () {
                setTimeout(() => this.select(), 10);
            });

            input.addEventListener('change', (e) => {
                try {
                    // [UX 고도화] 콜론 없이 숫자만 입력 시 자동 포맷팅 (예: 0230 -> 02:30, 230 -> 02:30)
                    let val = e.target.value.replace(/[^0-9]/g, '');
                    if (val.length === 3) val = '0' + val; // 3자리 입력 대비
                    if (val.length >= 4) {
                        e.target.value = val.substring(0, 2) + ':' + val.substring(2, 4);
                    }

                    const id = e.target.dataset.id;
                    const dt = e.target.dataset.date;
                    const spanId = e.target.dataset.safeId;
                    const orig = parseInt(e.target.dataset.orig) || 0;
                    // [FIX] 올바른 속성명 사용 (data-current-total → dataset.currentTotal)
                    const currentTot = parseInt(e.target.dataset.currentTotal) || 0;

                    const currentValMin = this.HHMMtoMinutes(e.target.value);
                    const diff = currentValMin - orig;

                    if (!id) return;

                    if (typeof this.tempCorrections[id] !== 'object' || this.tempCorrections[id] === null) {
                        this.tempCorrections[id] = {};
                    }

                    if (diff !== 0) {
                        this.tempCorrections[id][dt] = { diff };
                    } else {
                        delete this.tempCorrections[id][dt];
                    }

                    // [FIX] dedSpan null 방어
                    const dedSpan = document.getElementById(spanId);
                    if (dedSpan) {
                        dedSpan.textContent = this.minutesToHHMM(Math.max(0, currentTot - currentValMin));
                    }

                    // 하단 합계 실시간 업데이트
                    let sTot = 0, sDed = 0, sPay = 0;
                    document.querySelectorAll('.history-payable-input').forEach(inp => {
                        const pMin = this.HHMMtoMinutes(inp.value);
                        const tMin = parseInt(inp.dataset.currentTotal) || 0;
                        sTot += tMin;
                        sPay += pMin;
                        sDed += Math.max(0, tMin - pMin);
                    });

                    // [FIX] null 방어 (ID 부재 시 오류 방지)
                    const elTot = document.getElementById('historySumTot');
                    const elDed = document.getElementById('historySumDed');
                    const elPay = document.getElementById('historySumPay');
                    if (elTot) elTot.textContent = this.minutesToHHMM(sTot);
                    if (elDed) elDed.textContent = this.minutesToHHMM(sDed);
                    if (elPay) elPay.textContent = this.minutesToHHMM(sPay);

                } catch (err) {
                    console.error('history change error:', err);
                }
            });
        });

        document.querySelectorAll('.btn-exclude-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tr = e.target.closest('tr');
                if (!tr) return;
                const input = tr.querySelector('.history-payable-input');
                if (!input) return;
                input.value = '00:00';
                input.dispatchEvent(new Event('change'));
            });
        });
    },

    /**
     * HH:MM 형식의 문자열을 분으로 변환합니다.
     */
    HHMMtoMinutes(timeStr) {
        if (!timeStr) return 0;
        if (!timeStr.includes(':')) {
            const num = parseInt(timeStr, 10);
            if (isNaN(num)) return 0;
            if (timeStr.length <= 2) return num * 60;
            if (timeStr.length === 3 || timeStr.length === 4) {
                const h = Math.floor(num / 100);
                const m = num % 100;
                return (h * 60) + m;
            }
            return 0;
        }
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        return (hours * 60) + minutes;
    },

    /**
     * 분(minutes)을 [hh]:mm 형식의 문자열로 변환합니다.
     */
    minutesToHHMM(mins) {
        if (isNaN(mins) || mins < 0) return '00:00';
        const hours = Math.floor(mins / 60);
        const minutes = mins % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    },

    /**
     * Date 객체를 'YYYY-MM-DD(요일)' 형식의 문자열로 변환합니다.
     */
    formatDateWithDay(date) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
        return `${year}-${month}-${day}(${dayOfWeek})`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnProcessOvertime');
    if (btn) {
        btn.addEventListener('click', () => {
            window.Overtime.processOvertimeFile();
        });
    }

    const btnRestoreOvertime = document.getElementById('btnRestoreOvertimeCorrections');
    if (btnRestoreOvertime) {
        btnRestoreOvertime.addEventListener('click', () => {
            window.Overtime.restoreCorrections();
        });
    }

    const tableContainer = document.getElementById('overtimeResultTable');

    // [UX 고도화] 비상근무 시간 등 메인 테이블 입력 필드 자동 포맷팅 및 재계산 (input 대신 change로 변경하여 포맷팅 지원)
    tableContainer.addEventListener('change', (event) => {
        if (event.target.matches('.emergency-time')) {
            let val = event.target.value.replace(/[^0-9]/g, '');
            if (val.length === 3) val = '0' + val;
            if (val.length >= 4) {
                event.target.value = val.substring(0, 2) + ':' + val.substring(2, 4);
            }
            const row = event.target.closest('tr');
            if (row) window.Overtime.recalculateRow(row);
        }
    });

    // 체크박스 클릭(상한, 예외)에 즉각 반응하기 위한 change 이벤트 추가
    tableContainer.addEventListener('change', (event) => {
        if (event.target.matches('.overtime-input[type="checkbox"]')) {
            const row = event.target.closest('tr');
            if (row) window.Overtime.recalculateRow(row);
        }
    });

    // [상세/보정] 버튼 클릭 위임
    tableContainer.addEventListener('click', (event) => {
        if (event.target.matches('.btn-detail')) {
            const id = event.target.dataset.id;
            const name = event.target.dataset.name;
            window.Overtime.showEmployeeHistory(id, name);
        }
    });

    const btnCloseHistory = document.getElementById('btnCloseHistory');
    if (btnCloseHistory) {
        btnCloseHistory.addEventListener('click', () => {
            document.getElementById('empOvertimeHistoryModal').style.display = 'none';
        });
    }

    const btnSaveHistoryCorrections = document.getElementById('btnSaveHistoryCorrections');
    if (btnSaveHistoryCorrections) {
        btnSaveHistoryCorrections.addEventListener('click', () => {
            window.Overtime.saveHistoryCorrections();
        });
    }

    // [FIX] 가족사랑의 날 및 롤백 기능 이벤트 바인딩 추가
    const applyFamilyDay = (inputs) => {
        inputs.forEach(input => {
            input.value = '00:00';
            input.dispatchEvent(new Event('change'));
        });
    };

    const rollback = (inputs) => {
        inputs.forEach(input => {
            const orig = parseInt(input.dataset.orig) || 0;
            input.value = window.Overtime.minutesToHHMM(orig);
            input.dispatchEvent(new Event('change'));
        });
    };

    const btnFamilySelected = document.getElementById('btnApplyFamilyDaySelected');
    if (btnFamilySelected) {
        btnFamilySelected.addEventListener('click', () => {
            const inputs = [];
            document.querySelectorAll('.chk-history-row:checked').forEach(chk => {
                const tr = chk.closest('tr');
                const dateText = tr.cells[1].textContent;
                const holidayText = tr.cells[2].textContent;
                
                if (holidayText === '평일' && (dateText.includes('(수)') || dateText.includes('(금)'))) {
                    const input = tr.querySelector('.history-payable-input');
                    if (input) inputs.push(input);
                }
            });
            if (inputs.length === 0) {
                window.showCustomAlert('적용 가능한 평일 수요일/금요일 항목이 선택되지 않았습니다.');
                return;
            }
            applyFamilyDay(inputs);
        });
    }

    const btnFamilyAll = document.getElementById('btnApplyFamilyDayAll');
    if (btnFamilyAll) {
        btnFamilyAll.addEventListener('click', async () => {
            const confirmed = await window.showCustomConfirm('전체 평일 수요일/금요일 내역을 가족사랑의 날(0시간)로 적용하시겠습니까?');
            if (confirmed) {
                const inputs = [];
                document.querySelectorAll('.history-payable-input').forEach(input => {
                    const tr = input.closest('tr');
                    const dateText = tr.cells[1].textContent;
                    const holidayText = tr.cells[2].textContent;
                    
                    if (holidayText === '평일' && (dateText.includes('(수)') || dateText.includes('(금)'))) {
                        inputs.push(input);
                    }
                });
                
                if (inputs.length === 0) {
                    window.showCustomAlert('적용할 평일 수요일/금요일 내역이 없습니다.');
                    return;
                }
                applyFamilyDay(inputs);
            }
        });
    }

    const btnRollbackSelected = document.getElementById('btnRollbackSelected');
    if (btnRollbackSelected) {
        btnRollbackSelected.addEventListener('click', () => {
            const inputs = [];
            document.querySelectorAll('.chk-history-row:checked').forEach(chk => {
                const input = chk.closest('tr').querySelector('.history-payable-input');
                if (input) inputs.push(input);
            });
            if (inputs.length === 0) {
                window.showCustomAlert('롤백할 항목을 먼저 체크해주세요.');
                return;
            }
            rollback(inputs);
        });
    }

    const btnRollbackAll = document.getElementById('btnRollbackAll');
    if (btnRollbackAll) {
        btnRollbackAll.addEventListener('click', async () => {
            const confirmed = await window.showCustomConfirm('전체 내역을 원본 수당시간으로 되돌리시겠습니까?');
            if (confirmed) {
                const inputs = Array.from(document.querySelectorAll('.history-payable-input'));
                rollback(inputs);
            }
        });
    }

    // 지급내역서 인쇄 관련 이벤트
    const btnPrint = document.getElementById('btnPrintStatement');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            document.getElementById('printModal').style.display = 'flex';
            const now = new Date();
            document.getElementById('printTargetMonth').value =
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            document.getElementById('printCreationDate').value =
                now.toISOString().split('T')[0];
        });
    }

    const btnCancelPrint = document.getElementById('btnCancelPrint');
    if (btnCancelPrint) {
        btnCancelPrint.addEventListener('click', () => {
            document.getElementById('printModal').style.display = 'none';
        });
    }

    const btnConfirmPrint = document.getElementById('btnConfirmPrint');
    if (btnConfirmPrint) {
        btnConfirmPrint.addEventListener('click', async () => {
            const targetMonthStr = document.getElementById('printTargetMonth').value;
            const creationDateStr = document.getElementById('printCreationDate').value;

            if (!targetMonthStr || !creationDateStr) {
                window.showCustomAlert('날짜를 모두 입력해주세요.');
                return;
            }

            document.getElementById('printModal').style.display = 'none';

            const [targetY, targetM] = targetMonthStr.split('-');
            const lastDay = new Date(targetY, targetM, 0).getDate();
            const printTitleMonth = `${targetY}년 ${targetM}월`;
            const printPeriod = `${targetY}. ${parseInt(targetM)}. 1. ~ ${parseInt(targetM)}. ${lastDay}.`;

            const [createY, createM, createD] = creationDateStr.split('-');
            const printDate = `${createY}. ${parseInt(createM)}. ${parseInt(createD)}.`;

            const printTeamLeader = DB.employees.find(emp => emp.role === '주무계장(사무장)')?.name || '공란';
            const printClerk = DB.employees.find(emp => emp.role === '서무')?.name || '공란';

            const sourceTable = document.getElementById('overtimeResultTable').querySelector('table');
            if (!sourceTable) {
                window.showCustomAlert('출력할 데이터가 없습니다.');
                return;
            }

            const clonedTable = sourceTable.cloneNode(true);
            clonedTable.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
                input.parentNode.replaceChild(document.createTextNode(input.value), input);
            });
            clonedTable.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                // [FIX] 체크박스 자체를 숨기기
                cb.style.display = 'none';
            });

            // [FIX] 인쇄/PDF 생성 시 툴팁 HTML 노이즈 제거 (순수 텍스트만 남김)
            clonedTable.querySelectorAll('.tooltip').forEach(tooltip => {
                const trigger = tooltip.querySelector('.tooltip-trigger');
                if (trigger) {
                    const textNode = document.createTextNode(trigger.textContent);
                    tooltip.parentNode.replaceChild(textNode, tooltip);
                }
            });

            // 인쇄 시 불필요한 열 제거 (예외, 공문, 비상근무 조정 버튼)
            const headerRow = clonedTable.querySelector('thead tr');
            if (headerRow) {
                if (headerRow.cells.length > 11) headerRow.deleteCell(11); // 예외
                if (headerRow.cells.length > 10) headerRow.deleteCell(10); // 공문
                if (headerRow.cells.length > 9) headerRow.deleteCell(9); // 초과근무시간 (캡핑 텍스트 제거)
                if (headerRow.cells.length > 8)  headerRow.deleteCell(8);  // 조정(버튼)
            }
            clonedTable.querySelectorAll('tbody tr').forEach(row => {
                if (row.cells.length > 11) row.deleteCell(11);
                if (row.cells.length > 10) row.deleteCell(10);
                if (row.cells.length > 8)  row.deleteCell(8);
            });

            const printContentHtml = `
                <style>@page { size: A4 landscape; margin: 10mm; }</style>
                <div style="padding: 10mm;">
                    <h2 style="text-align: center; margin-bottom: 20px; font-size: 16pt;">
                        초과근무수당 지급내역서(${printTitleMonth})
                    </h2>
                    <div style="float: right; margin-bottom: 20px;">
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
                    <p style="font-weight: bold; font-size: 10pt;">- 초과근무기간: ${printPeriod}</p>
                    <p style="font-weight: bold; font-size: 10pt;">- 지급내역</p>
                    <div class="print-table-container">${clonedTable.outerHTML}</div>
                    <p style="text-align: center; margin-top: 30px; font-size: 11pt;">상기와 같이 지급하였음을 확인함</p>
                    <p style="text-align: center; margin-top: 20px; font-size: 11pt;">${printDate}</p>
                </div>
            `;

            if (window.electronAPI && window.electronAPI.openPrintWindow) {
                await window.electronAPI.openPrintWindow(printContentHtml, { landscape: true });
            } else {
                window.showCustomAlert('Electron API를 사용할 수 없습니다. 개발자 도구를 확인해주세요.');
            }
        });
    }

    // 엑셀 다운로드 이벤트
    const btnDownloadOvertime = document.getElementById('btnDownloadOvertime');
    if (btnDownloadOvertime) {
        btnDownloadOvertime.addEventListener('click', () => {
            const table = document.querySelector('#overtimeResultTable table');
            if (!table) {
                window.showCustomAlert('출력할 데이터가 없습니다.');
                return;
            }
            const aoa = [];
            table.querySelectorAll('tr').forEach(row => {
                const rowData = [];
                row.querySelectorAll('th, td').forEach((cell) => {
                    const input = cell.querySelector('input[type="text"], input[type="number"]');
                    if (input) {
                        rowData.push(input.value);
                    } else if (cell.querySelector('.btn-detail')) {
                        rowData.push(''); // 상세/보정 버튼은 엑셀에 포함하지 않음
                    } else {
                        // [FIX] 엑셀 다운로드 시 툴팁 숨김 텍스트가 함께 추출되는 현상 방지
                        const trigger = cell.querySelector('.tooltip-trigger');
                        if (trigger) {
                            rowData.push(trigger.innerText.replace(/\n/g, ' ').trim());
                        } else {
                            rowData.push(cell.innerText.replace(/\n/g, ' ').trim());
                        }
                    }
                });
                aoa.push(rowData);
            });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), '초과근무수당');
            
            window.showLoadingSpinner('초과근무수당 엑셀 파일을 생성하는 중입니다...');
            setTimeout(() => {
                try {
                    const now = new Date();
                    const datePrefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + " ";
                    XLSX.writeFile(wb, `${datePrefix}초과근무수당_산출결과.xlsx`);
                    window.hideLoadingSpinner();
                    window.showCustomAlert("초과근무수당 다운로드가 완료되었습니다.");
                } catch (error) {
                    window.hideLoadingSpinner();
                    window.showCustomAlert(`다운로드 중 오류가 발생했습니다: ${error.message}`);
                }
            }, 500);
        });
    }

    // 파일명 표시 설정
    if (window.AppUtils) window.AppUtils.setupFileNameDisplay('overtimeFiles', 'overtimeFilesName');
});