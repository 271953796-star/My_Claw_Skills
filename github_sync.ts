import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 技能仓库配置 ---
const GITHUB_REPO = "https://github.com/YourUsername/My_Claw_Skills.git"; // 黑总，这里换成您的技能仓库
const SKILLS_DIR = path.join(__dirname, "skills");

/**
 * 核心技能：从 GitHub 同步并加载新功能
 */
export async function syncSkillsFromGithub() {
    try {
        // 1. 物理目录检查
        if (!fs.existsSync(SKILLS_DIR)) {
            fs.mkdirSync(SKILLS_DIR, { recursive: true });
        }

        console.log(`📡 正在连接 GitHub 仓库...`);
        
        // 2. 执行 Git 操作 (如果没文件夹就 clone，有了就 pull)
        if (!fs.existsSync(path.join(SKILLS_DIR, ".git"))) {
            execSync(`git clone ${GITHUB_REPO} ${SKILLS_DIR}`, { stdio: 'inherit' });
        } else {
            execSync(`cd ${SKILLS_DIR} && git pull`, { stdio: 'inherit' });
        }

        // 3. 扫描新下载的技能
        const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith(".js") || f.endsWith(".ts"));
        
        return `✅ 报告黑总，同步完成！共发现 ${files.length} 个技能文件：\n${files.join(", ")}\n\n龙虾已准备好随时调用。`;

    } catch (e: any) {
        return `❌ GitHub 同步失败: ${e.message}\n(请检查您的电脑是否安装了 Git，以及仓库地址是否正确)`;
    }
}