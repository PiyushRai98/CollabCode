import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { config } from '../config';
import { ExecutionRequest, ExecutionResult } from '../types';
import { logger } from '../utils/logger';

const TEMP_DIR = path.join(os.tmpdir(), 'collab-exec');
try { mkdirSync(TEMP_DIR, { recursive: true }); } catch { /* exists */ }

const LANGUAGE_CONFIG_SUPPORTED = new Set(['javascript', 'python', 'cpp']);

const FILE_EXT: Record<string, string> = {
  javascript: 'js',
  python: 'py',
  cpp: 'cpp',
};

// Runtime commands available on the host (no Docker needed)
const LOCAL_RUNNERS: Record<string, { cmd: string; args: (file: string) => string[] }> = {
  javascript: { cmd: 'node', args: (f) => [f] },
  python: { cmd: 'python', args: (f) => [f] },
  cpp: { cmd: 'g++', args: (f) => ['-o', `${f}.out`, f] },
};

function executeLocal(request: ExecutionRequest): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const ext = FILE_EXT[request.language];
    const filename = path.join(TEMP_DIR, `code_${Date.now()}.${ext}`);
    const startTime = Date.now();

    try {
      writeFileSync(filename, request.code, 'utf8');
    } catch (err: any) {
      resolve({ stdout: '', stderr: `Failed to write temp file: ${err.message}`, exitCode: 1, timedOut: false, executionTimeMs: 0 });
      return;
    }

    const runner = LOCAL_RUNNERS[request.language];
    if (!runner) {
      resolve({ stdout: '', stderr: `No local runner for ${request.language}`, exitCode: 1, timedOut: false, executionTimeMs: 0 });
      return;
    }

    // For C++, compile first then run
    if (request.language === 'cpp') {
      const outFile = `${filename}.out`;
      const compile = spawn('g++', ['-o', outFile, filename], { timeout: config.docker.timeoutMs });
      let compileErr = '';
      compile.stderr.on('data', (d) => { compileErr += d.toString(); });
      compile.on('close', (code) => {
        if (code !== 0) {
          cleanup(filename);
          resolve({ stdout: '', stderr: compileErr || 'Compilation failed', exitCode: code ?? 1, timedOut: false, executionTimeMs: Date.now() - startTime });
          return;
        }
        // Run the compiled binary
        runProcess(outFile, [], request.stdin, startTime, config.docker.timeoutMs, () => {
          cleanup(filename);
          cleanup(outFile);
        }, resolve);
      });
      compile.on('error', (err) => {
        cleanup(filename);
        resolve({ stdout: '', stderr: `g++ not found. Install a C++ compiler or use Docker.\n${err.message}`, exitCode: 1, timedOut: false, executionTimeMs: Date.now() - startTime });
      });
      return;
    }

    // JS / Python: run directly
    runProcess(runner.cmd, runner.args(filename), request.stdin, startTime, config.docker.timeoutMs, () => cleanup(filename), resolve);
  });
}

function runProcess(
  cmd: string,
  args: string[],
  stdin: string | undefined,
  startTime: number,
  timeoutMs: number,
  onDone: () => void,
  resolve: (result: ExecutionResult) => void
) {
  const proc = spawn(cmd, args, {
    timeout: timeoutMs,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let timedOut = false;

  proc.stdout.on('data', (d) => { stdout += d.toString(); });
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  if (stdin) {
    proc.stdin.write(stdin);
    proc.stdin.end();
  } else {
    proc.stdin.end();
  }

  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill('SIGKILL');
  }, timeoutMs);

  proc.on('close', (code) => {
    clearTimeout(timer);
    onDone();
    resolve({
      stdout,
      stderr: timedOut ? 'Execution timed out' : stderr,
      exitCode: timedOut ? 124 : (code ?? 1),
      timedOut,
      executionTimeMs: Date.now() - startTime,
    });
  });

  proc.on('error', (err) => {
    clearTimeout(timer);
    onDone();
    resolve({
      stdout: '',
      stderr: `Runtime not found: ${cmd}. ${err.message}`,
      exitCode: 1,
      timedOut: false,
      executionTimeMs: Date.now() - startTime,
    });
  });
}

function cleanup(filepath: string) {
  try { unlinkSync(filepath); } catch { /* ignore */ }
}

// Try Docker first, fall back to local execution
let dockerAvailable: boolean | null = null;

async function checkDocker(): Promise<boolean> {
  if (dockerAvailable !== null) return dockerAvailable;
  try {
    const Dockerode = (await import('dockerode')).default;
    const socketPath = process.platform === 'win32'
      ? '//./pipe/docker_engine'
      : config.docker.socket;
    const docker = new Dockerode({ socketPath });
    await docker.ping();
    dockerAvailable = true;
    logger.info('Docker available for code execution');
  } catch {
    dockerAvailable = false;
    logger.info('Docker not available — using local process execution');
  }
  return dockerAvailable;
}

async function executeDocker(request: ExecutionRequest): Promise<ExecutionResult> {
  const Dockerode = (await import('dockerode')).default;
  const socketPath = process.platform === 'win32'
    ? '//./pipe/docker_engine'
    : config.docker.socket;
  const docker = new Dockerode({ socketPath });

  const LANGUAGE_CONFIG: Record<string, { image: string; cmd: (file: string) => string[] }> = {
    javascript: { image: 'node:20-alpine', cmd: (f) => ['node', f] },
    python: { image: 'python:3.12-alpine', cmd: (f) => ['python3', f] },
    cpp: { image: 'gcc:13', cmd: (f) => ['sh', '-c', `g++ -o /tmp/a.out ${f} && /tmp/a.out`] },
  };

  const langConfig = LANGUAGE_CONFIG[request.language];
  const filename = `/tmp/code.${FILE_EXT[request.language]}`;
  const startTime = Date.now();

  const container = await docker.createContainer({
    Image: langConfig.image,
    Cmd: ['sh', '-c', `cat > ${filename} << 'CODEEOF'\n${request.code}\nCODEEOF\n${langConfig.cmd(filename).join(' ')}`],
    NetworkDisabled: true,
    HostConfig: {
      Memory: config.docker.memoryMb * 1024 * 1024,
      MemorySwap: config.docker.memoryMb * 1024 * 1024,
      CpuPeriod: 100000,
      CpuQuota: 50000,
      PidsLimit: 64,
      ReadonlyRootfs: false,
      SecurityOpt: ['no-new-privileges'],
    },
  });

  await container.start();

  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), config.docker.timeoutMs)
  );
  const waitPromise = container.wait().then((r) => ({ timedOut: false as const, statusCode: r.StatusCode }));
  const result = await Promise.race([waitPromise, timeoutPromise]);

  let stdout = '';
  try {
    const logs = await container.logs({ stdout: true, stderr: true });
    stdout = logs.toString('utf8');
  } catch { /* killed */ }

  if (result.timedOut) {
    try { await container.kill(); } catch {}
  }
  try { await container.remove({ force: true }); } catch {}

  const executionTimeMs = Date.now() - startTime;
  if (result.timedOut) {
    return { stdout, stderr: 'Execution timed out', exitCode: 124, timedOut: true, executionTimeMs };
  }
  return { stdout, stderr: '', exitCode: 'statusCode' in result ? result.statusCode : 1, timedOut: false, executionTimeMs };
}

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  if (!LANGUAGE_CONFIG_SUPPORTED.has(request.language)) {
    return { stdout: '', stderr: `Unsupported language: ${request.language}`, exitCode: 1, timedOut: false, executionTimeMs: 0 };
  }

  try {
    const hasDocker = await checkDocker();
    if (hasDocker) {
      try {
        return await executeDocker(request);
      } catch (dockerErr: any) {
        logger.warn({ error: dockerErr.message }, 'Docker execution failed, falling back to local');
      }
    }
    return await executeLocal(request);
  } catch (error: any) {
    logger.error({ error: error.message, language: request.language }, 'Code execution failed');
    return {
      stdout: '',
      stderr: `Execution error: ${error.message}`,
      exitCode: 1,
      timedOut: false,
      executionTimeMs: 0,
    };
  }
}
