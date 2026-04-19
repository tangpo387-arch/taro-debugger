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

// ── Subfunctions: Router ─────────────────────────────────────────────

/**
 * Determines the category of a file based on its path and name.
 */
function getFileProfile(relPath, basename) {
  if (relPath.includes('.agents/skills/') && basename === 'SKILL') return 'skill';
  if (basename === 'project-context' && relPath.includes('.agents/')) return 'project-context';
  if (relPath.includes('.agents/rules/')) return 'agent-rule';
  if (relPath.includes('docs/')) return 'doc';
  return 'other';
}

// ── Subfunctions: Domain Validators ──────────────────────────────────

function validateFilename(basename, errors) {
  const isSpecialType = basename.endsWith('.review-package') || basename.endsWith('.spec-plan');
  const isValidKebab = basename === toKebabCase(basename) || basename === 'README' || basename === 'SKILL';
  const isWiPattern = /^WI-\d+(\.\d+)?(\.review-package|\.spec-plan)?$/.test(basename);

  if (!isValidKebab && !isWiPattern && !isSpecialType) {
    errors.push(`Filename must be kebab-case (except for WI references): ${basename}.md`);
  }
}

function validateLanguage(content, errors) {
  const chineseMatch = content.match(/[\u4e00-\u9fa5]/u);
  if (chineseMatch) {
    errors.push(`Non-English content found (Chinese characters forbidden): "${chineseMatch[0]}"`);
  }
}

function validateHeadings(content, errors) {
  const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
  const headings = [...contentWithoutCodeBlocks.matchAll(/^#+ /gm)].map(m => m[0].trim().length);
  let lastLevel = 0;
  headings.forEach((level, idx) => {
    // Only check for skips if this is not the first heading in the file
    if (idx > 0 && level > lastLevel + 1) {
      errors.push(`Skipped heading level: H${lastLevel} to H${level} at heading index ${idx + 1}`);
    }
    lastLevel = level;
  });
}

function validateDomainSkill(fm, errors) {
  const keys = fm.split('\n')
    .filter(l => l.includes(':') && !l.startsWith(' '))
    .map(l => l.split(':')[0].trim());
  if (keys.length !== 2 || !keys.includes('name') || !keys.includes('description')) {
    errors.push('SKILL.md YAML MUST contain exactly two fields: "name" and "description"');
  }
}

function validateDomainDoc(fm, basename, errors) {
  const hasTitle = fm.includes('title:');
  const hasName = fm.includes('name:');
  if (!hasTitle && !hasName && !basename.endsWith('.review-package')) {
    errors.push('Frontmatter missing "title"');
  }

  // Audience Directory Mapping Rules
  if (!fm.includes('audience:') && !basename.endsWith('.review-package')) {
    errors.push('Frontmatter missing "audience"');
  } else if (fm.includes('audience:')) {
    if (!basename.endsWith('.review-package') && !fm.includes('Human Engineer')) {
      errors.push('Frontmatter in docs/ MUST include "Human Engineer" audience');
    }
  }
}

function validateDomainProjectContext(fm, errors) {
  const hasTitle = fm.includes('title:');
  const hasName = fm.includes('name:');
  if (!hasTitle && !hasName) {
    errors.push('Project context frontmatter missing "title" or "name"');
  }
  // project-context is exempt from audience requirement
}

function validateXmlTags(content, relPath, errors) {
  if (!relPath.includes('.agents/')) return;

  const lines = content.split('\n');
  let activeTag = null;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    if (/^\s+<[a-zA-Z0-9-]+>/.test(line)) {
      errors.push(`XML tags MUST NOT be indented (line ${i+1})`);
    }

    if (/^<[a-zA-Z0-9-]+>$/.test(trimmed)) {
      activeTag = trimmed;
      if (i + 1 < lines.length && lines[i + 1].trim() !== '') {
        errors.push(`MUST leave an empty line after opening XML tag ${trimmed} (line ${i+1})`);
      }
    }

    if (/^<\/[a-zA-Z0-9-]+>$/.test(trimmed)) {
      activeTag = null;
      if (i - 1 >= 0 && lines[i - 1].trim() !== '') {
        errors.push(`MUST leave an empty line before closing XML tag ${trimmed} (line ${i+1})`);
      }
    }

    if (activeTag && /^#+\s/.test(trimmed)) {
      errors.push(`Markdown headers MUST NOT be placed inside XML tags (line ${i+1})`);
    }
  }
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
    const relPath = path.relative(process.cwd(), file).split(path.sep).join('/');
    const content = fs.readFileSync(file, 'utf8');
    const basename = path.basename(file, '.md');
    const errors = [];

    const profile = getFileProfile(relPath, basename);
    
    // 1. Structural Checks
    validateFilename(basename, errors);
    validateLanguage(content, errors);
    validateHeadings(content, errors);

    // 2. Frontmatter Check
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      const isOptional = basename === 'README' || 
                         basename.endsWith('.review-package') || 
                         profile === 'agent-rule' || 
                         profile === 'project-context';
      if (!isOptional) {
        errors.push('Missing YAML frontmatter (--- ... ---)');
      }
    } else {
      const fm = fmMatch[1];
      switch (profile) {
        case 'skill':
          validateDomainSkill(fm, errors);
          break;
        case 'doc':
          validateDomainDoc(fm, basename, errors);
          break;
        case 'project-context':
          validateDomainProjectContext(fm, errors);
          break;
        default: {
          // Agent rules or other files
          const hasTitle = fm.includes('title:') || fm.includes('name:');
          if (!hasTitle && !basename.endsWith('.review-package')) {
            errors.push('Frontmatter missing "title"');
          }
          if (!fm.includes('audience:') && !basename.endsWith('.review-package')) {
            errors.push('Frontmatter missing "audience"');
          }
          break;
        }
      }

      // Shared Global Audience constraints
      if (relPath.includes('.agents/') && profile !== 'skill') {
        if (fm.includes('Human Engineer') || fm.includes('Beginner')) {
          errors.push('.agents/ files MUST NOT target Human Engineer or Beginner audience');
        }
      }

      if (basename === 'README' && !fm.includes('Beginner')) {
        errors.push('README.md MUST explicitly target "Beginner" audience');
      }
    }

    // 3. Specialist Agent Checks
    validateXmlTags(content, relPath, errors);

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
