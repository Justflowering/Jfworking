const { ipcRenderer } = require('electron');

ipcRenderer.on('load-print-content', (event, htmlContent) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // <style> 태그를 <head>로 이동시켜 @page 규칙이 확실히 적용되게 함
    tempDiv.querySelectorAll('style').forEach(style => {
        document.head.appendChild(style);
    });

    // 인쇄 미리보기 컨트롤 바 추가
    const controlBar = document.createElement('div');
    controlBar.id = 'print-control-bar';
    controlBar.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; z-index: 99999; background: #2c3e50; color: white; display: flex; align-items: center; justify-content: center; gap: 15px; padding: 10px 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    controlBar.innerHTML = `
        <span style="font-size: 14px; font-weight: bold; margin-right: 20px;">📄 인쇄 미리보기</span>
        <button id="btnDoPrint" style="background: #3498db; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: bold;">🖨️ 인쇄</button>
        <button id="btnClosePreview" style="background: #95a5a6; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 14px; cursor: pointer;">닫기</button>
    `;

    // 컨트롤 바를 위한 여백 추가 스타일
    const spacerStyle = document.createElement('style');
    spacerStyle.textContent = `
        body { padding-top: 50px !important; }
        @media print { 
            #print-control-bar { display: none !important; } 
            body { padding-top: 0 !important; }
        }
    `;
    document.head.appendChild(spacerStyle);

    document.body.innerHTML = tempDiv.innerHTML;
    document.body.prepend(controlBar);

    // 인쇄 버튼 클릭 → 메인 프로세스에 인쇄 요청
    document.getElementById('btnDoPrint').addEventListener('click', () => {
        ipcRenderer.send('do-print');
    });

    // 닫기 버튼 클릭 → 창 닫기
    document.getElementById('btnClosePreview').addEventListener('click', () => {
        window.close();
    });
});