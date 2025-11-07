import { ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import settings from "./settings";
import logger from "./logger";

const DETAIL_DELIMITER = " ⸱ ";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/original";

function getCountryEmoji(code: string) {
    return Array.from(code).map(letter => String.fromCodePoint(0x1F1A5 + letter.charCodeAt(0))).join("")
}

// stupid hack because Jellyfin only serves episode IDs
function tmdbURLtoID(url: string) {
    const result = /themoviedb\.org\/\w+\/(\d+)/.exec(url)
    return result ? result[1] : null
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

export const movieHandler = {
    icon: "movie",

    async getActivity(item) {
        const { Tmdb: tmdbID } = item.ProviderIds;

        if (settings.store.tmdbAPIKey && tmdbID) {
            try {
                const response = await fetch(`https://api.themoviedb.org/3/movie/${tmdbID}?append_to_response=credits&api_key=${settings.store.tmdbAPIKey}`);
                
                if (response.ok) {
                    const details = await response.json();

                    const releaseDate = new Date(details.release_date);
                    const director = details.credits.crew.find(person => person.job === "Director");

                    const state: (number | string)[] = [];
                    state.push(releaseDate.getFullYear());
                    if (director) state.push(director.name);
                    state.push(details.origin_country.map(getCountryEmoji).join(""));
                    
                    return {
                        type: ActivityType.WATCHING,
                        statusType: ActivityStatusDisplayType.DETAILS,
                        details: details.title,
                        detailsURL: `https://www.themoviedb.org/movie/${tmdbID}`,
                        state: state.join(DETAIL_DELIMITER),
                        stateURL: director ? `https://www.themoviedb.org/person/${director.id}` : null,
                        imageURL: TMDB_IMAGE_URL + details.poster_path,
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

const episodeHandler = {
    icon: "show",

    async getActivity(item) {
        const { Tmdb: tmdbEpisodeID } = item.ProviderIds;

        let imageURL;
        if (tmdbEpisodeID) {
            try {
                const tmdbID = tmdbURLtoID(item.ExternalUrls.find(entry => entry.Name === "TMDB").Url)
                const response = await fetch(`https://api.themoviedb.org/3/tv/${tmdbID}/season/${item.ParentIndexNumber}/episode/${item.IndexNumber}?api_key=${settings.store.tmdbAPIKey}`);
                if (response.ok) {
                    const details = await response.json();
                    imageURL = TMDB_IMAGE_URL + details.still_path;
                }
            } catch(error) {
                logger.error(`Failed to query TMDB for "${item.Name}"`, error)
            }
        }
        
        let episode = item.IndexNumber;
        if (item.IndexNumberEnd) {
            episode += "-" + item.IndexNumberEnd;
        }

        return {
            type: ActivityType.WATCHING,
            statusType: ActivityStatusDisplayType.DETAILS,
            details: item.SeriesName,
            detailsURL: item.ExternalUrls[0]?.Url,
            state: [ `S${item.ParentIndexNumber}:E${episode}`, item.Name ].join(DETAIL_DELIMITER),
            imageURL,
        }
    },
};

export default {
    Audio: audioHandler,
    Movie: movieHandler,
    Episode: episodeHandler,
};
