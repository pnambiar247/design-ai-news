'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const fallbackImages = {
    'technology': 'path/to/default_technology_image.jpg',
    'sports': 'path/to/default_sports_image.jpg',
    // Add more categories as needed
};

const optimizeImage = async (buffer, width, height) => {
    return await sharp(buffer)
        .resize(width, height)
        .toBuffer();
};

const fetchOgImage = async (url) => {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const ogImage = $('meta[property="og:image"]').attr('content');
        return ogImage || null;
    } catch (error) {
        console.error(`Failed to fetch OG image from ${url}: ${error.message}`);
        return null;
    }
};

const fetchYouTubeChannelImages = async (channelId) => {
    try {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/channels?part=brandingSettings&id=${channelId}&key=YOUR_API_KEY`);
        const { thumbnails, bannerImageUrl } = response.data.items[0].brandingSettings.channel;
        return {
            avatar: thumbnails.default.url,
            banner: bannerImageUrl,
        };
    } catch (error) {
        console.error(`Failed to fetch YouTube channel images for ${channelId}: ${error.message}`);
        return { avatar: null, banner: null };
    }
};

const updateArticlesJson = async (data) => {
    const jsonFilePath = path.join(__dirname, '../data/articles.json');
    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf8');
};

const main = async () => {
    const articles = [
        // Define your articles with URLs and other metadata
    ];

    for (const article of articles) {
        const ogImageUrl = await fetchOgImage(article.url);
        let imageUrl = ogImageUrl || fallbackImages[article.category];

        if (imageUrl) {
            const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const optimizedImage = await optimizeImage(imageBuffer.data, 290, 163);
            // Save or use the optimizedImage as needed
        }

        if (article.youtubeChannelId) {
            const { avatar, banner } = await fetchYouTubeChannelImages(article.youtubeChannelId);
            if (avatar) {
                const avatarBuffer = await axios.get(avatar, { responseType: 'arraybuffer' });
                const optimizedAvatar = await optimizeImage(avatarBuffer.data, 176, 176);
                // Save or use the optimizedAvatar as needed
            }
            if (banner) {
                const bannerBuffer = await axios.get(banner, { responseType: 'arraybuffer' });
                const optimizedBanner = await optimizeImage(bannerBuffer.data, 1200, 627);
                // Save or use the optimizedBanner as needed
            }
        }
    }

    await updateArticlesJson(articles);
    console.log('Images fetched and articles updated successfully.');
};

main().catch(err => console.error(err));