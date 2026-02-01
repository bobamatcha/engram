/**
 * Semantic optimization for skill descriptions
 *
 * Optimizes skill content for better retrieval:
 * - Include exact error messages
 * - Front-load keywords
 * - Add trigger conditions
 */

import type { Learning, ExtractedPatterns } from '../types.js';

/**
 * Optimize a learning summary for retrieval
 */
export function optimizeLearning(learning: Learning): Learning {
  let optimizedSummary = learning.summary;
  let optimizedDetail = learning.detail;

  // Front-load category keywords
  const categoryKeywords: Record<string, string[]> = {
    decision: ['decision', 'chose', 'architecture', 'design'],
    pattern: ['pattern', 'approach', 'technique', 'method'],
    gotcha: ['error', 'fix', 'issue', 'problem', 'bug'],
    convention: ['convention', 'standard', 'naming', 'format'],
    context: ['context', 'background', 'note', 'important'],
  };

  const keywords = categoryKeywords[learning.category] || [];
  const hasKeyword = keywords.some((k) => optimizedSummary.toLowerCase().includes(k));

  if (!hasKeyword) {
    // Add category context
    switch (learning.category) {
      case 'gotcha':
        optimizedSummary = `Fix: ${optimizedSummary}`;
        break;
      case 'decision':
        optimizedSummary = `Decision: ${optimizedSummary}`;
        break;
      case 'pattern':
        optimizedSummary = `Pattern: ${optimizedSummary}`;
        break;
      case 'convention':
        optimizedSummary = `Convention: ${optimizedSummary}`;
        break;
    }
  }

  // Extract and preserve error messages
  if (learning.category === 'gotcha' && learning.detail) {
    const errorMatch = learning.detail.match(/error[:\s]+["']?([^"'\n]+)["']?/i);
    if (errorMatch && !optimizedSummary.includes(errorMatch[1].slice(0, 30))) {
      optimizedDetail = `Error: "${errorMatch[1].trim()}"\n\n${learning.detail}`;
    }
  }

  // Add file references to summary if present
  if (learning.files?.length && !optimizedSummary.includes(learning.files[0])) {
    const fileRef = learning.files[0];
    if (fileRef.length < 30) {
      optimizedSummary = `${optimizedSummary} (in \`${fileRef}\`)`;
    }
  }

  return {
    ...learning,
    summary: optimizedSummary,
    detail: optimizedDetail,
  };
}

/**
 * Optimize all learnings in a collection
 */
export function optimizeLearnings(learnings: Learning[]): Learning[] {
  return learnings.map(optimizeLearning);
}

/**
 * Generate trigger conditions for a learning
 */
export function generateTriggerConditions(learning: Learning): string[] {
  const triggers: string[] = [];

  // Category-based triggers
  switch (learning.category) {
    case 'gotcha':
      triggers.push('When encountering an error');
      triggers.push('When debugging an issue');
      break;
    case 'decision':
      triggers.push('When making architectural choices');
      triggers.push('When planning implementation');
      break;
    case 'pattern':
      triggers.push('When writing new code');
      triggers.push('When following project patterns');
      break;
    case 'convention':
      triggers.push('When creating new files');
      triggers.push('When naming things');
      break;
    case 'context':
      triggers.push('When starting work');
      triggers.push('When onboarding');
      break;
  }

  // File-based triggers
  if (learning.files?.length) {
    for (const file of learning.files.slice(0, 2)) {
      const ext = file.split('.').pop();
      if (ext) {
        triggers.push(`When working with .${ext} files`);
      }
      triggers.push(`When editing ${file}`);
    }
  }

  // Keyword-based triggers from summary
  const keywordTriggers = extractKeywordTriggers(learning.summary);
  triggers.push(...keywordTriggers);

  return [...new Set(triggers)]; // Dedupe
}

/**
 * Extract keyword-based triggers from text
 */
function extractKeywordTriggers(text: string): string[] {
  const triggers: string[] = [];
  const textLower = text.toLowerCase();

  const triggerPatterns: Array<{ pattern: RegExp; trigger: string }> = [
    { pattern: /test/i, trigger: 'When writing tests' },
    { pattern: /import|module/i, trigger: 'When importing modules' },
    { pattern: /api|endpoint/i, trigger: 'When working with APIs' },
    { pattern: /database|query|sql/i, trigger: 'When working with databases' },
    { pattern: /config|setting/i, trigger: 'When configuring the project' },
    { pattern: /deploy|build/i, trigger: 'When building or deploying' },
    { pattern: /auth|login|permission/i, trigger: 'When implementing authentication' },
    { pattern: /style|css|layout/i, trigger: 'When styling components' },
    { pattern: /cache|performance/i, trigger: 'When optimizing performance' },
    { pattern: /log|debug|trace/i, trigger: 'When debugging' },
  ];

  for (const { pattern, trigger } of triggerPatterns) {
    if (pattern.test(textLower)) {
      triggers.push(trigger);
    }
  }

  return triggers;
}

/**
 * Generate search keywords for a skill
 */
export function generateSearchKeywords(patterns: ExtractedPatterns, learnings: Learning[]): string[] {
  const keywords = new Set<string>();

  // From test commands
  for (const cmd of patterns.testCommands) {
    const words = cmd.split(/\s+/).filter((w) => w.length > 3);
    words.forEach((w) => keywords.add(w.toLowerCase()));
  }

  // From build commands
  for (const cmd of patterns.buildCommands) {
    const words = cmd.split(/\s+/).filter((w) => w.length > 3);
    words.forEach((w) => keywords.add(w.toLowerCase()));
  }

  // From error patterns
  for (const err of patterns.errorPatterns) {
    const words = err.error.split(/\s+/).filter((w) => w.length > 4);
    words.slice(0, 3).forEach((w) => keywords.add(w.toLowerCase()));
  }

  // From learnings
  for (const learning of learnings) {
    const words = learning.summary.split(/\s+/).filter((w) => w.length > 4);
    words.slice(0, 3).forEach((w) => keywords.add(w.toLowerCase()));
  }

  // Remove common words
  const stopWords = new Set([
    'should',
    'could',
    'would',
    'about',
    'after',
    'before',
    'between',
    'under',
    'above',
    'there',
    'their',
    'which',
    'where',
    'while',
    'this',
    'that',
    'these',
    'those',
  ]);

  return Array.from(keywords).filter((k) => !stopWords.has(k));
}
