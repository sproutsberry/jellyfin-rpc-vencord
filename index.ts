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

import definePlugin from "@utils/types";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";
import { ActivityFlags } from "@vencord/discord-types/enums";
import handlers from "./handlers";
import settings from "./settings";
import { addOverride, ensureAllOverrides } from "./csp";
import logger from "./logger";

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
            if (item.Type === "Episode" && !settings.store.shows) return false;
            if (item.Type === "Book" && !settings.store.books) return false;

            return true;
        });
    },

    metadataCache: {},
    async buildActivity(session) {
        const item = session.NowPlayingItem;
        const handler = handlers[item.Type];

        if (handler) {
            let metadata = this.metadataCache[item.Id];
            if (metadata === undefined) {
                metadata = await handler.getMetadata(item);
                this.metadataCache[item.Id] = metadata;
            }

            const activity = {
                ...metadata,
                ...handler.getProgress(item, session.PlayState.PositionTicks),
            }

            const [ imageAsset ] = await ApplicationAssetUtils.fetchAssetIds(settings.store.applicationID, [ activity.imageURL ?? handler.icon ]);

            return {
                application_id: settings.store.applicationID,
                flags: ActivityFlags.INSTANCE,

                name: settings.store.applicationName,
                type: activity.type,
                status_display_type: activity.statusType,
                details: activity.details,
                details_url: activity.detailsURL,
                state: activity.state,
                state_url: activity.stateURL,
                timestamps: activity.timestamps,
                assets: {
                    large_image: imageAsset,
                    large_text: activity.imageCaption ?? null,
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

        FluxDispatcher.dispatch({
            type: "LOCAL_ACTIVITY_UPDATE",
            socketId: "Jellyfin",
            activity: sessions.length > 0 ? await this.buildActivity(sessions[0]) : null,
        });
    },
});
