const { chromium } = require('playwright');

async function scrapeWechat() {
    const url = process.argv[2];
    if (!url) return console.log("❌ 缺少链接");

    const browser = await chromium.launch({ 
        headless: true, // 如果还是被拦，可以手动改成 false 观察一下
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN',
            viewport: { width: 375, height: 667 },
            isMobile: true,
            hasTouch: true
        });

        const page = await context.newPage();
        
        // 抹除自动化痕迹
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        });

        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(2000); // 模拟真人停顿

        // 尝试抓取微信内容容器
        const content = await page.innerText('#img-content') || await page.innerText('.rich_media_content');
        
        if (content && content.length > 50) {
            console.log(content.slice(0, 8000)); 
        } else {
            console.log("❌ 攻坚失败：微信依然返回了验证页面。原因：此 IP 已被标记。");
        }
    } catch (e) {
        console.log(`❌ 异常拦截: ${e.message}`);
    } finally {
        await browser.close();
    }
}
scrapeWechat();
