const { chromium } = require('playwright');

async function scrapeWechat() {
    const url = process.argv[2];
    if (!url) { console.log("❌ 缺少链接"); return; }

    // 【核心改动】关闭无头模式，增加慢速模拟
    const browser = await chromium.launch({ 
        headless: false, 
        args: ['--disable-blink-features=AutomationControlled'] // 抹除自动化受控标记
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN',
        });

        const page = await context.newPage();
        
        // 抹除 navigator.webdriver 标记
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        console.log(`🚀 正在深度突破验证: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

        // 模拟真人停留和微小滚动
        await page.mouse.move(100, 100);
        await page.waitForTimeout(2000); 

        // 尝试抓取正文
        const content = await page.innerText('#img-content') || await page.innerText('body');
        
        if (content.includes("验证") || content.includes("环境异常")) {
            console.log("❌ 依然被拦截。建议：黑总，请切换一下你电脑上的代理节点再试。");
        } else {
            console.log(content.slice(0, 3000));
        }
    } catch (e) {
        console.log(`❌ 突破失败: ${e.message}`);
    } finally {
        await browser.close();
    }
}
scrapeWechat();
