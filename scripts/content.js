// Receive verification requests
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "verifyHighlightedText") {
    verifyText(request.text);
  }
});

async function verifyText(text) {
  // Get position of highlighted text
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  try {
    // Send to AI API via service worker
    const verdict = await chrome.runtime.sendMessage({
      action: "getVerification",
      text: text,
    });
    console.log(verdict);

    // Update with result
    // html template
  } catch (error) {
    // update with html template
    console.log(error);
  }
}
