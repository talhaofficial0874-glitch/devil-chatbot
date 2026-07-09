/**
 * RAG (Retrieval-Augmented Generation) SERVICE FOR DEVIL CHATBOT
 * Implements a pure client-side search engine using TF-IDF text representation
 * and Cosine Similarity to find relevant document passages.
 */

const STORAGE_RAG_DOCS_KEY = 'devil_rag_documents';
const STORAGE_RAG_ENABLED_KEY = 'devil_rag_enabled';

// List of English stopwords to filter out for more accurate term mapping
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
  'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
  'why', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenizes text: downcases, cleans punctuation, splits into words, and filters stopwords.
 * @param {string} text 
 * @returns {Array<string>} list of tokens
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOPWORDS.has(word));
}

/**
 * Chunks a long document into sentence-boundary aligned passages.
 * @param {string} text 
 * @param {number} maxChunkSize - Target characters per chunk
 * @returns {Array<string>} chunks of text
 */
function chunkText(text, maxChunkSize = 400) {
  if (!text) return [];
  
  // Split by sentence boundaries roughly
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Checks if RAG mode is active/enabled by user
 * @returns {boolean}
 */
export function isRagEnabled() {
  const val = localStorage.getItem(STORAGE_RAG_ENABLED_KEY);
  return val === 'true'; // Default is disabled (false)
}

/**
 * Updates active RAG toggle state
 * @param {boolean} isEnabled 
 */
export function setRagEnabled(isEnabled) {
  localStorage.setItem(STORAGE_RAG_ENABLED_KEY, isEnabled ? 'true' : 'false');
}

/**
 * Returns all documents stored in the database
 * @returns {Array}
 */
export function getDocuments() {
  const docs = localStorage.getItem(STORAGE_RAG_DOCS_KEY);
  return docs ? JSON.parse(docs) : [];
}

/**
 * Saves a document to the database, chunks it, and updates local state.
 * @param {string} title 
 * @param {string} content 
 * @returns {Object} saved document
 */
export function saveDocument(title, content) {
  const docs = getDocuments();
  
  const cleanTitle = title.trim() || `Untitled Document (${new Date().toLocaleDateString()})`;
  const cleanContent = content.trim();
  
  if (!cleanContent) {
    throw new Error('Document content cannot be empty.');
  }

  // Create text chunks
  const chunks = chunkText(cleanContent);

  const doc = {
    id: 'doc_' + Date.now(),
    title: cleanTitle,
    content: cleanContent,
    chunks: chunks,
    wordCount: cleanContent.split(/\s+/).filter(Boolean).length,
    chunkCount: chunks.length,
    addedAt: new Date().toISOString()
  };

  docs.push(doc);
  localStorage.setItem(STORAGE_RAG_DOCS_KEY, JSON.stringify(docs));
  return doc;
}

/**
 * Deletes a document by ID
 * @param {string} docId 
 */
export function deleteDocument(docId) {
  let docs = getDocuments();
  docs = docs.filter(d => d.id !== docId);
  localStorage.setItem(STORAGE_RAG_DOCS_KEY, JSON.stringify(docs));
}

/**
 * Performs TF-IDF client-side similarity search across all document chunks.
 * @param {string} query 
 * @param {number} limit 
 * @returns {Array<Object>} retrieved search results [{ text, sourceTitle, score }]
 */
export function searchKnowledgeBase(query, limit = 3) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const docs = getDocuments();
  if (docs.length === 0) return [];

  // Flatten all document chunks into a single array for indexing
  const allChunks = [];
  docs.forEach(doc => {
    doc.chunks.forEach((chunkText, index) => {
      allChunks.push({
        text: chunkText,
        sourceId: doc.id,
        sourceTitle: doc.title,
        chunkIndex: index
      });
    });
  });

  const totalChunks = allChunks.length;
  if (totalChunks === 0) return [];

  // 1. Calculate Document Frequency (DF) of each token across all chunks
  const df = {};
  allChunks.forEach(chunk => {
    const chunkTokens = new Set(tokenize(chunk.text));
    chunkTokens.forEach(token => {
      df[token] = (df[token] || 0) + 1;
    });
  });

  // 2. Calculate IDF for each token in our query vocabulary
  const idf = {};
  queryTokens.forEach(token => {
    const termDf = df[token] || 0;
    // Standard IDF formula with smoothing to avoid zero division
    idf[token] = Math.log(1 + (totalChunks / (1 + termDf)));
  });

  // 3. Compute TF-IDF vector representing the query
  const queryTfs = {};
  queryTokens.forEach(token => {
    queryTfs[token] = (queryTfs[token] || 0) + 1;
  });

  let queryMagnitudeSq = 0;
  const queryVector = {};
  queryTokens.forEach(token => {
    const tf = queryTfs[token];
    const tfidf = tf * idf[token];
    queryVector[token] = tfidf;
    queryMagnitudeSq += tfidf * tfidf;
  });
  const queryMagnitude = Math.sqrt(queryMagnitudeSq);
  if (queryMagnitude === 0) return [];

  // 4. Calculate TF-IDF vectors for each chunk and score similarity
  const results = [];

  allChunks.forEach(chunk => {
    const chunkTokens = tokenize(chunk.text);
    const chunkTfs = {};
    chunkTokens.forEach(token => {
      chunkTfs[token] = (chunkTfs[token] || 0) + 1;
    });

    let dotProduct = 0;
    let chunkMagnitudeSq = 0;

    // Calculate magnitudes and overlaps
    // Calculate dot product only for overlapping query terms to save time
    queryTokens.forEach(token => {
      const qWeight = queryVector[token] || 0;
      const cTf = chunkTfs[token] || 0;
      const cWeight = cTf * (idf[token] || 0);
      dotProduct += qWeight * cWeight;
    });

    // Calculate full chunk vector magnitude for proper Cosine Similarity normalization
    // (Ensure all unique terms in chunk are counted, not just query terms)
    const uniqueChunkTokens = Object.keys(chunkTfs);
    uniqueChunkTokens.forEach(token => {
      // Calculate IDF on the fly if not calculated, or default to standard log ratio
      const termDf = df[token] || 0;
      const termIdf = Math.log(1 + (totalChunks / (1 + termDf)));
      const tfidf = chunkTfs[token] * termIdf;
      chunkMagnitudeSq += tfidf * tfidf;
    });

    const chunkMagnitude = Math.sqrt(chunkMagnitudeSq);
    
    let similarity = 0;
    if (queryMagnitude > 0 && chunkMagnitude > 0) {
      similarity = dotProduct / (queryMagnitude * chunkMagnitude);
    }

    if (similarity > 0) {
      results.push({
        text: chunk.text,
        sourceTitle: chunk.sourceTitle,
        chunkIndex: chunk.chunkIndex + 1,
        score: similarity
      });
    }
  });

  // 5. Rank and return top K matches above a minor relevance threshold
  return results
    .filter(r => r.score > 0.05) // ignore irrelevant items
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
