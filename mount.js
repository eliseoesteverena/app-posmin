// Cache for parsed selectors - avoids re-parsing the same selector
const SELECTOR_CACHE = new Map();

// Cache for reusable text elements
const TEXT_NODE_POOL = [];

// Pre-compile regex for better performance
const SELECTOR_REGEX = /^([a-zA-Z][a-zA-Z0-9]*)?(?:\.([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)*))?$/;

function parseSelector(selector) {
  // Use cache for already parsed selectors
  if (SELECTOR_CACHE.has(selector)) {
    return SELECTOR_CACHE.get(selector);
  }
  
  const trimmed = selector.trim();
  const match = SELECTOR_REGEX.exec(trimmed);
  
  let result;
  if (match) {
    result = {
      tag: match[1] || 'div',
      className: match[2] ? match[2].replace(/\s+/g, ' ') : ''
    };
  } else {
    // Fallback to the original method if the regex fails
    const parts = trimmed.split('.');
    result = {
      tag: parts[0] || 'div',
      className: parts.length > 1 ? parts.slice(1).join(' ') : ''
    };
  }
  
  // Store in cache only if it does not exceed a reasonable limit
  if (SELECTOR_CACHE.size < 1000) {
    SELECTOR_CACHE.set(selector, result);
  }
  
  return result;
}

// Optimized function to apply attributes
function applyAttributes(elem, attrs) {
  const entries = Object.entries(attrs);
  const len = entries.length;
  
  for (let i = 0; i < len; i++) {
    const [key, value] = entries[i];
    
    if (key === 'style' && value && typeof value === 'object') {
      // Optimization: use cssText for multiple styles
      const styleEntries = Object.entries(value);
      if (styleEntries.length > 3) {
        elem.style.cssText = styleEntries
          .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
          .join('; ');
      } else {
        Object.assign(elem.style, value);
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      // Use addEventListener with performance options
      const eventName = key.slice(2);
      elem.addEventListener(eventName, value, { passive: eventName.startsWith('touch') });
    } else if (value !== null && value !== undefined) {
      elem.setAttribute(key, value);
    }
  }
}

// Text node pool for reuse
function createTextNode(text) {
  if (TEXT_NODE_POOL.length > 0) {
    const node = TEXT_NODE_POOL.pop();
    node.textContent = text;
    return node;
  }
  return document.createTextNode(text);
}

// Optimized function for appendChild with batch processing
function appendChildren(elem, children) {
  if (children == null) return;
  
  if (typeof children === 'string' || typeof children === 'number') {
    elem.appendChild(createTextNode(String(children)));
    return;
  }
  
  if (children instanceof Node) {
    elem.appendChild(children);
    return;
  }
  
  if (Array.isArray(children)) {
    const len = children.length;
    
    // Optimization: use DocumentFragment for multiple children
    if (len > 5) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < len; i++) {
        appendToFragment(fragment, children[i]);
      }
      elem.appendChild(fragment);
    } else {
      for (let i = 0; i < len; i++) {
        appendChildren(elem, children[i]);
      }
    }
  }
}

function appendToFragment(fragment, child) {
  if (child == null) return;
  
  if (typeof child === 'string' || typeof child === 'number') {
    fragment.appendChild(createTextNode(String(child)));
  } else if (child instanceof Node) {
    fragment.appendChild(child);
  } else if (Array.isArray(child)) {
    child.forEach(c => appendToFragment(fragment, c));
  }
}

export function el(selector, attrs, children) {
  // Parse selector using cache
  const { tag, className } = parseSelector(selector);
  
  // Create element
  const elem = document.createElement(tag);
  
  // Apply className only if it exists
  if (className) {
    elem.className = className;
  }
  
  // Apply attributes in an optimized way
  if (attrs && typeof attrs === 'object') {
    applyAttributes(elem, attrs);
  }
  
  // Add children in an optimized way
  if (children !== undefined) {
    appendChildren(elem, children);
  }
  
  return elem;
}

export function mount(parent, ...args) {
  return parent.appendChild(el(...args));
}

// Utility function to periodically clear caches
export function clearCaches() {
  SELECTOR_CACHE.clear();
  // Return text nodes to the pool
  while (TEXT_NODE_POOL.length > 100) {
    TEXT_NODE_POOL.pop();
  }
}

// Function to efficiently create multiple elements
export function batch(parent, elements) {
  const fragment = document.createDocumentFragment();
  elements.forEach(args => fragment.appendChild(el(...args)));
  return parent.appendChild(fragment);
}

// Specialized version for common cases
export function div(attrs, children) {
  return el('div', attrs, children);
}

export function span(attrs, children) {
  return el('span', attrs, children);
}

export function p(attrs, children) {
  return el('p', attrs, children);
}

export function button(attrs, children) {
  return el('button', attrs, children);
}
