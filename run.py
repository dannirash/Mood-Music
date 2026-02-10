import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"


def spawn_process(command, cwd):
    return subprocess.Popen(command, cwd=str(cwd), env=os.environ.copy())


def terminate_processes(processes):
    for proc in processes:
        if proc.poll() is None:
            proc.send_signal(signal.SIGTERM)


def main():
    backend_cmd = [sys.executable, "app.py"]
    frontend_cmd = ["npm", "start"]

    backend = spawn_process(backend_cmd, BACKEND_DIR)
    frontend = spawn_process(frontend_cmd, ROOT_DIR)
    processes = (backend, frontend)

    try:
        while True:
            for proc in processes:
                if proc.poll() is not None:
                    terminate_processes(processes)
                    return proc.returncode
            time.sleep(0.5)
    except KeyboardInterrupt:
        terminate_processes(processes)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
