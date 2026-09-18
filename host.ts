import { experimental_defineHostEntry } from "@get-bb/plugin-sdk/host";
import { scanGitRoots } from "./git-detector.js";
import { hostContract } from "./host-contract.js";

export default experimental_defineHostEntry({
	contract: hostContract,
	handlers: {
		scanGitRoots: async ({ roots }, context) => ({
			repositories: await scanGitRoots(roots, { signal: context.signal }),
		}),
	},
});
