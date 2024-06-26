import fetch from 'node-fetch';
import cheerio from 'cheerio';
import fs from 'fs/promises';

// Function to fetch data from the website
async function fetchToramData(page) {
    const url = `https://toram-id.com/monster/type/boss?page=${page}`;
    const response = await fetch(url);
    const text = await response.text();
    
    const $ = cheerio.load(text);
    const data = [];
    
    $('div.card dl div.mb-5').each((i, dl) => {
        const name = $(dl).find('a.text-primary').text().trim();
        const element = $(dl).find('b:contains("Unsur:")').next().text().trim();
        const hp = $(dl).find('b:contains("HP:")').next().text().trim();
        const xp = $(dl).find('b:contains("XP:")').next().text().trim();
        const leveling = $(dl).find('b:contains("Leveling:")').parent().contents().filter(function() {
            return this.nodeType === 3; // Filter only text nodes
        }).text().trim().replace(/\s+/g, ' s/d '); // Replace multiple spaces with ' s/d '
        const map = $(dl).find('b:contains("Peta:")').next('a').text().trim();
        
        // Check if the mini boss image exists
        const hasMiniBossImage = $(dl).find('img[src="/img/f_boss.png"]').length > 0;
        const hasBossImage = $(dl).find('img[src="/img/boss.png"]').length > 0;

        if (hasMiniBossImage || hasBossImage) {
            const drops = [];
            $(dl).find('b:contains("Drop:")').nextAll('a').each((j, a) => {
                const dropName = $(a).text().trim();
                drops.push({ name: dropName });
            });
            
            data.push({ name, element, hp, xp, leveling, map, drops });
        }
    });
    
    return data;
}

// Function to join the drop names into a single string
function joinDrops(drops) {
  return drops.map(drop => drop.name).join(', ');
}

// Function to extract level and difficulty from the name and modify the object
function extractLevelAndDiff(obj) {
  const diffMatch = obj.name.match(/\((Easy|Normal|Hard|Nightmare|Ultimate)\)/);
  if (diffMatch) {
    obj.diff = diffMatch[1];
    obj.name = obj.name.replace(` (${obj.diff})`, '').trim();
  } else {
    obj.diff = '-'; // Default difficulty if not specified
  }

  const levelMatch = obj.name.match(/Lv (\d+)/);
  if (levelMatch) {
    obj.lvl = levelMatch[1]; // Convert to string
    obj.name = obj.name.replace(` (Lv ${obj.lvl})`, '').trim();
  }
}

// Function to reorder properties
function reorderProperties(obj) {
  const { name, diff, lvl, element, hp, xp, leveling, map, drops } = obj;
  return { name, diff, lvl, element, hp, xp, leveling, map, drops };
}

// Function to extract level from the object for sorting
function extractLevelForSorting(obj) {
  return parseInt(obj.lvl, 10);
}

// Function to get the total number of pages
async function getTotalPages() {
    const url = `https://toram-id.com/monster/type/boss?page=1`;
    const response = await fetch(url);
    const text = await response.text();
    
    const $ = cheerio.load(text);
    const totalPages = $('ul.pagination li').eq(-2).text().trim(); // Get the second last page number
    return parseInt(totalPages, 10);
}

// Main function to fetch, process, and save data
async function processToramData() {
  try {
    // Get the total number of pages
    const totalPages = await getTotalPages();
    console.log(`Total pages: ${totalPages}`);
    let allData = [];

    // Fetch data from all pages
    for (let page = 1; page <= totalPages; page++) {
        const data = await fetchToramData(page);
        console.log(`Fetched data from page ${page}`);
        allData = allData.concat(data);
    }

    // Join the drop names for each object
    const processedData = allData.map(obj => ({
      ...obj,
      drops: joinDrops(obj.drops)
    }));

    // Process each object to extract level and difficulty, and modify the name
    processedData.forEach(extractLevelAndDiff);

    // Reorder properties for each object
    const reorderedData = processedData.map(reorderProperties);

    // Sort the data by level
    const sortedData1 = reorderedData.sort((a, b) => extractLevelForSorting(a) - extractLevelForSorting(b));

    // Save the sorted data to sorted_toram_data.json
    await fs.writeFile('sorted_toram_data.json', JSON.stringify(sortedData1, null, 2));
    console.log('Data has been saved to sorted_toram_data.json');

    // Load data from sorted_toram_data.json
    const rawData = await fs.readFile('sorted_toram_data.json', 'utf8');
    const data = JSON.parse(rawData);

    // Function to sort data
    const sortedData = [];

    // Filter and sort data for each boss
    const bosses = {};
    data.forEach(item => {
      if (!bosses[item.name]) bosses[item.name] = [];
      bosses[item.name].push(item);
    });

    Object.keys(bosses).forEach(bossName => {
      const bossData = bosses[bossName];

      // Sort by level within each boss
      const sortedBossData = bossData.sort((a, b) => {
        return parseInt(a.lvl) - parseInt(b.lvl);
      });

      // Append sorted boss data to the result
      sortedData.push(...sortedBossData);
    });

    // Save sorted data
    await fs.writeFile('sorted_toram_data.json', JSON.stringify(sortedData, null, 2));
    console.log('Sorted data has been saved to sorted_toram_data.json');
  } catch (error) {
    console.error('Error processing data:', error);
  }
}

processToramData();
