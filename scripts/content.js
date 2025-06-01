// Listen for verification requests from service worker
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "verifySelectedText") {
    createOverlay(request.text);
    verifyText(request.text);
  }
});

async function verifyText(text) {
  // Show loading state
  showLoadingPopup();

  try {
    // Get AI verification result, call api in service worker
    const result = await chrome.runtime.sendMessage({
      action: "verifyByAI",
      text: text,
    });

    // Handle result based on state
    if (result.error) {
      showErrorPopup(result.details || "Verification failed");
    } else if (result.sources.length === 0 || !result.sources) {
      showErrorPopup("The highlighted text does not have enough supporting articles to verify it for now.")
    } else {
      showVerdictPopup(result.verdict, result.explanation, result.sources);
    }
  } catch (error) {
    showErrorPopup("The highlighted text does not contain enough information. Try extending your selection");
  }
}

function showLoadingPopup() {
  const html = `
    <div class="popup-loading-state">
      <div class="loader"></div>
      <i>Extracting information...</i>
    </div>
  `;
  updatePopup(html);
}

function showErrorPopup(message) {
  const html = `
    <div class="popup-invalid-state">
      <div class="warning-icon">
        <img src="../images/info.png" alt="Error Icon">
      </div>
      <i><b>${message}</b></i>
    </div>
  `;
  updatePopup(html);
}

function showVerdictPopup(verdict, explanation, links) {
  const verdictText = verdict ? "Accurate" : "Questionable";
  const linksHtml = links.map(link => `<li><a href="${link}" target="_blank">${link}</a></li>`).join('');

  const html = `
    <div class="verdict-container">
      <i>Verdict: <span class="verdict-result">${verdictText}</span></i>
    </div>
    <div class="explanation-container">
      <textarea class="explanation-js" readonly>${explanation}</textarea>
    </div>
    <div class="links-container">
      <p>Supporting Articles:</p>
      <ul>${linksHtml}</ul>
    </div>
  `;
  updatePopup(html);
}

let currentOverlay = null;

async function createOverlay(selectedText) {
  // Remove existing overlay
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
  
  try {
    const response = await fetch(chrome.runtime.getURL('popup/popup.html'));
    const htmlContent = await response.text();
    
    const overlay = document.createElement('div');
    overlay.id = 'verifaiOverlay';
    overlay.style = `
    position: fixed;
    top: 20;
    right: 20;
    z-index: 1000;
    `;
    
    // Create SHADOW DOM for style isolation
    const shadow = overlay.attachShadow({ mode: 'open' });
    shadow.innerHTML = htmlContent;
    
    // Set text and close handler
    const textElement = shadow.querySelector('.highlighted-text-js');
    if (textElement) textElement.textContent = selectedText;
    
    shadow.querySelector('.close-btn').addEventListener('click', () => {
      overlay.remove();
      currentOverlay = null;
    });
    
    document.body.appendChild(overlay);
    currentOverlay = overlay;
    return overlay;
    
  } catch (error) {
    console.error('Overlay creation failed:', error);
    return null;
  }
}

function updatePopup(html) {
  if (!currentOverlay) return;
  
  const popupElement = currentOverlay.shadowRoot.querySelector('.popup-state-js');
  if (popupElement) {
    popupElement.innerHTML = html;
  }
}