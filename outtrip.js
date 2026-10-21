// 전역 OutTrip 객체 선언
window.OutTrip = {
    records: [], 

    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        if (parts.length < 2) return 0;
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    },

    calculateAllowance(data) {
        const settings = (typeof DB !== 'undefined' && DB.settings && DB.settings.outTrip) ? DB.settings.outTrip : {
            dailyAllowance: 25000,
            mealAllowance: 25000,
            lodgingSeoul: 100000,
            lodgingMetro: 80000,
            lodgingOther: 70000
        };
        
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const diffTime = endDate - startDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays <= 0) {
            throw new Error('종료일이 시작일보다 빠를 수 없습니다.');
        }

        let dailyTotal = settings.dailyAllowance * diffDays;
        if (data.isVehicleUsed === 'Y') {
            dailyTotal = Math.floor(dailyTotal / 2);
        }

        let mealTotal = settings.mealAllowance * diffDays;
        const oneMealPrice = Math.floor(settings.mealAllowance / 3 / 10) * 10;
        const useTimeMealDeduction = settings.useTimeMealDeduction !== false;
        
        if (useTimeMealDeduction) {
            const startMin = this.timeToMinutes(data.startTime);
            const endMin = this.timeToMinutes(data.endTime);
            const noonMin = 12 * 60;
            const eveningMin = 18 * 60;

            if (startMin >= noonMin) {
                mealTotal -= oneMealPrice;
            }
            if (endMin < eveningMin) {
                mealTotal -= oneMealPrice;
            }
        }

        const providedMeals = parseInt(data.providedMeals) || 0;
        if (providedMeals > 0) {
            mealTotal -= (providedMeals * oneMealPrice);
        }
        
        mealTotal = Math.max(0, mealTotal);

        let lodgingMaxPerDay = settings.lodgingOther;
        if (data.destType === '서울') lodgingMaxPerDay = settings.lodgingSeoul;
        else if (data.destType === '광역시') lodgingMaxPerDay = settings.lodgingMetro;

        const maxLodgingTotal = lodgingMaxPerDay * data.lodgingDays;
        const lodgingAllowance = Math.min(data.lodgingCost, maxLodgingTotal);

        const transportAllowance = data.transportCost;
        const totalAllowance = dailyTotal + mealTotal + lodgingAllowance + transportAllowance;

        return {
            diffDays,
            dailyTotal,
            mealTotal,
            lodgingAllowance,
            maxLodgingTotal,
            transportAllowance,
            totalAllowance
        };
    },

    async addRecord() {
        try {
            const name = document.getElementById('otInputName')?.value.trim();
            const dest = document.getElementById('otInputDest')?.value.trim();
            const destType = document.getElementById('otInputDestType')?.value;
            const startDate = document.getElementById('otInputStartDate')?.value;
            const startTime = document.getElementById('otInputStartTime')?.value;
            const endDate = document.getElementById('otInputEndDate')?.value;
            const endTime = document.getElementById('otInputEndTime')?.value;
            const isVehicleUsed = document.getElementById('otInputVehicle')?.value;
            const lodgingDays = parseInt(document.getElementById('otInputLodgingDays')?.value) || 0;
            const lodgingCost = parseInt(document.getElementById('otInputLodgingCost')?.value) || 0;
            const transportCost = parseInt(document.getElementById('otInputTransportCost')?.value) || 0;
            const providedMeals = parseInt(document.getElementById('otInputProvidedMeals')?.value) || 0;

            if (!name || !dest || !startDate || !startTime || !endDate || !endTime) {
                window.showCustomAlert('성명, 출장지, 시작/종료 일시는 필수 입력 항목입니다.');
                return;
            }

            const startD = new Date(startDate);
            const endD = new Date(endDate);
            const diffDays = Math.floor((endD - startD) / (1000 * 60 * 60 * 24));

            if (lodgingDays > diffDays + 5) {
                window.showCustomAlert(`숙박일수(${lodgingDays}박)가 출장 기간에 비해 너무 큽니다.\n'숙박비 실비청구(원)' 칸에 입력할 금액을 숙박일수에 잘못 입력하셨는지 확인해 주세요.`);
                return;
            }

            const data = {
                name, dest, destType, startDate, startTime, endDate, endTime,
                isVehicleUsed, lodgingDays, lodgingCost, transportCost, providedMeals
            };

            const result = this.calculateAllowance(data);
            const record = { ...data, ...result, id: Date.now() };

            this.records.push(record);
            this.renderTables();
            
            document.getElementById('otInputName').value = '';
            document.getElementById('otInputDest').value = '';
            document.getElementById('otInputLodgingCost').value = 0;
            document.getElementById('otInputTransportCost').value = 0;
            if (document.getElementById('otInputProvidedMeals')) {
                document.getElementById('otInputProvidedMeals').value = 0;
            }
            document.getElementById('otInputName').focus();

        } catch (error) {
            window.showCustomAlert(error.message);
        }
    },

    removeRecord(id) {
        this.records = this.records.filter(r => r.id !== id);
        this.renderTables();
    },

    async clearAll() {
        const confirmed = await window.showCustomConfirm('입력된 모든 관외출장 내역을 삭제하시겠습니까?');
        if (confirmed) {
            this.records = [];
            this.renderTables();
        }
    },

    autoCalcLodgingDays() {
        const start = document.getElementById('otInputStartDate')?.value;
        const end = document.getElementById('otInputEndDate')?.value;
        if (start && end) {
            const d1 = new Date(start);
            const d2 = new Date(end);
            const diffDays = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
            const lodgingDaysInput = document.getElementById('otInputLodgingDays');
            if (lodgingDaysInput) lodgingDaysInput.value = Math.max(0, diffDays);
        }
    },

    renderTables() {
        this.renderMainTable();
        this.renderSummaryTable();

        if (window.Meal && window.Meal.mealRecords && typeof window.Meal.renderMainTable === 'function') {
            window.Meal.mealRecords.forEach(mr => {
                const dateStr = window.AppUtils.formatDate(mr.workDate);
                mr.isOutTripDouble = this.records.some(ot => {
                    if (ot.name !== mr.name) return false;
                    return dateStr >= ot.startDate && dateStr <= ot.endDate;
                });
            });
            window.Meal.renderMainTable(window.Meal.mealRecords);
        }
    },

    renderMainTable() {
        const container = document.getElementById('outTripResultTable');
        if (!container) return;

        if (this.records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚙</div>
                    <div class="empty-state-title">입력된 관외출장 내역이 없습니다</div>
                    <div class="empty-state-desc">양식에 출장 정보를 입력하고 <strong>'추가'</strong> 버튼을 눌러주세요.</div>
                </div>
            `;
            return;
        }

        const tableHtml = `
            <h3 style="margin-top:0;">관외출장 세부 내역</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>성명</th>
                        <th>출장지 (분류)</th>
                        <th>출장기간</th>
                        <th>일수</th>
                        <th>차량</th>
                        <th>일비</th>
                        <th>식비</th>
                        <th>숙박비(실비인정)</th>
                        <th>운임비</th>
                        <th>합계</th>
                        <th>관리</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.records.map(r => {
                        const period = `${r.startDate.slice(5)} ${r.startTime} ~ ${r.endDate.slice(5)} ${r.endTime}`;
                        const vehicleStr = r.isVehicleUsed === 'Y' ? '이용(감액)' : '미이용';
                        
                        let lodgingStr = '-';
                        if (r.lodgingDays > 0) {
                            const overColor = r.lodgingCost > r.maxLodgingTotal ? 'color:var(--danger-color);font-weight:bold;' : 'color:var(--text-muted);';
                            lodgingStr = `${r.lodgingAllowance.toLocaleString()}원<br><span style="font-size:0.8em;${overColor}">(상한: ${r.maxLodgingTotal.toLocaleString()}원)</span>`;
                        }

                        let isMealDouble = false;
                        if (window.Meal && window.Meal.mealRecords) {
                            isMealDouble = window.Meal.mealRecords.some(mr => {
                                if (mr.name !== r.name) return false;
                                const mrDateStr = window.AppUtils.formatDate(mr.workDate);
                                return mrDateStr >= r.startDate && mrDateStr <= r.endDate;
                            });
                        }

                        let mealDetailStr = '';
                        if (r.providedMeals > 0) {
                            mealDetailStr = `<br><span style="font-size:0.8em;color:var(--danger-color);font-weight:bold;">(제공 ${r.providedMeals}식 감액)</span>`;
                        }

                        return `
                        <tr style="${isMealDouble ? 'background-color: #fff9db;' : ''}">
                            <td>${r.name}</td>
                            <td>${r.dest}<br><span style="font-size:0.8em;color:#7f8c8d;">(${r.destType})</span></td>
                            <td>${period}</td>
                            <td>${r.diffDays}일</td>
                            <td>${vehicleStr}</td>
                            <td style="text-align:right;">${r.dailyTotal.toLocaleString()}원</td>
                            <td style="text-align:right;">
                                ${r.mealTotal.toLocaleString()}원${mealDetailStr}
                                ${isMealDouble ? `
                                    <span style="cursor: help; color: var(--warning-color); font-weight: bold; margin-left: 3px;" 
                                          title="[⚠️ 수기확인 필요] 동일 출장 기간에 초과근무 특근매식비 내역이 감지되었습니다. 출장비 식비와 특근매식비 중복 수령이 아닌지 수동으로 확인해 주세요.">⚠️</span>
                                ` : ''}
                            </td>
                            <td style="text-align:right;">${lodgingStr}</td>
                            <td style="text-align:right;">${r.transportAllowance > 0 ? r.transportAllowance.toLocaleString() + '원' : '-'}</td>
                            <td style="text-align:right; font-weight:bold; color:var(--danger-color);">${r.totalAllowance.toLocaleString()}원</td>
                            <td><button onclick="window.OutTrip.removeRecord(${r.id})" class="danger-btn" style="padding:4px 8px; font-size:0.8em; border-radius:4px; cursor:pointer;">삭제</button></td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = tableHtml;
    },

    renderSummaryTable() {
        const container = document.getElementById('outTripSummaryTable');
        if (!container) return;

        if (this.records.length === 0) {
            container.innerHTML = '';
            return;
        }

        const summaryMap = new Map();
        let totalSum = 0;

        this.records.forEach(r => {
            if (!summaryMap.has(r.name)) {
                summaryMap.set(r.name, 0);
            }
            summaryMap.set(r.name, summaryMap.get(r.name) + r.totalAllowance);
            totalSum += r.totalAllowance;
        });

        const summaryArr = Array.from(summaryMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        const tableHtml = `
            <h3 style="margin-top:0;">개인별 관외출장 합계</h3>
            <table class="data-table" style="width: auto;">
                <thead>
                    <tr><th>성명</th><th>지급액 합계</th></tr>
                </thead>
                <tbody>
                    ${summaryArr.map(([name, amount]) => `<tr><td>${name}</td><td style="text-align:right;font-weight:bold;">${amount.toLocaleString()}원</td></tr>`).join('')}
                </tbody>
                <tfoot><tr><td style="text-align:center; font-weight:bold;">총 지급액 합계</td><td style="text-align:right; font-weight:bold; color: var(--danger-color);">${totalSum.toLocaleString()}원</td></tr></tfoot>
            </table>
        `;
        container.innerHTML = tableHtml;
    },

    async printDocument() {
        const monthStr = document.getElementById('printOtMonth')?.value;
        const dateStr = document.getElementById('printOtDate')?.value;
        if (!monthStr || !dateStr) {
            window.showCustomAlert('출장 연월과 작성 일자를 입력해주세요.');
            return;
        }

        if (this.records.length === 0) {
            window.showCustomAlert('출력할 관외출장 데이터가 없습니다.');
            return;
        }

        const [y, m] = monthStr.split('-');
        const [cy, cm, cd] = dateStr.split('-');
        const titleMonth = `${parseInt(m)}월`;
        const printDate = `${cy}. ${parseInt(cm)}. ${parseInt(cd)}.`;

        const printTeamLeader = typeof DB !== 'undefined' ? (DB.employees.find(emp => emp.role === '주무계장(사무장)')?.name || '공란') : '';
        const printClerk = typeof DB !== 'undefined' ? (DB.employees.find(emp => emp.role === '서무')?.name || '공란') : '';

        const summaryMap = new Map();
        
        this.records.forEach(r => {
            if (!summaryMap.has(r.name)) {
                summaryMap.set(r.name, {
                    name: r.name,
                    diffDays: 0,
                    dailyTotal: 0,
                    mealTotal: 0,
                    lodgingAllowance: 0,
                    transportAllowance: 0,
                    totalAllowance: 0
                });
            }
            const sm = summaryMap.get(r.name);
            sm.diffDays += r.diffDays;
            sm.dailyTotal += r.dailyTotal;
            sm.mealTotal += r.mealTotal;
            sm.lodgingAllowance += r.lodgingAllowance;
            sm.transportAllowance += r.transportAllowance;
            sm.totalAllowance += r.totalAllowance;
        });

        const targetUsers = Array.from(summaryMap.values());
        
        targetUsers.forEach(u => {
            let matchedEmp = null;
            if (typeof DB !== 'undefined') {
                matchedEmp = DB.employees.find(e => e.name === u.name);
            }
            
            let finalBank = '';
            let finalAccount = '';
            if (matchedEmp) {
                finalBank = matchedEmp.bank;
                finalAccount = matchedEmp.account;
                if (matchedEmp.remarks && matchedEmp.remarks.includes('출장')) {
                    finalBank = matchedEmp.extraBank || finalBank;
                    finalAccount = matchedEmp.extraAccount || finalAccount;
                }
            }
            u.rank = matchedEmp ? matchedEmp.rank : '';
            u.idNumber = matchedEmp ? matchedEmp.idNumber : '';
            u.bank = finalBank;
            u.account = finalAccount;
        });

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

        const trs = [];
        let sumPeople = targetUsers.length;
        let sumDays = 0;
        let sumDaily = 0;
        let sumMeal = 0;
        let sumLodging = 0;
        let sumTransport = 0;
        let sumTotal = 0;

        targetUsers.forEach((user, idx) => {
            sumDays += user.diffDays;
            sumDaily += user.dailyTotal;
            sumMeal += user.mealTotal;
            sumLodging += user.lodgingAllowance;
            sumTransport += user.transportAllowance;
            sumTotal += user.totalAllowance;
            
            trs.push(`
                <tr>
                    <td>${idx + 1}</td>
                    <td>${user.rank}</td>
                    <td>${user.name}</td>
                    <td>${user.idNumber}</td>
                    <td>${user.diffDays}</td>
                    <td style="text-align:right;">${user.dailyTotal.toLocaleString()}</td>
                    <td style="text-align:right;">${user.mealTotal.toLocaleString()}</td>
                    <td style="text-align:right;">${user.lodgingAllowance.toLocaleString()}</td>
                    <td style="text-align:right;">${user.transportAllowance.toLocaleString()}</td>
                    <td style="text-align:right; font-weight:bold;">${user.totalAllowance.toLocaleString()}</td>
                    <td>${user.bank}</td>
                    <td style="text-align:left; font-size: 0.9em; padding-left: 5px;">${user.account}</td>
                </tr>
            `);
        });

        const contentHtml = `
            <style>@page { size: A4 landscape; margin: 5mm; }</style>
            <div style="padding: 5mm;">
                <h2 style="text-align: center; margin-bottom: 20px; font-size: 18pt;">${titleMonth} 관외출장여비 지급내역서</h2>
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
                            <th>일비</th>
                            <th>식비</th>
                            <th>숙박비</th>
                            <th>운임비</th>
                            <th>지급액</th>
                            <th colspan="2">은행 및 계좌번호</th>
                        </tr>
                        <tr style="background-color: var(--bg-light); font-weight:bold;">
                            <th>합계</th>
                            <th>${sumPeople}명</th>
                            <th></th>
                            <th>${sumDays}</th>
                            <th>${sumDaily.toLocaleString()}</th>
                            <th>${sumMeal.toLocaleString()}</th>
                            <th>${sumLodging.toLocaleString()}</th>
                            <th>${sumTransport.toLocaleString()}</th>
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

        const modal = document.getElementById('printOtModal');
        if (modal) modal.style.display = 'none';
        
        if (window.electronAPI && window.electronAPI.openPrintWindow) {
            await window.electronAPI.openPrintWindow(contentHtml, { landscape: true });
        } else {
            window.showCustomAlert('Electron API를 사용할 수 없습니다.');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = document.getElementById('btnOutTripAdd');
    if (btnAdd) btnAdd.addEventListener('click', () => window.OutTrip.addRecord());

    const btnClear = document.getElementById('btnOutTripClear');
    if (btnClear) btnClear.addEventListener('click', () => window.OutTrip.clearAll());

    const startDateInput = document.getElementById('otInputStartDate');
    const endDateInput = document.getElementById('otInputEndDate');
    if (startDateInput) startDateInput.addEventListener('change', () => window.OutTrip.autoCalcLodgingDays());
    if (endDateInput) endDateInput.addEventListener('change', () => window.OutTrip.autoCalcLodgingDays());

    const today = new Date().toISOString().split('T')[0];
    if (startDateInput && !startDateInput.value) startDateInput.value = today;
    if (endDateInput && !endDateInput.value) endDateInput.value = today;
    
    window.OutTrip.renderTables();

    const btnPrintOutTrip = document.getElementById('btnPrintOutTrip');
    if (btnPrintOutTrip) {
        btnPrintOutTrip.addEventListener('click', () => {
            if (window.OutTrip.records.length === 0) {
                window.showCustomAlert('출력할 관외출장 데이터가 없습니다.');
                return;
            }
            const now = new Date();
            const otMonth = document.getElementById('printOtMonth');
            const otDate = document.getElementById('printOtDate');
            if (otMonth) otMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            if (otDate) otDate.value = now.toISOString().split('T')[0];
            const modal = document.getElementById('printOtModal');
            if (modal) modal.style.display = 'flex';
        });
    }

    const btnConfirmPrintOt = document.getElementById('btnConfirmPrintOt');
    if (btnConfirmPrintOt) btnConfirmPrintOt.addEventListener('click', () => window.OutTrip.printDocument());

    const btnCancelPrintOt = document.getElementById('btnCancelPrintOt');
    if (btnCancelPrintOt) {
        btnCancelPrintOt.addEventListener('click', () => {
            const modal = document.getElementById('printOtModal');
            if (modal) modal.style.display = 'none';
        });
    }

    const btnDownloadOutTrip = document.getElementById('btnDownloadOutTrip');
    if (btnDownloadOutTrip) {
        btnDownloadOutTrip.addEventListener('click', () => {
            if (window.OutTrip.records.length === 0) {
                window.showCustomAlert('출력할 데이터가 없습니다.');
                return;
            }
            const aoa = [["성명", "출장지", "지역분류", "시작일시", "종료일시", "일수", "차량이용", "일비", "식비", "숙박일수", "숙박비실비", "숙박비인정액", "운임비", "총지급액"]];
            window.OutTrip.records.forEach(r => {
                aoa.push([
                    r.name, r.dest, r.destType, 
                    `${r.startDate} ${r.startTime}`, `${r.endDate} ${r.endTime}`, 
                    r.diffDays, r.isVehicleUsed === 'Y' ? '이용(감액)' : '미이용',
                    r.dailyTotal, r.mealTotal, r.lodgingDays, r.lodgingCost, r.lodgingAllowance, r.transportAllowance, r.totalAllowance
                ]);
            });
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            XLSX.utils.book_append_sheet(wb, ws, "관외출장비");
            
            window.showLoadingSpinner('관외출장비 엑셀 파일을 생성하는 중입니다...');
            setTimeout(() => {
                try {
                    const now = new Date();
                    const datePrefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + " ";
                    XLSX.writeFile(wb, `${datePrefix}관외출장비_산출결과.xlsx`);
                    window.hideLoadingSpinner();
                    window.showCustomAlert("관외출장비 다운로드가 완료되었습니다.");
                } catch (error) {
                    window.hideLoadingSpinner();
                    window.showCustomAlert(`다운로드 중 오류가 발생했습니다: ${error.message}`);
                }
            }, 500);
        });
    }

    const inputSequence = [
        'otInputName', 'otInputDest', 'otInputDestType',
        'otInputStartDate', 'otInputStartTime', 'otInputEndDate', 'otInputEndTime',
        'otInputVehicle', 'otInputLodgingDays', 'otInputLodgingCost', 'otInputTransportCost'
    ];

    inputSequence.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (index < inputSequence.length - 1) {
                        const nextEl = document.getElementById(inputSequence[index + 1]);
                        if (nextEl) {
                            nextEl.focus();
                            if (nextEl.tagName === 'INPUT' && (nextEl.type === 'text' || nextEl.type === 'number')) {
                                nextEl.select();
                            }
                        }
                    } else if (id === 'otInputTransportCost') {
                        document.getElementById('btnOutTripAdd')?.click();
                    }
                }
            });
        }
    });
});