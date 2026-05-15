/**
 * Placeholder hook for search functionality.
 * Full implementation will be added in Step 8.
 */
export function useSearch() {
  return {
    keyword: '',
    setKeyword: (_: string) => {},
    results: [],
    isSearching: false,
  };
}
