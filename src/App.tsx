import { useState } from 'react';

interface Message {
  role: string;
  content: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

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
          history: messages
        })
      });

      const data = await res.json();
      setMessages([...newHistory, { role: 'assistant', content: data.text }]);
    } catch {
      setMessages([...newHistory, { role: 'assistant', content: 'Error!' }]);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ height: '400px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '10px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <span style={{ background: msg.role === 'user' ? '#007bff' : '#e0e0e0', color: msg.role === 'user' ? 'white' : 'black', padding: '8px 12px', borderRadius: '10px', display: 'inline-block' }}>
              {msg.content}
            </span>
          </div>
        ))}
        {loading && <div>Loading...</div>}
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Message..."
          style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button onClick={sendMessage} style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>
          Send
        </button>
      </div>
    </div>
  );
}