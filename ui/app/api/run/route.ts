import { NextRequest, NextResponse } from "next/server";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";
import { spawn } from "child_process";

// Get the directory of the current file (for ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run simulator via child process (most reliable approach)
function runSimulator(body: any): Promise<any> {
  return new Promise((resolvePromise, reject) => {
    console.log("[API Run] ===== Starting runSimulator =====");
    console.log("[API Run] import.meta.url:", import.meta.url);
    console.log("[API Run] __filename:", __filename);
    console.log("[API Run] __dirname:", __dirname);
    
    // Resolve paths: from ui/app/api/run -> ui/ directory
    // In dev mode: __dirname is ui/app/api/run, go up 3 levels
    // In prod mode: __dirname is .next/server/app/api/run, go up 6 levels
    // Try dev mode first (3 levels up)
    let uiDir = resolve(__dirname, "..", "..", "..");
    console.log("[API Run] Initial uiDir (3 levels up from __dirname):", uiDir);
    
    // Verify this is the ui directory by checking for package.json with name "trading-ui"
    let pkgPath = resolve(uiDir, "package.json");
    console.log("[API Run] Checking package.json at:", pkgPath);
    console.log("[API Run] package.json exists?", existsSync(pkgPath));
    
    if (!existsSync(pkgPath)) {
      // Try prod mode (6 levels up from .next/server/app/api/run)
      uiDir = resolve(__dirname, "..", "..", "..", "..", "..", "..");
      console.log("[API Run] package.json not found, trying 6 levels up (prod mode):", uiDir);
      pkgPath = resolve(uiDir, "package.json");
      console.log("[API Run] Checking package.json at:", pkgPath);
      console.log("[API Run] package.json exists?", existsSync(pkgPath));
    }
    
    if (existsSync(pkgPath)) {
      try {
        const pkgContent = JSON.parse(readFileSync(pkgPath, "utf-8"));
        console.log("[API Run] package.json name:", pkgContent.name);
        if (pkgContent.name !== "trading-ui") {
          console.error("[API Run] Wrong package name, expected 'trading-ui', got:", pkgContent.name);
          // This shouldn't happen, but if it does, try going up one more level and into ui/
          uiDir = resolve(uiDir, "..", "ui");
          console.log("[API Run] Trying alternative path:", uiDir);
          pkgPath = resolve(uiDir, "package.json");
        }
      } catch (e: any) {
        console.error("[API Run] Error reading package.json:", e.message);
        reject(new Error(`Could not read package.json: ${e.message}`));
        return;
      }
    }
    
    // Final verification
    const finalPkgPath = resolve(uiDir, "package.json");
    if (!existsSync(finalPkgPath)) {
      console.error("[API Run] ERROR: Could not find ui/package.json");
      console.error("[API Run] Tried:", uiDir);
      reject(new Error(`Could not locate ui directory. Tried: ${uiDir}`));
      return;
    }
    
    const wrapperPath = resolve(uiDir, "scripts", "runSimWrapper.mjs");
    const parentDir = resolve(uiDir, ".."); // trading/ directory
    
    console.log("[API Run] Final UI directory:", uiDir);
    console.log("[API Run] Final wrapper script path:", wrapperPath);
    console.log("[API Run] Final parent directory (trading/):", parentDir);
    console.log("[API Run] Wrapper exists?", existsSync(wrapperPath));
    console.log("[API Run] Parent dir exists?", existsSync(parentDir));
    
    // Check if wrapper exists
    if (!existsSync(wrapperPath)) {
      console.error("[API Run] ERROR: Wrapper script not found!");
      console.error("[API Run] Checked path:", wrapperPath);
      console.error("[API Run] uiDir:", uiDir);
      const scriptsDir = resolve(uiDir, "scripts");
      console.error("[API Run] scripts dir exists?", existsSync(scriptsDir));
      if (existsSync(scriptsDir)) {
        try {
          const fs = require("fs");
          const scriptsContents = fs.readdirSync(scriptsDir);
          console.error("[API Run] scripts dir contents:", scriptsContents);
        } catch (e: any) {
          console.error("[API Run] Could not read scripts directory:", e.message);
        }
      }
      reject(new Error(`Wrapper script not found at ${wrapperPath}. Make sure ui/scripts/runSimWrapper.mjs exists.`));
      return;
    }
    
    console.log("[API Run] ✓ Wrapper script found, starting child process");
    console.log("[API Run] Command: node", wrapperPath);
    console.log("[API Run] CWD:", parentDir);
    
    const child = spawn("node", [wrapperPath], {
      cwd: parentDir,
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    let stdout = "";
    let stderr = "";
    
    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log("[API Run] stdout chunk:", chunk.substring(0, 100));
    });
    
    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.error("[API Run] stderr chunk:", chunk);
    });
    
    child.on("close", (code) => {
      console.log("[API Run] Process exited with code:", code);
      console.log("[API Run] stdout length:", stdout.length);
      console.log("[API Run] stderr length:", stderr.length);
      
      if (code !== 0) {
        console.error("[API Run] Process failed - stdout:", stdout.substring(0, 500));
        console.error("[API Run] Process failed - stderr:", stderr);
        rejectPromise(new Error(`Simulator process failed (code ${code}): ${stderr || stdout.substring(0, 200)}`));
      } else {
        try {
          console.log("[API Run] Parsing stdout:", stdout.substring(0, 200));
          const parsed = JSON.parse(stdout);
          console.log("[API Run] Successfully parsed response");
          console.log("[API Run] Response keys:", Object.keys(parsed));
          console.log("[API Run] Response meta:", parsed.meta);
          console.log("[API Run] Response finalLeaderboard length:", parsed.finalLeaderboard?.length);
          resolvePromise(parsed);
        } catch (parseError: any) {
          console.error("[API Run] Parse error:", parseError.message);
          console.error("[API Run] Parse error - stdout:", stdout.substring(0, 500));
          rejectPromise(new Error(`Failed to parse simulator output: ${parseError.message}. Output: ${stdout.substring(0, 200)}`));
        }
      }
    });
    
    child.on("error", (error) => {
      console.error("[API Run] Child process spawn error:", error);
      console.error("[API Run] Error details:", {
        message: error.message,
        code: (error as any).code,
        errno: (error as any).errno,
      });
      rejectPromise(new Error(`Failed to start simulator process: ${error.message}`));
    });
    
    const inputJson = JSON.stringify(body);
    console.log("[API Run] Sending input to simulator (length:", inputJson.length, "chars)");
    console.log("[API Run] Input preview:", inputJson.substring(0, 200));
    
    child.stdin.write(inputJson);
    child.stdin.end();
    console.log("[API Run] Input sent, waiting for response...");
  });
}

export async function POST(request: NextRequest) {
  console.log("[API Run] POST request received");
  try {
    const body = await request.json();
    const { override = {}, mode = "summary", stride = 5 } = body;

    console.log("[API Run] Request body parsed:", {
      overrideKeys: Object.keys(override),
      mode,
      stride,
      overrideSeed: override.seed,
      overrideT: override.T,
    });

    // Run simulator via child process (reliable and avoids webpack issues)
    console.log("[API Run] Calling runSimulator...");
    const response = await runSimulator(body);
    console.log("[API Run] runSimulator completed successfully");
    console.log("[API Run] Response type:", typeof response);
    console.log("[API Run] Response keys:", Object.keys(response || {}));
    console.log("[API Run] Response meta:", response?.meta);
    console.log("[API Run] Response finalLeaderboard length:", response?.finalLeaderboard?.length);
    
    return NextResponse.json(response);

  } catch (error: any) {
    console.error("[API Run] Error caught in POST handler:", error);
    console.error("[API Run] Error stack:", error.stack);
    const errorMessage = error.message || "Simulation failed";
    
    // Provide helpful error message if dist doesn't exist
    if (errorMessage.includes("Cannot find module") || errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
      return NextResponse.json(
        { error: `Simulator error: ${errorMessage}. Make sure to run 'npm run build' in the root directory first.` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
