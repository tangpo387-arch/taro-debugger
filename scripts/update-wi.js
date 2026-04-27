const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../work-items');

const [targetId, rawStatus] = process.argv.slice(2);
const newStatus = rawStatus === 'abort' ? 'aborted' : rawStatus;
const validStatuses = ['pending', 'done', 'accepted', 'rework', 'aborted', 'proposed'];

if (!targetId || !validStatuses.includes(newStatus)) {
    console.error('Usage: node update-wi.js WI-## <pending|done|accepted|rework|aborted|proposed>');
    process.exit(1);
}

function update() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    let found = false;

    files.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        let data = JSON.parse(content);
        const items = data.items || [];
        const index = items.findIndex(i => i.id === targetId);

        if (index !== -1) {
            found = true;
            const item = items[index];
            item.metadata.status = newStatus;

            const today = new Date().toISOString().split('T')[0];
            if (newStatus === 'accepted' || newStatus === 'aborted') {
                item.timeline.completed = today;
            }

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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
            'future': 'docs/project/future-roadmap.md'
        };
        Object.entries(views).forEach(([view, path]) => {
            execSync(`node scripts/generate-docs.js ${view} ${path}`, { stdio: 'inherit' });
        });
    } catch (e) {
        console.warn('Warning: Documentation sync failed.');
    }
}

update();
