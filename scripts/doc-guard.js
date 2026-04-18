#!/usr/bin/env node
/**
 * doc-guard.js — Unified documentation management and quality verification tool.
 *
 * Subcommands:
 *   init-spec <WI-ID> <type> [Filename]
 *   verify    [path]
 *
 * Types for init-spec:
 *   feature       (Purpose, Scope, Behavior, Acceptance Criteria)
 *   service       (Overview, Layer Responsibilities, API Contract, Constraints)
 *   guide         (Goal, Prerequisites, Steps, Verification)
 *   troubleshoot  (Symptom, Root Cause, Resolution, Prevention)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const DATA_DIR = path.join(__dirname, '../work-items');

const SCHEMAS = {
  feature: {
    title: 'Feature Specification',
    sections: ['Purpose', 'Scope', 'Behavior', 'Acceptance Criteria'],
    audience: '[Human Engineer, Agent Role Play]'
  },
  service: {
    title: 'Service/Architecture Documentation',
    sections: ['Overview', 'Layer Responsibilities', 'API Contract', 'Constraints'],
    audience: '[Human Engineer, Agent Role Play]'
  },
  guide: {
    title: 'How-To Guide',
    sections: ['Goal', 'Prerequisites', 'Steps', 'Verification'],
    audience: '[Human Engineer, Beginner]'
  },
  troubleshoot: {
    title: 'Troubleshooting Guide',
    sections: ['Symptom', 'Root Cause', 'Resolution', 'Prevention'],
    audience: '[Human Engineer, Agent Role Play]'
  }
};

// ── Shared Utilities ────────────────────────────────────────────────

function loadWorkItem(wiId) {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    const item = data.items.find(i => i.id === wiId);
    if (item) return item;
  }
  return null;
}

function toKebabCase(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Subcommand: init-spec ────────────────────────────────────────────

function cmdInitSpec(args) {
  const [wiId, type, customFilename] = args;
  if (!wiId || !type || !SCHEMAS[type]) {
    console.error('Usage: doc-guard.js init-spec <WI-ID> <feature|service|guide|troubleshoot> [Filename]');
    process.exit(1);
  }

  const wi = loadWorkItem(wiId);
  if (!wi) {
    console.error(`Error: Work Item ${wiId} not found.`);
    process.exit(1);
  }

  const schema = SCHEMAS[type];
  const filename = customFilename ? (customFilename.endsWith('.md') ? customFilename : `${customFilename}.md`) : `${toKebabCase(wi.title)}.md`;
  const filePath = path.join(DOCS_DIR, filename);

  if (fs.existsSync(filePath)) {
    console.error(`Error: File ${filename} already exists.`);
    process.exit(1);
  }

  let content = `---
title: ${wi.title}
scope: ${wi.featureGroup}
audience: ${schema.audience}
related:
  - work-items.md
---

# ${wi.title} (${wiId})

> [!NOTE]
> **Source Work Item**: ${wi.title}
> **Description**: ${wi.description}

`;

  schema.sections.forEach(section => {
    content += `## ${section}\n\n<!-- TODO: Implement ${section} -->\n\n`;
  });

  fs.writeFileSync(filePath, content);
  console.log(`✅ Successfully initialized ${type} spec: docs/${filename}`);
}

// ── Subcommand: verify ───────────────────────────────────────────────

function cmdVerify(targetPath) {
  const basePath = targetPath || DOCS_DIR;
  const files = [];

  function collectFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          collectFiles(fullPath);
        }
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  if (fs.statSync(basePath).isDirectory()) {
    collectFiles(basePath);
  } else {
    files.push(basePath);
  }

  let totalErrors = 0;
  console.log(`🔍 Verifying ${files.length} markdown files...\n`);

  files.forEach(file => {
    const relPath = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf8');
    const errors = [];

    // 1. Filename kebab-case (allow uppercase for WI IDs and dots for specific types)
    const basename = path.basename(file, '.md');
    const isSpecialType = basename.endsWith('.review-package') || basename.endsWith('.spec-plan');
    const kebabBase = basename.toLowerCase().replace(/[^a-z0-0.]/g, '-');
    
    // Check if filename matches allowed patterns
    const isValidKebab = basename === toKebabCase(basename) || basename === 'README' || basename === 'SKILL';
    const isWiPattern = /^WI-\d+(\.\d+)?(\.review-package|\.spec-plan)?$/.test(basename);
    
    if (!isValidKebab && !isWiPattern && !isSpecialType) {
      errors.push(`Filename must be kebab-case (except for WI references): ${basename}.md`);
    }

    // 2. Frontmatter Check
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      if (basename !== 'README' && !basename.endsWith('.review-package')) {
        errors.push('Missing YAML frontmatter (--- ... ---)');
      }
    } else {
      const fm = fmMatch[1];
      const hasTitle = fm.includes('title:');
      const hasName = fm.includes('name:');
      if (!hasTitle && !hasName && !basename.endsWith('.review-package')) {
        errors.push('Frontmatter missing "title" (or "name" for SKILL files)');
      }
      // review-packages have 'wi:' instead of 'title' sometimes, but actually template shows 'title' too.
      // doc-authoring §4.3 says MUST include audience for docs/ files.
      if (!fm.includes('audience:') && !basename.endsWith('.review-package')) {
        errors.push('Frontmatter missing "audience"');
      }
    }

    // 3. Language Check (Strictly US English - simple ASCII check for non-English chars)
    // We allow emojis and standard punctuation. Deep search for Chinese characters specifically as per project policy.
    const chineseMatch = content.match(/[\u4e00-\u9fa5]/u);
    if (chineseMatch) {
      errors.push(`Non-English content found (Chinese characters forbidden): "${chineseMatch[0]}"`);
    }

    // 4. Heading Hierarchy (no skip levels)
    // Ignore headings inside code blocks
    const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
    const headings = [...contentWithoutCodeBlocks.matchAll(/^#+ /gm)].map(m => m[0].trim().length);
    let lastLevel = 0;
    headings.forEach((level, idx) => {
      if (level > lastLevel + 1) {
        errors.push(`Skipped heading level: H${lastLevel} to H${level} at heading index ${idx + 1}`);
      }
      lastLevel = level;
    });

    if (errors.length > 0) {
      console.log(`❌ ${relPath}`);
      errors.forEach(e => console.log(`   - ${e}`));
      totalErrors += errors.length;
    }
  });

  if (totalErrors === 0) {
    console.log('\n✅ All documents passed quality verification.');
  } else {
    console.log(`\n❌ Found ${totalErrors} errors in total.`);
    process.exit(1);
  }
}

// ── CLI Router ───────────────────────────────────────────────────────

const [subcommand, ...subArgs] = process.argv.slice(2);

switch (subcommand) {
  case 'init-spec':
    cmdInitSpec(subArgs);
    break;
  case 'verify':
    cmdVerify(subArgs[0]);
    break;
  default:
    console.log(`
Usage: doc-guard.js <subcommand> [args]

Subcommands:
  init-spec <WI-ID> <type> [Filename]
  verify    [path]

Notes:
  - init-spec pre-populates metadata from the Work Item SSOT.
  - verify runs CI-ready linting against Documentation Authoring Rules.
    `.trim());
    process.exit(subcommand ? 1 : 0);
}
