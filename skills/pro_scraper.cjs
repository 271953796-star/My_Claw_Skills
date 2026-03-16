const { chromium } = require('playwright');

async function scrapeWechat() {
    const url = process.argv[2];
    if (!url) return console.log("❌ 缺少链接");

    const browser = await chromium.launch({ 
        headless: true, // 如果总是超时，可以改 false 看看是不是卡在验证码了
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
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        console.log(`🚀 深度潜入中...`);
        // 增加到 60 秒等待，预防网络慢
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        // 【关键判断】检查是否遇到了验证码或拦截
        const isBlocked = await page.evaluate(() => {
            return document.body.innerText.includes("验证") || !!document.querySelector('.weui-msg');
        });

        if (isBlocked) {
            console.log("❌ 撞墙了：微信弹出了滑块验证。请黑总切换代理节点（换个IP）。");
        } else {
            // 尝试多个可能的容器，哪个有就抓哪个
            const content = await page.innerText('#img-content') || await page.innerText('.rich_media_content') || await page.innerText('body');
            console.log(content.slice(0, 8000));
        }
    } catch (e) {
        console.log(`❌ 彻底堵塞: ${e.message}`);
    } finally {
        await browser.close();
    }
}
scrapeWechat();