import * as fs from "fs";
import { platform as currentPlatform } from "os";
import * as path from "path";
import { color } from "../color";
import { PrepareCommand } from "../commands/prepare";
import { IChildProcess } from "../common/declarations";
import { ICommand } from "../common/definitions/commands";
import {
	IKeyCommand,
	IKeyCommandHelper,
	IKeyCommandPlatform,
	IValidKeyName,
	SpecialKeys,
	SupportedProcessType,
} from "../common/definitions/key-commands";
import { injector } from "../common/yok";
import { IProjectData } from "../definitions/project";
import { IStartService } from "../definitions/start-service";

export class A implements IKeyCommand {
	key: IValidKeyName = "a";
	platform: IKeyCommandPlatform = "Android";
	description: string = "Run android app";

	constructor(private $startService: IStartService) {}

	async execute(): Promise<void> {
		this.$startService.runAndroid();
	}

	canExecute(processType: SupportedProcessType) {
		return processType === "start";
	}
}

export class ShiftA implements IKeyCommand {
	key: IValidKeyName = "A";
	platform: IKeyCommandPlatform = "Android";
	description: string = "Open android project in Android Studio";
	willBlockKeyCommandExecution: boolean = true;

	constructor(
		private $logger: ILogger,
		private $liveSyncCommandHelper: ILiveSyncCommandHelper,
		private $childProcess: IChildProcess,
		private $projectData: IProjectData
	) {}

	async execute(): Promise<void> {
		this.$liveSyncCommandHelper.validatePlatform(this.platform);
		this.$projectData.initializeProjectData();
		const androidDir = `${this.$projectData.platformsDir}/android`;

		if (!fs.existsSync(androidDir)) {
			const prepareCommand = injector.resolveCommand(
				"prepare"
			) as PrepareCommand;
			await prepareCommand.execute([this.platform]);
			process.stdin.resume();
		}

		const os = currentPlatform();

		if (os === "darwin") {
			const possibleStudioPaths = [
				"/Applications/Android Studio.app",
				`${process.env.HOME}/Applications/Android Studio.app`,
			];

			const studioPath = possibleStudioPaths.find((p) => {
				this.$logger.trace(`Checking for Android Studio at ${p}`);
				return fs.existsSync(p);
			});

			if (!studioPath) {
				this.$logger.error(
					"Android Studio is not installed, or not in a standard location."
				);
				return;
			}
			this.$childProcess.exec(`open -a "${studioPath}" ${androidDir}`);
		} else if (os === "win32") {
			const studioPath = path.join(
				"C:",
				"Program Files",
				"Android",
				"Android Studio",
				"bin",
				"studio64.exe"
			);
			if (!fs.existsSync(studioPath)) {
				this.$logger.error("Android Studio is not installed");
				return;
			}

			this.$childProcess.exec(`"${studioPath}" "${androidDir}"`);
		} else if (os === "linux") {
			if (!fs.existsSync(`/usr/local/android-studio/bin/studio.sh`)) {
				this.$logger.error("Android Studio is not installed");
				return;
			}
			this.$childProcess.exec(
				`/usr/local/android-studio/bin/studio.sh ${androidDir}`
			);
		}
	}
}

export class I implements IKeyCommand {
	key: IValidKeyName = "i";
	platform: IKeyCommandPlatform = "iOS";
	description: string = "Run iOS app";

	constructor(private $startService: IStartService) {}

	async execute(): Promise<void> {
		this.$startService.runIOS();
	}

	canExecute(processType: SupportedProcessType) {
		return processType === "start";
	}
}

export class ShiftI implements IKeyCommand {
	key: IValidKeyName = "I";
	platform: IKeyCommandPlatform = "iOS";
	description: string = "Open iOS project in Xcode";
	willBlockKeyCommandExecution: boolean = true;

	constructor(
		private $logger: ILogger,
		private $childProcess: IChildProcess,
		private $projectData: IProjectData
	) {}

	async execute(): Promise<void> {
		this.$projectData.initializeProjectData();
		const iosDir = path.resolve(this.$projectData.platformsDir, "ios");

		// TODO: reuse logic for resolving the xcode project file.
		const xcprojectFile = path.resolve(iosDir);

		if (!fs.existsSync(iosDir)) {
			const prepareCommand = injector.resolveCommand(
				"prepare"
			) as PrepareCommand;
			await prepareCommand.execute(["ios"]);
			process.stdin.resume();
		}

		const os = currentPlatform();
		if (os === "darwin") {
			// TODO: remove this, and just use "open path/to/ios/xcworkspace or xcproject".
			if (!fs.existsSync("/Applications/Xcode.app")) {
				this.$logger.error("Xcode is not installed");
				return;
			}
			this.$childProcess.exec(`open ${xcprojectFile}`);
		}
	}
}

export class R implements IKeyCommand {
	key: IValidKeyName = "r";
	platform: IKeyCommandPlatform = "all";
	description: string = "Rebuild native app if needed and restart";
	willBlockKeyCommandExecution: boolean = true;

	constructor(private $liveSyncCommandHelper: ILiveSyncCommandHelper) {}

	async execute(platform: string): Promise<void> {
		const devices = await this.$liveSyncCommandHelper.getDeviceInstances(
			platform
		);

		await this.$liveSyncCommandHelper.executeLiveSyncOperation(
			devices,
			platform,
			{
				restartLiveSync: true,
			} as ILiveSyncCommandHelperAdditionalOptions
		);
	}
}

export class ShiftR implements IKeyCommand {
	key: IValidKeyName = "R";
	platform: IKeyCommandPlatform = "all";
	description: string = "Force rebuild native app and restart";
	willBlockKeyCommandExecution: boolean = true;

	constructor(private $liveSyncCommandHelper: ILiveSyncCommandHelper) {}

	async execute(platform: string): Promise<void> {
		const devices = await this.$liveSyncCommandHelper.getDeviceInstances(
			platform
		);
		await this.$liveSyncCommandHelper.executeLiveSyncOperation(
			devices,
			platform,
			{
				skipNativePrepare: false,
				forceRebuildNativeApp: true,
				restartLiveSync: true,
			} as ILiveSyncCommandHelperAdditionalOptions
		);
	}
}

export class CtrlC implements IKeyCommand {
	key: IValidKeyName = SpecialKeys.CtrlC;
	platform: IKeyCommandPlatform = "all";
	description: string;
	willBlockKeyCommandExecution: boolean = false;

	async execute(): Promise<void> {
		process.exit();
	}
}

export class W implements IKeyCommand {
	key: IValidKeyName = "w";
	platform: IKeyCommandPlatform = "all";
	description: string = "Toggle file watcher";
	willBlockKeyCommandExecution: boolean = true;

	constructor(private $prepareController: IPrepareController) {}

	async execute(): Promise<void> {
		try {
			const paused = await this.$prepareController.toggleFileWatcher();
			process.stdout.write(
				paused
					? color.gray("Paused watching file changes... Press 'w' to resume.")
					: color.bgGreen("Resumed watching file changes")
			);
		} catch (e) {}
	}
}

export class C implements IKeyCommand {
	key: IValidKeyName = "c";
	platform: IKeyCommandPlatform = "all";
	description: string = "Clean project";
	willBlockKeyCommandExecution: boolean = true;

	constructor(
		private $childProcess: IChildProcess,
		private $liveSyncCommandHelper: ILiveSyncCommandHelper
	) {}

	async execute(): Promise<void> {
		await this.$liveSyncCommandHelper.stop();

		const clean = this.$childProcess.spawn("ns", ["clean"]);
		clean.stdout.on("data", (data) => {
			process.stdout.write(data);
			if (
				data.toString().includes("Project successfully cleaned.") ||
				data.toString().includes("Project unsuccessfully cleaned.")
			) {
				clean.kill("SIGINT");
			}
		});
	}
}

export class N implements IKeyCommand {
	key: IValidKeyName = "n";
	platform: IKeyCommandPlatform = "all";
	description: string = "Install dependencies";
	willBlockKeyCommandExecution: boolean = true;

	async execute(platform: string): Promise<void> {
		const install = injector.resolveCommand("install") as ICommand;
		await install.execute([]);
		process.stdin.resume();
	}
}

export class QuestionMark implements IKeyCommand {
	key: IValidKeyName = SpecialKeys.QuestionMark;
	platform: IKeyCommandPlatform = "all";
	description: string = "Show this help";
	willBlockKeyCommandExecution: boolean = true;

	constructor(private $keyCommandHelper: IKeyCommandHelper) {}

	async execute(platform_: string): Promise<void> {
		let platform: IKeyCommandPlatform;
		switch (platform_.toLowerCase()) {
			case "android":
				platform = "Android";
				break;
			case "ios":
				platform = "iOS";
				break;
			default:
				platform = "all";
				break;
		}
		this.$keyCommandHelper.printCommands(platform);
		process.stdin.resume();
	}
}

injector.registerKeyCommand("a", A);
injector.registerKeyCommand("i", I);
injector.registerKeyCommand("A", ShiftA);
injector.registerKeyCommand("I", ShiftI);
injector.registerKeyCommand("r", R);
injector.registerKeyCommand("R", ShiftR);
injector.registerKeyCommand("w", W);
injector.registerKeyCommand("c", C);
injector.registerKeyCommand("A", ShiftA);
injector.registerKeyCommand("n", N);
injector.registerKeyCommand(SpecialKeys.QuestionMark, QuestionMark);
injector.registerKeyCommand(SpecialKeys.CtrlC, CtrlC);
