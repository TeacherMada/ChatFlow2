(function() {
  // Get pageId from script tag
  const script = document.currentScript;
  const pageId = new URL(script.src).searchParams.get('pageId');
  
  if (!pageId) {
    console.error('ChatFlow: pageId is required');
    return;
  }

  // Styles
  const styles = `
    #chatflow-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #chatflow-toggle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: #4f46e5;
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    #chatflow-toggle:hover {
      transform: scale(1.05);
    }
    #chatflow-window {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 350px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    #chatflow-header {
      background: #4f46e5;
      color: white;
      padding: 16px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #chatflow-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #f9fafb;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .chatflow-message {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
    }
    .chatflow-message.user {
      align-self: flex-end;
      background: #4f46e5;
      color: white;
      border-bottom-right-radius: 2px;
    }
    .chatflow-message.assistant {
      align-self: flex-start;
      background: white;
      color: #1f2937;
      border: 1px solid #e5e7eb;
      border-bottom-left-radius: 2px;
    }
    #chatflow-input-area {
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      background: white;
      display: flex;
      gap: 8px;
    }
    #chatflow-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
    }
    #chatflow-input:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
    }
    #chatflow-send {
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      cursor: pointer;
      font-weight: 500;
    }
    #chatflow-send:hover {
      background: #4338ca;
    }
  `;

  // Inject styles
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  // Create widget
  const widget = document.createElement('div');
  widget.id = 'chatflow-widget';
  widget.innerHTML = `
    <div id="chatflow-window">
      <div id="chatflow-header">
        <span>Chat Support</span>
        <button id="chatflow-close" style="background:none;border:none;color:white;cursor:pointer;">✕</button>
      </div>
      <div id="chatflow-messages"></div>
      <div id="chatflow-input-area">
        <input type="text" id="chatflow-input" placeholder="Type a message..." />
        <button id="chatflow-send">Send</button>
      </div>
    </div>
    <button id="chatflow-toggle">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </button>
  `;
  document.body.appendChild(widget);

  // Logic
  const toggleBtn = document.getElementById('chatflow-toggle');
  const windowEl = document.getElementById('chatflow-window');
  const closeBtn = document.getElementById('chatflow-close');
  const messagesEl = document.getElementById('chatflow-messages');
  const inputEl = document.getElementById('chatflow-input');
  const sendBtn = document.getElementById('chatflow-send');

  let isOpen = false;
  let userId = localStorage.getItem('chatflow_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatflow_user_id', userId);
  }

  const toggleChat = () => {
    isOpen = !isOpen;
    windowEl.style.display = isOpen ? 'flex' : 'none';
    if (isOpen) {
      inputEl.focus();
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const addMessage = (text, role) => {
    const msg = document.createElement('div');
    msg.className = `chatflow-message ${role}`;
    msg.textContent = text;
    messagesEl.appendChild(msg);
    scrollToBottom();
  };

  const fetchMessages = async () => {
    try {
      // Use the script src origin as the API base URL
      const apiUrl = new URL(script.src).origin;
      const res = await fetch(`${apiUrl}/api/webchat/messages?pageId=${pageId}&userId=${userId}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        messagesEl.innerHTML = '';
        data.forEach(m => addMessage(m.content, m.role === 'user' ? 'user' : 'assistant'));
      }
    } catch (e) {
      console.error('Error fetching messages:', e);
    }
  };

  const sendMessage = async () => {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    addMessage(text, 'user');

    try {
      const apiUrl = new URL(script.src).origin;
      await fetch(`${apiUrl}/api/webchat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, userId, text })
      });
      // Fetch immediately to get any quick response
      setTimeout(fetchMessages, 1000);
    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  // Event Listeners
  toggleBtn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Initial load
  fetchMessages();
  setInterval(fetchMessages, 3000);

})();
