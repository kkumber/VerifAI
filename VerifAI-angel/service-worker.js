// Add context menu on Installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'verify-text',
    title: "Verify '%s'",
    contexts: ['selection'],
  });
});

// Event Listener for 'Verify' context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'verify-text' && info.selectionText) {
    const selectedText = info.selectionText.trim();

    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'verifySelectedText',
        text: selectedText,
      });
    } catch (error) {
      console.log('Content script not ready, injecting...');

      // Inject content script if it's not loaded
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['css/index.css', 'css/header.css'],
        });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['scripts/content.js'],
        });

        // Try again after injection
        await chrome.tabs.sendMessage(tab.id, {
          action: 'verifySelectedText',
          text: selectedText,
        });
      } catch (injectionError) {
        console.error('Failed to inject content script:', injectionError);
      }
    }
  }
});

// Used by content js for api call
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'verifyByAI') {
    verificationAPI(request.text)
      .then((verdict) => sendResponse(verdict))
      .catch((error) =>
        sendResponse({
          error: 'Verification failed',
          details: error.message,
        })
      );
    return true; // keep message channel open
  }
});

// Mock API function
async function verificationAPI(text) {
  try {
    const response = await fetch('http://localhost:3105/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: text }),
    });

    const data = await response.json();
    return {
      verdict: data.verdict,
      explanation: data.overall_reason,
      sources: data.errors.map((err) => err.url),
    };
  } catch (error) {
    throw new Error(`API verification failed: ${error.message}`);
  }
}
