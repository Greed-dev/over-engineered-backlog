// rate limit bypasser essentially
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function loadBacklog() {
    // 1. Fetch from GitHub Issues
    const githubRepo = 'Greed-dev/over-engineered-backlog';
    const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues?state=all&per_page=100`);
    const issues = await response.json();

    // 2. Convert GitHub issues into media items
    const backlogItems = issues.map(issue => {
        let itemType = 'unknown';
        let itemStatus = 'backlog'; // Defaults to backlog

        // Extract types and our 3 simple statuses from GitHub labels
        issue.labels.forEach(label => {
            const name = label.name.toLowerCase();
            if (['game', 'anime', 'movie', 'book'].includes(name)) itemType = name;
            if (['done', 'doing', 'backlog'].includes(name)) itemStatus = name;
        });

        return { title: issue.title, type: itemType, status: itemStatus };
    }).filter(item => item.type !== 'unknown'); // Ignore issues that aren't media

    // 3. Render the items
    for (const item of backlogItems) {
        let thumbnailUrl = await getThumbnail(item.type, item.title);

        const itemDiv = document.createElement('div');
        itemDiv.className = 'item';
        itemDiv.innerHTML = `
            <img src="${thumbnailUrl}" alt="cover art for ${item.title}">
            <p>${item.title}</p>
        `;

        // 4. simplified sorting logic
        if (item.status === 'done') {
            document.getElementById('completed-grid').appendChild(itemDiv);
        } else if (item.status === 'doing') {
            document.getElementById('in-progress-grid').appendChild(itemDiv);
        } else {
            // Catches 'backlog' or anything else
            document.getElementById('backlog-grid').appendChild(itemDiv);
        }

        // jikan api needs a delay between requests, so we sleep for 400ms if it's an anime to avoid hitting rate limits. Other APIs are more forgiving.    
        if (item.type === 'anime') {
            await sleep(400); 
        }
    }
}

async function getThumbnail(type, title) {
    const query = encodeURIComponent(title); // fix spaces in urls

    try {
        if (type === 'book') {
            const res = await fetch(`https://openlibrary.org/search.json?title=${query}&limit=1`);
            const data = await res.json();
            if (data.docs?.[0]?.cover_i) {
                return `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`;
            }
        } 
        else if (type === 'movie') {
            // TMDB proxy (no key required)
            const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb&query=${query}`);
            const data = await res.json();
            if (data.results?.length > 0 && data.results[0].poster_path) {
                return `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`;
            }
        }
        else if (type === 'game') {
            // RAWG Search API
            const apiKey = '3d02b18efb9740969028f9eb60866c8f'; // From rawg.io
            const res = await fetch(`https://api.rawg.io/api/games?search=${query}&key=${apiKey}&page_size=1`);
            const data = await res.json();
            if (data.results?.length > 0) return data.results[0].background_image;
        }
        else if (type === 'anime') {
            const res = await fetch(`https://api.jikan.moe/v4/anime?q=${query}&limit=1`);
            const data = await res.json();
            if (data.data?.length > 0) return data.data[0].images.jpg.large_image_url; 
        }
    } catch (error) {
        console.error(`RIP failed to fetch thumbnail for ${title}`, error);
    }
    
    // welp, fallback (using placehold.co which is more reliable)
    return 'https://placehold.co/300x450/1e1e1e/888888?text=No+Cover'; 
}

loadBacklog();