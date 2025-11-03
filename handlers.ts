import { ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import settings from "./settings";

export const audioHandler = {
    icon: "audio",

    getActivity(item) {
        const providers = item.ProviderIds;

        return {
            type: ActivityType.LISTENING,
            statusType: ActivityStatusDisplayType.STATE,
            details: item.Name,
            detailsURL: providers.MusicBrainzRecording ? `https://musicbrainz.org/recording/${providers.MusicBrainzRecording}` : undefined,
            state: item.Artists.join(", "),
            stateURL: providers.MusicBrainzArtist ? `https://musicbrainz.org/artist/${providers.MusicBrainzArtist}` : undefined,
            image: item.Album,
        };
    },

    async getImage(item) {
        const release = item.ProviderIds.MusicBrainzAlbum;
        if (release) {
            const response = await fetch(`https://coverartarchive.org/release/${release}`);

            if (response.ok) {
                const data = await response.json();

                for (const image of data.images) {
                    if (image.front) {
                        return image.thumbnails.small;
                    }
                }
            }
        }

        return null;
    },
};

export const movieHandler = {
    icon: "movie",

    getActivity(item) {
        return {
            type: ActivityType.WATCHING,
            statusType: ActivityStatusDisplayType.DETAILS,
            details: item.Name,
            detailsURL: item.ExternalUrls[0]?.Url,
            state: item.ProductionYear,
        };
    },

    async getImage(item) {
        if (settings.store.tmdbAPIKey) {
            const tmdb = item.ProviderIds.Tmdb;
            if (tmdb) {
                const response = await fetch(`https://api.themoviedb.org/3/movie/${tmdb}?api_key=${settings.store.tmdbAPIKey}`);
                if (response.ok) {
                    const details = await response.json();
                    return "http://image.tmdb.org/t/p/w500" + details.poster_path;
                }
            }
        }

        return null;
    },
};

export default {
    Audio: audioHandler,
    Movie: movieHandler,
};
