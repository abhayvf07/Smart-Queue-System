const chatbotService = require('../services/chatbot.service');
const ApiError = require('../utils/ApiError');

/**
 * POST /api/chatbot/message
 * Send a message to the AI queue assistant
 */
const handleChatMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      throw new ApiError(400, 'Message is required.');
    }

    const response = await chatbotService.getChatbotResponse(req.user, message);

    res.status(200).json({
      success: true,
      data: { response },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { handleChatMessage };
