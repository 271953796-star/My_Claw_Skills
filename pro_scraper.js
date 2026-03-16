const { chromium } = require('playwright');

async function scrapeWechat() {
    const url = process.argv[2];
    if (!url) {
        console.log("❌ 缺少链接");
        return;
    }

    const browser = await chromium.launch({ 
        headless: true // 微信很聪明，如果还不行，下次咱改 false 看它怎么跳
    });
    
    try {
        const context = await browser.newContext({
            // 【关键】伪装成真实的移动端微信环境
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN',
            viewport: { width: 375, height: 667 }
        });

        const page = await context.newPage();
        
        // 【混淆】注入一段脚本，抹除自动化工具特征
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        console.log(`🚀 正在深度解析: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // 模拟真人滚动，触发懒加载内容
        await page.evaluate(async () => {
            await new Promise(resolve => {
                let totalHeight = 0;
                let distance = 100;
                let timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= document.body.scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        const content = await page.innerText('#img-content'); // 微信文章的核心容器
        console.log(content.slice(0, 2000)); // 只取前2000字，防止飞书爆表
    } catch (e) {
        console.log(`❌ 爬取失败: ${e.message}`);
    } finally {
        await browser.close();
    }
}

scrapeWechat();
