#!/usr/bin/env node
/**
 * manage-wi.js — Unified Work Item management script for Product_Architect.
 *
 * Subcommands:
 *   add   <ID|AUTO> <Group> <Title> [Desc] [Details] [Deps] [Size] [Milestone]
 *   edit  <WI-##> [--title <v>] [--desc <v>] [--details <v>]
 *                 [--deps <v>] [--size <v>] [--milestone <v>]
 *   show  <WI-##>
 *
 * Notes:
 *   - For 'add', Details use '|' as separator.
 *   - For 'edit', --details and --deps also use '|' and ',' respectively.
 *   - Prefix any value with '@' to load content from a file.
 *   - 'show' and read-only ops do NOT trigger doc sync.
 *   - Status lifecycle is managed by update-wi.js (Lead_Engineer only).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../work-items');

// ── Shared Utilities ────────────────────────────────────────────────

/**
 * Loads and merges all WI JSON files from the data directory.
 * @returns {{ item: object, file: string }[]} Flat array of { item, file } pairs.
 */
function loadAllEntries() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const entries = [];
  files.forEach(file => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
      const items = data.items || [];
      const groupDef = data.groupDefinition || null;
      // Always include at least one entry per group to ensure it's "known" even if empty
      entries.push({ item: null, file, groupDef });
      items.forEach(item => entries.push({ item, file, groupDef }));
    } catch (e) {
      console.warn(`Warning: Could not parse ${file}: ${e.message}`);
    }
  });
  return entries;
}

/**
 * Resolves a CLI string value — reads from file if prefixed with '@'.
 * @param {string} input
 * @returns {string}
 */
function resolveContent(input) {
  if (!input) return '';
  if (input.startsWith('@')) {
    const filePath = path.resolve(process.cwd(), input.substring(1));
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
    console.warn(`Warning: File not found at ${filePath}, using literal string.`);
  }
  return input;
}

/**
 * Calculates the next available WI ID across all JSON files.
 * @returns {string} e.g. 'WI-39'
 */
function getNextId() {
  const entries = loadAllEntries();
  let maxId = 0;
  entries.forEach(({ item }) => {
    const match = item?.id?.match(/^WI-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxId) maxId = num;
    }
  });
  return `WI-${String(maxId + 1).padStart(2, '0')}`;
}

/**
 * Writes updated items array back to its JSON file.
 * @param {string} file - Filename (not full path)
 * @param {object[]} items
 */
function writeFile(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2) + '\n');
}

// ── Subcommand: add-group ────────────────────────────────────────────

/**
 * Creates a new Feature Group JSON file.
 * @param {string[]} args - [Name, Fill, Stroke, Description]
 */
function cmdAddGroup(args) {
  if (args.length < 4) {
    console.error('Usage: manage-wi.js add-group <Name> <FillHex> <StrokeHex> <Description>');
    process.exit(1);
  }

  const [name, fill, stroke, rawDesc] = args;
  const description = resolveContent(rawDesc);
  const fileName = name.toLowerCase().replace(/\s+/g, '-') + '.json';
  const filePath = path.join(DATA_DIR, fileName);

  if (fs.existsSync(filePath)) {
    console.error(`Error: Group "${name}" (file: ${fileName}) already exists.`);
    process.exit(1);
  }

  const data = {
    groupDefinition: {
      name,
      color: { fill, stroke },
      description
    },
    items: []
  };

  writeFile(fileName, data);
  console.log(`✅ Successfully created new group "${name}" in ${fileName}`);
  syncDocs();
}

// ── Subcommand: show-group ───────────────────────────────────────────

/**
 * Lists all groups or shows details of a specific group.
 * @param {string[]} args - [GroupName]
 */
function cmdShowGroup(args) {
  const entries = loadAllEntries();
  const groupMap = new Map();

  entries.forEach(e => {
    if (e.groupDef && !groupMap.has(e.groupDef.name)) {
      groupMap.set(e.groupDef.name, { def: e.groupDef, file: e.file });
    }
  });

  const targetName = args[0];
  if (targetName) {
    const group = groupMap.get(targetName);
    if (!group) {
      console.error(`Error: Group "${targetName}" not found.`);
      process.exit(1);
    }
    process.stdout.write(JSON.stringify(group.def, null, 2) + '\n');
  } else {
    console.log('\nRegistered Feature Groups:');
    console.log(''.padEnd(60, '-'));
    Array.from(groupMap.values())
      .sort((a, b) => a.def.name.localeCompare(b.def.name))
      .forEach(g => {
        console.log(`${g.def.name.padEnd(25)} | ${g.def.color.fill}/${g.def.color.stroke} | ${g.def.description}`);
      });
    console.log(''.padEnd(60, '-'));
  }
}

// ── Subcommand: list-group ───────────────────────────────────────────

/**
 * Lists all Work Items in a specific group with filtering.
 * @param {string[]} args - [GroupName, ...flags]
 */
function cmdListGroup(args) {
  const flags = { status: 'active', detailed: false };
  const posArgs = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--detailed') {
      flags.detailed = true;
    } else if (args[i] === '--status') {
      flags.status = args[i + 1];
      i++;
    } else if (args[i].startsWith('--')) {
      console.error(`Error: Unknown flag "${args[i]}"`);
      process.exit(1);
    } else {
      posArgs.push(args[i]);
    }
  }

  const groupName = posArgs[0];
  if (!groupName) {
    console.error('Usage: manage-wi.js list-group <Name> [--status <all|pending|...>] [--detailed]');
    process.exit(1);
  }

  const entries = loadAllEntries();
  const groupExists = entries.some(e => e.groupDef && e.groupDef.name === groupName);

  if (!groupExists) {
    console.error(`Error: Group "${groupName}" not found. use show-group to list valid groups.`);
    process.exit(1);
  }

  const activeStatuses = ['pending', 'done', 'rework'];
  const items = entries
    .filter(e => e.item && e.item.featureGroup === groupName)
    .map(e => e.item)
    .filter(item => {
      if (flags.status === 'all') return true;
      if (flags.status === 'active') return activeStatuses.includes(item.metadata.status);
      return item.metadata.status === flags.status;
    });

  if (items.length === 0) {
    console.log(`No items found in group "${groupName}" matching status "${flags.status}".`);
    return;
  }

  console.log(`\nItems in Group: ${groupName} (Status: ${flags.status})`);
  console.log(''.padEnd(80, '-'));

  items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).forEach(item => {
    const summary = `${item.id.padEnd(7)} | ${item.metadata.status.padEnd(8)} | ${item.metadata.size.padEnd(2)} | ${item.title}`;
    console.log(summary);

    if (flags.detailed) {
      if (item.description) console.log(`   Desc: ${item.description}`);
      if (item.details && item.details.length > 0) {
        console.log('   Tasks:');
        item.details.forEach(d => console.log(`     - ${d}`));
      }
      console.log('');
    }
  });
  console.log(''.padEnd(80, '-'));
}

/**
 * Triggers regeneration of all derivative Markdown views.
 */
function syncDocs() {
  console.log('🔄 Syncing all views...');
  const views = {
    backlog: 'docs/work-items.md',
    roadmap: 'docs/project-roadmap.md',
    future: 'docs/future-roadmap.md',
  };
  try {
    Object.entries(views).forEach(([view, outPath]) => {
      execSync(`node scripts/generate-docs.js ${view} ${outPath}`, { stdio: 'inherit' });
    });
  } catch (e) {
    console.warn(`Warning: Documentation sync failed: ${e.message}`);
  }
}

// ── Subcommand: add ──────────────────────────────────────────────────

/**
 * Creates a new Work Item entry in the appropriate Feature Group JSON file.
 * @param {string[]} args - Positional args after 'add' subcommand.
 */
function cmdAdd(args) {
  // Parse command line flags
  const flags = {};
  const posArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    } else {
      posArgs.push(args[i]);
    }
  }

  if (posArgs.length < 3) {
    console.error(`
Usage: manage-wi.js add <ID|AUTO> <Group> <Title> [Desc] [Details] [Deps] [Size] [Milestone] [Flags]

Arguments:
  ID          WI-## or "AUTO" to auto-allocate the next number.
  Group       Feature Group name (must exist; use add-group to create a new one).
  Title       Short task title.
  Desc        Task description (use @file to load).
  Details     Task list (separator: "|", use @file to load).
  Deps        Comma-separated IDs (e.g. "WI-01,WI-02" or "none").
  Size        T-shirt size: S, M, L, XL (default: M).
  Milestone   Target version: v1.0, v1.1, Backlog (default: v1.0).

Flags:
  No flags available for add. Position args only.
    `.trim());
    process.exit(1);
  }

  let [id, group, title, rawDesc, rawDetails, rawDeps, size, milestone] = posArgs;

  if (id.toUpperCase() === 'AUTO') {
    id = getNextId();
  } else if (!id.match(/^WI-\d+$/)) {
    console.error('Error: Manual ID must follow the format "WI-##".');
    process.exit(1);
  }

  const description = resolveContent(rawDesc);
  const detailsRaw = resolveContent(rawDetails);
  const details = detailsRaw ? detailsRaw.split('|').map(d => d.trim()).filter(Boolean) : [];
  const deps = (rawDeps && rawDeps.toLowerCase() !== 'none')
    ? rawDeps.split(',').map(d => d.trim()).filter(Boolean)
    : [];

  const hasTestEntry = details.some(d => d.startsWith('[Test]'));
  if (!hasTestEntry) {
    console.warn('⚠️  Warning: No "[Test]" entry found in details.');
  }

  // 1. Find group file
  const entries = loadAllEntries();
  const existingGroup = entries.find(e => e.groupDef && e.groupDef.name === group);

  if (!existingGroup) {
    console.error(`Error: Feature Group "${group}" does not exist.`);
    console.error(`Please create it first using: node scripts/manage-wi.js add-group "${group}" <Fill> <Stroke> <Description>`);
    process.exit(1);
  }

  const targetFile = existingGroup.file;
  const filePath = path.join(DATA_DIR, targetFile);
  const targetData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (targetData.items.find(i => i.id === id)) {
    console.error(`Error: Item ${id} already exists in ${targetFile}.`);
    process.exit(1);
  }

  const newItem = {
    id,
    title,
    featureGroup: group,
    metadata: {
      status: 'pending',
      size: size || 'M',
      milestone: milestone || 'v1.0',
      dependencies: deps,
    },
    description,
    details,
    timeline: {
      created: new Date().toISOString().split('T')[0],
      created_by: 'Antigravity-Agent',
    },
  };

  targetData.items.push(newItem);
  writeFile(targetFile, targetData);
  console.log(`✅ Successfully added ${id} ("${title}") to ${targetFile}`);
  syncDocs();
}

// ── Subcommand: edit ─────────────────────────────────────────────────

/**
 * Edits specific fields of an existing Work Item.
 * Only fields explicitly provided via flags are updated.
 * @param {string[]} args - [WI-## , ...flags]
 */
function cmdEdit(args) {
  const targetId = args[0];
  if (!targetId || !targetId.match(/^WI-\d+$/)) {
    console.error(`
Usage: manage-wi.js edit <WI-##> [Flags]

Flags:
  --title <v>      Update title.
  --desc <v>       Update description (@file supported).
  --details <v>    Update details list (separator: "|", @file supported).
  --deps <v>       Update dependencies (comma-separated IDs or "none").
  --size <v>       Update size (S, M, L, XL).
  --milestone <v>  Update milestone (vX.Y, Backlog).
    `.trim());
    process.exit(1);
  }

  const flags = {};
  const remaining = args.slice(1);
  for (let i = 0; i < remaining.length; i++) {
    const token = remaining[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = remaining[i + 1];
      if (!value || value.startsWith('--')) {
        console.error(`Error: Flag "${token}" requires a value.`);
        process.exit(1);
      }
      flags[key] = value;
      i++;
    }
  }

  if (Object.keys(flags).length === 0) {
    console.error('Error: No fields specified.');
    process.exit(1);
  }

  const entries = loadAllEntries();
  const entry = entries.find(e => e.item?.id === targetId);

  if (!entry) {
    console.error(`Error: Could not find ${targetId} in any JSON file.`);
    process.exit(1);
  }

  const { file } = entry;
  const filePath = path.join(DATA_DIR, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error: Could not parse ${file}: ${e.message}`);
    process.exit(1);
  }

  const idx = data.items.findIndex(i => i.id === targetId);
  const target = data.items[idx];

  if (flags.title !== undefined) target.title = resolveContent(flags.title);
  if (flags.desc !== undefined) target.description = resolveContent(flags.desc);
  if (flags.size !== undefined) target.metadata.size = flags.size;
  if (flags.milestone !== undefined) target.metadata.milestone = flags.milestone;
  if (flags.deps !== undefined) {
    target.metadata.dependencies = (flags.deps.toLowerCase() === 'none')
      ? []
      : flags.deps.split(',').map(d => d.trim()).filter(Boolean);
  }
  if (flags.details !== undefined) {
    const raw = resolveContent(flags.details);
    target.details = raw.split('|').map(d => d.trim()).filter(Boolean);
  }

  writeFile(file, data);
  console.log(`✅ Successfully updated ${targetId} in ${file}`);
  syncDocs();
}

// ── Subcommand: show ─────────────────────────────────────────────────

/**
 * Prints the full JSON of a single Work Item or a specific field.
 * Supports a field name as the second argument.
 * Read-only — does not trigger doc sync.
 * @param {string[]} args - [WI-##, field]
 */
function cmdShow(args) {
  const [targetId, filter] = args;

  if (!targetId || !targetId.match(/^WI-\d+$/)) {
    console.error('Usage: manage-wi.js show <WI-##> [field]');
    process.exit(1);
  }

  const entries = loadAllEntries();
  const entry = entries.find(e => e.item?.id === targetId);

  if (!entry) {
    console.error(`Error: Could not find ${targetId} in any JSON file.`);
    process.exit(1);
  }

  // Enrich with dependency statuses
  const item = JSON.parse(JSON.stringify(entry.item));
  const deps = item.metadata.dependencies || [];
  item._dependencyStatuses = {};
  if (deps.length > 0) {
    deps.forEach(depId => {
      const depEntry = entries.find(e => e.item?.id === depId);
      item._dependencyStatuses[depId] = depEntry ? depEntry.item.metadata.status : 'missing';
    });
  }

  // Handle filtering
  let output = item;
  if (filter === 'deps') {
    output = item._dependencyStatuses;
  } else if (filter) {
    // Basic property access (including common metadata shortcuts)
    if (filter === 'status') output = item.metadata.status;
    else if (filter === 'size') output = item.metadata.size;
    else if (filter === 'milestone') output = item.metadata.milestone;
    else output = item[filter];

    if (output === undefined) {
      console.error(`Error: Field "${filter}" not found in ${targetId}.`);
      process.exit(1);
    }
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

// ── CLI Router ───────────────────────────────────────────────────────

const [subcommand, ...subArgs] = process.argv.slice(2);

const USAGE = `
Usage: node scripts/manage-wi.js <subcommand> [args]

Subcommands:
  add         <ID|AUTO> <Group> <Title> ...
  edit        <WI-##> [Flags]
  show        <WI-##> [field]
  add-group   <Name> <Fill> <Stroke> <Description>
  show-group  [Name]
  list-group  <Name> [--status <all|active|pending|...>] [--detailed]

Notes:
  - Details use "|" as separator; prefix any value with "@" to load from a file.
  - Groups must be managed via add-group/show-group.
  - "show <field>" filters output to a specific field (e.g. details, status, deps).
  - "list-group" defaults to active items (pending, done, rework) in a single-line summary.
  - Status changes (done/pending/accepted/rework/aborted) are handled by update-wi.js.
`.trim();

switch (subcommand) {
  case 'add':
    cmdAdd(subArgs);
    break;
  case 'add-group':
    cmdAddGroup(subArgs);
    break;
  case 'edit':
    cmdEdit(subArgs);
    break;
  case 'show':
    cmdShow(subArgs);
    break;
  case 'show-group':
    cmdShowGroup(subArgs);
    break;
  case 'list-group':
    cmdListGroup(subArgs);
    break;
  default:
    console.log(USAGE);
    process.exit(subcommand ? 1 : 0);
}
