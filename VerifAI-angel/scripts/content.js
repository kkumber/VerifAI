// Listen for verification requests from service worker
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'verifySelectedText') {
    createOverlay(request.text);
    verifyText(request.text);
  }
});

// const explanationBox = shadow.querySelector('.explanation-js');
// if (explanationBox) {
//   explanationBox.style.height = 'auto';
//   explanationBox.style.height = explanationBox.scrollHeight + 'px';
// }

async function verifyText(text) {
  // Show loading state
  showLoadingPopup();

  try {
    // Get AI verification result, call api in service worker
    const result = await chrome.runtime.sendMessage({
      action: 'verifyByAI',
      text: text,
    });

    // Handle result based on state
    if (result.error) {
      showErrorPopup(result.details || 'Verification failed');
    } else if (result.sources.length === 0 || !result.sources) {
      showErrorPopup(
        'The highlighted text does not have enough supporting articles to verify it for now.'
      );
    } else {
      showVerdictPopup(result.verdict, result.explanation, result.sources);
    }
  } catch (error) {
    showErrorPopup(
      'The highlighted text does not contain enough information. Try extending your selection'
    );
  }
}

// Inject Loading Popup into DOM
function showLoadingPopup() {
  const iconUrl = chrome.runtime.getURL('images/loader.png');
  const html = `
    <div class="popup-loading-state loader">
      <div class="loader-container">
        <img src="${iconUrl}" alt="Loading..." class="loader-img" />
      </div>
      <i>Extracting information...</i>
    </div>
  `;
  updatePopup(html, 'loading-state');
  updateCloseButton('loading');
}

// Inject Error Popup into DOM
function showErrorPopup(message) {
  const iconUrl = chrome.runtime.getURL('images/info.png');
  const html = `
    <div class="popup-invalid-state">
      <div class="warning-icon">
        <img src="${iconUrl}" alt="Error Icon">
      </div>
      <i><b>${message}</b></i>
    </div>
  `;
  updatePopup(html, 'error-state');
  updateCloseButton('error');
}

// Inject Verdict into DOM
function showVerdictPopup(verdict, explanation, links) {
  const verdictText = verdict.toString().toUpperCase();
  const linksHtml = links
    .filter((link) => link && link.trim() !== '')
    .map(
      (link) =>
        `<li><span class="link-wrapper"><a href="${link}" target="_blank">${link}</a></span></li>`
    )
    .join('');

  const html = `
    <div class="verdict-container ${
      verdict ? 'verdict-container-true' : 'verdict-container-false'
    }">
      <i><p>Verdict: </p>
            <p class="verdict-result ${
              verdict ? 'verdict-result-true' : 'verdict-result-false'
            }">${verdictText}</p></i>
    <div class="explanation-container">
      <div  class="explanation-js ${
        verdict ? 'explanation-js-true' : 'explanation-js-false'
      }" readonly>${explanation}</div>
    </div>
      </div>
    <div class="links-container">
      <p>Supporting Articles:</p>
      <ul>${linksHtml}</ul>
    </div>
  `;
  updatePopup(html, 'verdict-state');
  updateCloseButton(verdict ? 'true' : 'false');
}

let currentOverlay = null;

async function createOverlay(selectedText) {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }

  try {
    // Fetch popup HTML
    const htmlResponse = await fetch(chrome.runtime.getURL('popup/popup.html'));
    let htmlContent = await htmlResponse.text();

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'verifaiOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
    `;

    const shadow = overlay.attachShadow({ mode: 'open' });

    // Inject CSS
    const cssFiles = [
      'css/index.css',
      'css/header.css',
      'css/verdict.css',
      'css/error.css',
      'css/loading.css',
    ];

    for (const cssFile of cssFiles) {
      const cssUrl = chrome.runtime.getURL(cssFile);
      const cssResponse = await fetch(cssUrl);
      const cssText = await cssResponse.text();

      const style = document.createElement('style');
      style.textContent = cssText;
      shadow.appendChild(style);
    }

    // Inject fonts
    const fontStyles = `
      @font-face {
        font-family: "Satoshi";
        src: url('${chrome.runtime.getURL(
          'fonts/Satoshi-Regular.otf'
        )}') format("opentype");
      }
      @font-face {
        font-family: "Fira Mono";
        src: url('${chrome.runtime.getURL(
          'fonts/FiraMono-Regular.ttf'
        )}') format("truetype");
      }
      :host, * {
        font-family: "Satoshi", sans-serif;
      }
    `;
    const fontStyleTag = document.createElement('style');
    fontStyleTag.textContent = fontStyles;
    shadow.appendChild(fontStyleTag);

    // Inject HTML
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    shadow.appendChild(container);

    // Fix the loading icon in the popup (injected HTML)
    const loadingImg = shadow.querySelector('.close-btn img');
    if (loadingImg) {
      loadingImg.src = chrome.runtime.getURL('images/check-square-loading.png');
    }

    // Set selected text
    const textElement = shadow.querySelector('.highlighted-text-js');
    if (textElement) textElement.textContent = selectedText;

    // Setup close button
    updateCloseButton('default');
    const closeBtn = shadow.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        overlay.remove();
        currentOverlay = null;
      });
    }

    // Final append
    document.body.appendChild(overlay);
    currentOverlay = overlay;
    return overlay;
  } catch (error) {
    console.error('Overlay creation failed:', error);
    return null;
  }
}

// Helper function to update inner html
function updatePopup(html, state) {
  if (!currentOverlay) return;

  const popupCard = currentOverlay.shadowRoot.querySelector('.popup-card');
  const popupElement =
    currentOverlay.shadowRoot.querySelector('.popup-state-js');
  if (popupElement) {
    // Remove all existing state classes
    popupCard.classList.remove('loading-state', 'error-state', 'verdict-state');
    // Add the new state class
    popupCard.classList.add(state);
    popupElement.innerHTML = html;
  }
}

// Function to update close button image based on state
function updateCloseButton(state) {
  if (!currentOverlay) return;

  const closeBtn = currentOverlay.shadowRoot.querySelector('.close-btn');
  if (!closeBtn) return;

  closeBtn.innerHTML = '';

  // Create image element
  const img = document.createElement('img');
  img.alt = 'Close';
  img.className = 'close-btn-icon';

  // Set image source based on state
  switch (state) {
    case 'loading':
      img.src = chrome.runtime.getURL('images/check-square-loading.png');
      img.alt = 'Close (Loading)';
      break;
    case 'error':
      img.src = chrome.runtime.getURL('images/check-square-error.png');
      img.alt = 'Close (Error)';
      break;
    case 'true':
      img.src = chrome.runtime.getURL('images/check-square-true.png');
      img.alt = 'Close (Success)';
      break;
    case 'false':
      img.src = chrome.runtime.getURL('images/check-square-false.png');
      img.alt = 'Close (Failure)';
      break;
    default:
      img.src = chrome.runtime.getURL('images/check-square-loading.png');
      img.alt = 'Close';
  }

  closeBtn.appendChild(img);

  closeBtn.className = `close-btn close-btn-${state}`;
}
