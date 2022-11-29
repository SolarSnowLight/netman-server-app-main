/*
* Общий сервис для работы с токенами
*/

const config = require("config");
const jwt = require('jsonwebtoken');
const {
    Tokens, AuthTypes, User
} = require('../../sequelize/models');

class TokenService {
    // Асинхронное сохранение пары токенов доступа и обновления
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
            refresh_token: refreshToken,
        });

        return token;
    }

    // Удаление токенов по токену обновления
    async removeTokens(refreshToken) {
        const tokenData = await Tokens.destroy({
            where: {
                refresh_token: refreshToken
            }
        });

        return tokenData;
    }

    // Удаление токенов по пользовательскому ID
    async removeTokenByUserId(userId) {
        const tokenData = await Tokens.destroy({
            where: {
                users_id: userId
            }
        });

        return tokenData;
    }

    // Поиск токенов по refreshToken и userId
    async findToken(refreshToken, userId) {
        const tokenData = await Tokens.findOne({
            where: {
                refresh_token: refreshToken,
                users_id: userId
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

    // Поиск токена по пользовательскому ID и токену доступа
    async findTokenByAccessToken(userId, accessToken){
        const tokenData = await Tokens.findOne({
            where: {
                users_id: userId,
                access_token: accessToken
            }
        });

        return tokenData;
    }

    async findUserByRefreshToken(refreshToken, typeAuth){
        let tokenData = await Tokens.findOne({
            where: {
                refresh_token: refreshToken
            }
        });

        if(tokenData){
            const authData = await AuthTypes.findOne({
                where: {
                    type: typeAuth,
                    users_id: tokenData.users_id
                }
            });

            if(!authData){
                return false;
            }
        }

        const userData = await User.findOne({
            where: {
                id: tokenData.users_id
            }
        });

        return {
            id: userData.id,
            email: userData.email
        };
    }

    async isExistsUser(users_id, access_token, refresh_token, type_auth){
        const tokenData = await Tokens.findOne({
            where: {
                users_id: users_id,
                access_token: access_token,
                refresh_token: refresh_token
            }
        });

        const typeData = await AuthTypes.findOne({
            where: {
                users_id: users_id,
                type: type_auth
            }
        });

        return (tokenData && typeData);
    }
}

module.exports = new TokenService();