const config = require("config");
const jwt = require('jsonwebtoken');
const {
    Tokens
} = require('../sequelize/models');

class TokenService {
    // Генерация токенов access и refresh
    generateTokens(payload) {
        const access_token = jwt.sign(payload, config.get('jwtSecret'), { expiresIn: '1h' });
        const refresh_token = jwt.sign(payload, config.get('jwt_refresh_secret'), { expiresIn: '30d' });

        return {
            access_token,
            refresh_token
        };
    }

    // Проверка токена access
    validateAccessToken(token) {
        try {
            const userData = jwt.verify(token, config.get('jwtSecret'));
            return userData;
        } catch (e) {
            return null;
        }
    }

    // Проверка токена refresh
    validateRefreshToken(token) {
        try {
            const userData = jwt.verify(token, config.get('jwt_refresh_secret'));
            return userData;
        } catch (e) {
            return null;
        }
    }

    // Асинхронное сохранение токена
    async saveTokens(userId, accessToken, refreshToken) {
        // Поиск токена
        const tokenData = await Tokens.findOne({
            where: {
                users_id: userId,
            }
        });

        // Если данные о токене найдены, то перезаписываем текущие данные
        if (tokenData) {
            tokenData.access_token = accessToken;
            tokenData.refresh_token = refreshToken;
            return await tokenData.save();
        }

        // Создание новой пары токенов для пользователя
        const token = await Tokens.create({
            users_id: userId,
            access_token: accessToken,
            refresh_token: refreshToken
        });

        return token;
    }

    // Удаление токенов по refresh токенам
    async removeTokens(refreshToken) {
        const tokenData = await Tokens.destroy({
            where: {
                refresh_token: refreshToken
            }
        });

        return tokenData;
    }

    // Удаление токенов по userId
    async removeTokenByUserId(userId) {
        const tokenData = await Tokens.destroy({
            where: {
                users_id: userId
            }
        });

        return tokenData;
    }

    // Поиск токенов по refreshToken
    async findToken(refreshToken) {
        const tokenData = await Tokens.findOne({
            where: {
                refresh_token: refreshToken
            }
        });

        return tokenData;
    }

    // Поиск токенов по userId
    async findTokenByUserId(userId) {
        const tokenData = await Tokens.findOne({
            where: {
                users_id: userId
            }
        });

        return tokenData;
    }
}

module.exports = new TokenService();