import { filterSuggestions, hasExactMatch, Suggestion } from './autocomplete';

const cats: Suggestion[] = [
  { id: '1', label: 'Work' },
  { id: '2', label: 'Health' },
  { id: '3', label: 'Personal' },
  { id: '4', label: 'Learning' },
];

describe('filterSuggestions', () => {
  it('returns all when query is empty', () => {
    expect(filterSuggestions(cats, '')).toHaveLength(4);
    expect(filterSuggestions(cats, '   ')).toHaveLength(4);
  });
  it('filters case-insensitively by substring', () => {
    expect(filterSuggestions(cats, 'a').map((s) => s.label)).toEqual(['Health', 'Personal', 'Learning']);
    expect(filterSuggestions(cats, 'ar').map((s) => s.label)).toEqual(['Learning']);
    expect(filterSuggestions(cats, 'HEAL').map((s) => s.label)).toEqual(['Health']);
  });
  it('returns empty when nothing matches', () => {
    expect(filterSuggestions(cats, 'zzz')).toEqual([]);
  });
});

describe('hasExactMatch', () => {
  it('is true on an exact (case-insensitive) label', () => {
    expect(hasExactMatch(cats, 'work')).toBe(true);
    expect(hasExactMatch(cats, 'Personal')).toBe(true);
  });
  it('is false on a partial or missing label', () => {
    expect(hasExactMatch(cats, 'wor')).toBe(false);
    expect(hasExactMatch(cats, 'zzz')).toBe(false);
    expect(hasExactMatch(cats, '')).toBe(false);
  });
});
