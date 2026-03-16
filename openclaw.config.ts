import { defineConfig } from "openclaw";

export default defineConfig({
  // 关键：这里只写 "feishu"，不要写路径，强制它只认这一个
  plugins: ["my_custom_bot"], 
  gateway: {
    model: "openai/deepseek-chat",
  }
});