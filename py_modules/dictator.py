"""Manages voice dictation processes using nerd-dictation."""

import os
import asyncio
import decky
from pathlib import Path

# Base paths
BIN_PATH = Path(decky.DECKY_PLUGIN_DIR) / "bin"
LOG_DIR = Path(decky.DECKY_PLUGIN_LOG_DIR)

# Application-specific paths
NERD_DICTATION_PATH = BIN_PATH / "nerd-dictation/nerd-dictation.py"
VOSK_PATH = BIN_PATH / "vosk_libraries"
MODEL_PATH = BIN_PATH / "vosk-model-small-en-us-0.15"
DOTOOL_PATH = BIN_PATH / "dotool"
NERD_DICTATION_COOKIE_PATH = Path(decky.DECKY_PLUGIN_RUNTIME_DIR) / "nerd-dictation-cookie"

# Log files
STD_OUT_FILE = open(LOG_DIR / "decky-dictation-std-out.log", "w")
STD_ERR_FILE = open(LOG_DIR / "decky-dictation-std-err.log", "w")

# Environment setup
if str(DOTOOL_PATH) not in os.environ["PATH"].split(":"):
    os.environ["PATH"] = f"{DOTOOL_PATH}:{os.environ['PATH']}"
pythonpath = os.environ.get('PYTHONPATH', '').split(':')
if str(VOSK_PATH) not in pythonpath:
    os.environ["PYTHONPATH"] = f"{VOSK_PATH}:{os.environ.get('PYTHONPATH', '')}"

class Dictator:
    _active_process = None
    _lock = asyncio.Lock()

    @classmethod
    async def begin_dictation(cls, push_to_dictate: bool) -> None:
        """Start a new dictation process with specified mode."""
        async with cls._lock:
            if cls._active_process is not None:
                decky.logger.warning("Dictation already running, stopping existing process")
                await cls.end_dictation()

            try:
                timeout_arg = "--timeout 4" if push_to_dictate else ""
                command = f'''{NERD_DICTATION_PATH} begin \
                    --cookie="{NERD_DICTATION_COOKIE_PATH}" \
                    --vosk-model-dir="{MODEL_PATH}" \
                    --simulate-input-tool DOTOOL \
                    --full-sentence \
                    --numbers-min-value 2 \
                    --numbers-no-suffix \
                    --numbers-as-digits \
                    --numbers-use-separator \
                    --punctuate-from-previous-timeout 2 \
                    {timeout_arg}'''
                
                decky.logger.info("Starting dictation process...")
                cls._active_process = await asyncio.create_subprocess_shell(
                    command,
                    stdout=STD_OUT_FILE,
                    stderr=STD_ERR_FILE,
                )
                decky.logger.info(f"Dictation process started with PID: {cls._active_process.pid}")
            except Exception as e:
                decky.logger.error(f"Failed to start dictation: {str(e)}")
                cls._active_process = None
                raise

    @classmethod
    async def end_dictation(cls) -> None:
        """Stop the current dictation process using nerd-dictation end."""
        async with cls._lock:
            if cls._active_process is None or cls._active_process.returncode is not None:
                cls._active_process = None  # Cleanup if process already exited
                return

            try:
                decky.logger.info("Stopping dictation process...")
                
                # Run nerd-dictation end to gracefully stop the process
                end_command = f'''{NERD_DICTATION_PATH} end \
                    --cookie="{NERD_DICTATION_COOKIE_PATH}"'''
                end_process = await asyncio.create_subprocess_shell(
                    end_command,
                    stdout=STD_OUT_FILE,
                    stderr=STD_ERR_FILE
                )
                
                # Wait for the end command to complete and the process to exit
                try:
                    await asyncio.wait_for(end_process.wait(), timeout=1.0)
                    await asyncio.wait_for(cls._active_process.wait(), timeout=0.5)
                except asyncio.TimeoutError:
                    decky.logger.warning("nerd-dictation end timed out, forcing termination...")
                    cls._active_process.terminate()
                    try:
                        await asyncio.wait_for(cls._active_process.wait(), timeout=0.5)
                    except asyncio.TimeoutError:
                        decky.logger.warning("Graceful termination failed, forcing kill...")
                        cls._active_process.kill()
                        await cls._active_process.wait()

                # Close pipes after process has exited
                if cls._active_process.stdout:
                    cls._active_process.stdout.close()
                if cls._active_process.stderr:
                    cls._active_process.stderr.close()

                decky.logger.info("Dictation process stopped")
            except ProcessLookupError:
                decky.logger.info("Process already terminated")
            except Exception as e:
                decky.logger.error(f"Error stopping dictation: {str(e)}")
                # Fallback to kill if something goes wrong
                try:
                    cls._active_process.kill()
                    await cls._active_process.wait()
                except (ProcessLookupError, Exception):
                    pass  # Ignore if already gone
            finally:
                cls._active_process = None  # Always reset reference

# Optional cleanup for log files
def __del__():
    if not STD_OUT_FILE.closed:
        STD_OUT_FILE.close()
    if not STD_ERR_FILE.closed:
        STD_ERR_FILE.close()