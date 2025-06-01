// Add context menu on Installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "verify-text",
    title: "Verify '%s'",
    contexts: ["selection"],
  });
});

// Event Listener for 'verify' context menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "verify-text" && info.selectionText) {
    const selectedText = info.selectionText.trim();
    chrome.tabs.sendMessage(tab.id, {
      action: "verifyHighlightedText",
      text: selectedText,
    });
    console.log(selectedText);
  }
});

// Listener for a sendMessage from Tab (content.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getVerification") {
    verificationAPI(request.text).then((verdict) => sendResponse(verdict)); // Send verdict back to content.js for UI
    return true;
  }
});

// Mock API function
async function verificationAPI(text) {
  return new Promise(
    setTimeout(() => {
      console.log(text);
    }, [1000])
  );
}
