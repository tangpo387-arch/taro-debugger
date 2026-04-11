const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getNextId() {
    const dataDir = path.join(__dirname, '../docs/data/work-items');
    if (!fs.existsSync(dataDir)) return 'WI-01';

    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    let maxId = 0;

    files.forEach(file => {
        try {
            const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
            const items = JSON.parse(content);
            items.forEach(item => {
                const match = item.id.match(/^WI-(\d+)$/);
                if (match) {
                    const idNum = parseInt(match[1], 10);
                    if (idNum > maxId) maxId = idNum;
                }
            });
        } catch (e) {}
    });

    return `WI-${String(maxId + 1).padStart(2, '0')}`;
}

const DATA_DIR = path.join(__dirname, '../docs/data/work-items');

/**
 * Resolves content from a string. If the string starts with '@', 
 * it treats the remainder as a file path and reads its content.
 */
function resolveContent(input) {
    if (!input) return '';
    if (input.startsWith('@')) {
        const filePath = path.resolve(process.cwd(), input.substring(1));
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8').trim();
        } else {
            console.warn(`Warning: File not found at ${filePath}, using literal string instead.`);
        }
    }
    return input;
}

// Params: ID, Group, Title, [Description], [Details|Split], [Deps,Split], [Size], [Milestone], [Status]
const args = process.argv.slice(2);
if (args.length < 3) {
    console.log('Usage: node add-wi.js <ID|AUTO> <Group> <Title> [Desc] [Details] [Deps] [Size] [Milestone] [Status]');
    console.log('Note: Use @path/to/file to load long descriptions or details from a file.');
    process.exit(0);
}

let [id, group, title, rawDesc, rawDetails, rawDeps, size, milestone, status] = args;

if (id.toUpperCase() === 'AUTO') {
    id = getNextId();
}
const fileName = group.toLowerCase().replace(/\s+/g, '-') + '.json';
const filePath = path.join(DATA_DIR, fileName);

const description = resolveContent(rawDesc);
const detailsRaw = resolveContent(rawDetails);
const details = detailsRaw ? detailsRaw.split('|').map(d => d.trim()) : [];
const deps = rawDeps ? rawDeps.split(',').map(d => d.trim()) : [];

const newItem = {
    id,
    title,
    featureGroup: group,
    metadata: {
        status: status || 'pending',
        size: size || 'M',
        milestone: milestone || 'v1.0',
        dependencies: deps
    },
    description: description,
    details: details,
    timeline: {
        created: new Date().toISOString().split('T')[0],
        created_by: 'Antigravity-Agent'
    }
};

let items = [];
if (fs.existsSync(filePath)) {
    items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

if (items.find(i => i.id === id)) {
    console.error(`Error: Item ${id} already exists in ${fileName}`);
    process.exit(1);
}

items.push(newItem);
fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
console.log(`✅ Successfully added ${id} to ${fileName}`);

console.log('🔄 Syncing all views...');
try {
    execSync('node scripts/generate-docs.js backlog docs/work-items.md', { stdio: 'inherit' });
    execSync('node scripts/generate-docs.js roadmap docs/project-roadmap.md', { stdio: 'inherit' });
    execSync('node scripts/generate-docs.js future docs/future-roadmap.md', { stdio: 'inherit' });
} catch (e) {
    console.warn('Warning: Documentation sync failed.');
}
