// Add context menu on Installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "verify-text",
    title: "Verify '%s'",
    contexts: ["selection"],
  });
});

// Event Listener for 'Verify' context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "verify-text" && info.selectionText) {
    const selectedText = info.selectionText.trim();
    
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: "verifySelectedText",
        text: selectedText,
      });
    } catch (error) {
      console.log("Content script not ready, injecting...");
      
      // Inject content script if it's not loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['scripts/content.js']
        });
        
        // Try sending message again after injection
        await chrome.tabs.sendMessage(tab.id, {
          action: "verifySelectedText",
          text: selectedText,
        });
      } catch (injectionError) {
        console.error("Failed to inject content script:", injectionError);
      }
    }
  }
});

// Used by content js for api call
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "verifyByAI") {
    verificationAPI(request.text)
      .then(verdict => sendResponse(verdict))
      .catch(error => sendResponse({ 
        error: "Verification failed",
        details: error.message 
      }));
    return true; // keep message channel open
  }
});

// Mock API function
async function verificationAPI(text) {
  try {
    // const response = await fetch('endpoint', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': 'Bearer apikey'
    //   },
    //   body: JSON.stringify({ text: text })
    // });
    // const data = await response.json();
    // return data;
    
    // Mock response for testing
    return new Promise((resolve) => {
      setTimeout(() => {
        const isFactual = Math.random() > 0.5; // Random for demo
        resolve({
          verdict: isFactual,
          explanation: isFactual 
            ? "This statement appears to be factually accurate based on available data." 
            : "This statement may contain inaccurate information. Please verify with additional sources.",
          sources: ["https://example-source1.com", "https://example-source2.com"],
        });
      }, 1000);
    });
  } catch (error) {
    throw new Error(`API verification failed: ${error.message}`);
  }
}

