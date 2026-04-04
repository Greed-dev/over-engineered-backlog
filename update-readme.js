const fs = require('fs');

// rate limit bypasser
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getThumbnail(type, title) {
    const query = encodeURIComponent(title);
    try {
        if (type === 'book') {
            const res = await fetch(`https://openlibrary.org/search.json?title=${query}&limit=1`);
            const data = await res.json();
            if (data.docs?.[0]?.cover_i) return `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`;
        } 
        else if (type === 'movie') {
            const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb&query=${query}`);
            const data = await res.json();
            if (data.results?.length > 0 && data.results[0].poster_path) return `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`;
        }
        else if (type === 'game') {
            // 1. Try Steam first (It gives us perfect vertical library covers)
            const steamRes = await fetch(`https://store.steampowered.com/api/storesearch/?term=${query}&l=english&cc=US`);
            const steamData = await steamRes.json();
            
            if (steamData.items && steamData.items.length > 0) {
                const appId = steamData.items[0].id;
                // Note: Sometimes Steam games don't have the new vertical cover, but this works 90% of the time
                return `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`;
            }
            
            // 2. Fallback to RAWG for Console/Nintendo games!
            const apiKey = '3d02b18efb9740969028f9eb60866c8f'; 
            const rawgRes = await fetch(`https://api.rawg.io/api/games?search=${query}&key=${apiKey}&page_size=1`);
            const rawgData = await rawgRes.json();
            
            if (rawgData.results && rawgData.results.length > 0 && rawgData.results[0].background_image) {
                // We use RAWG's hidden image cropper via the URL to force it into a vertical portrait aspect ratio!
                return rawgData.results[0].background_image.replace('/media/games/', '/media/crop/600/900/games/');
            }
        }
        else if (type === 'anime') {
            const res = await fetch(`https://api.jikan.moe/v4/anime?q=${query}&limit=1`);
            const data = await res.json();
            if (data.data?.length > 0) return data.data[0].images.jpg.large_image_url; 
        }
    } catch (error) {
        console.error(`Failed to fetch thumbnail for ${title}`, error);
    }
    return 'https://placehold.co/300x450/1e1e1e/888888?text=No+Cover'; 
}

async function updateReadme() {
    const githubRepo = 'Greed-dev/over-engineered-backlog';
    console.log('Fetching issues...');
    const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues?state=all&per_page=100`);
    const issues = await response.json();

    const categorized = { doing: [], backlog: [], done: [] };

    for (const issue of issues) {
        let type = 'unknown', status = 'backlog';
        issue.labels.forEach(label => {
            const name = label.name.toLowerCase();
            if (['game', 'anime', 'movie', 'book'].includes(name)) type = name;
            if (['done', 'doing', 'backlog'].includes(name)) status = name;
        });

        if (type === 'unknown') continue;

        console.log(`Fetching art for ${issue.title}...`);
        const thumbnailUrl = await getThumbnail(type, issue.title);
        
        // We use HTML here to ensure the poster sizes stay uniform on the GitHub README
        const markdownImage = `<a href="${issue.html_url}"><img src="${thumbnailUrl}" width="200" alt="${issue.title}" title="${issue.title}" /></a>`;

        categorized[status].push(markdownImage);

        if (type === 'anime') await sleep(400); // Respect Jikan rate limit
    }

    // Build the Markdown section
    let newReadmeSection = `<!-- START_BACKLOG -->\n\n`;
    
    newReadmeSection += `### 🚧 Currently Going Through\n<p align="left">\n${categorized.doing.join('\n') || '*Nothing here yet.*'}\n</p>\n\n`;
    newReadmeSection += `### 📚 Never Ending Black Hole\n<p align="left">\n${categorized.backlog.join('\n') || '*Nothing here yet.*'}\n</p>\n\n`;
    newReadmeSection += `### ✅ Actually Finished\n<p align="left">\n${categorized.done.join('\n') || '*Nothing here yet.*'}\n</p>\n\n`;
    
    newReadmeSection += `<!-- END_BACKLOG -->`;

    console.log('Updating README.md...');
    let readmeContent = fs.readFileSync('README.md', 'utf8');
    
    // Replace the content between the markers
    readmeContent = readmeContent.replace(
        /<!-- START_BACKLOG -->[\s\S]*<!-- END_BACKLOG -->/,
        newReadmeSection
    );

    fs.writeFileSync('README.md', readmeContent);
    console.log('README updated successfully!');
}

updateReadme();