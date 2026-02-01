/**
 * Skill Generator - Analyze Claude Code history and generate useful skills
 * 
 * Reads session history to identify patterns and generates SKILL.md files
 * that encode learned behaviors for future sessions.
 */

import { 
  findClaudeCodeSessions, 
  parseClaudeCodeSession,
  type ClaudeCodeSession,
  type ParsedMessage,
  type ToolCall,
} from '../parsers/claude-code.js';
import {
  findOpenClawSessions,
  parseOpenClawSession,
  type OpenClawSession,
} from '../parsers/openclaw.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';

/** Options for skill generation */
export interface GenerateSkillOptions {
  /** Days of history to analyze */
  days?: number;
  /** Include OpenClaw sessions */
  includeOpenClaw?: boolean;
  /** OpenClaw agent ID filter */
  openclawAgent?: string;
}

/** Unified session type for pattern extraction */
interface UnifiedSession {
  sessionId: string;
  cwd?: string;
  messages: ParsedMessage[];
  startTime: Date;
  endTime: Date;
}

/** Patterns extracted from history */
export interface ExtractedPatterns {
  /** Files that are frequently edited together */
  fileCoEdits: Map<string, string[]>;
  /** Common tool sequences */
  toolSequences: ToolSequence[];
  /** Test commands used */
  testCommands: string[];
  /** Build/lint commands used */
  buildCommands: string[];
  /** Common error patterns and fixes */
  errorPatterns: ErrorPattern[];
  /** File types and their conventions */
  fileConventions: FileConvention[];
  /** Project-specific patterns */
  projectPatterns: ProjectPattern[];
}

export interface ToolSequence {
  tools: string[];
  count: number;
  context: string;
}

export interface ErrorPattern {
  error: string;
  fix: string;
  count: number;
}

export interface FileConvention {
  pattern: string;
  convention: string;
  examples: string[];
}

export interface ProjectPattern {
  name: string;
  description: string;
  trigger: string;
  actions: string[];
}

/**
 * Analyze sessions and extract patterns
 */
export function extractPatterns(sessions: UnifiedSession[]): ExtractedPatterns {
  const fileCoEdits = new Map<string, string[]>();
  const toolSequences: ToolSequence[] = [];
  const testCommands: string[] = [];
  const buildCommands: string[] = [];
  const errorPatterns: ErrorPattern[] = [];
  const fileConventions: FileConvention[] = [];
  const projectPatterns: ProjectPattern[] = [];

  // Track tool sequences per session
  const toolSeqCounts = new Map<string, { count: number; context: string }>();

  for (const session of sessions) {
    const filesEditedInSession = new Set<string>();
    const toolsInSession: string[] = [];

    for (const msg of session.messages) {
      // Track file edits
      if (msg.toolCalls) {
        for (const tool of msg.toolCalls) {
          toolsInSession.push(tool.name);
          const toolNameLower = tool.name.toLowerCase();

          // Extract file edits
          if (['write', 'edit', 'write_file', 'edit_file'].includes(toolNameLower)) {
            const file = (tool.input as any).path || (tool.input as any).file_path || (tool.input as any).file;
            if (file) {
              filesEditedInSession.add(normalizeFilePath(file));
            }
          }

          // Extract test commands
          if (['bash', 'exec', 'run_command'].includes(toolNameLower)) {
            const cmd = (tool.input as any).command || '';
            if (isTestCommand(cmd)) {
              if (!testCommands.includes(cmd)) {
                testCommands.push(cmd);
              }
            }
            if (isBuildCommand(cmd)) {
              if (!buildCommands.includes(cmd)) {
                buildCommands.push(cmd);
              }
            }
          }
        }
      }

      // Look for error mentions in content
      if (msg.content && msg.role === 'assistant') {
        const errorMatch = msg.content.match(/error[:\s]+(.{20,100})/i);
        if (errorMatch) {
          // Look for fix in subsequent messages
          const fixIdx = session.messages.indexOf(msg);
          if (fixIdx < session.messages.length - 1) {
            const nextMsg = session.messages[fixIdx + 1];
            if (nextMsg.toolCalls?.length) {
              errorPatterns.push({
                error: errorMatch[1].trim(),
                fix: nextMsg.toolCalls.map(t => t.name).join(' → '),
                count: 1,
              });
            }
          }
        }
      }
    }

    // Record file co-edits
    const files = Array.from(filesEditedInSession);
    for (const file of files) {
      const others = files.filter(f => f !== file);
      if (others.length > 0) {
        const existing = fileCoEdits.get(file) || [];
        fileCoEdits.set(file, [...new Set([...existing, ...others])]);
      }
    }

    // Record tool sequences (sliding window of 3)
    for (let i = 0; i < toolsInSession.length - 2; i++) {
      const seq = toolsInSession.slice(i, i + 3).join(' → ');
      const existing = toolSeqCounts.get(seq);
      if (existing) {
        existing.count++;
      } else {
        toolSeqCounts.set(seq, { count: 1, context: 'general' });
      }
    }
  }

  // Convert tool sequences to array
  for (const [seq, data] of toolSeqCounts.entries()) {
    if (data.count >= 2) { // Only include repeated sequences
      toolSequences.push({
        tools: seq.split(' → '),
        count: data.count,
        context: data.context,
      });
    }
  }

  // Sort by frequency
  toolSequences.sort((a, b) => b.count - a.count);

  return {
    fileCoEdits,
    toolSequences: toolSequences.slice(0, 10), // Top 10
    testCommands: [...new Set(testCommands)].slice(0, 5),
    buildCommands: [...new Set(buildCommands)].slice(0, 5),
    errorPatterns: dedupeErrors(errorPatterns).slice(0, 5),
    fileConventions,
    projectPatterns,
  };
}

/**
 * Generate a SKILL.md from extracted patterns
 */
export function generateSkill(
  patterns: ExtractedPatterns,
  projectName: string,
  projectPath: string,
): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push(`name: ${projectName}-conventions`);
  lines.push('description: |');
  lines.push(`  Learned conventions for working in ${projectName}.`);
  lines.push('  Auto-generated from Claude Code session history by engram.');
  lines.push('category: project');
  lines.push('disable-model-invocation: false');
  lines.push('user-invocable: true');
  lines.push('allowed-tools: Read, Bash, Write, Edit, Glob');
  lines.push('---');
  lines.push('');

  // Header
  lines.push(`# ${projectName} Conventions`);
  lines.push('');
  lines.push('> Auto-generated from Claude Code history. Update as conventions evolve.');
  lines.push('');

  // File co-edits
  if (patterns.fileCoEdits.size > 0) {
    lines.push('## Files Often Changed Together');
    lines.push('');
    lines.push('When editing these files, check their companions:');
    lines.push('');
    let count = 0;
    for (const [file, companions] of patterns.fileCoEdits.entries()) {
      if (count >= 5) break; // Limit output
      if (companions.length > 0) {
        lines.push(`- \`${file}\` → also check: ${companions.slice(0, 3).map(f => `\`${f}\``).join(', ')}`);
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
 * Check if a session is primarily working in the target workspace.
 * Uses a heuristic: count file operations in the workspace vs total.
 * Requires >50% of file operations to be in the target workspace.
 */
function matchesWorkspace(session: UnifiedSession, targetPath: string): boolean {
  const resolvedTarget = resolve(targetPath);
  
  // First check session cwd
  if (session.cwd) {
    const resolvedCwd = resolve(session.cwd);
    if (resolvedCwd === resolvedTarget || resolvedCwd.startsWith(resolvedTarget + '/')) {
      return true;
    }
  }
  
  // Fall back to analyzing file operations
  let inWorkspace = 0;
  let total = 0;
  
  for (const msg of session.messages) {
    if (!msg.toolCalls) continue;
    
    for (const tool of msg.toolCalls) {
      // Look for file operations
      if (['Write', 'Edit', 'Read', 'write', 'edit', 'read', 'write_file', 'read_file', 'edit_file'].includes(tool.name)) {
        const filePath = (tool.input as any).path || 
                        (tool.input as any).file_path || 
                        (tool.input as any).file ||
                        (tool.input as any).filePath;
        
        if (filePath) {
          total++;
          const resolvedFile = resolve(filePath);
          if (resolvedFile.startsWith(resolvedTarget + '/') || resolvedFile === resolvedTarget) {
            inWorkspace++;
          }
        }
      }
    }
  }
  
  // Require >50% of file operations in workspace, with minimum of 5 operations
  if (total >= 5) {
    return inWorkspace / total > 0.5;
  }
  
  // If too few file operations, require at least 3 in workspace
  return inWorkspace >= 3;
}

/**
 * Convert OpenClaw session to unified format
 */
function openclawToUnified(session: OpenClawSession): UnifiedSession {
  return {
    sessionId: session.sessionId,
    cwd: session.cwd,
    messages: session.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      toolCalls: m.toolCalls?.map(t => ({
        name: t.name,
        input: t.arguments,
      })),
      parentId: m.parentId,
    })),
    startTime: session.startTime,
    endTime: session.endTime,
  };
}

/**
 * Convert Claude Code session to unified format
 */
function claudeToUnified(session: ClaudeCodeSession): UnifiedSession {
  return {
    sessionId: session.sessionId,
    cwd: session.cwd,
    messages: session.messages,
    startTime: session.startTime,
    endTime: session.endTime,
  };
}

/**
 * Generate skills for a project from Claude Code and OpenClaw history
 */
export async function generateProjectSkills(
  projectPath: string,
  outputDir: string,
  options: GenerateSkillOptions = {},
): Promise<{ skillPath: string; patterns: ExtractedPatterns; sessionCount: number; filteredCount: number }> {
  const { days = 30, includeOpenClaw = true, openclawAgent } = options;
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const resolvedPath = resolve(projectPath);
  
  const allSessions: UnifiedSession[] = [];
  let totalFound = 0;

  // Collect Claude Code sessions
  const claudeSessions = findClaudeCodeSessions()
    .map(parseClaudeCodeSession)
    .filter(s => s.endTime.getTime() > cutoff);
  
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
      .filter(s => s.endTime.getTime() > cutoff);
    
    totalFound += openclawSessions.length;
    
    for (const session of openclawSessions) {
      const unified = openclawToUnified(session);
      if (matchesWorkspace(unified, resolvedPath)) {
        allSessions.push(unified);
      }
    }
  }

  if (allSessions.length === 0) {
    throw new Error(
      `No sessions found for workspace: ${resolvedPath}\n` +
      `Total sessions in time range: ${totalFound}\n` +
      `Try running from the project directory or check the workspace path.`
    );
  }

  const patterns = extractPatterns(allSessions);
  const projectName = basename(projectPath) || 'project';
  const skillContent = generateSkill(patterns, projectName, projectPath);

  // Ensure output directory exists
  const skillDir = join(outputDir, `${projectName}-conventions`);
  if (!existsSync(skillDir)) {
    mkdirSync(skillDir, { recursive: true });
  }

  const skillPath = join(skillDir, 'SKILL.md');
  writeFileSync(skillPath, skillContent);

  return { 
    skillPath, 
    patterns, 
    sessionCount: allSessions.length,
    filteredCount: totalFound - allSessions.length,
  };
}

// Helper functions

function normalizeFilePath(path: string): string {
  // Remove absolute path prefix, keep relative
  return path.replace(/^\/[^/]+\/[^/]+\//, '');
}

function isTestCommand(cmd: string): boolean {
  // Skip multi-line commands or very long commands
  if (cmd.includes('\n') || cmd.length > 200) return false;
  
  const testPatterns = [
    /\btest\b/i,
    /\bvitest\b/i,
    /\bjest\b/i,
    /\bpytest\b/i,
    /cargo test/i,
    /npm run test/i,
    /pnpm test/i,
    /npm test/i,
  ];
  return testPatterns.some(p => p.test(cmd));
}

function isBuildCommand(cmd: string): boolean {
  // Skip multi-line commands or very long commands
  if (cmd.includes('\n') || cmd.length > 200) return false;
  
  const buildPatterns = [
    /\bbuild\b/i,
    /\bcompile\b/i,
    /cargo build/i,
    /npm run build/i,
    /pnpm build/i,
    /tsc\b/i,
  ];
  return buildPatterns.some(p => p.test(cmd));
}

function dedupeErrors(errors: ErrorPattern[]): ErrorPattern[] {
  const seen = new Map<string, ErrorPattern>();
  for (const err of errors) {
    const key = err.error.slice(0, 30);
    const existing = seen.get(key);
    if (existing) {
      existing.count++;
    } else {
      seen.set(key, err);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.count - a.count);
}
