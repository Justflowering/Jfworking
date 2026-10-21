// 전역 DB 객체 선언
const DB = {
    // 인메모리 데이터
    employees: [], 
    rosterData: [], // 엑셀 다운로드 및 수정을 위한 원본 2D 배열 데이터
    lastBackupDate: null, // 하루 한 번 자동 백업을 위한 날짜 추적 변수
    settings: {
        unitPrices: {
            '6급': 13692,
            '7급': 12368,
            '8급': 12113,
            '9급': 10949,
            '다급': 12368,
            '라급': 12113,
            '마급': 10949,
            '경위': 13779
        },
        mealPrice: 9000, // 특근매식비 단가 기본값 변경
        mealVendors: [], // 거래처 목록 (상호, 주소, 대표자, 계좌, 전화번호)
        includeGrade5Overtime: false, // 5급 초과근무수당 포함 여부
        departmentName: '', // 부서명 추가
        departmentType: '실과', // 소속부서 분류 (실과 / 동)
        localTrip: {
            sangsiAmount: 200000,
            normalVehOver4: 10000,
            normalVehUnder4: 0,
            normalNoVehOver4: 20000,
            normalNoVehUnder4: 10000,
            useSangsiDeduction: true,
            sangsiDeductionExemptDays: 4
        },
        outTrip: {
            dailyAllowance: 25000,
            mealAllowance: 25000,
            lodgingSeoul: 100000,
            lodgingMetro: 80000,
            lodgingOther: 70000,
            useTimeMealDeduction: true
        },
        kakaoApi: {
            restApiKey: '41360366fe8aa573b45f73c82e4aa34a',
            startAddress: '',
            javascriptKey: '6e18fe849bf66bff676eb7d51cfebcb1'
        },
        publicDataApiKey: '502703e3209d16cee77a91c35223e14190e22823704ead8ff756104506e6711e', // 공공데이터포털 API 키
        maxConsecutiveDuty: 3, // 연속 당직 최대 일수
        banks: {
            '한국은행': '001:한국은행',
            '산업은행': '002:산업은행',
            '기업은행': '003:기업은행',
            '국민은행': '004:국민은행',
            '농협은행': '011:농협',
            '지역 농축협': '012:지역 농축협',
            '우리은행': '020:우리은행',
            'SC제일은행': '023:SC제일은행',
            '한국씨티은행': '027:한국씨티은행',
            'iM뱅크(구)대구은행': '031:iM뱅크(구)대구은행',
            '부산은행': '032:부산은행',
            '광주은행': '034:광주은행',
            '제주은행': '035:제주은행',
            '전북은행': '037:전북은행',
            '경남은행': '039:경남은행',
            '새마을금고중앙회': '045:새마을금고중앙회',
            '신협': '048:신협',
            '상호저축은행': '050:상호저축은행',
            '기타 외국계은행(중국 교통은행 등)': '051:기타 외국계은행(중국 교통은행 등)',
            '모간스탠리은행': '052:모간스탠리은행',
            'HSBC은행': '054:HSBC은행',
            '도이치은행': '055:도이치은행',
            '제이피모간체이스은행': '057:제이피모간체이스은행',
            '미즈호은행': '058:미즈호은행',
            '미쓰비시도쿄UFJ은행': '059:미쓰비시도쿄UFJ은행',
            'BOA은행': '060:BOA은행',
            '비엔피파리바은행': '061:비엔피파리바은행',
            '중국공상은행': '062:중국공상은행',
            '중국은행': '063:중국은행',
            '산림조합중앙회': '064:산림조합중앙회',
            '대화은행': '065:대화은행',
            '중국건설은행': '067:중국건설은행',
            '우체국': '071:우체국',
            '신용보증기금': '076:신용보증기금',
            '기술보증기금': '077:기술보증기금',
            'KEB하나은행': '081:KEB하나은행',
            '신한은행': '088:신한은행',
            '케이뱅크': '089:케이뱅크',
            '카카오뱅크': '090:카카오뱅크',
            '토스뱅크': '092:토스뱅크',
            '한국주택금융공사': '093:한국주택금융공사',
            '서울보증보험': '094:서울보증보험',
            '유안타증권': '209:유안타증권',
            'KB증권(218)': '218:KB증권',
            '상상인증권': '221:상상인증권',
            '리딩투자증권': '223:리딩투자증권',
            'BNK투자증권': '224:BNK투자증권',
            'IBK투자증권': '225:IBK투자증권',
            'KB증권': '226:KB증권',
            'KTB투자증권': '227:KTB투자증권',
            '미래에셋증권': '230:미래에셋증권',
            '삼성증권': '240:삼성증권',
            '한국투자증권': '243:한국투자증권',
            'NH투자증권(247)': '247:NH투자증권',
            '교보증권': '261:교보증권',
            '하이투자증권': '262:하이투자증권',
            '현대차투자증권': '263:현대차투자증권',
            '키움증권': '264:키움증권',
            '이베스트투자증권': '265:이베스트투자증권',
            'SK증권': '266:SK증권',
            '대신증권': '267:대신증권',
            '메리츠증권(268)': '268:메리츠종합금융증권',
            '한화투자증권': '269:한화투자증권',
            '하나금융투자': '270:하나금융투자',
            '토스증권': '271:토스증권',
            '신한금융투자': '278:신한금융투자',
            'DB금융투자': '279:DB금융투자',
            '유진투자증권': '280:유진투자증권',
            '메리츠종합금융증권': '287:메리츠종합금융증권',
            '카카오페이증권': '288:카카오페이증권',
            'NH투자증권': '289:NH투자증권',
            '부국증권': '290:부국증권',
            '신영증권': '291:신영증권',
            '케이프투자증권': '292:케이프투자증권',
            '우리투자증권': '294:우리투자증권'
        }
    },

    // 중첩 객체 안전 병합을 위한 Deep Merge 헬퍼
    deepMerge(target, source) {
        if (!source) return target;
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    },

    // 초기화 및 로컬스토리지 로드
    init() {
        if (!window.electronAPI) {
            console.warn('Electron 환경이 아닙니다. 자동 저장이 비활성화됩니다.');
            return;
        }

        const savedSettings = window.electronAPI.getStoreValue('seomuSettings');
        if (savedSettings) {
            // 하위 호환성: 기존에 JSON.stringify로 저장된 문자열 데이터도 처리
            const parsed = (typeof savedSettings === 'string') ? JSON.parse(savedSettings) : savedSettings;
            this.deepMerge(this.settings, parsed);
            
            // 배포용 하드코딩 API 키 강제 유지 (값이 비어있는 경우)
            if (!this.settings.kakaoApi) {
                this.settings.kakaoApi = {};
            }
            if (!this.settings.kakaoApi.restApiKey) {
                this.settings.kakaoApi.restApiKey = '41360366fe8aa573b45f73c82e4aa34a';
            }
            if (!this.settings.kakaoApi.javascriptKey) {
                this.settings.kakaoApi.javascriptKey = '6e18fe849bf66bff676eb7d51cfebcb1';
            }
            if (!this.settings.publicDataApiKey) {
                this.settings.publicDataApiKey = '502703e3209d16cee77a91c35223e14190e22823704ead8ff756104506e6711e';
            }
        }
        
        // 자동 저장된 명세서 데이터 로드
        const savedRoster = window.electronAPI.getStoreValue('seomuRosterData');
        if (savedRoster) {
            try {
                // 하위 호환성: 기존에 JSON.stringify로 저장된 문자열 데이터도 처리
                const parsedRoster = (typeof savedRoster === 'string') ? JSON.parse(savedRoster) : savedRoster;
                if (parsedRoster && parsedRoster.length > 0) {
                    this.loadFromRoster(parsedRoster, false);
                }
            } catch (e) {
                console.error('명세서 로드 실패', e);
            }
        }
    },

    // 명세서 내부 DB 자동 저장
    saveRoster() {
        if (window.electronAPI) {
            window.electronAPI.setStoreValue('seomuRosterData', this.rosterData);

            // 앱 실행 후 하루에 한 번 자동 백업 파일(엑셀) 생성
            if (window.electronAPI.autoBackup && this.rosterData && this.rosterData.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const fileName = `직원신상명세서_백업_${today}.xlsx`;
                
                // 같은 날짜 세션 내 중복 I/O 방지 (성능 최적화)
                if (this.lastBackupDate !== today && typeof XLSX !== 'undefined') {
                    const wb = XLSX.utils.book_new();
                    const ws = XLSX.utils.aoa_to_sheet(this.rosterData);
                    XLSX.utils.book_append_sheet(wb, ws, "직원신상명세서");
                    
                    const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
                    window.electronAPI.autoBackup(fileName, base64Data, true);
                    
                    this.lastBackupDate = today;
                }
            }
        }
    },

    // 설정 저장
    saveSettings(newSettings) {
        // [FIX] Deep Merge를 활용해 중첩 객체 속성 유실 방지
        this.deepMerge(this.settings, newSettings);
        if (window.electronAPI) {
            window.electronAPI.setStoreValue('seomuSettings', this.settings);
        }
    },

    // 생년월일을 MMDD 형태로 정제
    parseBirthToMMDD(birthStr) {
        if (!birthStr) return "0000";
        const str = String(birthStr).trim();
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) { // YYYY/MM/DD
                return parts[1].padStart(2, '0') + parts[2].padStart(2, '0');
            }
            if (parts.length === 2) { // MM/DD
                return parts[0].padStart(2, '0') + parts[1].padStart(2, '0');
            }
        } else if (str.includes('-')) {
            const parts = str.split('-');
            if (parts.length === 3) { // YYYY-MM-DD
                return parts[1].padStart(2, '0') + parts[2].padStart(2, '0');
            }
            if (parts.length === 2) { // MM-DD
                return parts[0].padStart(2, '0') + parts[1].padStart(2, '0');
            }
        }
        // 숫자만 남기고 끝 4자리 (YYYYMMDD, YYMMDD, MMDD 형식 처리)
        return str.replace(/[^0-9]/g, '').slice(-4);
    },

    // 직급 -> 계급 변환 (규칙 적용)
    parseRank(rawRank) {
        if (!rawRank) return "";
        let text = rawRank.replace(/^지방/, '').trim(); // '지방' 제거

        if (text.includes('청원경찰')) return '경위';
        if (text.includes('시간선택제임기제')) {
            const match = text.match(/([가-마]급)/);
            return match ? match[1] : text.replace('시간선택제임기제', '').trim();
        }
        
        // '지방서기관'은 '행정4급'으로 변환하기 위한 특별 케이스
        if (text === '서기관') return '행정4급';
        
        // 서기보->9급 등의 치환
        text = text.replace(/서기관$/, '4급') // 예: 행정서기관 -> 행정4급
                   .replace(/사무관$/, '5급')
                   .replace(/주사$/, '6급')
                   .replace(/주사보$/, '7급')
                   .replace(/서기$/, '8급')
                   .replace(/서기보(?:시보)?$/, '9급');
        return text;
    },

    // 계급 -> 직급 변환 (수정 시 자동 적용)
    generateOriginalRank(className) {
        if (!className) return "";
        let text = String(className).trim();
        
        if (text.includes("경위")) return "청원경찰";
        
        if (/^[가-마]급$/.test(text)) {
            return "지방시간선택제임기제 " + text;
        }

        const gradeMatch = text.match(/(.*?)([4-9]급)$/);
        if (gradeMatch) {
            const series = gradeMatch[1];
            const grade = gradeMatch[2];
            let suffix = "";
            if (grade === "4급") suffix = "서기관";
            else if (grade === "5급") suffix = "사무관";
            else if (grade === "6급") suffix = "주사";
            else if (grade === "7급") suffix = "주사보";
            else if (grade === "8급") suffix = "서기";
            else if (grade === "9급") suffix = "서기보";

            return "지방" + series + suffix;
        }

        return text;
    },

    // 계급으로 단가 찾기
    getUnitPrice(rankStr) {
        // 계급 문자열에 9급, 라급 등이 포함되어 있는지 확인
        for (let key in this.settings.unitPrices) {
            if (rankStr.includes(key)) {
                return this.settings.unitPrices[key];
            }
        }
        if (rankStr.includes('청원경찰')) return this.settings.unitPrices['경위'] || 13779;
        return 0; // 매핑 실패시 0
    },

    // 은행명 하드코딩 매핑
    mapBankName(rawBank) {
        if (!rawBank) return "";
        for (let key in this.settings.banks) {
            if (rawBank.includes(key)) return this.settings.banks[key];
        }
        return rawBank; // 매핑 없으면 원본 반환
    },

    // 계급 정렬 점수 계산 (내부용)
    getSortScore(rank) {
        let score = 0;
        let gradeScore = 99;
        if (rank.includes('4급')) gradeScore = 4;
        else if (rank.includes('5급')) gradeScore = 5;
        else if (rank.includes('6급')) gradeScore = 6;
        else if (rank.includes('7급')) gradeScore = 7;
        else if (rank.includes('8급')) gradeScore = 8;
        else if (rank.includes('9급')) gradeScore = 9;
        else if (rank.includes('가급')) gradeScore = 10;
        else if (rank.includes('나급')) gradeScore = 11;
        else if (rank.includes('다급')) gradeScore = 12;
        else if (rank.includes('라급')) gradeScore = 13;
        else if (rank.includes('마급')) gradeScore = 14;
        else if (rank.includes('경위')) gradeScore = 20;
        else if (rank.includes('실무원') || rank.includes('공무직')) gradeScore = 30;
        else if (rank.includes('기간제')) gradeScore = 31;
        
        score += gradeScore * 10000;

        let seriesScore = 99;
        if (rank.includes('행정')) seriesScore = 1;
        else if (rank.includes('사회복지')) seriesScore = 2;
        
        score += seriesScore * 100;
        return score;
    },

    // 두 엑셀 데이터 병합 로직
    processExcelFiles(data1, data2, roleMap) {
        // data1: 근무형태목록 (D:3 직급, E:4 고유번호, F:5 성명, H:7 직책, I:8 생일)
        // data2: 거래처목록 (A:0 거래처명, D:3 생일, F:5 금융기관, H:7 계좌번호)
        
        // 1. data1에서 동명이인 확인
        const nameCounts = {};
        data1.forEach((row, index) => {
            if (index === 0 || !row[5]) return; // 헤더 또는 이름 없는 행 스킵
            const name = String(row[5]).trim();
            nameCounts[name] = (nameCounts[name] || 0) + 1;
        });

        // 2. data2(계좌정보)를 생년월일 유무에 따라 두 개의 딕셔너리로 분리
        const file2DictWithBirth = {};
        const file2DictByName = {};
        data2.forEach(row => {
            const name = String(row[0] || '').trim();
            if (!name) return; // 이름이 없으면 스킵

            const birthMMDD = this.parseBirthToMMDD(row[3]);
            const bankInfo = {
                bank: this.mapBankName(row[5]),
                account: row[7] || ""
            };

            if (birthMMDD && birthMMDD !== "0000") {
                const key = name + birthMMDD;
                file2DictWithBirth[key] = bankInfo;
            } else {
                // 생년월일이 없는 경우, 이름만으로 저장
                file2DictByName[name] = bankInfo;
            }
        });

        const resultData = [];
        this.employees = []; // 상태 초기화

        // 최종 헤더
        resultData.push(["연번", "팀", "성명", "생년월일", "계급", "직급", "고유식별번호", "수당은행", "수당계좌", "추가은행", "추가계좌", "단가", "직책", "차량번호", "비고"]);

        // 파일1 (근무형태) 파싱 및 병합
        let serialNum = 1;
        data1.forEach((row, index) => {
            if (index === 0 || !row[5]) return; // 헤더 또는 이름 없는 행 스킵

            const rankRaw = row[3] || "";
            const idNumber = row[4] || "";
            const name = String(row[5]).trim();
            let role = String(row[7] || "").trim();

            // 직책 오버라이드 적용
            if (roleMap) {
                if (name === roleMap.manager) role = "과장(동장)";
                else if (name === roleMap.teamLeader) role = "주무계장(사무장)";
                else if (name === roleMap.clerk) role = "서무";
            }
            const birthRaw = row[8] || "";

            const birthMMDD = this.parseBirthToMMDD(birthRaw);
            const parsedRank = this.parseRank(rankRaw);
            const unitPrice = this.getUnitPrice(parsedRank);

            // 파일 2와 매칭 로직
            let bankInfo = { bank: "", account: "" };
            const matchKeyWithBirth = name + birthMMDD;

            // 1순위: 이름+생년월일로 정확히 매칭
            if (file2DictWithBirth[matchKeyWithBirth]) {
                bankInfo = file2DictWithBirth[matchKeyWithBirth];
            }
            // 2순위: 이름만으로 매칭 (생년월일이 없는 데이터)
            else if (file2DictByName[name]) {
                // 이름으로 매칭 시, data1에 동명이인이 있는지 확인
                if (nameCounts[name] > 1) {
                    // 동명이인이 있으면 경고 메시지 표시
                    bankInfo = { bank: "동명이인 생년월일 확인 필수", account: "동명이인 생년월일 확인 필수" };
                } else {
                    // 동명이인이 없으면 안전하게 매칭
                    bankInfo = file2DictByName[name];
                }
            }

            // 행 데이터 생성
            const newRow = [
                serialNum++,    // 연번
                "",             // 팀 (빈칸)
                name,           // 성명
                birthMMDD,      // 생년월일
                parsedRank,     // 계급
                rankRaw,        // 직급(원본)
                idNumber,       // 고유식별번호
                bankInfo.bank,  // 수당은행
                bankInfo.account,// 수당계좌
                "",             // 추가은행 (빈칸)
                "",             // 추가계좌 (빈칸)
                unitPrice ? unitPrice.toLocaleString() : "0", // 단가 (천단위 콤마)
                role,           // 직책
            "",             // 차량번호 (빈칸)
            ""              // 비고 (빈칸)
            ];
            resultData.push(newRow);

            // 산출기 UI를 위해 메모리에도 저장
            this.employees.push({
                name: name,
                rank: parsedRank,
                unitPrice: unitPrice,
                idNumber: idNumber,
            bank: bankInfo.bank,
            account: bankInfo.account,
            role: role,
            remarks: ""
            });
        });

        this.rosterData = resultData; // 수정/다운로드를 위해 원본 저장
        this.saveRoster(); // 자동 저장
        return resultData;
    },

    loadFromRoster(rosterData, save = true) {
        this.rosterData = rosterData; // 수정/다운로드를 위해 원본 저장
        this.employees = []; // 상태 초기화
        
        // 헤더: ["연번", "팀", "성명", "생년월일", "계급", "직급", "고유식별번호", "수당은행", "수당계좌", "추가은행", "추가계좌", "단가", "직책", "차량번호"]
        const COL = {
            NAME: 2,
            RANK: 4,
            ID_NUMBER: 6,
            BANK: 7,
            ACCOUNT: 8,
            EXTRA_BANK: 9,
            EXTRA_ACCOUNT: 10,
            UNIT_PRICE: 11,
            ROLE: 12,
            REMARKS: 14
        };

        // 헤더(첫 번째 행)를 건너뛰고 시작
        for (let i = 1; i < rosterData.length; i++) {
            const row = rosterData[i];
            const name = String(row[COL.NAME] || '').trim();
            if (!name) continue; // 이름이 없으면 스킵

            this.employees.push({
                name: name,
                rank: String(row[COL.RANK] || ''),
                unitPrice: parseInt(String(row[COL.UNIT_PRICE]).replace(/,/g, '')) || 0,
                idNumber: String(row[COL.ID_NUMBER] || ''),
                bank: String(row[COL.BANK] || ''),
                account: String(row[COL.ACCOUNT] || ''),
                extraBank: String(row[COL.EXTRA_BANK] || ''),
                extraAccount: String(row[COL.EXTRA_ACCOUNT] || ''),
                role: String(row[COL.ROLE] || '').trim(),
                remarks: String(row[COL.REMARKS] || '')
            });
        }

        if (save) {
            this.saveRoster();
        }
    },

    sortEmployees() {
        if (!this.rosterData || this.rosterData.length <= 1) return;

        const header = this.rosterData[0];
        const body = this.rosterData.slice(1);

        body.sort((a, b) => {
            const rankA = String(a[4] || '');
            const nameA = String(a[2] || '');
            const rankB = String(b[4] || '');
            const nameB = String(b[2] || '');

            const scoreA = this.getSortScore(rankA);
            const scoreB = this.getSortScore(rankB);

            if (scoreA !== scoreB) return scoreA - scoreB;
            return nameA.localeCompare(nameB, 'ko-KR');
        });

        body.forEach((row, idx) => { row[0] = idx + 1; });

        this.rosterData = [header, ...body];
        this.loadFromRoster(this.rosterData, true);
    }
};

DB.init(); // 스크립트 로드 시 초기화