import { useCallback, useEffect, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { Collection, rpcContract } from "../server";
import type { StarterId } from "../pokemon";

export function useCollection() {
	const rpc = useRpc<typeof rpcContract>();
	const [collection, setCollection] = useState<Collection | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(() => {
		rpc.call("collection_get").then(setCollection, (cause) => {
			setError(cause instanceof Error ? cause.message : String(cause));
		});
	}, [rpc]);

	useEffect(load, [load]);
	useRealtime("collection-changed", load);

	const selectStarter = async (starterId: StarterId) => {
		try {
			setCollection(await rpc.call("starter_select", { starterId }));
			setError(null);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	};

	const resetCollection = async () => {
		try {
			setCollection(await rpc.call("collection_reset"));
			setError(null);
			return true;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			return false;
		}
	};

	const addDemoReward = async (kind: "egg" | "shiny") => {
		try {
			setCollection(await rpc.call("demo_reward_add", { kind }));
			setError(null);
			return true;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			return false;
		}
	};

	return { collection, error, selectStarter, resetCollection, addDemoReward };
}
