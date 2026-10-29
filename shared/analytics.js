/**
 * Vercel Web Analytics
 * Initialization script for vanilla JavaScript pages
 */
(function() {
  'use strict';
  
  // Initialize Vercel Analytics queue
  window.va = window.va || function() {
    (window.vaq = window.vaq || []).push(arguments);
  };
  
  // Load analytics script asynchronously
  var script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.appendChild(script);
})();
