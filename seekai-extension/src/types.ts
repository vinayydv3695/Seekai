/**
 * Seekai Type Definitions
 * TypeScript interfaces for all data models
 */

export type ItemType = 'bookmark' | 'tab' | 'history' | 'command';

export interface SeekaiItem {
  id: string | number;
  title: string;
  url: string;
  type: ItemType;
  icon?: string;
  lastVisitTime?: number;
  dateAdded?: number;
}

export interface BookmarkItem extends SeekaiItem {
  type: 'bookmark';
  useCount?: number;
  lastUsed?: number;
}

export interface TabItem extends SeekaiItem {
  type: 'tab';
  windowId: number;
  active: boolean;
  pinned: boolean;
}

export interface HistoryItem extends SeekaiItem {
  type: 'history';
  visitCount?: number;
}

export interface CommandItem extends SeekaiItem {
  type: 'command';
  description?: string;
  action?: string;
}

export interface SearchResult {
  item: SeekaiItem;
  score: number;
  matches: number[];
  matchedField: 'title' | 'url';
}

export interface FuzzyMatchResult {
  score: number;
  indices: number[];
}

export interface Settings {
  enableBookmarks: boolean;
  enableHistory: boolean;
  enableTabs: boolean;
  enableCommands: boolean;
  theme?: string;
  accentColor?: string;
  customCommands?: CustomCommand[];
}

export interface CustomCommand {
  id: string;
  title: string;
  name?: string;
  url: string;
  action?: string;
  icon?: string;
  description?: string;
}

export interface BookmarkStats {
  [bookmarkId: string]: {
    count: number;
    lastUsed: number;
  };
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
  };
}

export interface DataCache {
  bookmarks: BookmarkItem[];
  history: HistoryItem[];
  tabs: TabItem[];
  commands: CommandItem[];
  combined: SeekaiItem[];
}

export interface UIState {
  results: SearchResult[];
  selectedIndex: number;
  isSearching: boolean;
  searchQuery: string;
}

export interface UICallbacks {
  onSearch: ((query: string) => void) | null;
  onSelect: ((item: SeekaiItem) => void) | null;
  onRefresh: (() => void) | null;
  onEnterWithNoResults: ((query: string) => void) | null;
}
