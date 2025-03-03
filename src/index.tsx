import {
	PanelSection,
	PanelSectionRow,
	ToggleField,
	staticClasses,
	Dropdown,
	SingleDropdownOption
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

// Define an interface for the button mapping
interface ButtonMapping {
	[key: string]: number;
}

class DeckyDictationLogic {
	// Button mapping with name and bit position
	BUTTON_MAPPING: ButtonMapping = {
		"R2": 0,
		"L2": 1,
		"R1": 2,
		"L1": 3,
		"Y": 4,
		"B": 5,
		"X": 6,
		"A": 7,
		"D-Pad Up": 8,
		"D-Pad Right": 9,
		"D-Pad Left": 10,
		"D-Pad Down": 11,
		"View": 12,
		"Steam": 13,
		"Menu": 14,
		"L5": 15,
		"R5": 16
	};
	
	// Default to L5
	selectedButton: string = "L5";
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
		const selectedBit = this.BUTTON_MAPPING[this.selectedButton];
		
		for (const inputs of val) {
			if (inputs.ulButtons && inputs.ulButtons & (1 << selectedBit)) {
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
		const selectedBit = this.BUTTON_MAPPING[this.selectedButton];
		
		for (const inputs of val) {
			if (Date.now() - this.pressedAt < 2000) {
				continue;
			}
			
			// Use the same button for both starting and stopping
			if (inputs.ulButtons && inputs.ulButtons & (1 << selectedBit)) {
				this.pressedAt = Date.now();
				
				if (!this.dictating) {
					// Start dictation
					this.dictating = true;
					beginDictation(false);
					await this.notify("Decky Dictation", 2000, "Starting speech to text input");
				} else {
					// Stop dictation
					this.dictating = false;
					endDictation();
					await this.notify("Decky Dictation", 2000, "Ending speech to text input");
				}
			}
		}
	}
}

const DeckyDictation: FC<{ logic: DeckyDictationLogic }> = ({ logic }) => {
	const [enabled, setEnabled] = useState<boolean>(false);
	const [pushToDictate, setPushToDictate] = useState<boolean>(false);
	const [selectedButton, setSelectedButton] = useState<string>(logic.selectedButton);
	
	// Create dropdown options from the button mapping
	const buttonOptions = Object.keys(logic.BUTTON_MAPPING).map(button => ({
		data: button,
		label: button
	}));

	useEffect(() => {
		setEnabled(logic.enabled);
		setPushToDictate(logic.pushToDictate);
		setSelectedButton(logic.selectedButton);
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
				<PanelSectionRow>
					<Dropdown
						menuLabel="Dictation Button"
						strDefaultLabel="Select Button"
						disabled={!enabled}
						rgOptions={buttonOptions}
						selectedOption={selectedButton}
						onChange={(e: SingleDropdownOption) => { 
							const buttonName = e.data as string;
							setSelectedButton(buttonName); 
							logic.selectedButton = buttonName; 
						}}
					/>
				</PanelSectionRow>
			</PanelSection>
			<PanelSection title="How to use:">
				<PanelSectionRow>
					<div>
						Press {selectedButton} to {pushToDictate ? "hold while speaking" : "toggle"} speech to text input.
						{!pushToDictate && <span><br />Press {selectedButton} again to stop dictation.</span>}
						{pushToDictate && <span><br />Release {selectedButton} to stop dictation.</span>}
					</div>
					<div>
						<br />
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