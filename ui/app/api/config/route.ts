import { NextResponse } from "next/server";
import { resolve } from "path";
import { existsSync } from "fs";
import { spawn } from "child_process";

export async function GET() {
  console.log("[API Config] GET request received");
  return new Promise((resolvePromise, reject) => {
    // In Next.js, process.cwd() is the project root (ui/)
    // We need to go up one level to find dist/
    const cwd = process.cwd();
    const distPath = resolve(cwd, "..", "dist", "config.js");
    console.log("[API Config] Loading config from:", distPath);
    console.log("[API Config] Current working directory:", cwd);
    
    // Check if dist exists
    if (!existsSync(distPath)) {
      reject(NextResponse.json(
        { error: `Simulator not compiled. Please run 'npm run build' in the root directory first. Expected: ${distPath}` },
        { status: 500 }
      ));
      return;
    }
    
    // Use node -e to import and print the config
    // Use file:// URL for Windows compatibility
    const fileUrl = distPath.startsWith("/") ? `file://${distPath}` : `file:///${distPath.replace(/\\/g, "/")}`;
    const child = spawn("node", ["--input-type=module", "-e", `import("${fileUrl}").then(m => console.log(JSON.stringify(m.DEFAULT_CONFIG)))`], {
      cwd: resolve(cwd, ".."),
    });
    
    let stdout = "";
    let stderr = "";
    
    child.stdout.on("data", (data) => {
      stdout += data.toString();
      console.log("[API Config] stdout chunk:", data.toString().substring(0, 100));
    });
    
    child.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error("[API Config] stderr:", data.toString());
    });
    
    child.on("close", (code) => {
      console.log("[API Config] Process exited with code:", code);
      if (code === 0) {
        try {
          const config = JSON.parse(stdout.trim());
          console.log("[API Config] Successfully loaded config, keys:", Object.keys(config));
          resolvePromise(NextResponse.json(config));
        } catch (e: any) {
          console.error("[API Config] Parse error:", e.message, "Output:", stdout.substring(0, 200));
          reject(NextResponse.json(
            { error: `Failed to parse config: ${e.message}. Output: ${stdout.substring(0, 200)}` },
            { status: 500 }
          ));
        }
      } else {
        console.error("[API Config] Process failed:", stderr || stdout);
        reject(NextResponse.json(
          { error: `Failed to load config (code ${code}): ${stderr || stdout}. Make sure to run 'npm run build' first.` },
          { status: 500 }
        ));
      }
    });
    
    child.on("error", (error) => {
      console.error("[API Config] Spawn error:", error);
      reject(NextResponse.json(
        { error: `Failed to start config loader: ${error.message}` },
        { status: 500 }
      ));
    });
  });
}
