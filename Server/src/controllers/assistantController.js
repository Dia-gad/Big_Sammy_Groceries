const {
    chatWithAssistant,
} = require('../services/assistantService');

const chat = async (req, res, next) => {
    try {
        const { message } = req.body;

        const reply = await chatWithAssistant(message);

        return res.status(200).json({
            success: true,
            data: {
                reply,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    chat,
};