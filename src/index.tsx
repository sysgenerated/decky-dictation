import {
	PanelSection,
	PanelSectionRow,
	ToggleField,
	staticClasses
} from "@decky/ui";
import {
	callable,
	definePlugin,
	toaster,
} from "@decky/api";
import { FC, useState, useEffect } from "react";
import { FaComment } from "react-icons/fa";

// Add TypeScript declarations
declare global {
	interface Window {
		SteamClient: {
			Input: {
				RegisterForControllerStateChanges: (callback: (val: any[]) => void) => { unregister: () => void }
			}
		}
	}
}

const beginDictation = callable<[push_to_dictate: boolean], void>("begin_dictation");
const endDictation = callable<[], void>("end_dictation");

class DeckyDictationLogic {
	pressedAt: number = Date.now();
	enabled: boolean = false;
	dictating = false;
	pushToDictate = false;

	notify = async (message: string, duration: number = 1000, body: string = "") => {
		if (!body) {
			body = message;
		}
		toaster.toast({
			title: message,
			body: body,
			duration: duration,
			critical: true
		});
	}

	handleButtonInput = async (val: any[]) => {
		if (!this.enabled) {
			return;
		}
		if (this.pushToDictate) {
			this.handlePushToDictate(val);
		} else {
			this.handleToggleMode(val);
		}
	}

	handlePushToDictate = async (val: any[]) => {
		for (const inputs of val) {
			if (inputs.ulButtons && inputs.ulButtons & (1 << 15)) {
				if (!this.dictating) {
					this.dictating = true;
					beginDictation(true);
					this.notify("Decky Dictation", 2000, "Starting speech to text input");
				}
			} else if (this.dictating) {
				this.dictating = false;
				await endDictation();
				this.notify("Decky Dictation", 2000, "Ending speech to text input");
			}
		}
	}

	handleToggleMode = async (val: any[]) => {
		for (const inputs of val) {
			if (Date.now() - this.pressedAt < 2000) {
				continue;
			}
			if (inputs.ulButtons && inputs.ulButtons & (1 << 15)) {
				this.pressedAt = Date.now();
				this.dictating = true;
				beginDictation(false);
				await this.notify("Decky Dictation", 2000, "Starting speech to text input");
			}
			if (inputs.ulButtons && inputs.ulButtons & (1 << 16) && this.dictating) {
				this.pressedAt = Date.now();
				this.dictating = false;
				endDictation();
				await this.notify("Decky Dictation", 2000, "Ending speech to text input");
			}
		}
	}
}

const DeckyDictation: FC<{ logic: DeckyDictationLogic }> = ({ logic }) => {
	const [enabled, setEnabled] = useState<boolean>(false);
	const [pushToDictate, setPushToDictate] = useState<boolean>(false);

	useEffect(() => {
		setEnabled(logic.enabled);
		setPushToDictate(logic.pushToDictate);
	}, []);

	return (
		<div>
			<PanelSection>
				<PanelSectionRow>
					<ToggleField
						label="Enable"
						checked={enabled}
						onChange={(e) => { setEnabled(e); logic.enabled = e; }}
					/>
				</PanelSectionRow>
				<PanelSectionRow>
					<ToggleField
						label="Push To Dictate"
						checked={pushToDictate}
						disabled={!enabled}
						onChange={(e) => { setPushToDictate(e); logic.pushToDictate = e; }}
					/>
				</PanelSectionRow>
			</PanelSection>
			<PanelSection title="How to use:">
				<PanelSectionRow>
					<div>
						L5 to begin speech to text input, hold if "Push To Dictate" is enabled.
						<br />
						R5 to end speech to text input if "Push To Dictate" is disabled.
					</div>
					<div>
						Currently this plugin only works in a game (first opened game if you have more opened at once; not working in home, store or steam chat ui etc).
					</div>
				</PanelSectionRow>
			</PanelSection>
		</div>
	);
};

export default definePlugin(() => {
	const logic = new DeckyDictationLogic();
	const input_register = window.SteamClient.Input.RegisterForControllerStateChanges(logic.handleButtonInput);

	return {
		name: "Decky Dictation",
		titleView: <div className={staticClasses.Title}>Decky Dictation</div>,
		content: <DeckyDictation logic={logic} />,
		icon: <FaComment />,
		onDismount() {
			input_register.unregister();
		},
	};
});