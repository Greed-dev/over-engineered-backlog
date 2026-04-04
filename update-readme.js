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
            // 1. Try Steam first (Best quality for PC games)
            const steamRes = await fetch(`https://store.steampowered.com/api/storesearch/?term=${query}&l=english&cc=US`);
            const steamData = await steamRes.json();
            
            if (steamData.items && steamData.items.length > 0) {
                const appId = steamData.items[0].id;
                return `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`;
            }
            
            // 2. If not on Steam (Console games), fallback to Wikipedia Box Art
            const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}%20video%20game&gsrlimit=1&prop=pageimages&pithumbsize=500&format=json`);
            const wikiData = await wikiRes.json();
            
            if (wikiData.query && wikiData.query.pages) {
                const firstPageId = Object.keys(wikiData.query.pages)[0];
                if (wikiData.query.pages[firstPageId]?.thumbnail) {
                    return wikiData.query.pages[firstPageId].thumbnail.source;
                }
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