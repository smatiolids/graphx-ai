const blockedPatterns = [/\baddV\s*\(/i, /\baddE\s*\(/i, /\bdrop\s*\(/i, /\bproperty\s*\(/i, /\bmergeV\s*\(/i, /\bmergeE\s*\(/i];

export function isMutatingGremlinQuery(query: string): boolean {
  return blockedPatterns.some((pattern) => pattern.test(query));
}
