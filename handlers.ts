import { ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import settings from "./settings";
import logger from "./logger";

function getCountryEmoji(code: string) {
    return Array.from(code).map(letter => String.fromCodePoint(0x1F1A5 + letter.charCodeAt(0))).join("")
}

export const audioHandler = {
    icon: "audio",

    async getActivity(item) {
        const { MusicBrainzAlbum: releaseID, MusicBrainzArtist: artistID } = item.ProviderIds;

        let imageURL;
        if (releaseID) {
            try {
                const response = await fetch(`https://coverartarchive.org/release/${releaseID}`);
                if (response.ok) {
                    const data = await response.json();
                    for (const image of data.images) {
                        if (image.front) {
                            imageURL = image.thumbnails.small;
                            break;
                        }
                    }
                }
            } catch(error) {
                logger.error(`Failed to query Cover Art Archive for "${item.Name}"`, error)
            }
        }

        return {
            type: ActivityType.LISTENING,
            statusType: ActivityStatusDisplayType.STATE,
            details: item.Name,
            detailsURL: releaseID ? `https://musicbrainz.org/release/${releaseID}` : undefined,
            state: item.Artists.join(", "),
            stateURL: artistID ? `https://musicbrainz.org/artist/${artistID}` : undefined,
            imageCaption: item.Album,
            imageURL,
        };
    },
};

const TMDB_IMAGE_PREFIX = "http://image.tmdb.org/t/p/w500";

export const movieHandler = {
    icon: "movie",

    async getActivity(item) {
        const { Tmdb: tmdbID } = item.ProviderIds;

        if (settings.store.tmdbAPIKey && tmdbID) {
            try {
                const [ detailsResponse, creditsResponse ] = await Promise.all([
                    fetch(`https://api.themoviedb.org/3/movie/${tmdbID}?api_key=${settings.store.tmdbAPIKey}`),
                    fetch(`https://api.themoviedb.org/3/movie/${tmdbID}/credits?api_key=${settings.store.tmdbAPIKey}`),
                ]);
                
                if (detailsResponse.ok && creditsResponse.ok) {
                    const details = await detailsResponse.json();
                    const credits = await creditsResponse.json();

                    const releaseDate = new Date(details.release_date);
                    const director = credits.crew.find(person => person.job === "Director");

                    const state: (number | string)[] = [];
                    state.push(releaseDate.getFullYear());
                    if (director) state.push(director.name);
                    state.push(details.origin_country.map(getCountryEmoji).join(""));
                    
                    return {
                        type: ActivityType.WATCHING,
                        statusType: ActivityStatusDisplayType.DETAILS,
                        details: details.title,
                        detailsURL: `https://www.themoviedb.org/movie/${tmdbID}`,
                        state: state.join(" ⸱ "),
                        imageURL: TMDB_IMAGE_PREFIX + details.poster_path,
                    }
                }
            } catch(error) {
                logger.error(`Failed to query TMDB for "${item.Name}"`, error)
            }
        }

        return {
            type: ActivityType.WATCHING,
            statusType: ActivityStatusDisplayType.DETAILS,
            details: item.Name,
            detailsURL: item.ExternalUrls[0]?.Url,
            state: item.ProductionYear,
        };
    },
};

export default {
    Audio: audioHandler,
    Movie: movieHandler,
};
