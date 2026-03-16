const { chromium } = require('playwright');

async function scrapeWechat() {
    const url = process.argv[2];
    if (!url) return console.log("❌ 缺少链接");

    // 1. 启动配置：抹除自动化受控特征
    const browser = await chromium.launch({ 
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox'
        ]
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN',
            viewport: { width: 375, height: 667 },
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true
        });

        const page = await context.newPage();
        
        // 2. 注入核心混淆：让浏览器觉得自己不是爬虫
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        });

        console.log(`🚀 正在秘密潜入: ${url}`);
        
        // 3. 随机等待，模拟真人犹豫（0.5s - 2s）
        await page.waitForTimeout(Math.floor(Math.random() * 1500) + 500);

        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

        // 4. 模拟真人下滑动作
        await page.evaluate(async () => {
            window.scrollBy(0, 400);
            await new Promise(r => setTimeout(r, 500));
            window.scrollBy(0, 800);
        });

        // 5. 抓取正文：优先抓取微信特有的文章容器
        const content = await page.innerText('#img-content') || await page.innerText('.rich_media_content');
        
        if (content && content.length > 50) {
            console.log(content.slice(0, 8000)); // 吐出深度情报
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
