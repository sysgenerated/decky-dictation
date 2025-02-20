import os
import traceback
import subprocess
import logging

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code one directory up
# or add the `decky-loader/plugin` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky_plugin

from dictator import Dictator


logging.basicConfig(
    filename="/tmp/decky-dictation.log",
    format="Decky Dictation: %(asctime)s %(levelname)s %(message)s",
    filemode="w+",
    force=True,
)
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

plugin_path = os.environ["DECKY_PLUGIN_DIR"]
# model_path = f"{plugin_path}/bin/vosk-model-small-en-us-0.15"
# os.environ["PATH"] = f"{plugin_path}/bin:{os.environ['PATH']}"
# os.environ["PYTHONPATH"] = f"{plugin_path}/bin/vosk"
os.environ["XDG_RUNTIME_DIR"] = f"/run/user/{os.getuid()}"


class Plugin:

    logger.info(f"Initializing dictator")
    dictator = Dictator(plugin_path)
    logger.info(f"Dictator bin path: {dictator.bin_path}")
    logger.info(f"Dictator model path: {dictator.model_path}")
    logger.info(f"Dictator nerd dictation path: {dictator.nerd_dictation_path}")
    logger.info(f"Dictator vosk path: {dictator.vosk_path}")

    # Begins dictation
    async def begin(self, push_to_dictate: bool):
        try:
            logger.info("Begin dictation")
            await Plugin.dictator.begin_dictation(push_to_dictate)
        except Exception:
            await Plugin.end(self)
            logger.info(traceback.format_exc())
        return

    # Ends dictation
    async def end(self):
        try:
            logger.info("End dictation")
            await Plugin.dictator.end_dictation()

        except Exception:
            logger.info(traceback.format_exc())
        return

    async def _main(self):
        # if not os.path.exists(model_path):
        #     logger.info("Model directory not found")
        return

    async def _unload(self):
        logger.info("Unload was called")
        await Plugin.end(self)
        return
