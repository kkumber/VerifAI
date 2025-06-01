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
  const verdictText = verdict.toString().toUpperCase();
  const linksHtml = links.map(link => `<li><a href="${link}" target="_blank">${link}</a></li>`).join('');

  const html = `
    <div class="verdict-container ${verdict ? "verdict-container-true" : "verdict-container-false"}">
      <i><p>Verdict: </p>
            <p class="verdict-result ${verdict ? "verdict-result-true" : "verdict-result-false"}">${verdictText}</p></i>
    <div class="explanation-container">
      <textarea class="explanation-js ${verdict ? "explanation-js-true" : "explanation-js-false"}" readonly>${explanation}</textarea>
    </div>
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
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
  
  try {
    // Fetch HTML content
    const htmlResponse = await fetch(chrome.runtime.getURL('popup/popup.html'));
    let htmlContent = await htmlResponse.text();
    
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'verifaiOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0%;
      right: 20%;
      z-index: 1000;
    `;
    
    // Create shadow DOM
    const shadow = overlay.attachShadow({ mode: 'open' });
    
    const cssFiles = [
      'css/index.css',
      'css/header.css'
    ];
    
    // Add CSS to shadow DOM
    for (const cssFile of cssFiles) {
      const cssUrl = chrome.runtime.getURL(cssFile);
      const cssResponse = await fetch(cssUrl);
      const cssText = await cssResponse.text();
      
      const style = document.createElement('style');
      style.textContent = cssText;
      shadow.appendChild(style);
    }

    // Add HTML content
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    shadow.appendChild(container);
    
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

// Helper function to update inner html
function updatePopup(html) {
  if (!currentOverlay) return;
  
  const popupElement = currentOverlay.shadowRoot.querySelector('.popup-state-js');
  if (popupElement) {
    popupElement.innerHTML = html;
  }
}