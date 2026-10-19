import api from './api';

const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
};

const login = async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
};

const logout = async () => {
    const response = await api.post('/auth/logout');
    return response.data;
};

const forgotPassword = async (email) => {
    const response = await api.post('/auth/forgot-password', {
        email,
    });

    return response.data;
};

const resetPassword = async (data) => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
};

export {
    register,
    login,
    logout,
    forgotPassword,
    resetPassword,
};