const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");

// Replace this with your TMDb API key
const TMDB_API_KEY = "YOUR_TMDB_API_KEY";

// Cache setup
const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 10; // 10 minutes

// Function to fetch movies with filters
const fetchMovies = async (year, genre, rating, runtime, language) => {
    try {
        const response = await axios.get(`https://api.themoviedb.org/3/discover/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                language: "en-US",
                sort_by: "popularity.desc",
                include_adult: false,
                include_video: false,
                page: 1,
                primary_release_year: year,
                with_genres: genre,
                'vote_average.gte': rating,
                'with_runtime.gte': runtime,
                with_original_language: language
            }
        });
        return response.data.results.map(movie => ({
            id: `tmdb:${movie.id}`,
            type: 'movie',
            name: movie.title,
            poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
            description: movie.overview,
            genres: movie.genre_ids,
            year: movie.release_date.split('-')[0],
            rating: movie.vote_average,
            runtime: movie.runtime
        }));
    } catch (error) {
        console.error(`Error fetching movies: ${error.message}`);
        return [];
    }
};

// Function to fetch detailed metadata
const fetchMovieDetails = async (movieId) => {
    try {
        const response = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
            params: {
                api_key: TMDB_API_KEY,
                language: "en-US",
                append_to_response: "credits,videos"
            }
        });
        const movie = response.data;
        return {
            id: `tmdb:${movie.id}`,
            type: 'movie',
            name: movie.title,
            poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
            description: movie.overview,
            genres: movie.genres.map(genre => genre.name),
            year: movie.release_date.split('-')[0],
            rating: movie.vote_average,
            runtime: movie.runtime,
            cast: movie.credits.cast.map(actor => actor.name).join(', '),
            director: movie.credits.crew.find(crew => crew.job === 'Director').name,
            trailer: movie.videos.results.find(video => video.type === 'Trailer')?.key
        };
    } catch (error) {
        console.error(`Error fetching movie details: ${error.message}`);
        return {};
    }
};

// Cache fetch function
const cacheFetchMovies = async (year, genre, rating, runtime, language) => {
    const cacheKey = `${year}-${genre}-${rating}-${runtime}-${language}`;
    if (cache.has(cacheKey) && (Date.now() - cache.get(cacheKey).timestamp < CACHE_DURATION)) {
        return cache.get(cacheKey).data;
    }
    const data = await fetchMovies(year, genre, rating, runtime, language);
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
};

// Create addon
const builder = new addonBuilder({
    id: 'org.stremio.multi-industry',
    version: '1.0.0',
    name: 'Multi-Industry Movies & TV Shows',
    description: 'An addon to list movies and TV shows by year, genre, rating, runtime, and language.',
    resources: ['catalog', 'meta'],
    types: ['movie', 'series'],
    catalogs: [
        {
            type: 'movie',
            id: 'multi-industry-movies',
            name: 'Movies',
            genres: ['Action', 'Comedy', 'Drama', 'Romance'],
            extra: [
                { name: 'genre' },
                { name: 'year', isRequired: true },
                { name: 'rating' },
                { name: 'runtime' },
                { name: 'language', options: ['hi', 'en', 'es', 'fr', 'zh', 'ja'] } // Hindi, English, Spanish, French, Chinese, Japanese
            ]
        },
        {
            type: 'series',
            id: 'multi-industry-series',
            name: 'TV Shows',
            genres: ['Drama', 'Comedy'],
            extra: [
                { name: 'genre' },
                { name: 'year', isRequired: true },
                { name: 'language', options: ['hi', 'en', 'es', 'fr', 'zh', 'ja'] }
            ]
        }
    ]
});

builder.defineCatalogHandler(async (args) => {
    const { type, id, extra } = args;
    const { year, genre, rating, runtime, language } = extra;

    if (type === 'movie' && id === 'multi-industry-movies') {
        const movies = await cacheFetchMovies(year, genre, rating, runtime, language);
        return { metas: movies };
    }

    // Add series fetching logic here if needed

    return { metas: [] };
});

builder.defineMetaHandler(async (args) => {
    const { id } = args;

    if (id.startsWith('tmdb:')) {
        const movieId = id.split(':')[1];
        const meta = await fetchMovieDetails(movieId);
        return { meta };
    }

    // Add series details fetching logic here if needed

    return { meta: {} };
});

module.exports = builder.getInterface();
