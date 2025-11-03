import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export default definePluginSettings({
    // Server
    jellyfinURL: {
        description: "i.e. https://example.com",
        type: OptionType.STRING,
        restartNeeded: true,
    },
    jellyfinAPIKey: {
        description: "Find this in Dashboard > API Keys (you must be an administrator of your server)",
        type: OptionType.STRING,
    },
    jellyfinUsername: {
        description: "Username to get sessions for",
        type: OptionType.STRING,
    },

    // Items
    audio: {
        description: "Should Audio be displayed on your profile?",
        type: OptionType.BOOLEAN,
        default: true,
    },
    movies: {
        description: "Should Movies be displayed on your profile?",
        type: OptionType.BOOLEAN,
        default: true,
    },

    // API
    tmdbAPIKey: {
        description: "For movie covers",
        type: OptionType.STRING,
        restartNeeded: true,
    },

    // Discord
    applicationID: {
        description: "Where to fetch assets from",
        type: OptionType.STRING,
        default: "1433957762437742722"
    },
    applicationName: {
        description: "What to call the application",
        type: OptionType.STRING,
        default: "Jellyfin",
    },
    updateTime: {
        description: "Time between status updates, in seconds",
        type: OptionType.NUMBER,
        default: 10,
        restartNeeded: true,
    },
});
