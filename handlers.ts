import { ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import settings from "./settings";

export const audioHandler = {
    icon: "audio",

    getActivity(item) {
        const { MusicBrainzRecording: recordingID, MusicBrainzArtist: artistID } = item.ProviderIds;

        return {
            type: ActivityType.LISTENING,
            statusType: ActivityStatusDisplayType.STATE,
            details: item.Name,
            detailsURL: recordingID ? `https://musicbrainz.org/recording/${recordingID}` : undefined,
            state: item.Artists.join(", "),
            stateURL: artistID ? `https://musicbrainz.org/artist/${artistID}` : undefined,
            image: item.Album,
        };
    },

    async getImage(item) {
        const releaseID = item.ProviderIds.MusicBrainzAlbum;
        if (releaseID) {
            const response = await fetch(`https://coverartarchive.org/release/${releaseID}`);

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

const TMDB_IMAGE_PREFIX = "http://image.tmdb.org/t/p/w500";

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
            const { Tmdb: tmdbID, Imdb: imdbID } = item.ProviderIds;

            if (tmdbID) {
                const response = await fetch(`https://api.themoviedb.org/3/movie/${tmdbID}?api_key=${settings.store.tmdbAPIKey}`);
                if (response.ok) {
                    const details = await response.json();
                    return TMDB_IMAGE_PREFIX + details.poster_path;
                }
            } else if (imdbID) {
                const response = await fetch(`https://api.themoviedb.org/3/find/${imdbID}?api_key=${settings.store.tmdbAPIKey}`);
                if (response.ok) {
                    const { movie_results: results } = await response.json();
                    return results.length > 0 ? TMDB_IMAGE_PREFIX + results[0].poster_path : null;
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
