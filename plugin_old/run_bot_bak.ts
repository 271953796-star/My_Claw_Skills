import * as Lark from "@larksuiteoapi/node-sdk";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const config = {
  appId: "cli_a920f503a5fb5bc6",
  appSecret: "59M1VuFv55s1VwpYwwOpjbiMDhHprhxw",
  deepseekKey: "sk-55ec1b3791b7475da60466dddd2ea0ec"
};

const lark = new Lark.Client({ appId: config.appId, appSecret: config.appSecret, domain: Lark.Domain.Feishu });
const ws = new Lark.WSClient({ appId: config.appId, appSecret: config.appSecret, domain: Lark.Domain.Feishu });

let pendingCommand: string | null = null;
const processedMsgIds = new Set<string>();

// 封装 AI 对话函数，方便多次调用
async function askAI(userInput: string, isErrorDiagnostic = false) {
  const systemPrompt = isErrorDiagnostic 
    ? `你是一个 Windows 专家。刚才执行的命令报错了。请用大白话解释报错原因（可能选错了命令格式，如误用PowerShell），并直接给出修正后的 CMD 命令。格式：【修正建议】：内容 \n 【COMMAND】: 命令`
    : `你是一个 Windows AI 助手。必须先用大白话解释操作，确认无风险后询问“请确认是否执行？回复‘是’或‘不是’”，最后一行给命令：【COMMAND】: 命令。严禁使用代码块。只准使用 CMD 命令。`;

  try {
    const res = await axios.post("https://api.deepseek.com/v1/chat/completions", {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput }
      ]
    }, { headers: { "Authorization": `Bearer ${config.deepseekKey}` } });
    return res.data.choices[0].message.content;
  } catch (err) {
    return "AI 响应失败，请检查网络。";
  }
}

ws.start({ eventDispatcher: new Lark.EventDispatcher({ encryptKey: "" }).register({
  "im.message.receive_v1": async (data: any) => {
    const msgId = data.message.message_id;
    if (processedMsgIds.has(msgId)) return { code: 0 };
    processedMsgIds.add(msgId);
    if (processedMsgIds.size > 100) processedMsgIds.delete(processedMsgIds.values().next().value);

    let text: any = "";
    try {
      const content = JSON.parse(data.message.content);
      text = content.text || content.content || "";
    } catch (e) { text = data.message.content || ""; }

    text = String(text).replace(/回复\s+.*?:/g, "").trim();
    if (!text || text === "undefined") return { code: 0 };

    // --- 处理“是”执行逻辑 ---
    if (text === "是" || text.toLowerCase() === "yes" || text.includes("批准")) {
      if (pendingCommand) {
        const currentTask = pendingCommand;
        pendingCommand = null; 
        try {
          const { stdout, stderr } = await execAsync(currentTask, { cwd: "E:\\OpenClaw_Bot" });
          await lark.im.message.reply({
            path: { message_id: msgId },
            data: { content: JSON.stringify({ text: `✅ 执行成功！\n${stdout || stderr || 'Done.'}` }), msg_type: "text" }
          });
        } catch (err: any) {
          // 【核心功能：自我纠错】
          console.log(` [System] >>> 发现报错，正在请求 AI 诊断...`);
          const diagnosticReply = await askAI(`命令 "${currentTask}" 执行报错了，错误信息是：${err.message}`);
          
          const cmdMatch = diagnosticReply.match(/【COMMAND】:\s*([\s\S]*)/);
          if (cmdMatch) pendingCommand = cmdMatch[1].replace(/```/g, "").trim();

          await lark.im.message.reply({
            path: { message_id: msgId },
            data: { content: JSON.stringify({ text: `❌ 执行出错了，我检查了一下原因：\n\n${diagnosticReply}` }), msg_type: "text" }
          });
        }
      }
      return { code: 0 };
    }

    // --- 普通对话逻辑 ---
    const aiReply = await askAI(text);
    const cmdMatch = aiReply.match(/【COMMAND】:\s*([\s\S]*)/);
    if (cmdMatch) pendingCommand = cmdMatch[1].replace(/```/g, "").trim();

    await lark.im.message.reply({
      path: { message_id: msgId },
      data: { content: JSON.stringify({ text: aiReply }), msg_type: "text" }
    });
    return { code: 0 };
  }
})});

console.log("\n [System] >>> 🚀 自我诊断增强版机器人已启动！");