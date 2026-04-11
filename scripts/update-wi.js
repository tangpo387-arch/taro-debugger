const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../docs/data/work-items');

const [targetId, rawStatus] = process.argv.slice(2);
const newStatus = rawStatus === 'abort' ? 'aborted' : rawStatus;
const validStatuses = ['pending', 'done', 'aborted'];

if (!targetId || !validStatuses.includes(newStatus)) {
    console.error('Usage: node update-wi.js WI-## <pending|done|aborted>');
    process.exit(1);
}

function update() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    let found = false;

    files.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        let items = JSON.parse(content);
        const index = items.findIndex(i => i.id === targetId);

        if (index !== -1) {
            found = true;
            const item = items[index];
            item.metadata.status = newStatus;

            const today = new Date().toISOString().split('T')[0];
            if (newStatus === 'done' || newStatus === 'aborted') {
                item.timeline.completed = today;
            }

            fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
            console.log(`✅ Updated ${targetId} status to ${newStatus} in ${file}`);
        }
    });

    if (!found) {
        console.error(`Error: Could not find ${targetId} in any JSON file.`);
        process.exit(1);
    }

    console.log('🔄 Syncing all views...');
    try {
        const views = {
            'backlog': 'docs/work-items.md',
            'roadmap': 'docs/project-roadmap.md',
            'future': 'docs/future-roadmap.md'
        };
        Object.entries(views).forEach(([view, path]) => {
            execSync(`node scripts/generate-docs.js ${view} ${path}`, { stdio: 'inherit' });
        });
    } catch (e) {
        console.warn('Warning: Documentation sync failed.');
    }
}

update();
