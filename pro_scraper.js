const { chromium } = require('playwright');

async function scrapeWechat() {
    const url = process.argv[2];
    if (!url) return console.log("❌ 缺少链接");

    // 开启“有头模式”的底层特征，但保持 headless: true 运行
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'] 
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN',
        });

        const page = await context.newPage();
        
        // 【核心】注入 JS 抹除自动化受控标记
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        
        // 模拟真人停留 2 秒
        await page.waitForTimeout(2000);

        // 微信文章内容的容器选择器
        const content = await page.innerText('#img-content') || await page.innerText('body');
        
        if (content.includes("验证") || content.includes("环境异常")) {
            console.log("❌ 攻坚失败：微信依然认出了我是机器人。建议：黑总，请更换代理软件的节点（IP）再试。");
        } else {
            console.log(content.slice(0, 5000)); // 吐出正文
        }
    } catch (e) {
        console.log(`❌ 异常: ${e.message}`);
    } finally {
        await browser.close();
    }
}
scrapeWechat();
