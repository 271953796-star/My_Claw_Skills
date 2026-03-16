import * as Lark from '@larksuiteoapi/node-sdk';

console.log("🚀 [SYSTEM] 正在发起【修正版】握手尝试...");

const client = new Lark.WSClient({
    appId: 'cli_a920f503a5fb5bc6', // 重点：d 是小写的
    appSecret: '59M1VuFv55s1VwpYwwOpjbiMDhHprhxw',
    domain: Lark.Domain.Feishu
});

// 飞书 SDK 启动时需要一个空的处理器，防止它崩溃
try {
    client.start({
        eventDispatcher: new Lark.EventDispatcher()
    });
    console.log("✅ [SUCCESS] 握手指令已发出！");
    console.log("📢 [ACTION] 只要没有出现 'appId is needed'，立刻去网页端点【保存】！");
} catch (e) {
    console.error("❌ [ERROR] 启动失败:", e);
}

setInterval(() => {
    console.log("⏳ [HEARTBEAT] 保持连接中...");
}, 5000);