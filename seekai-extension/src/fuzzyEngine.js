/**
 * Seekai Fuzzy Search Engine
 * Lightweight, fast fuzzy matching with character highlighting
 */

class FuzzyEngine {
  constructor() {
    this.items = [];
    this.options = {
      keys: ['title', 'url'],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      useExtendedSearch: false
    };
  }

  /**
   * Set the items to search through
   * @param {Array} items - Array of searchable items
   */
  setItems(items) {
    this.items = items;
  }

  /**
   * Perform fuzzy search
   * @param {string} query - Search query
   * @param {number} limit - Max results to return
   * @returns {Array} - Sorted results with scores
   */
  search(query, limit = 50) {
    if (!query || query.trim() === '') {
      return this.items.slice(0, limit).map(item => ({
        item,
        score: 1,
        matches: []
      }));
    }

    const normalizedQuery = query.toLowerCase();
    const results = [];

    for (const item of this.items) {
      const result = this.matchItem(item, normalizedQuery);
      if (result.score > 0) {
        results.push(result);
      }
    }

    // Sort by score (higher is better) and recency
    results.sort((a, b) => {
      if (Math.abs(a.score - b.score) < 0.01) {
        // If scores are similar, prefer more recent items
        return (b.item.lastVisitTime || 0) - (a.item.lastVisitTime || 0);
      }
      return b.score - a.score;
    });

    return results.slice(0, limit);
  }

  /**
   * Match a single item against the query
   * @param {Object} item - Item to match
   * @param {string} query - Normalized query string
   * @returns {Object} - Match result with score and highlights
   */
  matchItem(item, query) {
    const titleMatch = this.fuzzyMatch(item.title || '', query);
    const urlMatch = this.fuzzyMatch(item.url || '', query);

    // Combine scores (title weighted higher)
    const combinedScore = Math.max(
      titleMatch.score * 1.5,
      urlMatch.score
    );

    const bestMatch = titleMatch.score > urlMatch.score ? titleMatch : urlMatch;

    return {
      item,
      score: combinedScore,
      matches: bestMatch.indices,
      matchedField: titleMatch.score > urlMatch.score ? 'title' : 'url'
    };
  }

  /**
   * Core fuzzy matching algorithm
   * @param {string} text - Text to search in
   * @param {string} query - Query to search for
   * @returns {Object} - Score and matched indices
   */
  fuzzyMatch(text, query) {
    if (!text) return { score: 0, indices: [] };

    const normalizedText = text.toLowerCase();
    const queryLen = query.length;
    const textLen = normalizedText.length;

    if (queryLen > textLen) return { score: 0, indices: [] };

    // Exact match gets highest score
    if (normalizedText.includes(query)) {
      const startIndex = normalizedText.indexOf(query);
      const indices = [];
      for (let i = 0; i < queryLen; i++) {
        indices.push(startIndex + i);
      }
      return { score: 1.0, indices };
    }

    // Fuzzy matching
    let queryIndex = 0;
    let textIndex = 0;
    const indices = [];
    let consecutiveMatches = 0;
    let totalDistance = 0;

    while (queryIndex < queryLen && textIndex < textLen) {
      const queryChar = query[queryIndex];
      const textChar = normalizedText[textIndex];

      if (queryChar === textChar) {
        indices.push(textIndex);
        
        // Bonus for consecutive matches
        if (indices.length > 1 && indices[indices.length - 1] === indices[indices.length - 2] + 1) {
          consecutiveMatches++;
        }
        
        queryIndex++;
      } else {
        totalDistance++;
      }
      
      textIndex++;
    }

    // Not all query characters found
    if (queryIndex < queryLen) {
      return { score: 0, indices: [] };
    }

    // Calculate score based on:
    // - Match percentage
    // - Character distance
    // - Consecutive matches bonus
    // - Word boundary bonus
    const matchRatio = queryLen / textLen;
    const distancePenalty = Math.max(0, 1 - (totalDistance / textLen));
    const consecutiveBonus = Math.min(consecutiveMatches / queryLen, 0.3);
    const wordBoundaryBonus = this.isWordBoundaryMatch(normalizedText, indices) ? 0.2 : 0;

    const score = (matchRatio * 0.4 + distancePenalty * 0.4 + consecutiveBonus + wordBoundaryBonus);

    return {
      score: Math.min(score, 1.0),
      indices
    };
  }

  /**
   * Check if matched characters align with word boundaries
   * @param {string} text - Original text
   * @param {Array} indices - Matched character indices
   * @returns {boolean}
   */
  isWordBoundaryMatch(text, indices) {
    if (indices.length === 0) return false;
    
    const firstIndex = indices[0];
    if (firstIndex === 0) return true;
    
    const prevChar = text[firstIndex - 1];
    return /[\s\-_/.]/.test(prevChar);
  }

  /**
   * Generate highlighted text with matched characters
   * @param {string} text - Original text
   * @param {Array} indices - Indices to highlight
   * @returns {string} - HTML string with highlights
   */
  highlightMatches(text, indices) {
    if (!text || !indices || indices.length === 0) {
      return this.escapeHtml(text || '');
    }

    let result = '';
    let lastIndex = 0;

    for (const index of indices) {
      if (index >= text.length) continue;
      
      // Add non-highlighted portion
      result += this.escapeHtml(text.substring(lastIndex, index));
      
      // Add highlighted character
      result += `<mark class="match-highlight">${this.escapeHtml(text[index])}</mark>`;
      
      lastIndex = index + 1;
    }

    // Add remaining text
    result += this.escapeHtml(text.substring(lastIndex));

    return result;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FuzzyEngine;
}
