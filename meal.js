// 전역 Meal 객체 선언
window.Meal = {
    records: [],
    dateSummary: [],
    mealRecords: [],
    savedDistribution: null,

    // --- Main Logic ---
    async processFile() {
        const fileInput = document.getElementById('mealOvertimeFile');
        const statusEl = document.getElementById('mealStatus');
        const file = fileInput ? fileInput.files[0] : null;

        if (!file) {
            window.showCustomAlert('초과근무목록 파일을 업로드해주세요.');
            return;
        }

        window.showLoadingSpinner('특근매식비 데이터를 분석하는 중...');

        try {
            const rawData = await window.AppUtils.readExcel(file);
            const transformedData = window.AppUtils.simulateTextToColumns(rawData);
            const mealRecords = this.generateMealRecords(transformedData);
            this.mealRecords = mealRecords; 
            const mealSummary = this.summarizeByName(mealRecords);
            const dateSummary = this.summarizeByDate(mealRecords);
            this.dateSummary = dateSummary; 
            this.savedDistribution = null; 

            this.renderMainTable(mealRecords);
            this.renderSummaryTable(mealSummary);
            this.renderDateSummaryTable(dateSummary);
            
            if (window.OutTrip && typeof window.OutTrip.renderTables === 'function') {
                window.OutTrip.renderTables();
            }

            if (statusEl) statusEl.textContent = '분석이 완료되었습니다.';
            window.hideLoadingSpinner();
        } catch (error) {
            console.error('특근매식비 파일 처리 중 오류:', error);
            window.hideLoadingSpinner();
            if (statusEl) statusEl.textContent = `오류가 발생했습니다: ${error.message}`;
        }
    },

    generateMealRecords(data) {
        const records = [];
        const COL = { DATE: 2, ID: 5, NAME: 6, HOLIDAY: 10, CLOCK_IN: 17, CLOCK_OUT: 18, TOTAL_OVERTIME: 19, DEDUCTION_MIN: 20 };

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[COL.ID]) continue;

            const holidayType = String(row[COL.HOLIDAY] || '').trim();
            let mealCount = 0;

            if (holidayType === '평일') {
                const clockIn = window.AppUtils.toJsDate(row[COL.CLOCK_IN]);
                const clockOut = window.AppUtils.toJsDate(row[COL.CLOCK_OUT]);

                if (clockIn && clockOut) {
                    const isEarlyStart = clockIn.getHours() < 8 || (clockIn.getHours() === 8 && clockIn.getMinutes() === 0);
                    const isLateFinish = clockOut.getHours() >= 19;

                    if (isEarlyStart && !isLateFinish) mealCount = 1;
                    else if (isEarlyStart && isLateFinish) mealCount = 2;
                    else if (!isEarlyStart && isLateFinish) mealCount = 1;
                }
            } else if (holidayType === '휴일') {
                const deductionMin = parseInt(row[COL.DEDUCTION_MIN]) || 0;
                const totalOvertime = parseInt(row[COL.TOTAL_OVERTIME]) || 0;
                if (deductionMin >= 30 && totalOvertime >= 90) {
                    mealCount = 1;
                }
            }
            
            if (mealCount > 0) {
                const workDate = window.AppUtils.toJsDate(row[COL.DATE]);
                const holidayDeduction = (holidayType === '휴일' && (parseInt(row[COL.DEDUCTION_MIN]) || 0) >= 30) ? 'Y' : 'N';
                const dateStr = window.AppUtils.formatDate(workDate);
                const empName = String(row[COL.NAME] || '').trim();

                let isOutTripDouble = false;
                if (window.OutTrip && window.OutTrip.records) {
                    isOutTripDouble = window.OutTrip.records.some(ot => {
                        if (ot.name !== empName) return false;
                        return dateStr >= ot.startDate && dateStr <= ot.endDate;
                    });
                }
                
                records.push({
                    workDate: workDate,
                    name: empName,
                    idNumber: String(row[COL.ID] || ''),
                    holidayType: holidayType,
                    clockInStr: window.AppUtils.formatTime(window.AppUtils.toJsDate(row[COL.CLOCK_IN])),
                    clockOutStr: window.AppUtils.formatTime(window.AppUtils.toJsDate(row[COL.CLOCK_OUT])),
                    totalOvertime: parseInt(row[COL.TOTAL_OVERTIME]) || 0,
                    holidayDeduction: holidayDeduction,
                    mealCount: mealCount,
                    isOutTripDouble: isOutTripDouble
                });
            }
        }
        
        records.sort((a, b) => {
            if (a.workDate.getTime() !== b.workDate.getTime()) {
                return a.workDate - b.workDate;
            }
            return a.name.localeCompare(b.name, 'ko-KR');
        });
        return records;
    },

    summarizeByName(records) {
        const summary = new Map();
        records.forEach(rec => {
            summary.set(rec.name, (summary.get(rec.name) || 0) + rec.mealCount);
        });
        return Array.from(summary.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko-KR'));
    },

    summarizeByDate(records) {
        const summary = new Map();
        records.forEach(rec => {
            const dateStr = window.AppUtils.formatDate(rec.workDate);
            summary.set(dateStr, (summary.get(dateStr) || 0) + rec.mealCount);
        });
        return Array.from(summary.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    },

    renderMainTable(records) {
        const container = document.getElementById('mealResultTable');
        if (!container) return;
        
        const totalCount = records.reduce((sum, rec) => sum + rec.mealCount, 0);
        const mealPrice = (typeof DB !== 'undefined' && DB.settings && DB.settings.mealPrice) ? DB.settings.mealPrice : 9000;
        const totalAmount = totalCount * mealPrice;

        const tableHtml = `
            <h3 style="margin-top:0;">일자별 산출 내역</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>근무일자</th>
                        <th>성명</th>
                        <th>고유식별번호</th>
                        <th>휴일구분</th>
                        <th>출근</th>
                        <th>퇴근</th>
                        <th>총초과(분)</th>
                        <th>휴일공제</th>
                        <th>급식수량</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(rec => `
                        <tr style="${rec.isOutTripDouble ? 'background-color: #fff9db;' : ''}">
                            <td>${window.AppUtils.formatDate(rec.workDate)}</td>
                            <td>${rec.name}</td>
                            <td>${rec.idNumber}</td>
                            <td>${rec.holidayType}</td>
                            <td>${rec.clockInStr}</td>
                            <td>${rec.clockOutStr}</td>
                            <td>${rec.totalOvertime}</td>
                            <td>${rec.holidayDeduction}</td>
                            <td>
                                ${rec.mealCount}
                                ${rec.isOutTripDouble ? `
                                    <span style="cursor: help; color: var(--warning-color); font-weight: bold; margin-left: 5px;" 
                                          title="[⚠️ 수기확인 필요] 동일 날짜에 관외출장 내역이 감지되었습니다. 출장비 식비와 매식비 중복 수령이 아닌지 수동으로 확인해 주세요.">⚠️</span>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold; background-color: var(--bg-light);">
                        <td colspan="8" style="text-align: right; padding-right: 15px;">
                            총계 (단가: ${mealPrice.toLocaleString()}원 / 지급 총액: <span style="color: var(--danger-color);">${totalAmount.toLocaleString()}원</span>)
                        </td>
                        <td>${totalCount}</td>
                    </tr>
                </tfoot>
            </table>
        `;
        container.innerHTML = tableHtml;
    },

    renderSummaryTable(summary) {
        const container = document.getElementById('mealSummaryTable');
        if (!container) return;
        const tableHtml = `
            <h3 style="margin-top:0;">성명별 급식수량 합계</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>성명</th>
                        <th>총 급식수량</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.map(([name, count]) => `
                        <tr>
                            <td>${name}</td>
                            <td>${count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = tableHtml;
    },

    renderDateSummaryTable(summary) {
        const container = document.getElementById('mealDateSummaryTable');
        if (!container) return;
        const tableHtml = `
            <h3 style="margin-top:0;">일자별 급식수량 합계</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>근무일자</th>
                        <th>총 급식수량</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.map(([date, count]) => `
                        <tr>
                            <td>${date}</td>
                            <td>${count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = tableHtml;
    },

    processFromOvertimeData() {
        const statusEl = document.getElementById('mealStatus');
        
        if (!window.Overtime || !window.Overtime.transformedData || window.Overtime.transformedData.length <= 1) {
            window.showCustomAlert('초과근무수당 탭에서 먼저 데이터를 분석해 주세요.\n(초과근무 파일을 업로드 후 산출 버튼을 누른 상태여야 합니다.)');
            return;
        }

        window.showLoadingSpinner('초과근무 데이터에서 특근매식비를 산출하는 중...');

        try {
            const transformedData = window.Overtime.transformedData;
            const mealRecords = this.generateMealRecords(transformedData);
            this.mealRecords = mealRecords; 
            const mealSummary = this.summarizeByName(mealRecords);
            const dateSummary = this.summarizeByDate(mealRecords);
            this.dateSummary = dateSummary;
            this.savedDistribution = null;

            this.renderMainTable(mealRecords);
            this.renderSummaryTable(mealSummary);
            this.renderDateSummaryTable(dateSummary);

            if (window.OutTrip && typeof window.OutTrip.renderTables === 'function') {
                window.OutTrip.renderTables();
            }

            if (statusEl) statusEl.textContent = '초과근무 데이터에서 분석이 완료되었습니다.';
            window.hideLoadingSpinner();
        } catch (error) {
            console.error('초과근무 데이터 기반 특근매식비 처리 중 오류:', error);
            window.hideLoadingSpinner();
            if (statusEl) statusEl.textContent = `오류가 발생했습니다: ${error.message}`;
        }
    }
};

function numberToKorean(num) {
    const units = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const tens = ['', '십', '백', '천'];
    const groups = ['', '만', '억', '조'];
    if (num === 0) return '영';
    
    let result = '';
    let numStr = String(num);
    let groupIdx = 0;
    
    while (numStr.length > 0) {
        let chunk = numStr.slice(-4);
        numStr = numStr.slice(0, -4);
        let chunkStr = '';
        for (let i = 0; i < chunk.length; i++) {
            let digit = parseInt(chunk[chunk.length - 1 - i]);
            if (digit > 0) {
                chunkStr = units[digit] + tens[i] + chunkStr;
            }
        }
        if (chunkStr !== '') result = chunkStr + groups[groupIdx] + result;
        groupIdx++;
    }
    return result;
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnProcessMeal');
    if (btn) btn.addEventListener('click', () => window.Meal.processFile());

    const btnLoadOvertime = document.getElementById('btnLoadOvertimeForMeal');
    if (btnLoadOvertime) btnLoadOvertime.addEventListener('click', () => window.Meal.processFromOvertimeData());

    let currentMealPrintMode = 'confirmation';

    function openMealPrintModal(mode) {
        if (!window.Meal.dateSummary || window.Meal.dateSummary.length === 0) {
            window.showCustomAlert('초과근무목록 파일을 분석한 후 양식을 생성할 수 있습니다.');
            return;
        }
        
        currentMealPrintMode = mode;
        const modalTitle = document.querySelector('#printMealModal h3');
        const confirmBtn = document.getElementById('btnConfirmPrintMeal');
        
        if (modalTitle && confirmBtn) {
            if (mode === 'confirmation') {
                modalTitle.textContent = '급식제공확인서 양식 생성';
                confirmBtn.textContent = '선택 거래처 일괄 양식 생성';
            } else {
                modalTitle.textContent = '급식비 지급내역서 양식 생성';
                confirmBtn.textContent = '급식비 지급내역서 인쇄';
            }
        }
        
        const modal = document.getElementById('printMealModal');
        if (modal) modal.style.display = 'flex';
        
        const now = new Date();
        const mealDateInput = document.getElementById('printMealCreationDate');
        if (mealDateInput) mealDateInput.value = now.toISOString().split('T')[0];
            
        const firstDateMatch = window.Meal.dateSummary[0][0].match(/^(\d{4})-(\d{2})/);
        const monthInput = document.getElementById('printMealMonth');
        if (monthInput) {
            if (firstDateMatch) {
                monthInput.value = `${firstDateMatch[1]}-${firstDateMatch[2]}`;
            } else {
                monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }
        }

        const vendorContainer = document.getElementById('printMealVendorCheckboxes');
        if (vendorContainer) {
            vendorContainer.innerHTML = '';
            let vendors = (typeof DB !== 'undefined' && DB.settings && DB.settings.mealVendors) ? DB.settings.mealVendors : [];
            if (vendors.length === 0 && DB.settings && DB.settings.mealVendor && typeof DB.settings.mealVendor === 'string') {
                vendors = [{ name: DB.settings.mealVendor, address: '', representative: '', account: '', phone: '' }];
            }
            
            if (vendors.length === 0) {
                vendorContainer.innerHTML = '<span style="color:var(--danger-color);">등록된 거래처가 없습니다 (환경설정에서 추가)</span>';
                const distContainer = document.getElementById('printMealDistributionContainer');
                if (distContainer) distContainer.style.display = 'none';
                return;
            } else {
                vendors.forEach((v, idx) => {
                    const label = document.createElement('label');
                    label.style.cursor = 'pointer';
                    label.innerHTML = `<input type="checkbox" class="vendor-chk" value="${idx}" checked style="margin-right: 5px;">${v.name || '(상호명 없음)'}`;
                    vendorContainer.appendChild(label);
                });
                document.querySelectorAll('.vendor-chk').forEach(chk => {
                    chk.addEventListener('change', renderDistributionTable);
                });
                renderDistributionTable();
            }
        }
    }

    const btnPrintMeal = document.getElementById('btnPrintMeal');
    if (btnPrintMeal) btnPrintMeal.addEventListener('click', () => openMealPrintModal('confirmation'));
    
    const btnPrintMealPayment = document.getElementById('btnPrintMealPayment');
    if (btnPrintMealPayment) btnPrintMealPayment.addEventListener('click', () => openMealPrintModal('payment'));

    const btnSaveMealDistribution = document.getElementById('btnSaveMealDistribution');
    if (btnSaveMealDistribution) {
        btnSaveMealDistribution.addEventListener('click', () => {
            const totalOrigElement = document.getElementById('dist-total-orig');
            if (!totalOrigElement) return;
            const totalOrig = parseInt(totalOrigElement.dataset.val);
            let sumOfCols = 0;
            document.querySelectorAll('.dist-col-sum').forEach(td => {
                sumOfCols += (parseInt(td.textContent) || 0);
            });
            if (totalOrig !== sumOfCols) {
                window.showCustomAlert('배분된 식수 합계가 원본 식수 합과 일치해야 저장할 수 있습니다.');
                return;
            }

            window.Meal.savedDistribution = {};
            document.querySelectorAll('.dist-input').forEach(inp => {
                const row = inp.dataset.row;
                const col = inp.dataset.col;
                if (!window.Meal.savedDistribution[row]) window.Meal.savedDistribution[row] = {};
                window.Meal.savedDistribution[row][col] = parseInt(inp.value) || 0;
            });
            window.showCustomAlert('현재 식수 배분 내역이 임시 저장되었습니다.\n(급식비 지급내역서 인쇄 시에도 유지됩니다.)');
        });
    }

    function renderDistributionTable() {
        const dateSummary = window.Meal.dateSummary;
        let vendors = (typeof DB !== 'undefined' && DB.settings && DB.settings.mealVendors) ? DB.settings.mealVendors : [];
        if (vendors.length === 0 && DB.settings && DB.settings.mealVendor && typeof DB.settings.mealVendor === 'string') {
            vendors = [{ name: DB.settings.mealVendor, address: '', representative: '', account: '', phone: '' }];
        }

        const checkedIdxs = Array.from(document.querySelectorAll('.vendor-chk:checked')).map(cb => parseInt(cb.value));
        const container = document.getElementById('printMealDistributionContainer');
        
        if (!container) return;

        if (checkedIdxs.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';

        const thead = document.getElementById('printMealDistHead');
        const tbody = document.getElementById('printMealDistBody');
        const tfoot = document.getElementById('printMealDistFoot');
        
        let headHtml = `<th>일자</th><th>원본식수</th>`;
        checkedIdxs.forEach(idx => {
            headHtml += `<th>${vendors[idx].name || '업체' + (idx+1)}</th>`;
        });
        if (thead) thead.innerHTML = headHtml;

        let bodyHtml = '';
        let totalOriginal = 0;
        
        dateSummary.forEach((item, rowIdx) => {
            const dateStr = item[0];
            const originalCount = item[1];
            totalOriginal += originalCount;
            
            bodyHtml += `<tr>
                <td>${dateStr}</td>
                <td class="dist-orig" data-val="${originalCount}">${originalCount}</td>`;
            
            let sumRestored = 0;
            const rowVals = {};
            checkedIdxs.forEach(vIdx => {
                let val = 0;
                if (window.Meal.savedDistribution && window.Meal.savedDistribution[rowIdx] && window.Meal.savedDistribution[rowIdx][vIdx] !== undefined) {
                    val = window.Meal.savedDistribution[rowIdx][vIdx];
                }
                rowVals[vIdx] = val;
                sumRestored += val;
            });

            if (!window.Meal.savedDistribution) {
                if (checkedIdxs.length > 0) rowVals[checkedIdxs[0]] = originalCount;
            } else {
                if (checkedIdxs.length > 0) {
                    let diff = originalCount - sumRestored;
                    rowVals[checkedIdxs[0]] += diff;
                    if (rowVals[checkedIdxs[0]] < 0) {
                        checkedIdxs.forEach((vIdx, colIdx) => {
                            rowVals[vIdx] = (colIdx === 0) ? originalCount : 0;
                        });
                    }
                }
            }

            checkedIdxs.forEach((vIdx) => {
                bodyHtml += `<td><input type="text" inputmode="numeric" class="dist-input overtime-input" data-row="${rowIdx}" data-col="${vIdx}" value="${rowVals[vIdx]}" onfocus="this.select()"></td>`;
            });
            bodyHtml += `</tr>`;
        });
        if (tbody) tbody.innerHTML = bodyHtml;
        
        let footHtml = `<tr><td style="font-weight:bold;">합계</td><td style="font-weight:bold;" id="dist-total-orig" data-val="${totalOriginal}">${totalOriginal}</td>`;
        checkedIdxs.forEach(vIdx => {
            footHtml += `<td class="dist-col-sum" data-col="${vIdx}" style="font-weight:bold;">0</td>`;
        });
        footHtml += `</tr>`;
        if (tfoot) tfoot.innerHTML = footHtml;

        if (tbody) {
            tbody.oninput = calcDistTable;
            calcDistTable();
        }
    }

    function calcDistTable(e) {
        const checkedBoxes = document.querySelectorAll('.vendor-chk:checked');
        const checkedIdxs = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
        const bodyEl = document.getElementById('printMealDistBody');
        if (!bodyEl) return;
        const rows = bodyEl.querySelectorAll('tr');
        
        const colSums = {};
        checkedIdxs.forEach(idx => colSums[idx] = 0);

        if (e && e.target && e.target.classList.contains('dist-input')) {
            const originalStart = e.target.selectionStart;
            const originalVal = e.target.value;
            const newVal = originalVal.replace(/[^0-9]/g, '');
            if (originalVal !== newVal) {
                e.target.value = newVal;
                e.target.setSelectionRange(originalStart - 1, originalStart - 1);
            }
            const tr = e.target.closest('tr');
            const orig = parseInt(tr.querySelector('.dist-orig').dataset.val) || 0;
            
            let val = parseInt(e.target.value) || 0;
            if (val > orig) { val = orig; e.target.value = val; }

            const inputs = Array.from(tr.querySelectorAll('.dist-input'));
            const otherInputs = inputs.filter(inp => inp !== e.target);
            
            let rowSum = val;
            otherInputs.forEach(inp => rowSum += parseInt(inp.value) || 0);

            let diff = orig - rowSum;
            if (diff !== 0 && otherInputs.length > 0) {
                let safetyCount = 0;
                while (diff !== 0 && safetyCount < 100) {
                    safetyCount++;
                    let hasChanged = false;
                    for (let other of otherInputs) {
                        if (diff === 0) break;
                        let otherVal = parseInt(other.value) || 0;
                        if (diff > 0) {
                            if (otherVal < orig) {
                                let addAmt = Math.min(diff, orig - otherVal);
                                other.value = otherVal + addAmt;
                                diff -= addAmt;
                                hasChanged = true;
                            }
                        } else if (diff < 0) {
                            if (otherVal > 0) {
                                let subAmt = Math.min(-diff, otherVal);
                                other.value = otherVal - subAmt;
                                diff += subAmt;
                                hasChanged = true;
                            }
                        }
                    }
                    if (!hasChanged) break;
                }
            }
        }

        rows.forEach(tr => {
            const inputs = tr.querySelectorAll('.dist-input');
            inputs.forEach(inp => {
                const v = parseInt(inp.value.replace(/[^0-9]/g, '')) || 0;
                colSums[inp.dataset.col] += v;
            });
        });

        checkedIdxs.forEach(idx => {
            const td = document.querySelector(`.dist-col-sum[data-col="${idx}"]`);
            if (td) td.textContent = colSums[idx];
        });
    }

    const distBody = document.getElementById('printMealDistBody');
    if (distBody) {
        distBody.addEventListener('keydown', (e) => {
            if (!e.target.classList.contains('dist-input')) return;
            const currentTd = e.target.closest('td');
            const currentTr = e.target.closest('tr');
            
            let targetInput = null;
            if (e.key === 'ArrowRight') {
                targetInput = currentTd.nextElementSibling?.querySelector('.dist-input');
            } else if (e.key === 'ArrowLeft') {
                targetInput = currentTd.previousElementSibling?.querySelector('.dist-input');
            } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault(); 
                targetInput = currentTr.nextElementSibling?.children[currentTd.cellIndex]?.querySelector('.dist-input');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                targetInput = currentTr.previousElementSibling?.children[currentTd.cellIndex]?.querySelector('.dist-input');
            }
            
            if (targetInput) {
                targetInput.focus();
                targetInput.select();
            }
        });
    }

    const btnCancel = document.getElementById('btnCancelPrintMeal');
    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            const modal = document.getElementById('printMealModal');
            if (modal) modal.style.display = 'none';
        });
    }

    const btnConfirm = document.getElementById('btnConfirmPrintMeal');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            const monthStr = document.getElementById('printMealMonth')?.value;
            const creationDateStr = document.getElementById('printMealCreationDate')?.value;

            const checkedBoxes = Array.from(document.querySelectorAll('.vendor-chk:checked'));
            if (checkedBoxes.length === 0) {
                window.showCustomAlert('출력할 거래처를 하나 이상 선택하세요.');
                return;
            }
            
            const totalOrigElement = document.getElementById('dist-total-orig');
            const totalOrig = totalOrigElement ? parseInt(totalOrigElement.dataset.val) : 0;
            let sumOfCols = 0;
            document.querySelectorAll('.dist-col-sum').forEach(td => {
                sumOfCols += (parseInt(td.textContent) || 0);
            });
            if (totalOrig !== sumOfCols) {
                window.showCustomAlert('모든 일자의 식수가 정확히 배분되어야 합니다. (원본 식수 합과 배분된 식수 합이 일치해야 함)');
                return;
            }

            window.Meal.savedDistribution = {};
            document.querySelectorAll('.dist-input').forEach(inp => {
                const row = inp.dataset.row;
                const col = inp.dataset.col;
                if (!window.Meal.savedDistribution[row]) window.Meal.savedDistribution[row] = {};
                window.Meal.savedDistribution[row][col] = parseInt(inp.value) || 0;
            });

            if (!monthStr || !creationDateStr) {
                window.showCustomAlert('급식기간 연월 및 작성일자를 입력해주세요.');
                return;
            }

            let vendors = (typeof DB !== 'undefined' && DB.settings && DB.settings.mealVendors) ? DB.settings.mealVendors : [];
            if (vendors.length === 0 && DB.settings && DB.settings.mealVendor && typeof DB.settings.mealVendor === 'string') {
                vendors = [{ name: DB.settings.mealVendor, address: '', representative: '', account: '', phone: '' }];
            }

            const checkedIdxs = checkedBoxes.map(cb => parseInt(cb.value));

            const vendorDataMap = {};
            checkedIdxs.forEach(idx => {
                vendorDataMap[idx] = []; 
            });

            const rows = document.getElementById('printMealDistBody')?.querySelectorAll('tr') || [];
            rows.forEach(tr => {
                const dateStr = tr.cells[0].textContent.trim();
                const inputs = tr.querySelectorAll('.dist-input');
                inputs.forEach(inp => {
                    const count = parseInt(inp.value) || 0;
                    if (count > 0) {
                        vendorDataMap[inp.dataset.col].push([dateStr, count]);
                    }
                });
            });

            const modal = document.getElementById('printMealModal');
            if (modal) modal.style.display = 'none';

            const printTeamLeader = DB.employees.find(emp => emp.role === '주무계장(사무장)')?.name || '공란';
            const printClerk = DB.employees.find(emp => emp.role === '서무')?.name || '공란';

            const [targetY, targetM] = monthStr.split('-');
            const lastDay = new Date(targetY, targetM, 0).getDate();
            const printMealPeriod = `${targetY}년 ${targetM}월 1일 ~ ${targetY}년 ${targetM}월 ${lastDay}일`;
            const mealPrice = (typeof DB !== 'undefined' && DB.settings && DB.settings.mealPrice) ? DB.settings.mealPrice : 9000;
            const [createY, createM, createD] = creationDateStr.split('-');
            const printMealDate = `${createY}. ${parseInt(createM)}. ${parseInt(createD)}.`;

            let printContentHtml = '';

            if (currentMealPrintMode === 'payment') {
                let totalCountAll = 0;
                let totalAmountAll = 0;
                const paymentRowsHtml = checkedIdxs.map((vIdx) => {
                    const vendor = vendors[vIdx];
                    const vendorDates = vendorDataMap[vIdx];
                    if (!vendorDates || vendorDates.length === 0) return '';

                    const vendorCount = vendorDates.reduce((sum, [d, c]) => sum + c, 0);
                    const vendorAmount = vendorCount * mealPrice;
                    totalCountAll += vendorCount;
                    totalAmountAll += vendorAmount;

                    return `
                        <tr>
                            <td>${vendor.name}</td>
                            <td contenteditable="true">계좌입금</td>
                            <td contenteditable="true">${vendor.representative}</td>
                            <td>${vendorCount}</td>
                            <td>${vendorAmount.toLocaleString()}</td>
                            <td contenteditable="true" style="text-align: left; font-size: 0.9em; padding: 0 5px;">${vendor.account}</td>
                        </tr>
                    `;
                }).join('');

                if (totalCountAll === 0) {
                    window.showCustomAlert('출력할 급식 내역이 없습니다.');
                    return;
                }

                const totalAmountKorean = numberToKorean(totalAmountAll);

                printContentHtml = `
                    <style>@page { size: A4 portrait; margin: 15mm; }</style>
                    <div style="padding: 10mm;">
                        <h2 style="text-align: center; margin-bottom: 20px; font-size: 24pt; color: black; border-bottom: none;">급식비 지급내역서</h2>
                        
                        <div style="float: right; margin-bottom: 20px;">
                            <table style="border-collapse: collapse; text-align: center;">
                                <tr>
                                    <td rowspan="2" style="padding: 0 10px; border: 1px solid black; font-size: 10pt;">결<br>재</td>
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

                        <div style="margin-bottom: 10px; font-size: 14pt; font-weight: bold; color: black;">
                            총 합계: 금${totalAmountAll.toLocaleString()}원 (금${totalAmountKorean}원)
                        </div>

                        <table style="width: 100%; border-collapse: collapse; text-align: center; color: black; font-size: 11pt;" class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 15%;">상호</th>
                                    <th style="width: 15%;">결제방법</th>
                                    <th style="width: 15%;">예금주</th>
                                    <th style="width: 10%;">급식수량</th>
                                    <th style="width: 15%;">결제금액</th>
                                    <th style="width: 30%;">비고</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${paymentRowsHtml}
                            </tbody>
                            <tfoot>
                                <tr style="font-weight: bold; background-color: var(--bg-light);">
                                    <td colspan="3">합계</td>
                                    <td>${totalCountAll}</td>
                                    <td>${totalAmountAll.toLocaleString()}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                `;
            } else {
                let pagesHtml = '';

                checkedIdxs.forEach((vIdx, index) => {
                    const vendor = vendors[vIdx];
                    const vendorDates = vendorDataMap[vIdx];
                
                    if (!vendorDates || vendorDates.length === 0) return;

                    const totalCount = vendorDates.reduce((sum, [d, c]) => sum + c, 0);
                    const totalAmount = totalCount * mealPrice;
                    const vendorText = `${vendor.name} (${vendor.address})`;
                    const pageBreak = index > 0 ? 'page-break-before: always;' : '';

                    const pageHtml = `
                        <div style="padding: 10mm; ${pageBreak}">
                            <h2 style="text-align: center; margin-bottom: 20px; font-size: 24pt; color: black; border-bottom: none;">급식제공확인서</h2>
                            
                            <div style="float: right; margin-bottom: 20px;">
                                <table style="border-collapse: collapse; text-align: center;">
                                    <tr>
                                        <td rowspan="2" style="padding: 0 10px; border: 1px solid black; font-size: 10pt;">결<br>재</td>
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

                            <div style="margin-bottom: 20px; font-size: 12pt; line-height: 1.8; color: black;">
                                <div>□ 급식기간: ${printMealPeriod}</div>
                                <div>□ 거 래 처: <span contenteditable="true" style="border-bottom: 1px dashed #ccc; padding: 0 5px; min-width: 300px; display: inline-block;">${vendorText}</span></div>
                                <div>□ 급식단가: 1식 <span>${mealPrice.toLocaleString()}</span>원</div>
                                <div style="margin-top: 15px; font-weight: bold;">□ 급식제공내역</div>
                            </div>
                            
                            <table style="width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 30px; color: black;" class="data-table">
                                <thead>
                                    <tr>
                                        <th>급식일자</th>
                                        <th>품명</th>
                                        <th>급식수</th>
                                        <th>단가</th>
                                        <th>금액</th>
                                        <th>비고</th>
                                    </tr>
                                    <tr style="font-weight: bold; background-color: var(--bg-light);">
                                        <td>합계</td>
                                        <td></td>
                                        <td>${totalCount}</td>
                                        <td>${mealPrice.toLocaleString()}</td>
                                        <td>${totalAmount.toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${vendorDates.map(([date, count]) => `
                                        <tr>
                                            <td>${date}</td>
                                            <td>특근매식비</td>
                                            <td>${count}</td>
                                            <td>${mealPrice.toLocaleString()}</td>
                                            <td>${(count * mealPrice).toLocaleString()}</td>
                                            <td></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            
                            <p style="text-align: center; margin-top: 50px; font-size: 14pt;">위와 같이 급식을 제공하였음을 확인합니다.</p>
                            <p style="text-align: center; margin-top: 20px; font-size: 14pt;">${printMealDate}</p>
                        </div>
                    `;
                    pagesHtml += pageHtml;
                });

                if (!pagesHtml) {
                    window.showCustomAlert('출력할 급식 내역이 없습니다.');
                    return;
                }

                printContentHtml = `
                    <style>@page { size: A4 portrait; margin: 10mm; }</style>
                    ${pagesHtml}
                `;
            }
            
            if (window.electronAPI && window.electronAPI.openPrintWindow) {
                await window.electronAPI.openPrintWindow(printContentHtml);
            } else {
                window.showCustomAlert('Electron API를 사용할 수 없습니다. 개발자 도구를 확인해주세요.');
            }
        });
    }

    const btnDownload = document.getElementById('btnDownloadMeal');
    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            const table = document.querySelector('#mealResultTable table');
            if (!table) {
                window.showCustomAlert('출력할 데이터가 없습니다.');
                return;
            }
            const wb = XLSX.utils.table_to_book(table, {sheet: "특근매식비"});
            
            window.showLoadingSpinner('특근매식비 엑셀 파일을 생성하는 중입니다...');
            setTimeout(() => {
                try {
                    const now = new Date();
                    const datePrefix = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + " ";
                    XLSX.writeFile(wb, `${datePrefix}특근매식비_산출결과.xlsx`);
                    window.hideLoadingSpinner();
                    window.showCustomAlert("특근매식비 다운로드가 완료되었습니다.");
                } catch (error) {
                    window.hideLoadingSpinner();
                    window.showCustomAlert(`다운로드 중 오류가 발생했습니다: ${error.message}`);
                }
            }, 500);
        });
    }

    if (window.AppUtils) window.AppUtils.setupFileNameDisplay('mealOvertimeFile', 'mealOvertimeFileName');
});