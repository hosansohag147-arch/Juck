import { useState, useEffect } from 'react';

interface Message {
  role: string;
  content: string;
}

interface Conversation {
  id: number;
  title: string;
  messages: Message[];
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('conversations');
    if (saved) setConversations(JSON.parse(saved));
  }, []);

  const saveConversations = (convs: Conversation[]) => {
    setConversations(convs);
    localStorage.setItem('conversations', JSON.stringify(convs));
  };

  const newChat = () => {
    setCurrentId(null);
    setMessages([]);
    setInput('');
    setSidebarOpen(false);
  };

  const openConversation = (conv: Conversation) => {
    setCurrentId(conv.id);
    setMessages(conv.messages);
    setSidebarOpen(false);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setLoading(true);

    const newHistory = [...messages, { role: 'user', content: userMessage }];
    setMessages(newHistory);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userMessage,
          history: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            content: m.content
          }))
        })
      });

      const data = await res.json();
      const aiReply = data.text || data.error;
      const updatedMessages = [...newHistory, { role: 'assistant', content: aiReply }];
      setMessages(updatedMessages);

      // Save conversation
      const updatedConvs = [...conversations];
      if (currentId !== null) {
        const idx = updatedConvs.findIndex(c => c.id === currentId);
        if (idx !== -1) updatedConvs[idx].messages = updatedMessages;
      } else {
        const newId = Date.now();
        const title = userMessage.slice(0, 30) || `Conversation #${updatedConvs.length + 1}`;
        updatedConvs.unshift({ id: newId, title, messages: updatedMessages });
        setCurrentId(newId);
      }
      saveConversations(updatedConvs);

    } catch {
      setMessages([...newHistory, { role: 'assistant', content: 'সংযোগ সমস্যা হয়েছে।' }]);
    }

    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', background: '#1a1a2e', color: 'white' }}>

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{ width: '260px', background: '#16213e', padding: '15px', overflowY: 'auto' }}>
          <button onClick={newChat} style={{ width: '100%', padding: '10px', background: '#0f3460', color: 'white', border: 'none', borderRadius: '8px', marginBottom: '15px', cursor: 'pointer' }}>
            + New Chat
          </button>
          {conversations.map(conv => (
            <div key={conv.id} onClick={() => openConversation(conv)}
              style={{ padding: '10px', marginBottom: '8px', background: currentId === conv.id ? '#0f3460' : '#1a1a2e', borderRadius: '8px', cursor: 'pointer' }}>
              {conv.title}
            </div>
          ))}
        </div>
      )}

      {/* Main Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '15px', background: '#16213e', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>☰</button>
          <span style={{ fontWeight: 'bold' }}>Jack Assistant</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '15px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
              <span style={{ background: msg.role === 'user' ? '#0f3460' : '#16213e', padding: '10px 15px', borderRadius: '12px', display: 'inline-block', maxWidth: '80%' }}>
                {msg.content}
              </span>
            </div>
          ))}
          {loading && <div style={{ textAlign: 'left', color: '#888' }}>লিখছে...</div>}
        </div>

        {/* Input */}
        <div style={{ padding: '15px', background: '#16213e', display: 'flex', gap: '10px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Message..."
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#1a1a2e', color: 'white' }}
          />
          <button onClick={sendMessage} style={{ padding: '12px 20px', background: '#0f3460', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Send
          </button>
        </div>

      </div>
    </div>
  );
}