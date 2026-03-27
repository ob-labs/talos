import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import { execSync } from "child_process";
import { createInterface } from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface UpdateOptions {
  check?: boolean;
  force?: boolean;
}

/**
 * 从 npm registry 获取最新版本信息
 */
async function getLatestVersion(packageName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const options = {
      hostname: "registry.npmjs.org",
      path: `/${packageName}`,
      method: "GET",
      headers: {
        "User-Agent": "talos-cli",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const packageInfo = JSON.parse(data);
          resolve(packageInfo["dist-tags"]?.latest || null);
        } catch (error) {
          console.error("Error parsing version info:", error);
          resolve(null);
        }
      });
    });

    req.on("error", (error) => {
      console.error("Error fetching latest version:", error.message);
      resolve(null);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.error("Request timeout while fetching latest version");
      resolve(null);
    });

    req.end();
  });
}

/**
 * 比较版本号
 * 返回: 1 (version1 > version2), 0 (相等), -1 (version1 < version2)
 */
export function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split(".").map(Number);
  const v2Parts = version2.split(".").map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }

  return 0;
}

/**
 * Get current installed version
 * This will be replaced with the actual version during build
 */
function getCurrentVersion(): string {
  // VERSION_PLACEHOLDER will be replaced during build
  return "VERSION_PLACEHOLDER";
}

/**
 * Get package name
 * This will be replaced with the actual package name during build
 */
function getPackageName(): string {
  // PACKAGE_NAME_PLACEHOLDER will be replaced during build
  return "PACKAGE_NAME_PLACEHOLDER";
}

/**
 * 检测是否使用 npm 安装
 */
function isNpmInstallation(): boolean {
  try {
    const npmGlobalRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
    const cliPath = join(__dirname, "../..");
    return cliPath.includes(npmGlobalRoot);
  } catch {
    return false;
  }
}

/**
 * 检测是否使用 pnpm 安装
 */
function isPnpmInstallation(): boolean {
  try {
    const pnpmGlobalRoot = execSync("pnpm root -g", { encoding: "utf-8" }).trim();
    const cliPath = join(__dirname, "../..");
    return cliPath.includes(pnpmGlobalRoot);
  } catch {
    return false;
  }
}

/**
 * 检测是否使用 yarn 安装
 */
function isYarnInstallation(): boolean {
  try {
    const yarnGlobalRoot = execSync("yarn global dir", { encoding: "utf-8" }).trim();
    const cliPath = join(__dirname, "../..");
    return cliPath.includes(yarnGlobalRoot);
  } catch {
    return false;
  }
}

/**
 * 获取包管理器类型
 */
function getPackageManager(): { name: string; updateCommand: string } | null {
  if (isNpmInstallation()) {
    return { name: "npm", updateCommand: "npm update -g talos-cli" };
  }
  if (isPnpmInstallation()) {
    return { name: "pnpm", updateCommand: "pnpm update -g talos-cli" };
  }
  if (isYarnInstallation()) {
    return { name: "yarn", updateCommand: "yarn global upgrade talos-cli" };
  }
  return null;
}

/**
 * 询问用户是否继续
 */
function askUser(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * 执行更新命令
 */
function executeUpdate(command: string): boolean {
  try {
    console.log(`\nExecuting update command: ${command}`);
    execSync(command, { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error("Update failed:", error);
    return false;
  }
}

/**
 * update 命令的主函数
 */
export async function updateCommand(options: UpdateOptions = {}): Promise<void> {
  const currentVersion = getCurrentVersion();
  const packageName = getPackageName();

  console.log(`Current version: ${currentVersion}`);
  console.log("Checking for latest version...");

  const latestVersion = await getLatestVersion(packageName);

  if (!latestVersion) {
    console.error("Unable to fetch latest version info. Please check your network connection or try again later.");
    process.exit(1);
  }

  console.log(`Latest version: ${latestVersion}`);

  const versionComparison = compareVersions(latestVersion, currentVersion);

  if (versionComparison === 0) {
    console.log("✓ You are already using the latest version!");
    return;
  }

  if (versionComparison < 0) {
    console.log("⚠ You are using a version newer than the latest stable release.");
    return;
  }

  console.log(`\nNew version available: ${latestVersion} (current: ${currentVersion})`);

  if (options.check) {
    console.log("\nUsing --check option, no update performed. To update, run: talos update");
    return;
  }

  const packageManager = getPackageManager();

  if (!packageManager) {
    console.log("\n⚠ Unable to auto-detect package manager.");
    console.log("Please manually update talos-cli:");
    console.log("  npm:  npm update -g talos-cli");
    console.log("  pnpm: pnpm update -g talos-cli");
    console.log("  yarn: yarn global upgrade talos-cli");
    return;
  }

  console.log(`\nDetected package manager: ${packageManager.name}`);
  console.log(`Update command: ${packageManager.updateCommand}`);

  if (!options.force) {
    const shouldUpdate = await askUser("\nUpdate now? (y/N): ");
    if (!shouldUpdate) {
      console.log("Update cancelled.");
      return;
    }
  }

  const success = executeUpdate(packageManager.updateCommand);

  if (success) {
    console.log("\n✓ Update successful!");
    console.log("Please restart your terminal or run 'hash -r' to use the new version.");
  } else {
    console.log("\n✗ Update failed. Please run the update command manually.");
    process.exit(1);
  }
}
