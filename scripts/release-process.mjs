import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk));
    child.stderr?.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", async (code, signal) => {
      const result = { command: [command, ...args], code: code ?? 1, signal, stdout, stderr };
      if (options.logPath) await writeFile(options.logPath, `${stdout}${stderr}`, "utf8");
      if (code === 0) resolve(result);
      else reject(Object.assign(new Error(`${command} exited ${code ?? signal}\n${stderr || stdout}`), { result }));
    });
  });
}
