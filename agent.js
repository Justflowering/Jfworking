class LocalAgent {
    constructor() {
        this.knowledge = [
            {
                keywords: ['명세서', '엑셀 다운로드', 'download'],
                answer: '직원신상명세서 다운로드는 \"직원신상명세서 관리\" 탭에서 명세서를 불러온 후, \"💾 엑셀 다운로드\" 버튼을 눌러 진행하세요. 수정이 필요한 경우 테이블 셀을 클릭해 변경한 뒤 다시 저장할 수 있습니다.'
            },
            {
                keywords: ['초과근무', '계산', '산출'],
                answer: '초과근무 계산은 \"초과근무수당\" 탭에서 초과근무목록과 초과근무정산내역 파일을 업로드한 다음 \"초과근무 데이터 정리 및 산출\" 버튼을 누르면 됩니다. 출력 또는 엑셀 다운로드 버튼으로 결과를 확인하세요.'
            },
            {
                keywords: ['특근', '매식비', '급식'],
                answer: '특근매식비는 \"특근매식비\" 탭에서 초과근무목록 파일을 업로드하고 \"특근매식비 데이터 정리 및 산출\" 버튼을 눌러 계산합니다. 이후 급식제공확인서 및 급식비 지급내역서를 인쇄 또는 다운로드할 수 있습니다.'
            },
            {
                keywords: ['관내출장', '거리 검증', '거리'],
                answer: '관내출장은 \"관내출장\" 탭에서 출장내역 파일을 업로드한 뒤 \"관내출장 데이터 분석 및 산출\" 버튼을 누르세요. 결과가 나오면 \"의심 출장지 거리 검증 (2km)\" 버튼으로 짧은 출장지를 확인할 수 있습니다.'
            },
            {
                keywords: ['환경 설정', '저장', '설정'],
                answer: '환경 설정은 \"환경 설정\" 탭에서 부서명, 기본주소, 거래처 정보 등을 입력하고 \"설정 저장\" 버튼을 클릭하면 저장됩니다. 필요한 경우 \"설정 백업(다운로드)\"과 \"설정 복구(업로드)\"도 사용할 수 있습니다.'
            },
            {
                keywords: ['인쇄', '미리보기', 'print'],
                answer: '출력은 각 탭에 있는 \"인쇄 미리보기\" 또는 \"🖨️\" 버튼을 이용하세요. 인쇄 미리보기 화면이 뜨면 프린터 설정을 확인한 뒤 실제 인쇄 또는 PDF 저장이 가능합니다.'
            },
            {
                keywords: ['인사이동', '전출', '전입', '신규', '퇴사'],
                answer: '인사이동 발생 시:\n1. [직원신상명세서 관리] 탭에서 전출자를 삭제하고 전입자를 추가(또는 파일 재업로드)합니다.\n2. [당직관리 > 당직 순서]로 이동하여 명단에서 전출자를 [X] 버튼으로 지웁니다.\n3. 좌측 명단에서 전입자를 찾아 원하는 순서에 끼워넣고 [순서 저장]을 누르면 완료됩니다.'
            },
            {
                keywords: ['결재', '결재란', '서무', '계장', '과장', '팀장', '직책'],
                answer: '각종 지급내역서 인쇄 시 하단 결재란의 이름은 [직원신상명세서 관리] 탭의 "직책" 열 정보를 기준으로 출력됩니다.\n명세서 표에서 변경할 사람의 셀을 직접 클릭해 "서무", "주무계장(사무장)", "과장(동장)" 등을 입력/수정하시면 즉시 인쇄물에 반영됩니다.'
            },
            {
                keywords: ['파일', '오류', '에러', '안됨', 'pdf', 'hwp'],
                answer: '프로그램 오류 방지를 위해 모든 업로드 파일은 반드시 엑셀(.xls, .xlsx) 형식이어야 합니다.\n계속해서 오류가 발생할 경우 [환경 설정] 탭에서 부서명과 기본주소가 올바르게 저장되어 있는지 확인해 주세요.'
            }
        ];
    }

    ask(prompt) {
        const query = (prompt || '').trim();
        if (!query) {
            return '질문을 입력해주세요. 예: 명세서 다운로드, 초과근무 계산 방법, 환경 설정 저장';
        }

        const lower = query.toLowerCase();
        for (const item of this.knowledge) {
            if (item.keywords.some(keyword => lower.includes(keyword))) {
                return item.answer;
            }
        }

        return '죄송합니다. 해당 내용은 아직 지원되지 않습니다. 다음과 같이 질문해 보세요:\n- 명세서 다운로드 방법\n- 인사이동 처리 방법\n- 초과근무 계산\n- 환경 설정 저장\n- 관내출장 결과 확인';
    }
}

window.localAgent = new LocalAgent();

const initializeAgentUI = () => {
    const promptInput = document.getElementById('agentPrompt');
    const askButton = document.getElementById('btnAgentAsk');
    const resetButton = document.getElementById('btnAgentReset');
    const responseContainer = document.getElementById('agentResponse');

    if (!promptInput || !askButton || !resetButton || !responseContainer) {
        return;
    }

    const renderResponse = (text) => {
        responseContainer.textContent = text;
    };

    askButton.addEventListener('click', () => {
        renderResponse(window.localAgent.ask(promptInput.value));
    });

    resetButton.addEventListener('click', () => {
        promptInput.value = '';
        renderResponse('질문을 입력하고 실행 버튼을 눌러 주세요.');
        promptInput.focus();
    });

    promptInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            askButton.click();
        }
    });

    // 추천 질문 칩 클릭 이벤트 바인딩
    document.querySelectorAll('.agent-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            promptInput.value = e.target.textContent.trim();
            askButton.click();
        });
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAgentUI);
} else {
    initializeAgentUI();
}
