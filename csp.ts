import { relaunch } from "@utils/native";
import { Alerts } from "@webpack/common";

const overrides = {
    "https://coverartarchive.org": ["connect-src"], // Cover Art Archive
    "https://archive.org": ["connect-src"], // Cover Art Archive
    "https://*.archive.org": ["connect-src"], // Cover Art Archive
    "https://api.themoviedb.org": ["connect-src"], // TMDB
};

export function addOverride(url, directives) {
    overrides[url] = directives;
}

export async function ensureAllOverrides(callback) {
    let requestRelaunch = false;

    for (const [url, directives] of Object.entries(overrides)) {
        const allowed = await VencordNative.csp.isDomainAllowed(url, directives);

        if (!allowed) {
            const userResponse = await VencordNative.csp.requestAddOverride(url, directives, "Jellyfin Rich Presence");

            if (userResponse === "ok") {
                requestRelaunch = true;
            } else {
                Alerts.show({
                    title: "Failed to authorize CSP overrides",
                    body: "You must click Yes on all the connection prompts that show up for Jellyfin Rich Presence to work.",
                    confirmText: "Retry",
                    cancelText: "Cancel",
                    onConfirm: () => ensureAllOverrides(callback),
                });

                return;
            }
        }
    }

    if (requestRelaunch) {
        Alerts.show({
            title: "Successfully added CSP overrides",
            body: "Discord must be relaunched in order to apply changes. Would you like to do that now?",
            confirmText: "Relaunch",
            cancelText: "Cancel",
            onConfirm: relaunch,
        });
    } else {
        callback();
    }
}
