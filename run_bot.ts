import * as Lark from "@larksuiteoapi/node-sdk";
import axios from "axios";
import { chromium } from "playwright"; 
import path from "path";
import fs from "fs"; 
import { fileURLToPath } from "url";
import * as lancedb from "@lancedb/lancedb";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 基础配置 ---
const config = {
  appId: "cli_a920f503a5fb5bc6",
  appSecret: "59M1VuFv55s1VwpYwwOpjbiMDhHprhxw",
  deepseekKey: "sk-55ec1b3791b7475da60466dddd2ea0ec",
  dbPath: path.join(__dirname, ".lancedb"),
  logPath: path.join(__dirname, "data/daily_log.txt"),      
  historyPath: path.join(__dirname, "data/chat_history.txt"),
  skillsDir: path.join(__dirname, "skills"),
  githubRepo: "https://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@github.com/271953796-star/My_Claw_Skills.git" 
};

const lark = new Lark.Client({ appId: config.appId, appSecret: config.appSecret, domain: Lark.Domain.Feishu });
const ws = new Lark.WSClient({ appId: config.appId, appSecret: config.appSecret, domain: Lark.Domain.Feishu });
const processedMsgs = new Set(); 

// --- 【物理感知】 ---
function getLocalFileSystemInfo(): string {
    try {
        const eRoot = "E:/"; 
        const eFiles = fs.existsSync(eRoot) ? fs.readdirSync(eRoot) : ["E盘根目录不可访问"];
        const botFiles = fs.readdirSync(__dirname);
        const dataFiles = fs.existsSync(path.join(__dirname, "data")) ? fs.readdirSync(path.join(__dirname, "data")) : [];
        const skillFiles = fs.existsSync(config.skillsDir) ? fs.readdirSync(config.skillsDir) : ["尚未建立技能库"];
        
        return `
【物理环境扫描】
- E盘内容: ${eFiles.join(", ")}
- 机器人路径: ${botFiles.join(", ")}
- Data存档: ${dataFiles.join(", ")}
- Skills库: ${skillFiles.join(", ")}
`.trim();
    } catch (e) { return "无法读取物理文件系统。"; }
}

// --- GitHub 同步 ---
async function syncSkills(): Promise<string> {
    try {
        if (!fs.existsSync(config.skillsDir)) fs.mkdirSync(config.skillsDir, { recursive: true });
        console.log(`📡 正在同步 GitHub 技能库...`);
        if (!fs.existsSync(path.join(config.skillsDir, ".git"))) {
            execSync(`git clone ${config.githubRepo} ${config.skillsDir}`);
        } else {
            execSync(`cd ${config.skillsDir} && git pull`);
        }
        const files = fs.readdirSync(config.skillsDir).filter(f => !f.startsWith('.'));
        return `✅ 技能库已同步完成。当前包含技能：\n${files.join(", ")}`;
    } catch (e: any) {
        return `❌ 同步失败，原因如下: ${e.message}`;
    }
}

// --- 【核心解析】破壁级抓取 (Jina 引擎 + Playwright 双保险) ---
async function scrapeWithJS(url: string): Promise<string> {
    const cleanUrl = url.replace(/[\\\\"'"\[\]{}]/g, '').trim();
    console.log(`🎯 准备处理目标链接: ${cleanUrl}`);

    // 【第一级策略：Jina Reader 破壁引擎】
    try {
        console.log(`🚀 优先启动 Jina 远程解析...`);
        const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
        // 增加对微信等复杂页面的针对性超时设置
        const response = await axios.get(jinaUrl, { timeout: 25000 });
        
        if (response.data && response.data.length > 200) {
            console.log("✅ Jina 解析成功，内容纯净。");
            return response.data.slice(0, 15000);
        }
    } catch (e) {
        console.log("⚠️ Jina 引擎受阻，正在为您切换本地 Playwright 环境进行强攻...");
    }

    // 【第二级策略：本地 Playwright 物理模拟】
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ 
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" 
        });
        const page = await context.newPage();
        
        // 专门针对微信链接的伪装策略
        if (cleanUrl.includes("mp.weixin.qq.com")) {
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });
        }

        await page.goto(cleanUrl, { waitUntil: 'load', timeout: 45000 });
        
        // 关键延迟：等待动态内容和图文渲染
        await new Promise(r => setTimeout(r, 3000));
        
        const text = await page.innerText('body');
        await browser.close();
        return text.length > 5 ? text.slice(0, 15000) : "FAILED_CONTENT_EMPTY";
    } catch (e: any) {
        if (browser) await browser.close();
        console.error(`❌ 抓取任务彻底中断: ${e.message}`);
        return `FAILED: ${e.message}`;
    }
}

// --- 关键词/记忆 ---
async function checkLocalMemory(query: string): Promise<string | null> {
    const triggerWords = ["查：", "查本地：", "查:"];
    const hasTrigger = triggerWords.find(word => query.startsWith(word));
    if (!hasTrigger) return null; 
    const searchKey = query.replace(hasTrigger, "").trim();
    try {
        if (!fs.existsSync(config.logPath)) return "⚠️ 账本目前没有任何记录。";
        const content = fs.readFileSync(config.logPath, 'utf8');
        const lines = content.split('\n').reverse(); 
        for (const line of lines) {
            if (line.includes(searchKey)) return line.split(']').slice(1).join(']').trim(); 
        }
        return `❌ 抱歉，未能在本地找到关于“${searchKey}”的记录。`;
    } catch (e) { return null; }
}

async function getIdentityMemory(query: string): Promise<string> {
    try {
        const db = await lancedb.connect(config.dbPath);
        const tables = await db.tableNames();
        if (!tables.includes("memories")) return "身份确认：黑总的专业管家。";
        const table = await db.openTable("memories");
        const results = await table.search(query).limit(1).toArray();
        return results.length > 0 ? `背景记忆片段: ${results[0].text}` : "无特定记忆参考。";
    } catch (e) { return "确认身份：黑总。"; }
}

async function autoArchive(user: string, bot: string) {
    try {
        const dir = path.dirname(config.historyPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const entry = `[${new Date().toLocaleString()}] 黑总: ${user} | 管家: ${bot}\n`;
        fs.appendFileSync(config.historyPath, entry);
    } catch (e) { console.error("存档失败"); }
}

// --- 核心调度逻辑 ---
ws.start({ eventDispatcher: new Lark.EventDispatcher({ encryptKey: "" }).register({
  "im.message.receive_v1": async (data: any) => {
    const msgId = data.message.message_id;
    if (processedMsgs.has(msgId)) return { code: 0 };
    processedMsgs.add(msgId);

    let userText = "";
    try { 
        const content = JSON.parse(data.message.content);
        userText = content.text || ""; 
    } catch (e) { 
        userText = data.message.content || ""; 
    }
    
    if (!userText) return { code: 0 };

    // 1. 记下功能
    if (userText.startsWith("记下：") || userText.startsWith("记下:")) {
        const note = userText.replace(/记下[:：]/, "").trim();
        const logEntry = `[${new Date().toLocaleString()}] ${note}\n`;
        if (!fs.existsSync(path.dirname(config.logPath))) fs.mkdirSync(path.dirname(config.logPath), { recursive: true });
        fs.appendFileSync(config.logPath, logEntry);
        await lark.im.message.reply({ path: { message_id: msgId }, data: { content: JSON.stringify({ text: `✅ 黑总，信息已成功物理存入：\n"${note}"` }), msg_type: "text" } });
        return { code: 0 };
    }

    // 2. 同步技能
    if (userText === "同步技能" || userText === "更新技能") {
        const syncResult = await syncSkills();
        await lark.im.message.reply({ path: { message_id: msgId }, data: { content: JSON.stringify({ text: syncResult }), msg_type: "text" } });
        return { code: 0 };
    }

    // 3. 手动执行技能
    if (userText.startsWith("执行技能：") || userText.startsWith("执行技能:")) {
        const cmd = userText.replace(/执行技能[:：]/, "").trim();
        const [skillName, ...args] = cmd.split(/\s+/);
        const skillFile = skillName.endsWith('.js') || skillName.endsWith('.cjs') ? skillName : `${skillName}.js`;
        const skillPath = path.join(config.skillsDir, skillFile);
        
        if (fs.existsSync(skillPath)) {
            try {
                const output = execSync(`node "${skillPath}" "${args.join(' ')}"`).toString();
                await lark.im.message.reply({ path: { message_id: msgId }, data: { content: JSON.stringify({ text: `【特种技能回传】\n${output.slice(0, 3000)}` }), msg_type: "text" } });
            } catch (e: any) {
                await lark.im.message.reply({ path: { message_id: msgId }, data: { content: JSON.stringify({ text: `❌ 技能运行异常: ${e.message}` }), msg_type: "text" } });
            }
        } else {
            await lark.im.message.reply({ path: { message_id: msgId }, data: { content: JSON.stringify({ text: `❌ 找不到名为 ${skillFile} 的技能文件。` }), msg_type: "text" } });
        }
        return { code: 0 };
    }

    // 4. 拦截本地检索
    const localHit = await checkLocalMemory(userText);
    if (localHit) {
        await lark.im.message.reply({ path: { message_id: msgId }, data: { content: JSON.stringify({ text: `【本地检索结果】\n${localHit}` }), msg_type: "text" } });
        return { code: 0 };
    }

    // 5. 链接识别与处理 (智能降级抓取)
    const urlMatch = userText.match(/https?:\/\/[^\s\n\r"'}]+/);
    const targetUrl = urlMatch ? urlMatch[0] : null;
    const memory = await getIdentityMemory(userText);

    if (targetUrl) {
        let intelligence = await scrapeWithJS(targetUrl);
        await executeReply(msgId, intelligence, targetUrl, memory, userText);
    } else {
        await executeReply(msgId, null, userText, memory, userText);
    }
    return { code: 0 };
  }
})});

// --- AI 情报中枢 ---
async function executeReply(msgId: string, info: string | null, input: string, memory: string, rawInput: string) {
    try {
        const realFileInfo = getLocalFileSystemInfo();
        const currentTime = new Date().toLocaleString('zh-CN', { hour12: false });
        const systemPrompt = `你是黑总的专业情报管家。请用沉稳、专业且得体的方式提供帮助。
【环境扫描】：${realFileInfo}
【背景记忆】：${memory}
【最高准则】：严禁凭空捏造。若信息抓取结果显示“FAILED”或内容为空，请如实告知并建议黑总检查网络环境或节点。`;

        const userPrompt = info ? `情报素材如下：\n${info}\n\n原始请求链接：${input}` : input;
        const res = await axios.post("https://api.deepseek.com/v1/chat/completions", {
            model: "deepseek-chat",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }]
        }, { headers: { "Authorization": `Bearer ${config.deepseekKey}` } });

        const replyContent = res.data.choices[0].message.content;
        await autoArchive(rawInput, replyContent);
        await lark.im.message.reply({ path: { message_id: msgId }, data: { content: JSON.stringify({ text: replyContent }), msg_type: "text" } });
    } catch (err) { console.error("❌ AI回复失败"); }
}

console.log(`🚀 【黑总专用·情报管家 V3.9 破壁增强版】已上线！`);