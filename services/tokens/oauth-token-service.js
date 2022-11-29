/*
* Сервис обработки и генерации токенов доступа на основе OAuth2
*/

const config = require("config");
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { address_config } = require('../../config/address.config');
const { google } = require('googleapis');

class TokenServiceOAuth2 {

    // Обновление токена доступа по токену обновления
    refreshAccessToken(refreshToken){
        // Определение объекта для работы с OAuth2
        const OAuth2Client = new google.auth.OAuth2(
            config.get("oauth_client_id"),
            config.get("oauth_secret"),
            config.get("client_url"),
        );

        OAuth2Client.credentials.refresh_token = refreshToken;

        let accessToken = null;
        OAuth2Client.refreshAccessToken((error, tokens) => {
            if(!error){
                accessToken = tokens.access_token;
            }
        });

        return accessToken;
    }

    // Генерация токенов access и refresh
    async generateTokens(code) {
        // Определение OAuth2 для работы с клиентом
        const OAuth2Client = new google.auth.OAuth2(
            config.get("oauth_client_id"),
            config.get("oauth_secret"),
            config.get("client_url"),
        );

        const { tokens } = await OAuth2Client.getToken(code);
        // await OAuth2Client.revokeToken(tokens.access_token);

        return {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token
        };
    }

    // Валидация токена доступа
    async validateAccessToken(token) {
        try {
            let verified_email = false;

            // Проверка полученного токена (обращение к сервисам google для подтверждения авторизации)
            await fetch(address_config.google_sequrity_oauth + token)
                .then(res => res.json())
                .then(json => {
                    verified_email = json.verified_email;
                });

            if (!verified_email) {
                return false;
            }

            let userData = {};

            // Получение данных по выданному токену (пользовательская информация)
            await fetch(address_config.google_user_data + token)
                .then(res => res.json())
                .then(json => {
                    userData = json;
                });

            return userData;
        } catch (e) {
            console.log(e);
            return false;
        }
    }

    async removeTokenByAccessToken(access_token){
        const OAuth2Client = new google.auth.OAuth2(
            config.get("oauth_client_id"),
            config.get("oauth_secret"),
            config.get("client_url"),
        );

        await OAuth2Client.revokeToken(access_token);
    }
}

module.exports = new TokenServiceOAuth2();