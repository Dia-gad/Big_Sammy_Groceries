import api from './api';

const getCategories = async () => {
    const response = await api.get('/categories');
    return response.data;
};

export {
    getCategories,
};