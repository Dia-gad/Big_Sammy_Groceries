import { useState } from 'react';
import { sendMessage } from '../../services/assistantService';

const quickQuestions = [
    'How do I place an order?',
    'How does delivery work?',
    'How can I pay?',
    'How can I track my order?',
];

const AIAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const [messages, setMessages] = useState([
        {
            id: 1,
            sender: 'assistant',
            text: 'Hi! 👋 I’m the Big Sammy Groceries AI Assistant. How can I help you today?',
        },
    ]);

    const handleSend = async (text = message) => {
        const trimmedMessage = text.trim();

        if (!trimmedMessage || loading) {
            return;
        }

        setMessages((previous) => [
            ...previous,
            {
                id: crypto.randomUUID(),
                sender: 'user',
                text: trimmedMessage,
            },
        ]);

        setMessage('');
        setLoading(true);

        try {
            const result = await sendMessage(trimmedMessage);

            setMessages((previous) => [
                ...previous,
                {
                    id: crypto.randomUUID(),
                    sender: 'assistant',
                    text: result.data.reply,
                },
            ]);
        } catch (error) {
            setMessages((previous) => [
                ...previous,
                {
                    id: crypto.randomUUID(),
                    sender: 'assistant',
                    text:
                        error.response?.data?.message ||
                        'Sorry, I’m unable to respond right now. Please try again later.',
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        handleSend();
    };

    return (
        <>
            {isOpen && (
                <div className="ai-assistant">
                    <div className="ai-assistant-header">
                        <div>
                            <strong>Big Sammy Assistant</strong>
                            <span>AI Customer Support</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close assistant"
                        >
                            ×
                        </button>
                    </div>

                    <div className="ai-assistant-messages">
                        {messages.map((item) => (
                            <div
                                key={item.id}
                                className={`ai-message ${item.sender}`}
                            >
                                {item.text}
                            </div>
                        ))}

                        {messages.length === 1 && (
                            <div className="ai-quick-questions">
                                {quickQuestions.map((question) => (
                                    <button
                                        key={question}
                                        type="button"
                                        onClick={() => handleSend(question)}
                                    >
                                        {question}
                                    </button>
                                ))}
                            </div>
                        )}

                        {loading && (
                            <div className="ai-message assistant">
                                Thinking...
                            </div>
                        )}
                    </div>

                    <form
                        className="ai-assistant-input"
                        onSubmit={handleSubmit}
                    >
                        <input
                            type="text"
                            value={message}
                            onChange={(event) =>
                                setMessage(event.target.value)
                            }
                            placeholder="Ask Big Sammy..."
                            disabled={loading}
                        />

                        <button
                            type="submit"
                            disabled={loading || !message.trim()}
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}

            {!isOpen && (
                <button
                    type="button"
                    className="ai-assistant-launcher"
                    onClick={() => setIsOpen(true)}
                    aria-label="Open Big Sammy AI Assistant"
                >
                    🤖
                </button>
            )}
        </>
    );
};

export default AIAssistant;