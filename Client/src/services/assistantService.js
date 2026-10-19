import api from './api';

const sendMessage = async (message) => {
    const response = await api.post('/assistant/chat', {
        message,
    });

    return response.data;
};

export {
    sendMessage,
};