/**
 * SKILL.md generation from extracted patterns and learnings
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, resolve } from 'path';
import { extractPatterns, matchesWorkspace } from '../extractors/structural.js';
import { summarizeSessions } from '../extractors/llm.js';
import { generateQualityReport } from '../quality/scoring.js';
import { findClaudeCodeSessions, parseClaudeCodeSession, claudeToUnified, } from '../parsers/claude-code.js';
import { findOpenClawSessions, parseOpenClawSession, openclawToUnified, } from '../parsers/openclaw.js';
/**
 * Generate a SKILL.md from extracted patterns
 */
export function generateSkillMarkdown(patterns, projectName, learnings = []) {
    const lines = [];
    // Frontmatter
    lines.push('---');
    lines.push(`name: ${projectName}-conventions`);
    lines.push('description: |');
    lines.push(`  Learned conventions for working in ${projectName}.`);
    lines.push('  Auto-generated from coding session history by engram.');
    lines.push('category: project');
    lines.push('disable-model-invocation: false');
    lines.push('user-invocable: true');
    lines.push('allowed-tools: Read, Bash, Write, Edit, Glob');
    lines.push('---');
    lines.push('');
    // Header
    lines.push(`# ${projectName} Conventions`);
    lines.push('');
    lines.push('> Auto-generated from coding session history. Update as conventions evolve.');
    lines.push('');
    // Learnings by category (if any)
    if (learnings.length > 0) {
        const byCategory = groupLearningsByCategory(learnings);
        if (byCategory.decision.length > 0) {
            lines.push('## Architectural Decisions');
            lines.push('');
            for (const l of byCategory.decision.slice(0, 5)) {
                lines.push(`- ${l.summary}`);
                if (l.detail) {
                    lines.push(`  - ${l.detail}`);
                }
            }
            lines.push('');
        }
        if (byCategory.gotcha.length > 0) {
            lines.push('## Gotchas');
            lines.push('');
            for (const l of byCategory.gotcha.slice(0, 5)) {
                lines.push(`- **${l.summary}**`);
                if (l.detail) {
                    lines.push(`  - ${l.detail}`);
                }
                if (l.files?.length) {
                    lines.push(`  - Files: ${l.files.map((f) => `\`${f}\``).join(', ')}`);
                }
            }
            lines.push('');
        }
        if (byCategory.convention.length > 0) {
            lines.push('## Conventions');
            lines.push('');
            for (const l of byCategory.convention.slice(0, 5)) {
                lines.push(`- ${l.summary}`);
            }
            lines.push('');
        }
        if (byCategory.pattern.length > 0) {
            lines.push('## Patterns');
            lines.push('');
            for (const l of byCategory.pattern.slice(0, 5)) {
                lines.push(`- ${l.summary}`);
                if (l.files?.length) {
                    lines.push(`  - See: ${l.files.map((f) => `\`${f}\``).join(', ')}`);
                }
            }
            lines.push('');
        }
    }
    // File co-edits
    if (patterns.fileCoEdits.size > 0) {
        lines.push('## Files Often Changed Together');
        lines.push('');
        lines.push('When editing these files, check their companions:');
        lines.push('');
        let count = 0;
        for (const [file, companions] of patterns.fileCoEdits.entries()) {
            if (count >= 5)
                break;
            if (companions.length > 0) {
                lines.push(`- \`${file}\` → also check: ${companions
                    .slice(0, 3)
                    .map((f) => `\`${f}\``)
                    .join(', ')}`);
                count++;
            }
        }
        lines.push('');
    }
    // Test commands
    if (patterns.testCommands.length > 0) {
        lines.push('## Testing');
        lines.push('');
        lines.push('Run tests with:');
        lines.push('');
        lines.push('```bash');
        for (const cmd of patterns.testCommands.slice(0, 3)) {
            lines.push(cmd);
        }
        lines.push('```');
        lines.push('');
    }
    // Build commands
    if (patterns.buildCommands.length > 0) {
        lines.push('## Building');
        lines.push('');
        lines.push('```bash');
        for (const cmd of patterns.buildCommands.slice(0, 3)) {
            lines.push(cmd);
        }
        lines.push('```');
        lines.push('');
    }
    // Common tool sequences
    if (patterns.toolSequences.length > 0) {
        lines.push('## Common Workflows');
        lines.push('');
        lines.push('Frequently used tool sequences:');
        lines.push('');
        for (const seq of patterns.toolSequences.slice(0, 5)) {
            lines.push(`- ${seq.tools.join(' → ')} (used ${seq.count}x)`);
        }
        lines.push('');
    }
    // Error patterns
    if (patterns.errorPatterns.length > 0) {
        lines.push('## Common Issues');
        lines.push('');
        lines.push('Known issues and their fixes:');
        lines.push('');
        for (const err of patterns.errorPatterns) {
            lines.push(`- **${err.error.slice(0, 50)}...** → Fix: ${err.fix}`);
        }
        lines.push('');
    }
    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`*Generated by [engram](https://github.com/bobamatcha/engram) on ${new Date().toISOString().split('T')[0]}*`);
    return lines.join('\n');
}
/**
 * Generate skills for a project from session history
 */
export async function generateProjectSkill(projectPath, outputDir, options = {}) {
    const { days = 30, includeOpenClaw = true, openclawAgent, includeLearnings = false, llmClient, } = options;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const resolvedPath = resolve(projectPath);
    const allSessions = [];
    let totalFound = 0;
    // Collect Claude Code sessions
    const claudeSessions = findClaudeCodeSessions()
        .map(parseClaudeCodeSession)
        .filter((s) => s.endTime.getTime() > cutoff);
    totalFound += claudeSessions.length;
    for (const session of claudeSessions) {
        const unified = claudeToUnified(session);
        if (matchesWorkspace(unified, resolvedPath)) {
            allSessions.push(unified);
        }
    }
    // Collect OpenClaw sessions
    if (includeOpenClaw) {
        const openclawSessions = findOpenClawSessions(openclawAgent)
            .map(parseOpenClawSession)
            .filter((s) => s.endTime.getTime() > cutoff);
        totalFound += openclawSessions.length;
        for (const session of openclawSessions) {
            const unified = openclawToUnified(session);
            if (matchesWorkspace(unified, resolvedPath)) {
                allSessions.push(unified);
            }
        }
    }
    if (allSessions.length === 0) {
        throw new Error(`No sessions found for workspace: ${resolvedPath}\n` +
            `Total sessions in time range: ${totalFound}\n` +
            `Try running from the project directory or check the workspace path.`);
    }
    // Extract patterns
    const patterns = extractPatterns(allSessions);
    // Extract learnings if requested
    let learnings = [];
    if (includeLearnings && llmClient) {
        const { allLearnings } = await summarizeSessions(allSessions, { llmClient });
        learnings = allLearnings;
    }
    // Generate skill markdown
    const projectName = basename(projectPath) || 'project';
    const skillContent = generateSkillMarkdown(patterns, projectName, learnings);
    // Ensure output directory exists
    const skillDir = join(outputDir, `${projectName}-conventions`);
    if (!existsSync(skillDir)) {
        mkdirSync(skillDir, { recursive: true });
    }
    const skillPath = join(skillDir, 'SKILL.md');
    writeFileSync(skillPath, skillContent);
    // Generate quality report
    const qualityReport = generateQualityReport(patterns, learnings);
    return {
        skillPath,
        patterns,
        sessionCount: allSessions.length,
        filteredCount: totalFound - allSessions.length,
        learnings: learnings.length > 0 ? learnings : undefined,
        qualityReport,
    };
}
// Helper function
function groupLearningsByCategory(learnings) {
    const groups = {
        decision: [],
        pattern: [],
        gotcha: [],
        convention: [],
        context: [],
    };
    for (const l of learnings) {
        groups[l.category].push(l);
    }
    // Sort each group by confidence
    for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => b.confidence - a.confidence);
    }
    return groups;
}
//# sourceMappingURL=skill-md.js.map