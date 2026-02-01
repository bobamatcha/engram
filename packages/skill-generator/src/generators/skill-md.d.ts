/**
 * SKILL.md generation from extracted patterns and learnings
 */
import type { ExtractedPatterns, Learning, GenerateSkillOptions, GenerateSkillResult } from '../types.js';
/**
 * Generate a SKILL.md from extracted patterns
 */
export declare function generateSkillMarkdown(patterns: ExtractedPatterns, projectName: string, learnings?: Learning[]): string;
/**
 * Generate skills for a project from session history
 */
export declare function generateProjectSkill(projectPath: string, outputDir: string, options?: GenerateSkillOptions): Promise<GenerateSkillResult>;
//# sourceMappingURL=skill-md.d.ts.map