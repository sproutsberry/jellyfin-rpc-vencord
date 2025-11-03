/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 sprouts
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import definePlugin, { OptionType } from "@utils/types";
import { Logger } from "@utils/Logger";
import { definePluginSettings } from "@api/Settings";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";
import { ActivityFlags } from "@vencord/discord-types/enums";
import handlers from "./handlers";
import settings from "./settings";
import { addOverride, ensureAllOverrides } from "./csp";

const logger = new Logger("JellyfinRichPresence");

export default definePlugin({
    name: "JellyfinRichPresence",
    description: "Rich presence for your Jellyfin instance",
    authors: [{ name: "sprouts", id: 232653376771325955n }],

    start() {
        if (settings.store.jellyfinURL) {
            addOverride(settings.store.jellyfinURL, ["connect-src"]);
            ensureAllOverrides(() => {
                this.updateInterval = setInterval(() => this.update(), Math.max(settings.store.updateTime, 10) * 1000);
                this.update();
            });
        }
    },

    stop() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        FluxDispatcher.dispatch({
            type: "LOCAL_ACTIVITY_UPDATE",
            socketId: "Jellyfin",
            activity: null,
        });
    },

    settings,

    async getSessions() {
        const sessions = await fetch(`${settings.store.jellyfinURL}/Sessions`, {
            headers: {
                Authorization: `MediaBrowser Token="${settings.store.jellyfinAPIKey}"`
            },
        }).then(response => response.json());

        return sessions.filter(session => {
            if (session.UserName !== settings.store.jellyfinUsername) return false;
            if (session.PlayState.IsPaused) return false;

            const item = session.NowPlayingItem;
            if (!item) return false;
            if (item.Type === "Audio" && !settings.store.audio) return false;
            if (item.Type === "Movie" && !settings.store.movies) return false;

            return true;
        });
    },

    imageCache: {},
    async buildActivity(session) {
        const item = session.NowPlayingItem;
        const handler = handlers[item.Type];

        if (handler) {
            const result = handler.getActivity(item);

            let imageURL = this.imageCache[item.Id];
            if (imageURL === undefined) {
                try {
                    imageURL = await handler.getImage(item);
                } catch (error) {
                    logger.error(`Failed to fetch image for ${item.Name}`, error);
                    imageURL = null;
                }
                this.imageCache[item.Id] = imageURL;
            }

            const startTime = Date.now() - session.PlayState.PositionTicks / 10000;
            const endTime = startTime + item.RunTimeTicks / 10000;

            const [imageAsset] = await ApplicationAssetUtils.fetchAssetIds(settings.store.applicationID, [imageURL ?? handler.icon]);

            return {
                application_id: settings.store.applicationID,
                flags: ActivityFlags.INSTANCE,

                name: settings.store.applicationName,
                type: result.type,
                status_display_type: result.statusType,
                details: result.details,
                details_url: result.detailsURL,
                state: result.state,
                state_url: result.stateURL,
                timestamps: { start: startTime, end: endTime },
                assets: {
                    large_image: imageAsset,
                    large_text: result.image ?? null,
                    small_image: null,
                    small_text: null,
                },
            };
        } else {
            return null;
        }
    },

    async update() {
        if (!settings.store.jellyfinURL) return;
        if (!settings.store.jellyfinAPIKey) return;
        if (!settings.store.jellyfinUsername) return;

        const sessions = await this.getSessions();

        console.log("SESSIONS", sessions);

        FluxDispatcher.dispatch({
            type: "LOCAL_ACTIVITY_UPDATE",
            socketId: "Jellyfin",
            activity: sessions.length > 0 ? await this.buildActivity(sessions[0]) : null,
        });
    },
});
